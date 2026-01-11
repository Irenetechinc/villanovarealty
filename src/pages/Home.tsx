import { useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { ArrowRight, Star, MapPin, Building, Users, Shield, Award, Calendar, Gavel } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import HomeAuctionCard from '@/components/HomeAuctionCard';

// Mock data for Testimonials (Static content is fine here)
const TESTIMONIALS = [
  {
    name: "Sarah Johnson",
    role: "Property Investor",
    content: "Villanova Realty transformed my investment portfolio. Their insights into the Lagos market are unmatched.",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=128&q=80"
  },
  {
    name: "Michael Okonkwo",
    role: "Homeowner",
    content: "Finding our dream home in Ikoyi was seamless. The team's attention to detail and personalized service is world-class.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=crop&w=128&q=80"
  },
  {
    name: "Elena Rodriguez",
    role: "Expat",
    content: "Relocating to Nigeria was daunting until I met the Villanova team. They handled everything with professionalism and grace.",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&auto=format&fit=crop&w=128&q=80"
  }
];

const NEIGHBORHOODS = [
  { name: "Ikoyi", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" },
  { name: "Victoria Island", image: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" },
  { name: "Lekki Phase 1", image: "https://images.unsplash.com/photo-1626178793926-22b28830aa30?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" },
  { name: "Banana Island", image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" },
];

const SERVICES = [
  {
    title: "Property Sales",
    description: "Expert guidance in buying and selling luxury residential and commercial properties.",
    icon: Building
  },
  {
    title: "Property Management",
    description: "Comprehensive management solutions to maximize your asset's value and lifespan.",
    icon: Shield
  },
  {
    title: "Real Estate Advisory",
    description: "Strategic investment advice and market analysis for informed decision-making.",
    icon: Users
  }
];

const Home = () => {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [projects, setProjects] = useState<any[]>([]);
  const [featuredProperties, setFeaturedProperties] = useState<any[]>([]);
  const [upcomingAuctions, setUpcomingAuctions] = useState<any[]>([]);
  const [nextAuction, setNextAuction] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
    fetchFeaturedProperties();
    fetchNextAuction();
    fetchUpcomingAuctions();
  }, []);

  useEffect(() => {
    if (featuredProperties.length > 0) {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % featuredProperties.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [featuredProperties.length]);

  useEffect(() => {
    if (nextAuction) {
      const timer = setInterval(() => {
        const now = new Date().getTime();
        const target = new Date(nextAuction.start_time).getTime();
        const difference = target - now;

        if (difference > 0) {
          setTimeLeft({
            days: Math.floor(difference / (1000 * 60 * 60 * 24)),
            hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((difference % (1000 * 60)) / 1000),
          });
        } else {
          // If auction started, maybe switch to "Active Now"
          setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [nextAuction]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      if (data) setProjects(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchFeaturedProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          property_images (
            image_url,
            is_primary
          )
        `)
        .eq('status', 'available')
        .limit(5);

      if (error) throw error;

      if (data) {
        const formattedData = data.map(prop => ({
          ...prop,
          image: prop.property_images?.find((img: any) => img.is_primary)?.image_url || prop.property_images?.[0]?.image_url
        })).filter(prop => prop.image);

        setFeaturedProperties(formattedData);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchUpcomingAuctions = async () => {
    try {
      const { data } = await supabase
        .from('auctions')
        .select(`
          *,
          property:properties (
            id,
            title,
            address,
            property_images (
              image_url,
              is_primary
            )
          )
        `)
        .in('status', ['upcoming', 'active'])
        .order('start_time', { ascending: true })
        .limit(3);
      
      if (data) {
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
        setUpcomingAuctions(formattedData);
      }
    } catch (error) {
      console.error('Error fetching upcoming auctions:', error);
    }
  };

  const fetchNextAuction = async () => {
    try {
      // Find the soonest upcoming auction
      const { data } = await supabase
        .from('auctions')
        .select(`
          *,
          property:properties(title)
        `)
        .eq('status', 'upcoming')
        .gt('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(1)
        .single();

      if (data) {
        setNextAuction(data);
      }
    } catch (error) {
      // It's okay if no auction is found
    }
  };

  const featuredProject = projects.length > 0 ? projects[0] : {
    title: "The Golden Heights",
    progress: 65,
    image: "https://images.unsplash.com/photo-1590247813693-5541d1c609fd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
  };

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <motion.div 
          style={{ y: y1 }}
          className="absolute inset-0 z-0"
        >
          <div className="absolute inset-0 bg-black/40 z-10" />
          <img 
            src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80" 
            alt="Luxury Home" 
            className="w-full h-full object-cover"
          />
        </motion.div>

        <div className="relative z-20 text-center px-4 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-6 font-serif leading-tight uppercase tracking-wide">
              OUR FUTURE IS IN <span className="text-primary">PLAIN SIGHT</span><br />
              IT TAKES <span className="text-primary">FORESIGHT</span> TO SEE IT
            </h1>
            <p className="text-lg md:text-xl text-gray-200 mb-8 max-w-2xl mx-auto font-light">
              Discover exclusive properties in Nigeria's most prestigious neighborhoods. Where luxury meets lifestyle.
            </p>

            {/* Auction Countdown */}
            {nextAuction && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-8 inline-block bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-primary/30"
              >
                <div className="flex items-center justify-center text-primary mb-2">
                  <Gavel className="h-5 w-5 mr-2" />
                  <span className="font-bold uppercase tracking-widest text-sm">Next Luxury Auction</span>
                </div>
                <h3 className="text-white text-xl font-serif mb-4">{nextAuction.property?.title}</h3>
                <div className="flex gap-4 md:gap-8 justify-center">
                  <div className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-white font-mono">{timeLeft.days}</div>
                    <div className="text-xs text-gray-400 uppercase">Days</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-white font-mono">{timeLeft.hours}</div>
                    <div className="text-xs text-gray-400 uppercase">Hours</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-white font-mono">{timeLeft.minutes}</div>
                    <div className="text-xs text-gray-400 uppercase">Mins</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-white font-mono">{timeLeft.seconds}</div>
                    <div className="text-xs text-gray-400 uppercase">Secs</div>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/properties" 
                className="px-8 py-4 bg-primary text-black font-bold rounded-full hover:bg-yellow-400 transition-all duration-300 transform hover:scale-105 hover:shadow-lg flex items-center justify-center"
              >
                Explore Properties <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link 
                to="/contact-agent" 
                className="px-8 py-4 bg-white/10 backdrop-blur-md text-white font-bold rounded-full hover:bg-white/20 transition-all duration-300 border border-white/30"
              >
                Contact Agent
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Auctions Section */}
      {upcomingAuctions.length > 0 && (
        <section className="py-20 bg-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-end mb-12">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false }}
              >
                <h2 className="text-primary font-bold tracking-wider uppercase mb-2">Don't Miss Out</h2>
                <h3 className="text-4xl font-serif font-bold text-white">Live & Upcoming Auctions</h3>
              </motion.div>
              <Link to="/auctions" className="hidden md:flex items-center text-gray-400 hover:text-primary transition-colors font-medium group">
                View All Auctions <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {upcomingAuctions.map((auction, index) => (
                <HomeAuctionCard key={auction.id} auction={auction} index={index} />
              ))}
            </div>
            
             <div className="mt-8 text-center md:hidden">
                <Link to="/auctions" className="inline-flex items-center text-primary font-bold">
                  View All Auctions <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
             </div>
          </div>
        </section>
      )}

      {/* About Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-primary font-bold tracking-wider uppercase mb-2">About Us</h2>
              <h3 className="text-4xl font-serif font-bold text-gray-900 mb-6">Redefining Luxury Real Estate</h3>
              <p className="text-gray-600 mb-6 leading-relaxed text-lg">
                At Villanova Realty, we don't just sell properties; we curate lifestyles. With over a decade of experience in the Nigerian luxury market, our mission is to provide unparalleled service and exclusive access to the finest homes and investments.
              </p>
              
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="flex items-start">
                  <div className="bg-primary/10 p-2 rounded-full mr-3">
                    <Award className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Award Winning</h4>
                    <p className="text-sm text-gray-500">Recognized excellence</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-primary/10 p-2 rounded-full mr-3">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Expert Team</h4>
                    <p className="text-sm text-gray-500">Dedicated professionals</p>
                  </div>
                </div>
              </div>

              <Link to="/about" className="text-primary font-bold hover:text-black transition-colors flex items-center group">
                Learn More About Us <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <img 
                src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
                alt="Modern Architecture" 
                className="rounded-2xl shadow-2xl w-full object-cover h-[300px] md:h-[500px]"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
            >
              <h2 className="text-primary font-bold tracking-wider uppercase mb-2">Our Services</h2>
              <h3 className="text-4xl font-serif font-bold text-gray-900">Comprehensive Real Estate Solutions</h3>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {SERVICES.map((service, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false }}
                transition={{ delay: index * 0.2 }}
                className="bg-white p-6 md:p-10 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-t-4 border-transparent hover:border-primary group"
              >
                <service.icon className="h-12 w-12 text-gray-400 group-hover:text-primary transition-colors mb-6" />
                <h4 className="text-2xl font-bold mb-4">{service.title}</h4>
                <p className="text-gray-600 leading-relaxed mb-6">{service.description}</p>
                <Link to="/services" className="text-sm font-bold text-primary uppercase tracking-wide group-hover:text-black transition-colors flex items-center">
                  Learn More <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Properties Carousel */}
      <section className="py-20 bg-black text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false }}
            >
              <h2 className="text-primary font-bold tracking-wider uppercase mb-2">Exclusive Listings</h2>
              <h3 className="text-4xl font-serif font-bold text-white">Featured Properties</h3>
            </motion.div>
            <Link to="/properties" className="hidden md:flex items-center text-gray-400 hover:text-primary transition-colors font-medium group">
              View All <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="relative h-auto min-h-[600px] md:h-[500px]">
            {featuredProperties.length > 0 ? (
              <AnimatePresence mode='wait'>
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, x: 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.5 }}
                  className="relative md:absolute inset-0"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                    {/* Image Side */}
                    <div className="h-[300px] md:h-full rounded-2xl overflow-hidden relative group">
                      <img 
                        src={featuredProperties[currentSlide].image} 
                        alt={featuredProperties[currentSlide].title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                    </div>
                    
                    {/* Content Side */}
                    <div className="flex flex-col justify-center space-y-6 p-4">
                      <h3 className="text-2xl md:text-4xl font-serif font-bold text-white">
                        {featuredProperties[currentSlide].title}
                      </h3>
                      <div className="flex items-center text-primary text-xl">
                        <MapPin className="h-5 w-5 mr-2" />
                        {featuredProperties[currentSlide].address.city}, {featuredProperties[currentSlide].address.state}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 border-t border-gray-800 pt-6">
                        <div>
                          <span className="block text-xl md:text-2xl font-bold">{featuredProperties[currentSlide].specifications.bedrooms}</span>
                          <span className="text-sm text-gray-400">Bedrooms</span>
                        </div>
                        <div>
                          <span className="block text-xl md:text-2xl font-bold">{featuredProperties[currentSlide].specifications.bathrooms}</span>
                          <span className="text-sm text-gray-400">Bathrooms</span>
                        </div>
                        <div>
                          <span className="block text-xl md:text-2xl font-bold">{featuredProperties[currentSlide].specifications.sqft}</span>
                          <span className="text-sm text-gray-400">Sq Ft</span>
                        </div>
                      </div>

                      <div className="pt-4">
                        <p className="text-sm text-gray-400 uppercase tracking-wide mb-1">Price</p>
                        <p className="text-2xl md:text-3xl font-bold text-primary">
                          {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(featuredProperties[currentSlide].price)}
                        </p>
                      </div>

                      <div className="flex gap-4">
                        <Link 
                          to={`/properties/${featuredProperties[currentSlide].id}`}
                          className="inline-flex items-center px-6 py-3 md:px-8 md:py-4 bg-primary text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors w-fit"
                        >
                          View Details <ArrowRight className="ml-2 h-5 w-5" />
                        </Link>
                        <Link 
                          to="/contact-agent"
                          className="inline-flex items-center px-6 py-3 md:px-8 md:py-4 border border-white text-white font-bold rounded-lg hover:bg-white hover:text-black transition-colors w-fit"
                        >
                          Inquire
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="flex items-center justify-center h-full text-white">
                Loading Featured Properties...
              </div>
            )}
            
            {/* Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-2 mt-8">
              {featuredProperties.map((_, index) => (
                <div 
                  key={index}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    index === currentSlide ? 'w-8 bg-primary' : 'w-2 bg-gray-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ongoing Projects */}
      <section className="py-20 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-primary font-bold tracking-wider uppercase mb-2">Future Living</h2>
              <h3 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-gray-900">Ongoing Developments</h3>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                Be part of the future. Our ongoing projects represent the pinnacle of architectural innovation and sustainable luxury living. Secure your investment in tomorrow's landmarks today.
              </p>
              
              <div className="space-y-6 mb-10">
                {projects.map((project) => (
                  <Link to={`/projects/${project.id}`} key={project.id} className="block">
                    <div className="flex items-start p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100">
                      <img src={project.images?.[0] || project.image} alt={project.title} className="w-24 h-24 object-cover rounded-lg mr-6" />
                      <div>
                        <h4 className="text-xl font-bold mb-1 text-gray-900">{project.title}</h4>
                        <p className="text-gray-500 text-sm mb-2 flex items-center"><MapPin className="h-3 w-3 mr-1" /> {project.location}</p>
                        <div className="flex items-center space-x-4 text-sm">
                          <span className="text-primary font-medium px-2 py-0.5 bg-primary/10 rounded">{project.status}</span>
                          <span className="text-gray-500 flex items-center"><Calendar className="h-3 w-3 mr-1" /> {project.completion_date || project.completion}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <Link to="/projects" className="inline-flex items-center px-6 py-3 md:px-8 md:py-4 bg-black text-white font-bold rounded-lg hover:bg-gray-800 transition-colors">
                View All Projects <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl border border-gray-100">
                <img 
                  src={featuredProject.images?.[0] || featuredProject.image} 
                  alt="Construction Site" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                <div className="absolute bottom-8 left-8 right-8">
                  <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl border border-white/20 text-white">
                    <h4 className="text-2xl font-bold mb-2">{featuredProject.title}</h4>
                    <div className="w-full bg-gray-700 h-2 rounded-full mb-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: `${featuredProject.progress}%` }}></div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-300">
                      <span>Construction Progress</span>
                      <span>{featuredProject.progress}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Neighborhoods */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-primary font-bold tracking-wider uppercase mb-2">Locations</h2>
            <h3 className="text-4xl font-serif font-bold text-gray-900">Explore Neighborhoods</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {NEIGHBORHOODS.map((hood, index) => (
              <motion.div
                key={hood.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: false }}
                className="group relative h-80 rounded-xl overflow-hidden cursor-pointer"
                onClick={() => navigate(`/properties?location=${hood.name}`)}
              >
                <img 
                  src={hood.image} 
                  alt={hood.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <h4 className="text-2xl font-bold mb-2">{hood.name}</h4>
                  <span className="text-primary text-sm font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                    View Listings
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-primary font-bold tracking-wider uppercase mb-2">Testimonials</h2>
            <h3 className="text-4xl font-serif font-bold text-gray-900">What Our Clients Say</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.2 }}
                viewport={{ once: false }}
                className="bg-gray-50 p-8 rounded-xl shadow-lg border-b-4 border-primary"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-primary fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 mb-6 italic leading-relaxed">"{testimonial.content}"</p>
                <div className="flex items-center">
                  <img src={testimonial.image} alt={testimonial.name} className="w-12 h-12 rounded-full object-cover mr-4" />
                  <div>
                    <h5 className="font-bold text-gray-900">{testimonial.name}</h5>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-black mb-6">Ready to Find Your Dream Home?</h2>
          <p className="text-xl text-black/80 mb-10 max-w-2xl mx-auto">
            Let our expert team guide you through the process of finding the perfect property that matches your lifestyle and investment goals.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              to="/contact" 
              className="px-6 py-3 md:px-8 md:py-4 bg-black text-white font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-lg"
            >
              Contact Us
            </Link>
            <Link 
              to="/properties" 
              className="px-6 py-3 md:px-8 md:py-4 bg-white text-black font-bold rounded-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              Browse Listings
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
