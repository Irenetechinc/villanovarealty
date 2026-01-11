import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Search, Calendar, Clock, MapPin, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const Auctions = () => {
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All'); // All, Upcoming, Active, Completed

  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchAuctions = async () => {
    try {
      const { data, error } = await supabase
        .from('auctions')
        .select(`
          *,
          property:properties (
            id,
            title,
            address,
            specifications,
            property_images (
              image_url,
              is_primary
            )
          )
        `)
        .order('start_time', { ascending: true });
      
      if (error) throw error;

      if (data) {
        // Transform data
        const formattedData = data.map(auction => {
          const prop = auction.property;
          const image = prop?.property_images?.find((img: any) => img.is_primary)?.image_url || prop?.property_images?.[0]?.image_url;
          return {
            ...auction,
            property: {
              ...prop,
              image
            }
          };
        });
        setAuctions(formattedData || []);
      }
    } catch (error) {
      console.error('Error fetching auctions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAuctions = auctions.filter(auction => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      auction.property?.title?.toLowerCase().includes(searchLower) ||
      (typeof auction.property?.address === 'string' ? auction.property.address.toLowerCase().includes(searchLower) : 
       Object.values(auction.property?.address || {}).join(' ').toLowerCase().includes(searchLower));

    const matchesStatus = filterStatus === 'All' || auction.status === filterStatus.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-white min-h-screen pt-20">
      {/* Header */}
      <div className="bg-black text-white py-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-serif font-bold mb-4"
          >
            Luxury <span className="text-primary">Auctions</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-400 text-lg max-w-2xl"
          >
            Bid on exclusive properties in Nigeria's most prestigious locations. Secure your dream home at the best value.
          </motion.p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="relative flex-grow md:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search auctions by property..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-2 md:pb-0">
             {['All', 'Upcoming', 'Active', 'Completed'].map(status => (
               <button
                 key={status}
                 onClick={() => setFilterStatus(status)}
                 className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                   filterStatus === status ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                 }`}
               >
                 {status}
               </button>
             ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-100 rounded-xl h-[450px] animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredAuctions.map((auction, index) => (
              <AuctionCard key={auction.id} auction={auction} index={index} />
            ))}
          </div>
        )}

        {!loading && filteredAuctions.length === 0 && (
          <div className="text-center py-20 bg-gray-50 rounded-2xl">
            <p className="text-gray-500 text-xl font-medium">No auctions found matching your criteria.</p>
            <button 
              onClick={() => { setSearchTerm(''); setFilterStatus('All'); }}
              className="mt-4 text-primary font-bold hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const AuctionCard = ({ auction, index }: { auction: any, index: number }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const isLive = auction.status === 'active';
  
  useEffect(() => {
    const updateTimer = () => {
      const target = new Date(isLive ? auction.end_time : auction.start_time);
      const now = new Date();
      const diff = target.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft(isLive ? 'Ended' : 'Started');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setTimeLeft(`${days}d ${hours}h ${mins}m`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [auction.start_time, auction.end_time, isLive]);

  // Robust currency formatter
  const formatCurrency = (val: any) => {
    if (val === undefined || val === null || val === '') return '₦0';
    const num = parseFloat(val);
    if (isNaN(num)) return '₦0';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Determine prices with fallbacks
  const startPrice = auction.starting_price || auction.starting_bid || auction.price || 0;
  const currentBid = auction.current_bid || startPrice;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="bg-white rounded-xl overflow-hidden shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 group"
    >
      <div className="relative h-64 overflow-hidden">
        <img 
          src={auction.property?.image || 'https://via.placeholder.com/600x400?text=No+Image'} 
          alt={auction.property?.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        />
        <div className="absolute top-4 left-4">
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
            auction.status === 'active' ? 'bg-red-600 text-white animate-pulse' :
            auction.status === 'completed' ? 'bg-gray-800 text-white' :
            'bg-green-600 text-white'
          }`}>
            {auction.status === 'active' ? 'Live Auction' : auction.status}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center text-white space-x-4">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1 text-primary" />
              <span className="text-sm font-medium">
                {auction.status === 'completed' ? 'Ended' : 
                 auction.status === 'active' ? `Ends in: ${timeLeft}` : 
                 `Starts in: ${timeLeft}`}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2 truncate">{auction.property?.title}</h3>
        <div className="flex items-center text-gray-500 text-sm mb-4">
          <MapPin className="h-4 w-4 mr-1" />
          {typeof auction.property?.address === 'object' ? `${auction.property.address.city}, ${auction.property.address.state}` : auction.property?.address}
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Starting Price</p>
            <p className="font-semibold text-gray-900">{formatCurrency(startPrice)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Current Bid</p>
            <p className="font-bold text-primary text-lg">{formatCurrency(currentBid)}</p>
          </div>
        </div>

        <div className="flex justify-between items-center border-t border-gray-100 pt-4">
          <div className="text-sm text-gray-500">
            <Calendar className="inline h-4 w-4 mr-1" />
            {new Date(auction.start_time).toLocaleDateString()}
          </div>
          <Link 
            to={`/auctions/${auction.id}`} 
            className="inline-flex items-center text-black font-bold hover:text-primary transition-colors"
          >
            View Details <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default Auctions;
