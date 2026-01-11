import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, MapPin, ArrowRight, Users, Zap, CheckCircle, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/useAuthStore';

interface HomeAuctionCardProps {
  auction: any;
  index: number;
}

const HomeAuctionCard = ({ auction: initialAuction, index }: HomeAuctionCardProps) => {
  const [auction, setAuction] = useState(initialAuction);
  const [timeLeft, setTimeLeft] = useState('');
  const [isLive, setIsLive] = useState(initialAuction.status === 'active');
  const [bidCount, setBidCount] = useState(0);
  const [lastBidTime, setLastBidTime] = useState<Date | null>(null);
  
  // Inline Bidding State
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [bidAmount, setBidAmount] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [bidStatus, setBidStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Initial setup and subscription
  useEffect(() => {
    setAuction(initialAuction);
    setIsLive(initialAuction.status === 'active');
    fetchBidCount();

    // Subscribe to Auction Updates
    const auctionSubscription = supabase
      .channel(`auction-${initialAuction.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions',
          filter: `id=eq.${initialAuction.id}`
        },
        (payload) => {
          setAuction((prev: any) => ({ ...prev, ...payload.new }));
          setIsLive(payload.new.status === 'active');
          // If bid increased, update visual feedback
          if (payload.new.current_bid > (auction.current_bid || 0)) {
            setLastBidTime(new Date());
          }
        }
      )
      .subscribe();

    // Subscribe to Bids (for count)
    const bidsSubscription = supabase
      .channel(`bids-${initialAuction.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids',
          filter: `auction_id=eq.${initialAuction.id}`
        },
        (payload) => {
            // 1. Optimistic Update
            setBidCount(prev => prev + 1);
            setLastBidTime(new Date());
            
            if (payload.new.amount > (auction.current_bid || 0)) {
                setAuction((prev: any) => ({ ...prev, current_bid: payload.new.amount }));
            }

            // 2. Trigger Fetch for Accuracy (as requested)
            fetchBidCount();
            
            // Fetch exact latest price from DB to ensure consistency
            supabase
                .from('bids')
                .select('amount')
                .eq('auction_id', initialAuction.id)
                .order('amount', { ascending: false })
                .limit(1)
                .single()
                .then(({ data }) => {
                    if (data && data.amount > (auction.current_bid || 0)) {
                        setAuction((prev: any) => ({ ...prev, current_bid: data.amount }));
                    }
                });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(auctionSubscription);
      supabase.removeChannel(bidsSubscription);
    };
  }, [initialAuction.id]);

  // Update Bid Amount Suggestion when price changes
  useEffect(() => {
    if (auction && isLive) {
      const startPrice = parseFloat(auction.starting_price || auction.starting_bid || auction.price || '0');
      const current = parseFloat(auction.current_bid || startPrice);
      const increment = parseFloat(auction.min_increment || '1000');
      if (!isNaN(current) && !isNaN(increment)) {
          setBidAmount((current + increment).toString());
      }
    }
  }, [auction, isLive]);

  const fetchBidCount = async () => {
    const { count } = await supabase
      .from('bids')
      .select('*', { count: 'exact', head: true })
      .eq('auction_id', initialAuction.id);
    setBidCount(count || 0);
  };

  // Timer Logic
  useEffect(() => {
    const updateTimer = () => {
      const target = new Date(isLive ? auction.end_time : auction.start_time);
      const now = new Date();
      const diff = target.getTime() - now.getTime();
      
      if (diff <= 0) {
        if (!isLive && auction.status === 'upcoming') {
           // Transition to active logic should ideally happen via DB/Backend, 
           // but for UI we can check if we passed start time
           // setIsLive(true); // Let realtime update handle status change source of truth
           setTimeLeft('Starting...');
        } else {
           setTimeLeft(isLive ? 'Ended' : 'Started');
        }
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${mins}m`);
      } else {
        setTimeLeft(`${hours}h ${mins}m ${secs}s`);
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [auction.start_time, auction.end_time, isLive, auction.status]);

  const formatCurrency = (val: any) => {
    const num = parseFloat(val);
    if (isNaN(num)) return '₦0';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const handleInlineBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setBidStatus('idle');

    if (!user) {
        // Redirect to login but remember to return here
        navigate('/login', { state: { from: '/' } });
        return;
    }

    const amount = parseFloat(bidAmount);
    const startPrice = parseFloat(auction.starting_price || auction.starting_bid || auction.price || '0');
    const currentPrice = parseFloat(auction.current_bid || startPrice);
    const minIncrement = parseFloat(auction.min_increment || '1000');

    if (isNaN(amount) || amount < currentPrice + minIncrement) {
        setBidStatus('error');
        // Reset error status after a bit
        setTimeout(() => setBidStatus('idle'), 2000);
        return;
    }

    setBidLoading(true);

    try {
        // 1. Insert Bid
        const { error } = await supabase.from('bids').insert([{
            auction_id: auction.id,
            user_id: user.id,
            amount: amount
        }]);

        if (error) throw error;

        // 2. Update Auction Current Price (Persistence)
        await supabase
            .from('auctions')
            .update({ current_bid: amount })
            .eq('id', auction.id)
            .lt('current_bid', amount);

        setBidStatus('success');
        setBidAmount(''); // Clear or reset to next increment handled by effect
        setTimeout(() => setBidStatus('idle'), 3000);

    } catch (error) {
        console.error('Bid error:', error);
        setBidStatus('error');
        setTimeout(() => setBidStatus('idle'), 3000);
    } finally {
        setBidLoading(false);
    }
  };

  // Visual feedback for bid update
  const isBidUpdated = lastBidTime && (new Date().getTime() - lastBidTime.getTime() < 2000);

  // Price Calculation
  const startPrice = parseFloat(auction.starting_price || auction.starting_bid || auction.price || '0');
  const currentPrice = parseFloat(auction.current_bid || startPrice);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false }}
        transition={{ delay: index * 0.1 }}
        className={`bg-gray-800 rounded-xl overflow-hidden shadow-lg border transition-all duration-300 group ${
          isBidUpdated ? 'border-green-500 ring-2 ring-green-500/50' : 'border-gray-700 hover:border-primary'
        }`}
      >
        <div className="relative h-56 overflow-hidden">
          <img 
            src={auction.property?.image || 'https://via.placeholder.com/600x400?text=No+Image'} 
            alt={auction.property?.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-100"
          />
          <div className="absolute top-4 left-4 flex gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-md flex items-center ${
              isLive ? 'bg-red-600 text-white animate-pulse' : 'bg-green-600 text-white'
            }`}>
              {isLive ? <><Zap className="w-3 h-3 mr-1 fill-current" /> Live</> : 'Upcoming'}
            </span>
            <span className="bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex items-center">
               <Users className="w-3 h-3 mr-1" /> {bidCount} Bids
            </span>
          </div>
          
          {/* Timer Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4">
             <div className="flex items-center text-white">
                <Clock className={`h-4 w-4 mr-2 ${isLive ? 'text-red-500' : 'text-primary'}`} />
                <span className="font-mono font-bold text-lg tracking-wider">
                  {timeLeft}
                </span>
                <span className="text-xs text-gray-300 ml-2 uppercase">
                  {isLive ? 'Remaining' : 'Until Start'}
                </span>
             </div>
          </div>
        </div>
        
        <div className="p-6 relative">
           {/* Bid Updated Flash Effect */}
           {isBidUpdated && (
             <div className="absolute inset-0 bg-green-500/10 pointer-events-none z-0 animate-pulse" />
           )}

          <h4 className="text-xl font-bold text-white mb-2 truncate relative z-10">{auction.property?.title}</h4>
          <p className="text-gray-400 text-sm mb-6 flex items-center relative z-10">
            <MapPin className="h-3 w-3 mr-1" />
            {typeof auction.property?.address === 'object' ? auction.property.address.city : 'Unknown Location'}
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
            <div className="bg-gray-700/50 p-3 rounded-lg">
              <p className="text-xs text-gray-400 uppercase mb-1">Current Bid</p>
              <p className={`font-bold text-lg ${isBidUpdated ? 'text-green-400 scale-110 transition-transform' : 'text-white'}`}>
                 {formatCurrency(currentPrice)}
              </p>
            </div>
            <div className="text-right p-3">
               <p className="text-xs text-gray-400 uppercase mb-1">Starting Price</p>
               <p className="font-medium text-gray-300">
                  {formatCurrency(startPrice)}
               </p>
            </div>
          </div>

          <div className="flex gap-3 relative z-10 items-stretch">
            {isLive ? (
              <form onSubmit={handleInlineBid} className="flex-1 flex gap-2">
                 <div className="relative flex-grow">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₦</span>
                    <input 
                      type="number" 
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      className={`w-full pl-7 pr-2 py-3 bg-gray-900 border rounded-lg text-white text-sm font-bold focus:ring-1 focus:ring-primary outline-none transition-colors ${bidStatus === 'error' ? 'border-red-500' : 'border-gray-600 focus:border-primary'}`}
                      placeholder="Amount"
                    />
                 </div>
                 <button 
                   type="submit"
                   disabled={bidLoading || bidStatus === 'success'}
                   className={`px-4 py-2 font-bold rounded-lg transition-all shadow-lg flex items-center justify-center whitespace-nowrap ${
                      bidStatus === 'success' ? 'bg-green-600 text-white' :
                      bidStatus === 'error' ? 'bg-red-600 text-white' :
                      'bg-primary text-black hover:bg-yellow-400 hover:shadow-primary/20'
                   }`}
                 >
                   {bidLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div> : 
                    bidStatus === 'success' ? <CheckCircle className="h-5 w-5" /> :
                    bidStatus === 'error' ? <AlertCircle className="h-5 w-5" /> :
                    'Bid'}
                 </button>
              </form>
            ) : (
               <Link 
                to={`/auctions/${auction.id}`}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg transition-colors text-center"
              >
                View Details
              </Link>
            )}
            
            <Link 
              to={`/auctions/${auction.id}`}
              className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center"
              title="View Details"
            >
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default HomeAuctionCard;