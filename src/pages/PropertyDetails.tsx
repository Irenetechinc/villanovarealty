import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { sendAdminNotification, sendUserConfirmation, sendAgentInquiry } from '@/lib/email';
import { useAuthStore } from '@/store/useAuthStore';
import NotificationToast, { NotificationType } from '@/components/NotificationToast';
import { MapPin, Bed, Bath, Square, Calendar, ArrowLeft, Mail, Phone, User, Share2, Heart, CheckCircle, ZoomIn, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import { PhotoProvider, PhotoView } from 'react-photo-view';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'react-photo-view/dist/react-photo-view.css';

// Utility to generate UUIDs client-side to avoid RLS select issues
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const PropertyDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage] = useState(0);
  
  // Schedule Viewing State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    message: ''
  });
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  // Contact Agent State
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [submittingContact, setSubmittingContact] = useState(false);

  // Save & Share State
  const [isSaved, setIsSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Notification State
  const [notification, setNotification] = useState<{
    isVisible: boolean;
    type: NotificationType;
    title: string;
    message: string;
    timestamp?: string;
  }>({
    isVisible: false,
    type: 'success',
    title: '',
    message: ''
  });

  const showNotification = (type: NotificationType, title: string, message: string) => {
    const now = new Date();
    setNotification({
      isVisible: true,
      type,
      title,
      message,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  };

  useEffect(() => {
    if (user) {
      setScheduleForm(prev => ({
        ...prev,
        name: user.user_metadata?.name || '',
        email: user.email || '',
        phone: user.user_metadata?.phone || ''
      }));
      setContactForm(prev => ({
        ...prev,
        name: user.user_metadata?.name || '',
        email: user.email || ''
      }));
    }
  }, [user]);

  useEffect(() => {
    if (id) fetchProperty(id);
  }, [id]);

  useEffect(() => {
    if (user && id) {
      checkSavedStatus();
    }
  }, [user, id]);

  const checkSavedStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_properties')
        .select('*')
        .eq('user_id', user!.id)
        .eq('property_id', id)
        .maybeSingle();

      if (error) throw error;
      setIsSaved(!!data);
    } catch (error) {
      console.error('Error checking saved status:', error);
    }
  };

  const fetchProperty = async (propertyId: string) => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*, property_images(*), users:agent_id(name, email, phone)')
        .eq('id', propertyId)
        .single();
      
      if (error) throw error;
      setProperty(data);
    } catch (error) {
      console.error('Error fetching property:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingContact(true);

    try {
      const inquiryId = generateUUID();
      const inquiryData = {
        id: inquiryId,
        name: contactForm.name,
        email: contactForm.email,
        phone: '', // Optional for simple contact
        subject: `Property Inquiry: ${property.title}`,
        message: contactForm.message,
        property_id: property.id, // For tracking
        // property_title: property.title, // Not in DB schema but used for email
        user_agent: navigator.userAgent
      };

      // 1. Save to Database
      // Note: We do NOT use .select() here because anonymous users might not have SELECT permissions
      // for the row they just created, causing an error even if the insert succeeded.
      const { error: dbError } = await supabase
        .from('inquiries')
        .insert([{
          ...inquiryData,
          status: 'unread'
        }]);

      if (dbError) {
        console.error('Database insertion error:', dbError);
        throw new Error('Could not save your message. Please try again.');
      }

      // 2. Send Emails (Agent + User Confirmation)
      const agentEmail = property.users?.email;
      // Use client-generated ID for reference
      const emailPayload = { 
        ...inquiryData, 
        property_title: property.title 
      };
      
      try {
        const promises = [sendUserConfirmation(emailPayload)];
        if (agentEmail) {
            promises.push(sendAgentInquiry(agentEmail, emailPayload));
        }
        await Promise.all(promises);
      } catch (emailError) {
        console.warn('Email notifications failed:', emailError);
        showNotification('error', 'Message Saved, Email Failed', 'We saved your inquiry, but could not send the confirmation email. Our team will still see it.');
        setContactForm(prev => ({ ...prev, message: '' }));
        return; // Exit early since we showed a specific warning
      }

      showNotification('success', 'Message Sent Successfully', 'Your inquiry has been received. Check your email for a confirmation and reference number.');
      setContactForm(prev => ({ ...prev, message: '' }));
    } catch (error: any) {
      console.error('Error sending message:', error);
      showNotification('error', 'Submission Failed', error.message || 'Failed to send message. Please check your connection and try again.');
    } finally {
      setSubmittingContact(false);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSchedule(true);

    try {
      const viewingId = generateUUID();
      const viewingRequest = {
        id: viewingId,
        name: scheduleForm.name,
        email: scheduleForm.email,
        phone: scheduleForm.phone,
        subject: `Viewing Request: ${property.title}`,
        message: `
          Property: ${property.title}
          Location: ${property.address.street}, ${property.address.city}
          Preferred Date: ${scheduleForm.date}
          Preferred Time: ${scheduleForm.time}
          Additional Notes: ${scheduleForm.message}
        `,
        user_agent: navigator.userAgent
      };

      // 1. Save to Database
      const { error: dbError } = await supabase
        .from('inquiries')
        .insert([{
          ...viewingRequest,
          status: 'unread'
        }]);

      if (dbError) {
        console.error('Database insertion error:', dbError);
        throw new Error('Could not save your booking request. Please try again.');
      }

      // 2. Send Notifications (Non-blocking)
      try {
        const emailPayload = {
            ...viewingRequest,
            property_title: property.title
        };

        await Promise.all([
          sendAdminNotification(emailPayload),
          sendUserConfirmation(emailPayload)
        ]);
      } catch (emailError) {
        // Log email failure but don't block the success flow
        console.warn('Email notifications failed to send:', emailError);
        showNotification('error', 'Booking Saved, Email Failed', 'We saved your booking, but could not send the confirmation email.');
        setIsScheduleModalOpen(false);
        setScheduleForm(prev => ({ ...prev, date: '', time: '', message: '' }));
        return;
      }

      showNotification('success', 'Viewing Scheduled!', 'Your viewing request has been received. Check your email for confirmation.');
      setIsScheduleModalOpen(false);
      setScheduleForm(prev => ({ ...prev, date: '', time: '', message: '' }));
    } catch (error: any) {
      console.error('Error scheduling viewing:', error);
      showNotification('error', 'Booking Failed', error.message || 'Failed to schedule viewing. Please try again.');
    } finally {
      setSubmittingSchedule(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      showNotification('error', 'Login Required', 'Please log in to save properties to your favorites.');
      return;
    }

    setSaveLoading(true);
    try {
      if (isSaved) {
        // Unsave
        const { error } = await supabase
          .from('saved_properties')
          .delete()
          .eq('user_id', user.id)
          .eq('property_id', property.id);
        
        if (error) throw error;
        setIsSaved(false);
        showNotification('success', 'Property Removed', 'This property has been removed from your favorites.');
      } else {
        // Save
        const { error } = await supabase
          .from('saved_properties')
          .insert([{ user_id: user.id, property_id: property.id }]);
          
        if (error) throw error;
        setIsSaved(true);
        showNotification('success', 'Property Saved', 'This property has been added to your favorites.');
      }
    } catch (error: any) {
      console.error('Error saving property:', error);
      showNotification('error', 'Action Failed', 'Could not update favorites. Please try again.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: property.title,
      text: `Check out this amazing property: ${property.title}`,
      url: window.location.href,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showNotification('success', 'Link Copied', 'Property link has been copied to your clipboard.');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <h2 className="text-2xl font-bold mb-4">Property not found</h2>
        <Link to="/properties" className="text-primary hover:underline">Return to listings</Link>
      </div>
    );
  }

  const images = property.property_images || [];
  const mainImage = images.length > 0 ? images[activeImage].image_url : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80';

  return (
    <div className="bg-white min-h-screen pb-12">
      {/* Image Gallery Hero */}
      <div className="relative h-[60vh] md:h-[70vh] bg-black">
        <motion.img 
          key={activeImage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          src={mainImage} 
          alt={property.title} 
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
        
        <div className="absolute top-24 left-4 md:left-8 z-20">
          <Link to="/properties" className="inline-flex items-center px-4 py-2 bg-black/30 backdrop-blur-md rounded-full text-white hover:bg-black/50 transition-colors border border-white/20">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Listings
          </Link>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16 max-w-7xl mx-auto z-20">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex flex-wrap items-center gap-4 mb-4 text-sm font-bold tracking-wider">
              <span className="bg-primary text-black px-3 py-1 rounded-sm uppercase">{property.type}</span>
              <span className="bg-white/20 backdrop-blur-md text-white px-3 py-1 rounded-sm border border-white/30 uppercase">{property.status}</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-4 leading-tight">{property.title}</h1>
            <div className="flex items-center text-white/80 text-lg">
              <MapPin className="h-5 w-5 mr-2 text-primary" />
              <span>{property.address.street}, {property.address.city}, {property.address.state}</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Gallery Section */}
      {images.length > 0 && (
        <div className="bg-white py-10 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="text-gray-900 text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">Property Gallery</span>
              <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{images.length} Photos</span>
            </h3>
            
            <PhotoProvider>
              <Swiper
                modules={[Navigation, Pagination, Autoplay]}
                spaceBetween={20}
                slidesPerView={1}
                navigation
                pagination={{ 
                  clickable: true,
                  dynamicBullets: true
                }}
                autoplay={{ 
                  delay: 5000,
                  disableOnInteraction: false 
                }}
                breakpoints={{
                  640: { slidesPerView: 2 },
                  768: { slidesPerView: 3 },
                  1024: { slidesPerView: 4 },
                }}
                className="property-gallery-swiper pb-10"
              >
                {images.map((img: any, index: number) => (
                  <SwiperSlide key={img.id}>
                    <PhotoView src={img.image_url}>
                      <div className="relative aspect-[4/3] cursor-pointer group overflow-hidden rounded-xl border border-gray-200 hover:border-primary transition-all bg-gray-50 shadow-sm hover:shadow-md">
                        <img 
                          src={img.image_url} 
                          alt={`${property.title} - View ${index + 1}`} 
                          loading="lazy"
                          className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700 ease-in-out" 
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                        
                        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm p-1.5 rounded-full opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 shadow-sm">
                          <ZoomIn className="h-4 w-4 text-gray-700" />
                        </div>
                        
                        {/* Optional: Click to set as cover (if we wanted to keep that logic, but lightbox is primary now) */}
                        <div 
                           className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                           onClick={(e) => {
                             e.stopPropagation(); // Prevent lightbox if we only wanted to set cover, but here we let lightbox happen
                           }}
                        >
                           <p className="text-white text-xs text-center font-medium">Click to enlarge</p>
                        </div>
                      </div>
                    </PhotoView>
                  </SwiperSlide>
                ))}
              </Swiper>
            </PhotoProvider>
            
            <style>{`
              .property-gallery-swiper .swiper-pagination-bullet {
                background: #9CA3AF;
              }
              .property-gallery-swiper .swiper-pagination-bullet-active {
                background: #EAB308; /* Primary color */
              }
              .property-gallery-swiper .swiper-button-next,
              .property-gallery-swiper .swiper-button-prev {
                color: #EAB308;
              }
              .property-gallery-swiper .swiper-button-next::after,
              .property-gallery-swiper .swiper-button-prev::after {
                font-size: 20px;
                font-weight: bold;
              }
            `}</style>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-12">
            {/* Key Specs */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-gray-50 p-8 rounded-2xl border border-gray-100"
            >
              <div className="text-center">
                <Bed className="h-8 w-8 mx-auto mb-2 text-primary" />
                <span className="block text-2xl font-bold text-gray-900">{property.specifications.bedrooms}</span>
                <span className="text-sm text-gray-500 uppercase tracking-wide">Bedrooms</span>
              </div>
              <div className="text-center border-l border-gray-200">
                <Bath className="h-8 w-8 mx-auto mb-2 text-primary" />
                <span className="block text-2xl font-bold text-gray-900">{property.specifications.bathrooms}</span>
                <span className="text-sm text-gray-500 uppercase tracking-wide">Bathrooms</span>
              </div>
              <div className="text-center border-l border-gray-200">
                <Square className="h-8 w-8 mx-auto mb-2 text-primary" />
                <span className="block text-2xl font-bold text-gray-900">{property.specifications.sqft}</span>
                <span className="text-sm text-gray-500 uppercase tracking-wide">Sq Ft</span>
              </div>
              <div className="text-center border-l border-gray-200">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-primary" />
                <span className="block text-2xl font-bold text-gray-900">{property.specifications.year_built}</span>
                <span className="text-sm text-gray-500 uppercase tracking-wide">Built</span>
              </div>
            </motion.div>

            {/* Description */}
            <div>
              <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6 flex items-center">
                About This Property
                <div className="h-px bg-gray-200 flex-grow ml-6"></div>
              </h2>
              <div className="prose max-w-none text-gray-600 leading-relaxed text-lg">
                <p className="whitespace-pre-line">{property.description}</p>
              </div>
            </div>

            {/* Amenities */}
            <div>
              <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6 flex items-center">
                Features & Amenities
                <div className="h-px bg-gray-200 flex-grow ml-6"></div>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {property.specifications.amenities?.map((amenity: string, index: number) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    viewport={{ once: true }}
                    className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <CheckCircle className="h-5 w-5 text-primary mr-3 flex-shrink-0" />
                    <span className="text-gray-700 font-medium">{amenity}</span>
                  </motion.div>
                )) || <p className="text-gray-500">No amenities listed.</p>}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <div className="sticky top-24 space-y-8">
              {/* Price Card */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-black text-white p-8 rounded-2xl shadow-xl"
              >
                <p className="text-gray-400 mb-1 text-sm uppercase tracking-wide">Listing Price</p>
                <div className="text-4xl font-bold text-primary mb-6">
                  {formatPrice(property.price)}
                </div>
                
                <div className="flex gap-4 mb-6">
                  <button 
                    onClick={handleShare}
                    className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <Share2 className="h-5 w-5 mr-2" /> Share
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={saveLoading}
                    className={`flex-1 py-3 rounded-lg flex items-center justify-center transition-colors ${
                      isSaved 
                        ? 'bg-primary text-black hover:bg-yellow-400' 
                        : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    <Heart className={`h-5 w-5 mr-2 ${isSaved ? 'fill-current' : ''}`} /> 
                    {isSaved ? 'Saved' : 'Save'}
                  </button>
                </div>

                <div className="border-t border-gray-800 pt-6">
                  <h3 className="text-lg font-bold mb-4">Interested?</h3>
                  <button 
                    onClick={() => setIsScheduleModalOpen(true)}
                    className="w-full bg-primary text-black py-4 rounded-lg font-bold text-lg hover:bg-yellow-400 transition-colors mb-4"
                  >
                    Schedule a Viewing
                  </button>
                  <p className="text-center text-gray-500 text-sm">
                    Free consultation with our luxury property experts
                  </p>
                </div>
              </motion.div>

              {/* Agent Card */}
              <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-lg">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Contact Agent</h3>
                
                <div className="flex items-center mb-6">
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 border-2 border-primary">
                    <User className="h-8 w-8" />
                  </div>
                  <div className="ml-4">
                    <h4 className="font-bold text-lg text-gray-900">{property.users?.name || 'Villanova Agent'}</h4>
                    <p className="text-sm text-primary font-medium">Senior Property Consultant</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <a href={`mailto:${property.users?.email}`} className="flex items-center text-gray-600 hover:text-primary transition-colors p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                    <Mail className="h-5 w-5 mr-3 text-primary" />
                    <span className="truncate">{property.users?.email || 'contact@villanovarealty.com'}</span>
                  </a>
                  <a href={`tel:${property.users?.phone}`} className="flex items-center text-gray-600 hover:text-primary transition-colors p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                    <Phone className="h-5 w-5 mr-3 text-primary" />
                    {property.users?.phone || '+1 (555) 123-4567'}
                  </a>
                </div>

                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <input
                    type="text"
                    required
                    placeholder="Your Name"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  />
                  <input
                    type="email"
                    required
                    placeholder="Your Email"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  />
                  <textarea
                    rows={4}
                    required
                    placeholder="I am interested in this property..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all resize-none"
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  ></textarea>
                  <button
                    type="submit"
                    disabled={submittingContact}
                    className="w-full bg-black text-white py-4 rounded-lg font-bold hover:bg-gray-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
                  >
                    {submittingContact ? (
                       <>
                         <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                         Sending...
                       </>
                    ) : (
                       'Send Message'
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Schedule Viewing Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl relative"
          >
            <button 
              onClick={() => setIsScheduleModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <Calendar className="h-6 w-6 mr-2 text-primary" />
              Schedule a Viewing
            </h2>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                    value={scheduleForm.name}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                    value={scheduleForm.phone}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                  value={scheduleForm.email}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                      value={scheduleForm.date}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <div className="relative">
                    <input
                      type="time"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                      value={scheduleForm.time}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary resize-none"
                  value={scheduleForm.message}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, message: e.target.value })}
                  placeholder="Any specific questions or requirements?"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={submittingSchedule}
                className="w-full bg-primary text-black py-3 rounded-lg font-bold hover:bg-yellow-400 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingSchedule ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent mr-2"></div>
                    Scheduling...
                  </>
                ) : (
                  'Confirm Booking'
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
      {/* Notification Toast */}
      <NotificationToast
        isVisible={notification.isVisible}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        timestamp={notification.timestamp}
        onClose={() => setNotification(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
};

export default PropertyDetails;
