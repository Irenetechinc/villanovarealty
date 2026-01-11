import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Users, Target, Award, Building, Star, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const ICON_MAP: any = {
  Shield, Users, Target, Award, Building, Star, CheckCircle
};

const About = () => {
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    try {
      const { data, error } = await supabase
        .from('about_sections')
        .select('*')
        .eq('is_visible', true)
        .order('order_index');
      
      if (error) throw error;
      setSections(data || []);
    } catch (error) {
      console.error('Error fetching about sections:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderSection = (section: any) => {
    switch (section.type) {
      case 'hero':
        return (
          <section key={section.id} className="relative h-[60vh] flex items-center justify-center overflow-hidden bg-black">
            <div className="absolute inset-0 opacity-50">
              <img 
                src={section.image_url} 
                alt={section.title} 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="relative z-10 text-center px-4 max-w-4xl">
              <motion.h1 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-5xl md:text-7xl font-bold text-white mb-6 font-serif"
              >
                {section.title}
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl text-gray-300 whitespace-pre-wrap"
              >
                {section.content}
              </motion.p>
            </div>
          </section>
        );

      case 'content_split':
        return (
          <section key={section.id} className="py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                >
                  <h2 className="text-primary font-bold tracking-wider uppercase mb-2">{section.subtitle}</h2>
                  <h3 className="text-4xl font-serif font-bold text-gray-900 mb-6">{section.title}</h3>
                  <div className="text-gray-600 mb-6 leading-relaxed whitespace-pre-wrap">
                    {section.content}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    {section.items?.filter((item: any) => item.label && item.value).map((stat: any, i: number) => (
                      <div key={i} className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                        <h4 className="text-4xl font-bold text-primary mb-2">{stat.value}</h4>
                        <p className="text-gray-600 font-medium">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="space-y-8"
                >
                  {section.items?.filter((item: any) => item.title && item.description).map((item: any, i: number) => {
                    const Icon = ICON_MAP[item.icon] || Star;
                    return (
                      <div key={i} className="flex items-start">
                        <div className="bg-primary/10 p-3 rounded-full mr-4">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h4 className="text-xl font-bold mb-2">{item.title}</h4>
                          <p className="text-gray-600">{item.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              </div>
            </div>
          </section>
        );

      case 'features_grid':
        return (
          <section key={section.id} className="py-20 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-primary font-bold tracking-wider uppercase mb-2">{section.subtitle}</h2>
                <h3 className="text-4xl font-serif font-bold text-gray-900">{section.title}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {section.items?.map((item: any, i: number) => {
                  const Icon = ICON_MAP[item.icon] || Star;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.2 }}
                      viewport={{ once: true }}
                      className="bg-white p-10 rounded-xl shadow-lg hover:shadow-xl transition-shadow border-t-4 border-transparent hover:border-primary group"
                    >
                      <Icon className="h-12 w-12 text-gray-400 group-hover:text-primary transition-colors mb-6" />
                      <h4 className="text-2xl font-bold mb-4">{item.title}</h4>
                      <p className="text-gray-600 leading-relaxed">{item.description}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </section>
        );

      case 'team_grid':
        return (
          <section key={section.id} className="py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-primary font-bold tracking-wider uppercase mb-2">{section.subtitle}</h2>
                <h3 className="text-4xl font-serif font-bold text-gray-900">{section.title}</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {section.items?.map((member: any, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    viewport={{ once: true }}
                    className="text-center group"
                  >
                    <div className="relative mb-4 overflow-hidden rounded-xl">
                      <img 
                        src={member.image} 
                        alt={member.name} 
                        className="w-full aspect-[3/4] object-cover grayscale group-hover:grayscale-0 transition-all duration-500" 
                      />
                      <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <h4 className="text-xl font-bold">{member.name}</h4>
                    <p className="text-primary font-medium">{member.role}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return <div className="pt-20 text-center py-20">Loading...</div>;
  }

  return (
    <div>
      {sections.map((section) => renderSection(section))}
    </div>
  );
};

export default About;
