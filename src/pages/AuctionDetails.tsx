import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuthStore } from '@/store/useAuthStore';
import { 
  MapPin, Building, Ruler, Bed, Bath, 
  AlertCircle, CheckCircle, TrendingUp, 
  History, User, Gavel
} from 'lucide-react';

const AuctionDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, 200]);

  const [auction, setAuction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bids, setBids] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState('');
  
  // Bidding State
  const [bidAmount, setBidAmount] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Gallery State
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  useEffect(() => {
    if (id) {
      console.log('Mounting AuctionDetails for ID:', id);
      fetchAuctionDetails();
      const channel = setupRealtimeSubscription();
      return () => {
        if (channel) supabase.removeChannel(channel);
      };
    } else {
        setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (auction) {
      const timer = setInterval(updateTimer, 1000);
      updateTimer();
      return () => clearInterval(timer);
    }
  }, [auction]);

  // Auto-fill bid amount when auction updates
  useEffect(() => {
    if (auction) {
      const startPrice = parseFloat(auction.starting_price || auction.starting_bid || auction.price || '0');
      const current = parseFloat(auction.current_bid || startPrice);
      const increment = parseFloat(auction.min_increment || '1000');
      if (!isNaN(current) && !isNaN(increment)) {
          setBidAmount((current + increment).toString());
      }
    }
  }, [auction?.current_bid, auction?.starting_price, auction?.starting_bid, auction?.price]);

  const fetchAuctionDetails = async () => {
    try {
      console.log('Fetching auction details...');
      // 1. Fetch Auction + Property
      // Ensure we select property correctly. Using 'property:properties' assumes the relationship is named 'properties' or foreign key matches.
      const { data: auctionData, error } = await supabase
        .from('auctions')
        .select(`
          *,
          property:properties (
            *,
            property_images (*)
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
          console.error('Supabase error fetching auction:', error);
          throw error;
      }
      
      if (!auctionData) {
          console.error('No auction data returned');
          setAuction(null);
      } else {
          console.log('Auction data fetched:', auctionData);
          setAuction(auctionData);
          // 2. Fetch Bids History only if auction exists
          fetchBids();
      }

    } catch (error) {
      console.error('Error fetching auction:', error);
      // Don't navigate away immediately, let the user see the error state
    } finally {
      setLoading(false);
    }
  };

  const fetchBids = async () => {
    try {
        const { data, error } = await supabase
        .from('bids')
        .select('*, user:users(email)')
        .eq('auction_id', id)
        .order('amount', { ascending: false })
        .limit(20);
        
        if (error) console.error('Error fetching bids:', error);
        if (data) setBids(data);
    } catch (err) {
        console.error('Exception fetching bids:', err);
    }
  };

  const setupRealtimeSubscription = () => {
    // Subscribe to BIDS (INSERT)
    const channel = supabase
      .channel(`auction-details-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids',
          filter: `auction_id=eq.${id}`
        },
        (payload) => {
          console.log('Realtime bid received:', payload);
          // Optimistic update for history
          const newBid = payload.new;
          
          // Trigger a full fetch to get user details and ensure consistency
          fetchBids();

          // Update price if higher
          setAuction((prev: any) => {
             if (!prev) return prev;
             if (newBid.amount > prev.current_bid) {
                return { ...prev, current_bid: newBid.amount };
             }
             return prev;
          });
        }
      )
      .subscribe();
      
    return channel;
  };

  const updateTimer = () => {
    if (!auction) return;
    
    try {
        const isLive = auction.status === 'active';
        const dateStr = isLive ? auction.end_time : auction.start_time;
        if (!dateStr) {
            setTimeLeft('Invalid Date');
            return;
        }
        
        const target = new Date(dateStr);
        if (isNaN(target.getTime())) {
            setTimeLeft('Invalid Date');
            return;
        }

        const now = new Date();
        const diff = target.getTime() - now.getTime();

        if (diff <= 0) {
        setTimeLeft(isLive ? 'Auction Ended' : 'Auction Started');
        return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeLeft(`${days}d ${hours}h ${mins}m ${secs}s`);
    } catch (e) {
        console.error('Timer error:', e);
        setTimeLeft('Error');
    }
  };

  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setBidError(null);

    if (!user) {
      navigate('/login', { state: { from: `/auctions/${id}` } });
      return;
    }

    if (!auction) return;

    const amount = parseFloat(bidAmount);
    const startPrice = parseFloat(auction.starting_price || auction.starting_bid || auction.price || '0');
    const currentPrice = parseFloat(auction.current_bid || startPrice);
    const minIncrement = parseFloat(auction.min_increment || '1000');
    
    if (isNaN(amount) || amount < currentPrice + minIncrement) {
      setBidError(`Minimum bid is ₦${(currentPrice + minIncrement).toLocaleString()}`);
      return;
    }

    setBidLoading(true);

    try {
      // 1. Insert Bid
      const { error } = await supabase.from('bids').insert([{
        auction_id: id,
        user_id: user.id,
        amount: amount
      }]);

      if (error) throw error;

      // 2. Update Auction Current Price (Persistence)
      const { error: updateError } = await supabase
        .from('auctions')
        .update({ current_bid: amount })
        .eq('id', id)
        .lt('current_bid', amount); // Safety: only update if new bid is higher (concurrency check)

      if (updateError) console.error('Error updating auction price persistence:', updateError);

      setBidSuccess(true);
      setTimeout(() => setBidSuccess(false), 3000);
      
      // Update local state immediately for better UX
      setAuction((prev: any) => ({ ...prev, current_bid: amount }));
      // Fetch bids to sync
      fetchBids();
      
    } catch (err: any) {
      setBidError(err.message);
    } finally {
      setBidLoading(false);
    }
  };

  // Safe Render Helpers
  const formatCurrency = (val: any) => {
      if (val === undefined || val === null || val === '') return '0';
      const num = parseFloat(val);
      return isNaN(num) ? '0' : num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.5 }
    }
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6 }
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-black text-white">Loading Auction Details...</div>;
  
  // Return empty div only while redirecting, or a nicer 404
  if (!auction) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-gray-50 text-center px-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Auction Not Found</h2>
            <p className="text-gray-600 mb-4">The auction you are looking for does not exist or has been removed.</p>
            <p className="text-xs text-gray-400 mb-8">ID: {id}</p>
            <button onClick={() => navigate('/auctions')} className="px-6 py-2 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-colors">
                Back to Auctions
            </button>
        </div>
      );
  }

  // Defensive Property Access
  const property = auction.property || {};
  const images = property.property_images?.map((img: any) => img.image_url) || [];
  const activeImage = images[activeImageIndex] || 'https://via.placeholder.com/1200x600?text=No+Image';
  const specifications = property.specifications || {};
  const address = property.address || {};
  
  // Robust Price Calculation
  const startPrice = auction.starting_price || auction.starting_bid || auction.price || 0;
  const currentPrice = auction.current_bid || startPrice;

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* 1. Immersive Hero Section with Parallax */}
      <div className="relative h-[85vh] overflow-hidden bg-black">
        <motion.div style={{ y: heroY }} className="absolute inset-0 opacity-80">
          <img src={activeImage} alt="Hero" className="w-full h-full object-cover" />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16 pb-32 max-w-7xl mx-auto z-10">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false }}
            variants={fadeInUp}
            className="max-w-3xl"
          >
            <div className="flex items-center gap-3 mb-6">
               <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg ${
                  auction.status === 'active' ? 'bg-red-600 text-white animate-pulse' : 'bg-green-600 text-white'
                }`}>
                  {auction.status === 'active' ? 'Live Auction' : auction.status}
                </span>
                <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                  ID: {auction.id?.slice(0,8)}
                </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-serif font-bold text-white mb-4 leading-tight shadow-sm">
              {property.title || 'Untitled Property'}
            </h1>
            <p className="text-2xl text-gray-200 flex items-center font-light">
              <MapPin className="h-6 w-6 mr-3 text-primary" />
              {address.city || 'Unknown City'}, {address.state || 'Unknown State'}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-20">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* LEFT COLUMN: Details */}
          <div className="lg:w-2/3 space-y-12">
            
            {/* Overview Stats - Floating Card */}
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false }}
              variants={fadeInUp}
              className="bg-white p-6 md:p-10 rounded-3xl shadow-2xl border border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-8"
            >
              <div className="text-center p-4 bg-gray-50 rounded-2xl hover:bg-primary/5 transition-colors group">
                <Bed className="h-8 w-8 mx-auto mb-3 text-gray-400 group-hover:text-primary transition-colors" />
                <div className="font-bold text-2xl text-gray-900">{specifications.bedrooms || '-'}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Bedrooms</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-2xl hover:bg-primary/5 transition-colors group">
                <Bath className="h-8 w-8 mx-auto mb-3 text-gray-400 group-hover:text-primary transition-colors" />
                <div className="font-bold text-2xl text-gray-900">{specifications.bathrooms || '-'}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Bathrooms</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-2xl hover:bg-primary/5 transition-colors group">
                <Ruler className="h-8 w-8 mx-auto mb-3 text-gray-400 group-hover:text-primary transition-colors" />
                <div className="font-bold text-2xl text-gray-900">{specifications.sqft || '-'}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Sq Ft</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-2xl hover:bg-primary/5 transition-colors group">
                <Building className="h-8 w-8 mx-auto mb-3 text-gray-400 group-hover:text-primary transition-colors" />
                <div className="font-bold text-2xl text-gray-900 capitalize truncate">{property.type || 'Property'}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Type</div>
              </div>
            </motion.div>

            {/* Description */}
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false }}
              variants={fadeInUp}
              className="prose prose-lg max-w-none"
            >
              <h2 className="text-3xl font-bold font-serif mb-6 text-gray-900">The Experience</h2>
              <p className="text-gray-600 leading-loose text-lg whitespace-pre-line">
                {property.description || 'No description available.'}
              </p>
            </motion.div>

             {/* Strategic Visual Journey */}
             {images.length > 0 && (
                 <div className="space-y-16 py-8">
                    {images.slice(0, 3).map((img: string, index: number) => (
                      <motion.div 
                        key={index}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: false }}
                        variants={fadeInUp}
                        className={`flex flex-col ${index % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'} gap-8 items-center`}
                      >
                        <div className="flex-1 w-full h-[400px] rounded-3xl overflow-hidden shadow-2xl group cursor-pointer" onClick={() => { setActiveImageIndex(index); setIsGalleryOpen(true); }}>
                          <img src={img} alt={`Detail ${index}`} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
                        </div>
                        <div className="flex-1 space-y-4">
                           <h3 className="text-2xl font-serif font-bold text-gray-900">
                             {index === 0 ? "Exquisite Interiors" : index === 1 ? "Serene Surroundings" : "Modern Amenities"}
                           </h3>
                           <p className="text-gray-600 leading-relaxed">
                             {index === 0 
                               ? "Step into a world of refined elegance where every detail has been meticulously crafted to offer the ultimate in luxury living. High ceilings, premium finishes, and an abundance of natural light create an atmosphere of grandeur."
                               : index === 1
                               ? "Enjoy peace and tranquility in a secure, exclusive neighborhood. The property features lush landscaping and private outdoor spaces perfect for relaxation or entertaining guests in style."
                               : "Equipped with state-of-the-art facilities designed for comfort and convenience. From the gourmet kitchen to the spa-like bathrooms, every aspect of this home is designed to elevate your daily life."
                             }
                           </p>
                           <button onClick={() => { setActiveImageIndex(index); setIsGalleryOpen(true); }} className="text-primary font-bold uppercase tracking-widest text-sm hover:text-black transition-colors">
                             View Full Image
                           </button>
                        </div>
                      </motion.div>
                    ))}
                 </div>
             )}

             {/* Full Gallery Button */}
             <div className="bg-black text-white p-12 rounded-3xl text-center relative overflow-hidden group cursor-pointer" onClick={() => setIsGalleryOpen(true)}>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                <div className="relative z-10">
                   <h3 className="text-3xl font-serif font-bold mb-4">View All Photos</h3>
                   <p className="text-gray-400 mb-8 max-w-lg mx-auto">Explore every corner of this magnificent property. From the grand entrance to the private suites, see what makes this home truly special.</p>
                   <span className="inline-block px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-primary transition-colors">
                     Open Gallery ({images.length} Images)
                   </span>
                </div>
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
             </div>

             {/* Features List */}
             <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false }}
              variants={containerVariants}
              className="bg-gray-50 p-10 rounded-3xl"
            >
              <h2 className="text-2xl font-bold font-serif mb-8 text-gray-900">Premium Amenities</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Check if amenities exist in property.features or similar, using mock for now as requested */}
                 {['24/7 Power Supply', 'Swimming Pool', 'Fitness Center', 'Security System', 'Smart Home Technology', 'Ample Parking', 'Gourmet Kitchen', 'Private Garden'].map((feat, i) => (
                   <motion.div 
                     key={i} 
                     variants={itemVariants}
                     className="flex items-center text-gray-700 bg-white p-4 rounded-xl shadow-sm"
                   >
                     <div className="bg-green-100 p-2 rounded-full mr-4">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                     </div>
                     <span className="font-medium">{feat}</span>
                   </motion.div>
                 ))}
              </div>
            </motion.div>

          </div>

          {/* RIGHT COLUMN: Bidding Interface (Sticky) */}
          <div className="lg:w-1/3 relative z-30">
            <div className="sticky top-24 space-y-6">
              
              {/* Timer Card */}
              <motion.div 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false }}
                variants={fadeInUp}
                className="bg-black text-white p-6 rounded-3xl shadow-2xl relative overflow-hidden border border-gray-800"
              >
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                 <div className="relative z-10 text-center">
                    <p className="text-primary text-sm font-bold uppercase tracking-widest mb-2">
                      {auction.status === 'active' ? 'Time Remaining' : 'Auction Starts In'}
                    </p>
                    <div className="text-5xl font-mono font-bold mb-4 tracking-tight">
                      {timeLeft}
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 border-t border-gray-800 pt-4">
                      <span>Start: {new Date(auction.start_time || Date.now()).toLocaleDateString()}</span>
                      <span>End: {new Date(auction.end_time || Date.now()).toLocaleDateString()}</span>
                    </div>
                 </div>
              </motion.div>

              {/* Bidding Form Card */}
              <motion.div 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false }}
                variants={fadeInUp}
                className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100"
              >
                <div className="mb-8 text-center">
                  <p className="text-xs text-gray-500 uppercase font-bold mb-2 tracking-wide">Current Highest Bid</p>
                  <div className="text-5xl font-bold text-primary flex items-center justify-center">
                    ₦{formatCurrency(currentPrice)}
                  </div>
                  {parseFloat(auction.current_bid) > parseFloat(startPrice) && (
                     <div className="flex items-center justify-center text-green-600 text-sm font-bold mt-2">
                        <TrendingUp className="mr-1 h-4 w-4" /> Price is rising
                     </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Starting Price: ₦{formatCurrency(startPrice)}
                  </p>
                </div>

                {user ? (
                  auction.status === 'active' ? (
                    <form onSubmit={handleBid} className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Place Your Bid</label>
                        <div className="relative group">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold group-focus-within:text-primary transition-colors">₦</span>
                          <input 
                            type="number" 
                            value={bidAmount}
                            onChange={(e) => setBidAmount(e.target.value)}
                            className="w-full pl-10 pr-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-primary focus:ring-0 text-lg font-bold transition-all outline-none"
                            placeholder="Amount"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-2 flex justify-between">
                          <span>Min increment:</span>
                          <span className="font-bold">₦{formatCurrency(auction.min_increment || 1000)}</span>
                        </p>
                      </div>

                      {bidError && (
                        <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl flex items-center animate-shake">
                          <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" /> {bidError}
                        </div>
                      )}

                      {bidSuccess && (
                        <div className="p-4 bg-green-50 text-green-600 text-sm rounded-xl flex items-center animate-bounce-short">
                          <CheckCircle className="h-5 w-5 mr-3 flex-shrink-0" /> Bid placed successfully!
                        </div>
                      )}

                      <button 
                        type="submit" 
                        disabled={bidLoading}
                        className="w-full py-5 bg-primary text-black font-bold text-xl rounded-xl hover:bg-yellow-400 transition-all shadow-lg hover:shadow-primary/30 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-1"
                      >
                        {bidLoading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div> : 'Place Bid Now'}
                      </button>
                    </form>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                       <Gavel className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                       <p className="text-gray-500 font-medium">Bidding is currently closed</p>
                       <p className="text-xs text-gray-400 mt-1">Wait for the auction to start</p>
                    </div>
                  )
                ) : (
                   <div className="text-center py-8 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-gray-600 mb-6 font-medium">Please login to participate in this exclusive auction.</p>
                      <button 
                        onClick={() => navigate('/login', { state: { from: `/auctions/${id}` } })}
                        className="w-full px-6 py-4 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg"
                      >
                        Login to Bid
                      </button>
                   </div>
                )}
              </motion.div>

              {/* Bid History Card */}
              <motion.div 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false }}
                variants={fadeInUp}
                className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 max-h-[500px] flex flex-col"
              >
                <h3 className="font-bold text-gray-900 mb-6 flex items-center text-lg">
                  <History className="h-5 w-5 mr-2 text-primary" /> Live Bid History
                </h3>
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  <AnimatePresence initial={false}>
                    {bids.map((bid, index) => (
                      <motion.div
                        key={bid.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`p-4 rounded-2xl border flex justify-between items-center ${index === 0 ? 'bg-green-50 border-green-200 shadow-sm' : 'bg-gray-50 border-transparent'}`}
                      >
                         <div>
                            <div className={`font-bold text-lg ${index === 0 ? 'text-green-700' : 'text-gray-900'}`}>
                              ₦{formatCurrency(bid.amount)}
                            </div>
                            <div className="flex items-center text-xs text-gray-500 mt-1">
                                <User className="h-3 w-3 mr-1" />
                                {bid.user_id === user?.id ? 'You' : `Bidder ${bid.user_id?.slice(0,4)}...`}
                            </div>
                         </div>
                         <div className="text-xs text-gray-400 font-mono bg-white px-2 py-1 rounded-md border border-gray-100">
                           {new Date(bid.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                         </div>
                      </motion.div>
                    ))}
                    {bids.length === 0 && (
                      <div className="text-center py-12 text-gray-400">
                        <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                           <Gavel className="h-8 w-8 opacity-20" />
                        </div>
                        <p>No bids yet.</p>
                        <p className="text-sm">Be the first to place a bid!</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Gallery Modal */}
      <AnimatePresence>
        {isGalleryOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[100] flex flex-col"
          >
             <div className="flex justify-between items-center p-6 text-white z-10">
                <span className="text-sm font-bold uppercase tracking-widest">{activeImageIndex + 1} / {images.length}</span>
                <button onClick={() => setIsGalleryOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <span className="sr-only">Close</span>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>
             
             <div className="flex-1 relative flex items-center justify-center p-4">
                <AnimatePresence mode='wait'>
                  <motion.img 
                    key={activeImageIndex}
                    src={images[activeImageIndex]} 
                    alt="Gallery Full" 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                  />
                </AnimatePresence>
                
                <button 
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-colors"
                  onClick={(e) => { e.stopPropagation(); setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1)); }}
                >
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button 
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-colors"
                  onClick={(e) => { e.stopPropagation(); setActiveImageIndex((prev) => (prev + 1) % images.length); }}
                >
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
             </div>

             <div className="p-6 overflow-x-auto flex gap-4 justify-center">
                {images.map((img: string, idx: number) => (
                  <button 
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`h-16 w-24 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${activeImageIndex === idx ? 'border-primary opacity-100' : 'border-transparent opacity-50 hover:opacity-100'}`}
                  >
                    <img src={img} className="w-full h-full object-cover" />
                  </button>
                ))}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default AuctionDetails;
