import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuthStore();

  const isActive = (path: string) => location.pathname === path;

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Properties', href: '/properties' },
    { name: 'Projects', href: '/projects' },
    { name: 'Auctions', href: '/auctions' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact' },
  ];

  if (user?.user_metadata?.role === 'admin') {
    navigation.push({ name: 'Admin', href: '/admin' });
  }

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isHomePage = location.pathname === '/';
  const isContactPage = location.pathname === '/contact';
  const isAboutPage = location.pathname === '/about';
  const isAuctionDetailsPage = location.pathname.startsWith('/auctions/') && location.pathname.split('/').length > 2;
  const isTransparent = (isHomePage || isContactPage || isAboutPage || isAuctionDetailsPage) && !scrolled;
  
  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${
      isTransparent ? 'bg-transparent py-4' : 'bg-white/95 backdrop-blur-md shadow-md py-2'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex">
            <Link to="/" className="flex-shrink-0 flex items-center group">
              <span className={`text-xl md:text-2xl font-bold font-serif transition-colors duration-300 ${
                isTransparent && !isOpen ? 'text-white' : 'text-black'
              }`}>
                Villanova <span className="text-primary">Realty</span>
              </span>
            </Link>
          </div>

          <div className="hidden md:flex md:items-center md:space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 relative group ${
                  isTransparent ? 'text-white hover:text-white/80' : 'text-gray-800 hover:text-primary'
                }`}
              >
                {item.name}
                <span className={`absolute bottom-0 left-0 w-full h-0.5 ${isTransparent ? 'bg-white' : 'bg-primary'} transform scale-x-0 transition-transform duration-300 group-hover:scale-x-100 ${
                  isActive(item.href) ? 'scale-x-100' : ''
                }`} />
              </Link>
            ))}
            
            {user ? (
              <div className="flex items-center space-x-4">
                 <Link to="/profile" className={`${isTransparent ? 'text-white' : 'text-gray-700'} hover:text-primary transition-colors`}>
                    <UserIcon className="h-5 w-5" />
                 </Link>
                 <button
                   onClick={() => signOut()}
                   className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
                 >
                   Sign Out
                 </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className={`${isTransparent ? 'text-white' : 'text-gray-700'} hover:text-primary font-medium transition-colors`}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-primary text-black px-6 py-2.5 rounded-full text-sm font-bold hover:bg-yellow-400 transition-all duration-300 hover:scale-105 hover:shadow-lg"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`inline-flex items-center justify-center p-2 rounded-md transition-colors ${
                isTransparent && !isOpen ? 'text-white' : 'text-gray-900'
              } hover:text-primary focus:outline-none`}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white shadow-xl overflow-hidden"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActive(item.href)
                      ? 'text-primary bg-yellow-50'
                      : 'text-gray-700 hover:text-primary hover:bg-gray-50'
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              {!user && (
                <div className="mt-4 flex flex-col space-y-3 px-3 pb-4">
                  <Link
                    to="/login"
                    className="block text-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
                    onClick={() => setIsOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="block text-center px-4 py-2 bg-primary text-black rounded-md hover:bg-yellow-400 font-bold"
                    onClick={() => setIsOpen(false)}
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
