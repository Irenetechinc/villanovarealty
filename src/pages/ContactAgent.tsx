import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, Mail, MapPin, Send, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { sendAdminNotification, sendUserConfirmation } from '@/lib/email';

const ContactAgent = () => {
  const [agents, setAgents] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    honeypot: '',
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      if (data) setAgents(data);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
            message: formData.message,
            subject: 'Agent Inquiry',
            user_agent: navigator.userAgent,
            status: 'new',
            reply_status: 'pending',
          },
        ]);

      if (error) throw error;

      // Use formData for email since we might not have SELECT permissions for the inserted row
      const inquiryData = {
        ...formData,
        subject: 'Agent Inquiry',
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString(),
      };

      // Non-blocking email send
      Promise.all([
        sendAdminNotification(inquiryData),
        sendUserConfirmation(inquiryData)
      ]).catch(console.warn);

      setStatus('success');
      setFormData({ name: '', email: '', phone: '', message: '', honeypot: '' });
    } catch (error) {
      console.error('Error submitting inquiry:', error);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-black text-white pt-32 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-serif font-bold mb-4"
          >
            Contact <span className="text-primary">Agent</span>
          </motion.h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Ready to find your dream property? Our expert agents are here to guide you every step of the way.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 gap-12">
          {/* Agents List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {agents.map((agent, index) => (
              <motion.div 
                key={agent.id}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100"
              >
                <div className="flex items-center space-x-6 mb-8">
                  <img 
                    src={agent.image_url || "https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&auto=format&fit=crop&w=256&q=80"} 
                    alt={agent.name} 
                    className="w-24 h-24 rounded-full object-cover border-4 border-primary/20"
                  />
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{agent.name}</h3>
                    <p className="text-primary font-medium">{agent.role}</p>
                    <div className="flex items-center mt-2 text-gray-500 text-sm">
                      <StarRating />
                      <span className="ml-2">(150+ Reviews)</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {agent.phone && (
                    <div className="flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                      <div className="bg-primary/10 p-3 rounded-full mr-4 group-hover:bg-primary group-hover:text-black transition-colors">
                        <Phone className="h-6 w-6 text-primary group-hover:text-black" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Call Directly</p>
                        <a href={`tel:${agent.phone}`} className="text-lg font-bold text-gray-900 hover:text-primary transition-colors">
                          {agent.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {agent.email && (
                    <div className="flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                      <div className="bg-primary/10 p-3 rounded-full mr-4 group-hover:bg-primary group-hover:text-black transition-colors">
                        <Mail className="h-6 w-6 text-primary group-hover:text-black" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Email Us</p>
                        <a href={`mailto:${agent.email}`} className="text-lg font-bold text-gray-900 hover:text-primary transition-colors">
                          {agent.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {agent.office_location && (
                    <div className="flex items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                      <div className="bg-primary/10 p-3 rounded-full mr-4 group-hover:bg-primary group-hover:text-black transition-colors">
                        <MapPin className="h-6 w-6 text-primary group-hover:text-black" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Office Location</p>
                        <p className="text-lg font-bold text-gray-900">
                          {agent.office_location}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-8 border-t border-gray-100">
                  <a 
                    href={`https://wa.me/${agent.phone?.replace(/[^0-9]/g, '')}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-full bg-[#25D366] text-white py-4 rounded-xl font-bold hover:bg-[#128C7E] transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                  >
                    <MessageSquare className="h-6 w-6 mr-2" />
                    Chat on WhatsApp
                  </a>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Contact Form */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white p-8 md:p-12 rounded-2xl shadow-xl border border-gray-100 max-w-3xl mx-auto w-full"
          >
            <h3 className="text-2xl font-serif font-bold text-gray-900 mb-2 text-center">Send a Message</h3>
            <p className="text-gray-500 mb-8 text-center">Fill out the form below and we'll get back to you shortly.</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                  placeholder="John Doe"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
                    placeholder="+234..."
                  />
                </div>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all resize-none"
                  placeholder="I'm interested in..."
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
                className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    Send Message <Send className="ml-2 h-5 w-5" />
                  </>
                )}
              </button>

              {status === 'success' && (
                <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Message sent successfully! We'll contact you soon.
                </div>
              )}

              {status === 'error' && (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                  Failed to send message. Please try again.
                </div>
              )}
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

const StarRating = () => (
  <div className="flex">
    {[1, 2, 3, 4, 5].map((i) => (
      <svg key={i} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

export default ContactAgent;
