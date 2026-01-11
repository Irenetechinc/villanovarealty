import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Phone, Mail, Clock, Send, Facebook, Twitter, Instagram, Linkedin, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { sendAdminNotification, sendUserConfirmation } from '@/lib/email';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    honeypot: '', // Spam protection
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [contactInfo, setContactInfo] = useState<any>(null);

  useEffect(() => {
    const fetchContactInfo = async () => {
      const { data } = await supabase.from('contact_info').select('*').single();
      if (data) setContactInfo(data);
    };
    fetchContactInfo();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Spam check
    if (formData.honeypot) return;

    setLoading(true);
    setStatus('idle');

    try {
      const { error } = await supabase
        .from('inquiries')
        .insert([
          {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            subject: formData.subject,
            message: formData.message,
            user_agent: navigator.userAgent,
            status: 'new', // Default status matching schema
            reply_status: 'pending',
          },
        ]);

      if (error) throw error;

      // Use formData for email since we might not have SELECT permissions for the inserted row
      const inquiryData = {
        ...formData,
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString(),
      };

      // Non-blocking email send
      Promise.all([
        sendAdminNotification(inquiryData),
        sendUserConfirmation(inquiryData)
      ]).catch(console.warn);

      setStatus('success');
      setFormData({ name: '', email: '', phone: '', subject: '', message: '', honeypot: '' });
    } catch (error) {
      console.error('Error submitting inquiry:', error);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppClick = () => {
    const number = contactInfo?.whatsapp_number || '2341234567890';
    const message = encodeURIComponent("Hello Villanova Realty, I'm interested in your properties.");
    window.open(`https://wa.me/${number}?text=${message}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-black text-white py-20 relative overflow-hidden pt-32">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80')] opacity-20 bg-cover bg-center" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-serif font-bold mb-6"
          >
            Get in <span className="text-primary">Touch</span>
          </motion.h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Have questions about a property or need expert real estate advice? We're here to help you every step of the way.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Contact Info */}
          <div className="lg:col-span-1 space-y-12">
            <div>
              <h3 className="text-2xl font-serif font-bold text-gray-900 mb-6">Contact Information</h3>
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="bg-primary/10 p-3 rounded-full mr-4 text-primary">
                    <MapPin className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Our Office</h4>
                    <p className="text-gray-600 whitespace-pre-wrap">{contactInfo?.address || '16B ADELEKE ADEDONYI VICTORIA ISLAND LAGOS NIGERIA'}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="bg-primary/10 p-3 rounded-full mr-4 text-primary">
                    <Phone className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Phone</h4>
                    <p className="text-gray-600">{contactInfo?.phone || '+234 (0) 123 456 7890'}</p>
                    <p className="text-gray-500 text-sm">Mon-Fri 9am-6pm</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="bg-primary/10 p-3 rounded-full mr-4 text-primary">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Email</h4>
                    <p className="text-gray-600">{contactInfo?.email_info || 'info@villanova.ng'}</p>
                    <p className="text-gray-600">{contactInfo?.email_sales || 'sales@villanova.ng'}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="bg-primary/10 p-3 rounded-full mr-4 text-primary">
                    <Clock className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Business Hours</h4>
                    <p className="text-gray-600">Monday - Friday: {contactInfo?.business_hours_weekdays || '9:00 AM - 6:00 PM'}</p>
                    <p className="text-gray-600">Saturday: {contactInfo?.business_hours_saturday || '10:00 AM - 4:00 PM'}</p>
                    <p className="text-gray-600">Sunday: {contactInfo?.business_hours_sunday || 'Closed'}</p>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleWhatsAppClick}
                    className="w-full bg-[#25D366] text-white py-4 rounded-lg font-bold hover:bg-[#128C7E] transition-colors flex items-center justify-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5 duration-200"
                  >
                    <MessageCircle className="mr-2 h-5 w-5" /> Chat on WhatsApp
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-serif font-bold text-gray-900 mb-6">Follow Us</h3>
              <div className="flex space-x-4">
                {[
                  { Icon: Facebook, link: contactInfo?.facebook_link },
                  { Icon: Twitter, link: contactInfo?.twitter_link },
                  { Icon: Instagram, link: contactInfo?.instagram_link },
                  { Icon: Linkedin, link: contactInfo?.linkedin_link }
                ].map(({ Icon, link }, i) => (
                  <a key={i} href={link || '#'} target="_blank" rel="noopener noreferrer" className="bg-gray-100 p-3 rounded-full text-gray-600 hover:bg-primary hover:text-black transition-colors">
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-gray-50 rounded-2xl p-8 md:p-12 shadow-sm border border-gray-100">
              <h3 className="text-2xl font-serif font-bold text-gray-900 mb-8">Send Us a Message</h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Your Email</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                    placeholder="+234 (0) 123 456 7890"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  >
                    <option value="">Select a subject</option>
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Property Viewing">Property Viewing</option>
                    <option value="Investment Consultation">Investment Consultation</option>
                    <option value="List My Property">List My Property</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={6}
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                    placeholder="How can we help you?"
                  ></textarea>
                </div>

                <div className="hidden">
                  <label htmlFor="honeypot">Don't fill this out if you're human</label>
                  <input
                    type="text"
                    id="honeypot"
                    name="honeypot"
                    value={formData.honeypot}
                    onChange={handleChange}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black text-white py-4 rounded-lg font-bold hover:bg-gray-800 transition-colors flex items-center justify-center disabled:opacity-70"
                >
                  {loading ? 'Sending...' : 'Send Message'} <Send className="ml-2 h-4 w-4" />
                </button>

                {status === 'success' && (
                  <div className="text-green-600 bg-green-50 p-4 rounded-lg">
                    Thank you! Your message has been sent successfully.
                  </div>
                )}
                
                {status === 'error' && (
                  <div className="text-red-600 bg-red-50 p-4 rounded-lg">
                    Something went wrong. Please try again later.
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-24">
          <h3 className="text-3xl font-serif font-bold text-center text-gray-900 mb-12">Frequently Asked Questions</h3>
          <div className="max-w-3xl mx-auto space-y-4">
            <FAQItem 
              question="How do I schedule a property viewing?"
              answer="You can schedule a viewing by filling out the contact form on any property details page, or by contacting our agents directly via phone or WhatsApp."
            />
            <FAQItem 
              question="What documents do I need to buy a property?"
              answer="Generally, you'll need a valid ID, proof of funds, and tax clearance certificates. Our team will guide you through the specific requirements for each property."
            />
            <FAQItem 
              question="Do you offer property management services?"
              answer="Yes, we offer comprehensive property management services including tenant screening, rent collection, and maintenance."
            />
            <FAQItem 
              question="Are there installment payment plans available?"
              answer="Many of our off-plan projects and some completed properties offer flexible payment plans. Check individual listings or ask an agent for details."
            />
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="h-96 w-full bg-gray-200 relative">
        <iframe 
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3964.728928308892!2d3.418723314770284!3d6.428864995348858!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x103bf5328d3a4db7%3A0x1d83eb33d599f572!2sVictoria%20Island%2C%20Lagos!5e0!3m2!1sen!2sng!4v1623456789012!5m2!1sen!2sng" 
          width="100%" 
          height="100%" 
          style={{ border: 0 }} 
          allowFullScreen 
          loading="lazy" 
          referrerPolicy="no-referrer-when-downgrade"
          title="Villanova Realty Office Location"
        ></iframe>
      </div>
    </div>
  );
};

const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-6 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <span className="font-bold text-gray-900">{question}</span>
        {isOpen ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 pt-0 bg-white text-gray-600 border-t border-gray-100">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Contact;
