import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { MapPin, Calendar, ArrowLeft, CheckCircle, ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (id) fetchProject(id);
  }, [id]);

  const fetchProject = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
  };

  const nextImage = () => {
    if (project?.images) {
      setActiveImage((prev) => (prev + 1) % project.images.length);
    }
  };

  const prevImage = () => {
    if (project?.images) {
      setActiveImage((prev) => (prev - 1 + project.images.length) % project.images.length);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <h2 className="text-2xl font-bold mb-4">Project not found</h2>
        <Link to="/projects" className="text-primary hover:underline">Return to projects</Link>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-12">
      {/* Hero Section */}
      <div className="relative h-[60vh] bg-black">
        <img 
          src={project.images[0]} 
          alt={project.title} 
          className="w-full h-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
        
        <div className="absolute top-24 left-4 md:left-8 z-20">
          <Link to="/projects" className="inline-flex items-center px-4 py-2 bg-black/30 backdrop-blur-md rounded-full text-white hover:bg-black/50 transition-colors border border-white/20">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Link>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16 max-w-7xl mx-auto z-20">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <div className="flex items-center gap-4 mb-4">
              <span className="bg-primary text-black px-3 py-1 rounded-sm uppercase font-bold tracking-wider text-sm">{project.status}</span>
              <span className="text-white/80 flex items-center"><Calendar className="h-4 w-4 mr-2" /> Completion: {project.completion_date}</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-4">{project.title}</h1>
            <div className="flex items-center text-white/80 text-lg">
              <MapPin className="h-5 w-5 mr-2 text-primary" />
              <span>{project.location}</span>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-12">
            
            {/* Gallery Preview */}
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-serif font-bold text-gray-900">Project Gallery</h2>
                <button 
                  onClick={() => setLightboxOpen(true)}
                  className="text-primary hover:text-black transition-colors flex items-center font-medium"
                >
                  <Maximize2 className="h-4 w-4 mr-2" /> View Fullscreen
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {project.images.slice(0, 6).map((img: string, index: number) => (
                  <div 
                    key={index} 
                    className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => {
                      setActiveImage(index);
                      setLightboxOpen(true);
                    }}
                  >
                    <img src={img} alt={`Gallery ${index}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6">About The Project</h2>
              <div className="prose max-w-none text-gray-600 leading-relaxed text-lg">
                <p className="whitespace-pre-line">{project.description}</p>
              </div>
            </div>

            {/* Features */}
            <div>
              <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6">Key Features</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.features?.map((feature: string, index: number) => (
                  <div key={index} className="flex items-center p-4 bg-gray-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-primary mr-3 flex-shrink-0" />
                    <span className="text-gray-700 font-medium">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Floor Plans (Placeholder) */}
            {project.floor_plans && project.floor_plans.length > 0 && (
              <div>
                <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6">Floor Plans</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {project.floor_plans.map((plan: string, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-4">
                      <img src={plan} alt={`Floor Plan ${index + 1}`} className="w-full h-auto" />
                      <p className="text-center mt-2 font-medium text-gray-500">Layout Type {index + 1}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <div className="sticky top-24 space-y-8">
              {/* Progress Card */}
              <div className="bg-black text-white p-8 rounded-2xl shadow-xl">
                <h3 className="text-xl font-bold mb-4 text-primary">Construction Status</h3>
                <div className="mb-2 flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden mb-6">
                  <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${project.progress}%` }}></div>
                </div>
                <div className="space-y-3 text-sm text-gray-400">
                  <div className="flex items-center"><CheckCircle className="h-4 w-4 mr-2 text-green-500" /> Foundation Complete</div>
                  <div className="flex items-center"><CheckCircle className="h-4 w-4 mr-2 text-green-500" /> Structure 80% Complete</div>
                  <div className="flex items-center"><div className="h-4 w-4 mr-2 rounded-full border border-gray-600"></div> Interiors Pending</div>
                </div>
              </div>

              {/* Inquiry Form */}
              <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-lg">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Interested in this Project?</h3>
                <p className="text-gray-500 mb-6">Download the brochure or schedule a site visit.</p>
                
                <form className="space-y-4">
                  <input
                    type="text"
                    placeholder="Your Name"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                  <input
                    type="email"
                    placeholder="Your Email"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                  <textarea
                    rows={3}
                    placeholder="I am interested in..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                  ></textarea>
                  <button
                    type="submit"
                    className="w-full bg-primary text-black py-4 rounded-lg font-bold hover:bg-yellow-400 transition-colors"
                  >
                    Request Information
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          >
            <button 
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 text-white hover:text-primary p-2"
            >
              <X className="h-8 w-8" />
            </button>
            
            <button onClick={prevImage} className="absolute left-4 text-white hover:text-primary p-2">
              <ChevronLeft className="h-10 w-10" />
            </button>
            
            <img 
              src={project.images[activeImage]} 
              alt="Project Gallery" 
              className="max-h-[90vh] max-w-[90vw] object-contain"
            />
            
            <button onClick={nextImage} className="absolute right-4 text-white hover:text-primary p-2">
              <ChevronRight className="h-10 w-10" />
            </button>

            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white">
              {activeImage + 1} / {project.images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectDetails;
