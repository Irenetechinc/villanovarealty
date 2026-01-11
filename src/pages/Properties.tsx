import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import PropertyCard from '@/components/PropertyCard';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';

const Properties = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    type: 'All',
    minPrice: '',
    maxPrice: '',
  });

  useEffect(() => {
    // Check for query params
    const params = new URLSearchParams(location.search);
    const locationParam = params.get('location');
    if (locationParam) {
      setSearchTerm(locationParam);
    }
  }, [location.search]);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          property_images (
            image_url,
            is_primary
          )
        `);
      
      if (error) throw error;

      if (data) {
        // Transform data to ensure image_url is accessible easily for the card
        const formattedData = data.map(prop => ({
          ...prop,
          image: prop.property_images?.find((img: any) => img.is_primary)?.image_url || prop.property_images?.[0]?.image_url
        }));
        setProperties(formattedData || []);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProperties = properties.filter(property => {
    // Search Filter (Title, Description, or Address/Location)
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      property.title.toLowerCase().includes(searchLower) ||
      property.description.toLowerCase().includes(searchLower) ||
      (typeof property.address === 'string' ? property.address.toLowerCase().includes(searchLower) : 
       Object.values(property.address).join(' ').toLowerCase().includes(searchLower));

    // Type Filter
    const matchesType = filters.type === 'All' || property.type === filters.type.toLowerCase();

    return matchesSearch && matchesType;
  });

  return (
    <div className="bg-white min-h-screen pt-20">
      {/* Header */}
      <div className="bg-black text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-serif font-bold mb-4"
          >
            Available <span className="text-primary">Properties</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-400 text-lg max-w-2xl"
          >
            Discover our curated selection of luxury homes, apartments, and investment opportunities in Nigeria's prime locations.
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
              placeholder="Search properties by location, title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-2 md:pb-0">
             {['All', 'House', 'Apartment', 'Condo', 'Commercial'].map(type => (
               <button
                 key={type}
                 onClick={() => setFilters({...filters, type})}
                 className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                   filters.type === type ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                 }`}
               >
                 {type}
               </button>
             ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-gray-100 rounded-xl h-[450px] animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProperties.map((property, index) => (
              <PropertyCard key={property.id} property={property} index={index} />
            ))}
          </div>
        )}

        {!loading && filteredProperties.length === 0 && (
          <div className="text-center py-20 bg-gray-50 rounded-2xl">
            <p className="text-gray-500 text-xl font-medium">No properties found matching your criteria.</p>
            <button 
              onClick={() => { setSearchTerm(''); setFilters({ ...filters, type: 'All' }); }}
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

export default Properties;
