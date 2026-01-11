import { Link } from 'react-router-dom';
import { MapPin, Bed, Bath, Square, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface Property {
  id: string;
  title: string;
  price: number;
  address: {
    city: string;
    state: string;
  };
  specifications: {
    bedrooms: number;
    bathrooms: number;
    sqft: number;
  };
  property_images: { image_url: string }[];
}

const PropertyCard = ({ property, index = 0 }: { property: Property; index?: number }) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const mainImage = property.property_images?.[0]?.image_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group border border-gray-100"
    >
      <div className="relative h-64 overflow-hidden">
        <img 
          src={mainImage} 
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
        />
        <div className="absolute top-4 right-4 bg-primary text-black px-4 py-1.5 rounded-full text-sm font-bold shadow-md">
          {formatPrice(property.price)}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2 truncate font-serif">{property.title}</h3>
        
        <div className="flex items-center text-gray-500 mb-4">
          <MapPin className="h-4 w-4 mr-1 text-primary" />
          <span className="text-sm truncate">
            {property.address.city}, {property.address.state}
          </span>
        </div>
        
        <div className="flex items-center justify-between text-gray-600 text-sm border-t border-gray-100 pt-4 mb-4">
          <div className="flex items-center">
            <Bed className="h-4 w-4 mr-1 text-primary" />
            <span>{property.specifications.bedrooms} Beds</span>
          </div>
          <div className="flex items-center">
            <Bath className="h-4 w-4 mr-1 text-primary" />
            <span>{property.specifications.bathrooms} Baths</span>
          </div>
          <div className="flex items-center">
            <Square className="h-4 w-4 mr-1 text-primary" />
            <span>{property.specifications.sqft} sqft</span>
          </div>
        </div>

        <Link 
          to={`/properties/${property.id}`}
          className="block w-full"
        >
          <button className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-primary hover:text-black transition-colors duration-300 flex items-center justify-center group-hover:gap-2">
            View Property
            <ArrowRight className="h-4 w-4 opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
          </button>
        </Link>
      </div>
    </motion.div>
  );
};

export default PropertyCard;
