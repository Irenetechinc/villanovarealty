import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gavel, AlertCircle, CheckCircle, TrendingUp, History, User } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';

interface BiddingModalProps {
  isOpen: boolean;
  onClose: () => void;
  auction: any;
  bidCount?: number;
}

const BiddingModal = ({ isOpen, onClose, auction }: BiddingModalProps) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [bidAmount, setBidAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [recentBids, setRecentBids] = useState<any[]>([]);
  // Removed unused ref
  
  const [localAuction, setLocalAuction] = useState(auction);

  // Calculate minimum next bid based on the most recent auction data we have
  const currentBid = parseFloat(localAuction.current_bid || localAuction.starting_price || localAuction.starting_bid || 0);
  const minIncrement = parseFloat(localAuction.min_increment || 1000);
  const minBid = currentBid + minIncrement;

  useEffect(() => {
    // Update local state when prop changes
    setLocalAuction(auction);
  }, [auction]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(false);
      fetchRecentBids();

      // Force fetch latest auction data to ensure we have the absolute latest price
      const fetchLatestAuction = async () => {
        const { data } = await supabase
          .from('auctions')
          .select('*')
          .eq('id', auction.id)
          .single();
        if (data) {
            setLocalAuction((prev: any) => ({ ...prev, ...data }));
        }
      };
      
      fetchLatestAuction();
      setBidAmount(minBid.toString());

      // Subscribe to new bids for this auction
      const subscription = supabase
        .channel(`bids-modal-${auction.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'bids',
            filter: `auction_id=eq.${auction.id}`
          },
          (payload) => {
            // 1. Optimistic Update for immediate feedback
            const newBid = payload.new;
            setRecentBids(prev => {
                if (prev.some(b => b.id === newBid.id)) return prev;
                return [newBid, ...prev].slice(0, 10);
            });
            
            if (newBid.amount > (localAuction.current_bid || 0)) {
                setLocalAuction((prev: any) => ({ ...prev, current_bid: newBid.amount }));
            }

            // 2. Trigger Fetch from DB (Source of Truth)
            fetchRecentBids();
            
            supabase
                .from('bids')
                .select('amount')
                .eq('auction_id', auction.id)
                .order('amount', { ascending: false })
                .limit(1)
                .single()
                .then(({ data }) => {
                     if (data && data.amount > (localAuction.current_bid || 0)) {
                         setLocalAuction((prev: any) => ({ ...prev, current_bid: data.amount }));
                     }
                });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [isOpen, auction.id]);

  // Update input when localAuction updates (e.g. from fetch or prop) AND modal is open
  useEffect(() => {
      if (isOpen) {
          setBidAmount((currentBid + minIncrement).toString());
      }
  }, [currentBid, minIncrement, isOpen]);

  // Scroll to top of history when new bid comes in
  useEffect(() => {
     if (recentBids.length > 0) {
        // We actually want the newest at the top, so no scrolling needed usually if it's a list
     }
  }, [recentBids]);

  const fetchRecentBids = async () => {
    const { data } = await supabase
      .from('bids')
      .select('*, user:users(email)') // select user email if possible, or just id
      .eq('auction_id', auction.id)
      .order('amount', { ascending: false })
      .limit(10);
    
    if (data) {
      setRecentBids(data);
    }
  };

  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      // Should not be reachable if UI is correct, but just in case
      navigate('/login');
      return;
    }

    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount < minBid) {
      setError(`Minimum bid amount is ₦${minBid.toLocaleString()}`);
      return;
    }

    setLoading(true);

    try {
      // 1. Insert Bid
      const { error: bidError } = await supabase
        .from('bids')
        .insert([
          {
            auction_id: auction.id,
            user_id: user.id,
            amount: amount
          }
        ]);

      if (bidError) throw bidError;

      // 2. Update Auction Current Bid (Fallback if trigger is missing/delayed)
      // This ensures the UI updates immediately and persistence is guaranteed
      const { error: updateError } = await supabase
        .from('auctions')
        .update({ 
            current_bid: amount,
            updated_at: new Date().toISOString()
        })
        .eq('id', auction.id)
        .lt('current_bid', amount); // Safety check: only update if higher

      if (updateError) {
         console.warn("Failed to update auction price manually:", updateError);
         // We don't throw here because the bid was recorded, but we log it.
      }
      
      setSuccess(true);
      setTimeout(() => {
        // Don't close immediately, let them see the success
        setSuccess(false);
        // Reset bid amount for next bid
        setBidAmount((amount + minIncrement).toString());
      }, 2000);

    } catch (err: any) {
      console.error('Bidding error:', err);
      setError(err.message || 'Failed to place bid');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
        >
          {/* Left Side: Bidding Form */}
          <div className="flex-1 flex flex-col">
            <div className="bg-black text-white p-6 relative flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-primary/20 p-2 rounded-full">
                    <Gavel className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold font-serif">Place Your Bid</h2>
                </div>
                <p className="text-gray-400 text-sm truncate">{auction.property?.title}</p>
              </div>
              
              {/* Close Button (Visible on Mobile) */}
              <button 
                onClick={onClose}
                className="md:hidden text-gray-400 hover:text-white p-1"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
              {!user ? (
                <div className="text-center py-10 h-full flex flex-col justify-center">
                  <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-6" />
                  <h3 className="text-2xl font-bold mb-4">Login Required</h3>
                  <p className="text-gray-600 mb-8 max-w-xs mx-auto">You need to be logged in to participate in this live auction.</p>
                  <div className="flex flex-col gap-3">
                    <button onClick={() => navigate('/login')} className="w-full py-4 rounded-xl bg-primary text-black font-bold text-lg hover:bg-yellow-400 transition-colors">
                      Login to Bid
                    </button>
                    <button onClick={onClose} className="w-full py-4 rounded-xl border border-gray-300 font-medium hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : success ? (
                <div className="text-center py-12 h-full flex flex-col justify-center">
                  <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    className="bg-green-100 p-6 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6"
                  >
                    <CheckCircle className="h-12 w-12 text-green-600" />
                  </motion.div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-2">Bid Placed!</h3>
                  <p className="text-gray-600 text-lg">You are now the highest bidder.</p>
                  <button 
                    onClick={() => setSuccess(false)}
                    className="mt-8 text-primary font-bold hover:underline"
                  >
                    Place another bid
                  </button>
                </div>
              ) : (
                <div className="pb-24"> {/* Added padding bottom to prevent button overlap if we use fixed */}
                    <form onSubmit={handleBid} className="flex flex-col min-h-0">
                    <div className="bg-gray-50 p-6 rounded-2xl mb-8 border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                        <span className="text-gray-500 font-medium">Current Highest Bid</span>
                        <span className="font-bold text-2xl text-gray-900">{formatCurrency(currentBid)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                        <span className="text-gray-500 font-medium">Minimum Increment</span>
                        <span className="text-green-600 font-bold text-sm">+{formatCurrency(minIncrement)}</span>
                        </div>
                    </div>

                    <div className="mb-8">
                        <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Your Bid Amount</label>
                        <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-gray-400 font-bold text-xl">₦</span>
                        </div>
                        <input
                            type="number"
                            required
                            min={minBid}
                            step={minIncrement}
                            value={bidAmount}
                            onChange={(e) => setBidAmount(e.target.value)}
                            className="block w-full pl-10 pr-4 py-5 text-3xl font-bold text-gray-900 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                            placeholder="0.00"
                        />
                        </div>
                        {error && (
                        <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-3 flex items-center text-red-600 font-medium bg-red-50 p-3 rounded-lg"
                        >
                            <AlertCircle className="h-5 w-5 mr-2" />
                            {error}
                        </motion.div>
                        )}
                        <p className="mt-3 text-sm text-gray-500 flex items-center justify-between">
                        <span>Minimum required:</span>
                        <span className="font-bold">{formatCurrency(minBid)}</span>
                        </p>
                    </div>
                    </form>
                </div>
              )}
            </div>

            {/* Sticky Footer for Button */}
            {!success && user && (
                <div className="p-6 border-t border-gray-100 bg-white z-10 sticky bottom-0">
                  <button
                    onClick={(e) => handleBid(e as any)}
                    disabled={loading}
                    className="w-full bg-primary text-black py-5 rounded-2xl font-bold text-xl hover:bg-yellow-400 transition-all shadow-lg hover:shadow-primary/30 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {loading ? (
                      <div className="h-6 w-6 border-3 border-black border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        Place Bid <TrendingUp className="ml-2 h-6 w-6" />
                      </>
                    )}
                  </button>
                </div>
            )}
          </div>

          {/* Right Side: Bid History */}
          <div className="md:w-80 bg-gray-50 border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
              <h3 className="font-bold text-gray-900 flex items-center">
                <History className="h-4 w-4 mr-2 text-primary" /> Bid History
              </h3>
              <button 
                onClick={onClose}
                className="md:hidden text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
              {/* Desktop Close Button is absolutely positioned on the main container or handled by layout, 
                  but since we split into two cols, let's put a close button on top right of the modal container 
                  or just keep it in the header. The header is only on the left side now.
                  Let's add a close button for desktop that floats.
               */}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {recentBids.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <History className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No bids yet. Be the first!</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {recentBids.map((bid, index) => (
                    <motion.div
                      key={bid.id || index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`p-3 rounded-xl border ${index === 0 ? 'bg-white border-green-200 shadow-sm' : 'bg-gray-100 border-transparent text-gray-500'}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`font-bold ${index === 0 ? 'text-green-700' : 'text-gray-700'}`}>
                          {formatCurrency(bid.amount)}
                        </span>
                        <span className="text-xs text-gray-400">{formatTime(bid.created_at)}</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-400">
                        <User className="h-3 w-3 mr-1" />
                        {bid.user_id === user?.id ? 'You' : `Bidder ${bid.user_id?.slice(0, 4)}...`}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Floating Close Button for Desktop */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-black bg-white/50 hover:bg-white rounded-full p-1 transition-colors z-10 hidden md:block"
          >
            <X className="h-6 w-6" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BiddingModal;
