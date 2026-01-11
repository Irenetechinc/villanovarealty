import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, ArrowRight, BarChart, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';

const Projects = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          project.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' || project.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="pt-20 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="pt-20">
      <section className="bg-black text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-serif font-bold mb-6"
          >
            Ongoing <span className="text-primary">Developments</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-400 max-w-2xl mx-auto"
          >
            Invest in the future. Explore our portfolio of premium developments currently underway across prime locations.
          </motion.p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            {['All', 'Planning', 'Under Construction', 'Near Completion', 'Completed'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  filterStatus === status
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-20">
          {filteredProjects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-12 items-center`}
            >
              <div className="lg:w-1/2 w-full">
                <Link to={`/projects/${project.id}`}>
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl group cursor-pointer">
                    <img 
                      src={project.images?.[0] || project.image} 
                      alt={project.title} 
                      className="w-full h-[400px] object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute top-4 left-4 bg-black/80 text-white px-4 py-1 rounded-full text-sm font-bold flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${project.progress < 100 ? 'bg-primary animate-pulse' : 'bg-green-500'}`} />
                      {project.status}
                    </div>
                  </div>
                </Link>
              </div>

              <div className="lg:w-1/2 w-full space-y-6">
                <Link to={`/projects/${project.id}`}>
                  <h2 className="text-3xl font-serif font-bold text-gray-900 hover:text-primary transition-colors">{project.title}</h2>
                </Link>
                <div className="flex items-center text-gray-500 font-medium">
                  <MapPin className="h-5 w-5 mr-2 text-primary" />
                  {project.location}
                </div>
                
                <p className="text-gray-600 leading-relaxed text-lg line-clamp-3">
                  {project.description}
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {project.features?.slice(0, 4).map((feature: string, i: number) => (
                    <div key={i} className="flex items-center text-gray-700">
                      <div className="w-2 h-2 bg-primary rounded-full mr-2" />
                      {feature}
                    </div>
                  ))}
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <div className="flex justify-between mb-2 font-bold text-gray-700">
                    <span className="flex items-center"><BarChart className="h-4 w-4 mr-2" /> Project Progress</span>
                    <span>{project.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      whileInView={{ width: `${project.progress}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className="bg-primary h-full rounded-full" 
                    />
                  </div>
                  <div className="mt-4 flex justify-between text-sm text-gray-500">
                    <span className="flex items-center"><Calendar className="h-4 w-4 mr-1" /> Completion: {project.completion_date || project.completion}</span>
                    <span className="text-primary font-bold cursor-pointer hover:underline">Investor Brochure available</span>
                  </div>
                </div>

                <Link 
                  to={`/projects/${project.id}`}
                  className="bg-black text-white px-8 py-3 rounded-lg font-bold hover:bg-primary hover:text-black transition-all duration-300 flex items-center w-fit"
                >
                  View Details <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </div>
            </motion.div>
          ))}
          
          {filteredProjects.length === 0 && (
            <div className="text-center text-gray-500 py-20">
              <p className="text-xl">No ongoing projects found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Projects;
