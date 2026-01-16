import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, Edit, Trash, MessageSquare, CheckCircle, XCircle, Send } from 'lucide-react';
import { sendEmail } from '@/lib/email';

import AboutSectionsEditor from '@/components/admin/AboutSectionsEditor';
import AdminSidebar from './components/AdminSidebar';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AuctionManagement from './components/AuctionManagement';
import UserManagement from './components/UserManagement';
import AdRoom from './components/AdRoom';
import Subscription from './components/Subscription';

type TabType = 'analytics' | 'properties' | 'projects' | 'auctions' | 'agents' | 'users' | 'messages' | 'contact' | 'about' | 'adroom' | 'subscription';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<TabType>('analytics');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [properties, setProperties] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [contactInfo, setContactInfo] = useState<any>({
    address: '', phone: '', email_info: '', email_sales: '',
    business_hours_weekdays: '', business_hours_saturday: '', business_hours_sunday: '',
    whatsapp_number: '', facebook_link: '', twitter_link: '', instagram_link: '', linkedin_link: ''
  });
  const [loading, setLoading] = useState(true);
  const [updatingContact, setUpdatingContact] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  
  const [newProject, setNewProject] = useState({
    title: '',
    description: '',
    location: '',
    status: 'Planning',
    completion_date: '',
    images: '',
    features: '',
    progress: 0,
  });

  const [newAgent, setNewAgent] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    office_location: '',
    image_url: '',
  });

  const [agentImageFile, setAgentImageFile] = useState<File | null>(null);
  const [uploadingAgentImage, setUploadingAgentImage] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectImageFiles, setProjectImageFiles] = useState<File[]>([]);
  const [uploadingProjectImages, setUploadingProjectImages] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [propertyImageFiles, setPropertyImageFiles] = useState<File[]>([]);
  const [uploadingPropertyImages, setUploadingPropertyImages] = useState(false);
  const [existingPropertyImages, setExistingPropertyImages] = useState<any[]>([]);

  const [newProperty, setNewProperty] = useState({
    title: '',
    description: '',
    price: '',
    type: 'house',
    status: 'available',
    address: {
      street: '',
      city: '',
      state: '',
      zip: '',
    },
    specifications: {
      bedrooms: 0,
      bathrooms: 0,
      sqft: 0,
      yearBuilt: '',
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch properties
      const { data: propertiesData } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });
      
      setProperties(propertiesData || []);

      // Fetch projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      
      setProjects(projectsData || []);

      // Fetch agents
      const { data: agentsData } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false });

      setAgents(agentsData || []);

      // Fetch messages
      const { data: messagesData } = await supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false });

      setMessages(messagesData || []);

      // Fetch contact info
      const { data: contactData } = await supabase
        .from('contact_info')
        .select('*')
        .single();
      
      if (contactData) {
        setContactInfo(contactData);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContactInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingContact(true);
    try {
      const { error } = await supabase
        .from('contact_info')
        .update(contactInfo)
        .eq('id', contactInfo.id);

      if (error) throw error;
      alert('Contact information updated successfully!');
    } catch (error) {
      console.error('Error updating contact info:', error);
      alert('Failed to update contact info');
    } finally {
      setUpdatingContact(false);
    }
  };

  const resetPropertyForm = () => {
    setNewProperty({
      title: '',
      description: '',
      price: '',
      type: 'house',
      status: 'available',
      address: { street: '', city: '', state: '', zip: '' },
      specifications: { bedrooms: 0, bathrooms: 0, sqft: 0, yearBuilt: '' },
    });
    setEditingPropertyId(null);
    setPropertyImageFiles([]);
    setExistingPropertyImages([]);
  };

  const handleEditProperty = async (property: any) => {
    try {
      // Fetch existing images
      const { data: images } = await supabase
        .from('property_images')
        .select('*')
        .eq('property_id', property.id)
        .order('is_primary', { ascending: false });

      setExistingPropertyImages(images || []);

      setNewProperty({
        title: property.title || '',
        description: property.description || '',
        price: property.price || '',
        type: property.type || 'house',
        status: property.status || 'available',
        address: property.address || { street: '', city: '', state: '', zip: '' },
        specifications: property.specifications || { bedrooms: 0, bathrooms: 0, sqft: 0, yearBuilt: '' },
      });
      setEditingPropertyId(property.id);
      setIsPropertyModalOpen(true);
    } catch (error) {
      console.error('Error setting up edit property form:', error);
    }
  };

  const uploadPropertyImage = async (file: File): Promise<string> => {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error(`File ${file.name} is too large. Max size is 5MB.`);
    }
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      throw new Error(`File ${file.name} has invalid type. Only JPG, PNG, GIF are allowed.`);
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('property-images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('property-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleUpdateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPropertyId) return;
    setUploadingPropertyImages(true);

    try {
      // 1. Update Property Details
      const { data, error } = await supabase
        .from('properties')
        .update(newProperty)
        .eq('id', editingPropertyId)
        .select()
        .single();

      if (error) throw error;

      // 2. Upload new images and insert records
      if (propertyImageFiles.length > 0) {
        const uploadedUrls = await Promise.all(propertyImageFiles.map(uploadPropertyImage));
        
        const imageRecords = uploadedUrls.map(url => ({
          property_id: editingPropertyId,
          image_url: url,
          is_primary: false, // Default to false, user can manage later
        }));

        const { error: imagesError } = await supabase
          .from('property_images')
          .insert(imageRecords);

        if (imagesError) throw imagesError;
      }

      setProperties((prev) => prev.map(p => p.id === editingPropertyId ? data : p));
      setIsPropertyModalOpen(false);
      resetPropertyForm();
      alert('Property updated successfully!');
    } catch (error: any) {
      console.error('Error updating property:', error);
      alert(`Failed to update property: ${error.message || 'Unknown error'}`);
    } finally {
      setUploadingPropertyImages(false);
    }
  };

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadingPropertyImages(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const propertyData = {
          ...newProperty,
          agent_id: user?.id 
      };

      // 1. Insert Property
      const { data: property, error } = await supabase
        .from('properties')
        .insert([propertyData])
        .select()
        .single();

      if (error) throw error;

      // 2. Upload images and insert records
      if (propertyImageFiles.length > 0) {
        const uploadedUrls = await Promise.all(propertyImageFiles.map(uploadPropertyImage));
        
        const imageRecords = uploadedUrls.map((url, index) => ({
          property_id: property.id,
          image_url: url,
          is_primary: index === 0, // Make the first image primary by default
        }));

        const { error: imagesError } = await supabase
          .from('property_images')
          .insert(imageRecords);

        if (imagesError) throw imagesError;
      }

      setProperties([property, ...properties]);
      setIsPropertyModalOpen(false);
      resetPropertyForm();
      alert('Property added successfully!');
    } catch (error: any) {
      console.error('Error adding property:', error);
      alert(`Failed to add property: ${error.message || 'Unknown error'}`);
    } finally {
      setUploadingPropertyImages(false);
    }
  };

  const handleDeletePropertyImage = async (imageId: string) => {
    if (!window.confirm('Delete this image?')) return;
    try {
      const { error } = await supabase.from('property_images').delete().eq('id', imageId);
      if (error) throw error;
      setExistingPropertyImages(prev => prev.filter(img => img.id !== imageId));
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Failed to delete image');
    }
  };

  const handleSetPrimaryImage = async (imageId: string) => {
    try {
      // Set all to false first
      await supabase.from('property_images').update({ is_primary: false }).eq('property_id', editingPropertyId);
      // Set selected to true
      await supabase.from('property_images').update({ is_primary: true }).eq('id', imageId);
      
      setExistingPropertyImages(prev => prev.map(img => ({
        ...img,
        is_primary: img.id === imageId
      })));
    } catch (error) {
      console.error('Error setting primary image:', error);
      alert('Failed to update primary image');
    }
  };

  const handleDeleteProperty = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this property?')) return;

    try {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
      setProperties(properties.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting property:', error);
      alert('Failed to delete property');
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      setProjects(projects.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project');
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this agent?')) return;

    try {
      const { error } = await supabase.from('agents').delete().eq('id', id);
      if (error) throw error;
      setAgents(agents.filter((a: any) => a.id !== id));
    } catch (error) {
      console.error('Error deleting agent:', error);
      alert('Failed to delete agent');
    }
  };

  const handleDeleteMessage = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;

    try {
      const { error } = await supabase.from('inquiries').delete().eq('id', id);
      if (error) throw error;
      setMessages(messages.filter(m => m.id !== id));
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Failed to delete message');
    }
  };

  const handleOpenReply = async (message: any) => {
    setSelectedMessage(message);
    setReplySubject(`Re: ${message.subject || 'Your Inquiry'}`);
    setReplyContent(`\n\n\n--- Original Message ---\nFrom: ${message.name} <${message.email}>\nDate: ${new Date(message.created_at).toLocaleString()}\n\n${message.message}`);
    setIsReplyModalOpen(true);

    // Mark as read if unread
    if (message.status === 'unread') {
      try {
        await supabase.from('inquiries').update({ status: 'read' }).eq('id', message.id);
        setMessages(prev => prev.map(m => m.id === message.id ? { ...m, status: 'read' } : m));
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingReply(true);

    try {
      // 1. Send email via Edge Function (simulated)
      await sendEmail({
        to: selectedMessage.email,
        subject: replySubject,
        html: `<p>${replyContent.replace(/\n/g, '<br>')}</p>`,
      });

      // 2. Update database
      const { error } = await supabase
        .from('inquiries')
        .update({
          reply_status: 'replied',
          replied_at: new Date().toISOString(),
          admin_reply: replyContent
        })
        .eq('id', selectedMessage.id);

      if (error) throw error;

      // 3. Update local state
      setMessages(prev => prev.map(m => m.id === selectedMessage.id ? { ...m, reply_status: 'replied', replied_at: new Date().toISOString() } : m));
      
      setIsReplyModalOpen(false);
      alert('Reply sent successfully!');
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const uploadAgentImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('agent-images')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from('agent-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadingAgentImage(true);

    try {
      let imageUrl = newAgent.image_url;

      if (agentImageFile) {
        imageUrl = await uploadAgentImage(agentImageFile);
      } else if (!imageUrl) {
        alert('Please upload an image for the agent.');
        setUploadingAgentImage(false);
        return;
      }

      const agentData = { ...newAgent, image_url: imageUrl };

      const { data, error } = await supabase
        .from('agents')
        .insert([agentData])
        .select()
        .single();

      if (error) throw error;

      setAgents((prev) => [data, ...prev]);
      setIsAgentModalOpen(false);
      resetAgentForm();
    } catch (error) {
      console.error('Error adding agent:', error);
      alert('Failed to add agent');
    } finally {
      setUploadingAgentImage(false);
    }
  };

  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgentId) return;
    setUploadingAgentImage(true);

    try {
      let imageUrl = newAgent.image_url;

      if (agentImageFile) {
        imageUrl = await uploadAgentImage(agentImageFile);
      }

      const agentData = { ...newAgent, image_url: imageUrl };

      const { data, error } = await supabase
        .from('agents')
        .update(agentData)
        .eq('id', editingAgentId)
        .select()
        .single();

      if (error) throw error;

      setAgents((prev) => prev.map(a => a.id === editingAgentId ? data : a));
      setIsAgentModalOpen(false);
      resetAgentForm();
    } catch (error) {
      console.error('Error updating agent:', error);
      alert('Failed to update agent');
    } finally {
      setUploadingAgentImage(false);
    }
  };

  const resetAgentForm = () => {
    setNewAgent({
      name: '',
      role: '',
      email: '',
      phone: '',
      office_location: '',
      image_url: '',
    });
    setAgentImageFile(null);
    setEditingAgentId(null);
  };

  const handleEditAgent = (agent: any) => {
    try {
      setNewAgent({
        name: agent.name || '',
        role: agent.role || '',
        email: agent.email || '',
        phone: agent.phone || '',
        office_location: agent.office_location || '',
        image_url: agent.image_url || '',
      });
      setEditingAgentId(agent.id);
      setIsAgentModalOpen(true);
    } catch (error) {
      console.error('Error setting up edit form:', error);
    }
  };

  const resetProjectForm = () => {
    setNewProject({
      title: '',
      description: '',
      location: '',
      status: 'Planning',
      completion_date: '',
      images: '',
      features: '',
      progress: 0,
    });
    setProjectImageFiles([]);
    setEditingProjectId(null);
  };

  const handleEditProject = (project: any) => {
    try {
      setNewProject({
        title: project.title || '',
        description: project.description || '',
        location: project.location || '',
        status: project.status || 'Planning',
        completion_date: project.completion_date || '',
        images: Array.isArray(project.images) ? project.images.join(', ') : (project.images || ''),
        features: Array.isArray(project.features) ? project.features.join(', ') : (project.features || ''),
        progress: project.progress || 0,
      });
      setProjectImageFiles([]);
      setEditingProjectId(project.id);
      setIsProjectModalOpen(true);
    } catch (error) {
      console.error('Error setting up edit project form:', error);
    }
  };

  const uploadProjectImage = async (file: File): Promise<string> => {
    // Client-side validation
    if (file.size > 5 * 1024 * 1024) {
      throw new Error(`File ${file.name} is too large. Max size is 5MB.`);
    }
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      throw new Error(`File ${file.name} has invalid type. Only JPG, PNG, GIF are allowed.`);
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('project-images')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from('project-images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProjectId) return;
    setUploadingProjectImages(true);

    try {
      let imageUrls = newProject.images.split(',').map(url => url.trim()).filter(url => url);

      if (projectImageFiles.length > 0) {
        const newUrls = await Promise.all(projectImageFiles.map(uploadProjectImage));
        imageUrls = [...imageUrls, ...newUrls];
      }

      const { data, error } = await supabase
        .from('projects')
        .update({
          ...newProject,
          images: imageUrls,
          features: newProject.features.split(',').map(f => f.trim()).filter(f => f),
        })
        .eq('id', editingProjectId)
        .select()
        .single();

      if (error) throw error;

      setProjects((prev) => prev.map(p => p.id === editingProjectId ? data : p));
      setIsProjectModalOpen(false);
      resetProjectForm();
    } catch (error: any) {
      console.error('Error updating project:', error);
      alert(`Failed to update project: ${error.message || 'Unknown error'}`);
    } finally {
      setUploadingProjectImages(false);
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadingProjectImages(true);

    try {
      let imageUrls = newProject.images.split(',').map(url => url.trim()).filter(url => url);

      if (projectImageFiles.length > 0) {
        const newUrls = await Promise.all(projectImageFiles.map(uploadProjectImage));
        imageUrls = [...imageUrls, ...newUrls];
      }

      const { data, error } = await supabase
        .from('projects')
        .insert([{
          ...newProject,
          images: imageUrls,
          features: newProject.features.split(',').map(f => f.trim()).filter(f => f),
        }])
        .select()
        .single();

      if (error) throw error;

      setProjects([data, ...projects]);
      setIsProjectModalOpen(false);
      resetProjectForm();
    } catch (error: any) {
      console.error('Error adding project:', error);
      alert(`Failed to add project: ${error.message || 'Unknown error'}`);
    } finally {
      setUploadingProjectImages(false);
    }
  };

  if (loading) return <div className="p-20 text-center">Loading...</div>;

  return (
    <div className="bg-gray-50 min-h-screen">
      {activeTab !== 'adroom' && (
        <AdminSidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />
      )}
      
      <div className={`transition-all duration-300 ${activeTab !== 'adroom' ? (isSidebarCollapsed ? 'ml-20' : 'ml-64') : ''} ${activeTab === 'adroom' ? 'p-0 h-screen' : 'p-8 pt-24'}`}>
        {activeTab === 'analytics' && <AnalyticsDashboard />}
        {activeTab === 'adroom' && <div className="pt-10 h-full"><AdRoom onExit={() => setActiveTab('analytics')} /></div>}
        {activeTab === 'subscription' && <Subscription />}
        {activeTab === 'auctions' && <AuctionManagement />}
        {activeTab === 'users' && <UserManagement />}
        
        {/* Legacy Views */}
        {(activeTab === 'properties' || activeTab === 'projects' || activeTab === 'agents' || activeTab === 'messages' || activeTab === 'contact' || activeTab === 'about') && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
             <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                {activeTab === 'properties' && 'Property Management'}
                {activeTab === 'projects' && 'Project Management'}
                {activeTab === 'agents' && 'Agent Management'}
                {activeTab === 'messages' && 'Inquiry Messages'}
                {activeTab === 'contact' && 'Edit Contact Information'}
                {activeTab === 'about' && 'Manage About Page Content'}
              </h2>
              {activeTab !== 'messages' && activeTab !== 'contact' && activeTab !== 'about' && (
              <button 
                onClick={() => {
                  if (activeTab === 'projects') setIsProjectModalOpen(true);
                  else if (activeTab === 'agents') setIsAgentModalOpen(true);
                  else if (activeTab === 'properties') setIsPropertyModalOpen(true);
                }}
                className="bg-primary text-white px-4 py-2 rounded-md text-sm font-medium flex items-center hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add {activeTab === 'properties' ? 'Property' : activeTab === 'projects' ? 'Project' : 'Agent'}
              </button>
              )}
            </div>

            <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
              {activeTab === 'about' ? (
                <div className="p-6">
                  <AboutSectionsEditor />
                </div>
              ) : activeTab === 'contact' ? (
                <form onSubmit={handleUpdateContactInfo} className="p-6 space-y-6">
                  {/* Contact Form Content */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Address</label>
                      <textarea
                        rows={3}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={contactInfo.address || ''}
                        onChange={(e) => setContactInfo({ ...contactInfo, address: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Phone</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={contactInfo.phone || ''}
                        onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email (Info)</label>
                      <input
                        type="email"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={contactInfo.email_info || ''}
                        onChange={(e) => setContactInfo({ ...contactInfo, email_info: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email (Sales)</label>
                      <input
                        type="email"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={contactInfo.email_sales || ''}
                        onChange={(e) => setContactInfo({ ...contactInfo, email_sales: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">WhatsApp Number</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={contactInfo.whatsapp_number || ''}
                        onChange={(e) => setContactInfo({ ...contactInfo, whatsapp_number: e.target.value })}
                      />
                    </div>
                  </div>

                  <h3 className="text-lg font-medium text-gray-900 pt-4">Business Hours</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Weekdays</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={contactInfo.business_hours_weekdays || ''}
                        onChange={(e) => setContactInfo({ ...contactInfo, business_hours_weekdays: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Saturday</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={contactInfo.business_hours_saturday || ''}
                        onChange={(e) => setContactInfo({ ...contactInfo, business_hours_saturday: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Sunday</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={contactInfo.business_hours_sunday || ''}
                        onChange={(e) => setContactInfo({ ...contactInfo, business_hours_sunday: e.target.value })}
                      />
                    </div>
                  </div>

                  <h3 className="text-lg font-medium text-gray-900 pt-4">Social Media Links</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Facebook</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={contactInfo.facebook_link || ''}
                        onChange={(e) => setContactInfo({ ...contactInfo, facebook_link: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Twitter</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={contactInfo.twitter_link || ''}
                        onChange={(e) => setContactInfo({ ...contactInfo, twitter_link: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Instagram</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={contactInfo.instagram_link || ''}
                        onChange={(e) => setContactInfo({ ...contactInfo, instagram_link: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">LinkedIn</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        value={contactInfo.linkedin_link || ''}
                        onChange={(e) => setContactInfo({ ...contactInfo, linkedin_link: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      type="submit"
                      className="bg-primary text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
                      disabled={updatingContact}
                    >
                      {updatingContact ? 'Updating...' : 'Update Information'}
                    </button>
                  </div>
                </form>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {activeTab === 'properties' ? (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </>
                    ) : activeTab === 'projects' ? (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </>
                    ) : activeTab === 'messages' ? (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                      </>
                    )}
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeTab === 'properties' ? (
                    properties.map((property) => (
                      <tr key={property.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{property.title}</div>
                              <div className="text-sm text-gray-500">{property.address.city}, {property.address.state}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">₦{property.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {property.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            property.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {property.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div 
                            role="button"
                            tabIndex={0}
                            aria-label="Edit property"
                            onClick={() => {
                               handleEditProperty(property);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleEditProperty(property);
                              }
                            }}
                            className="inline-block cursor-pointer p-2 hover:bg-gray-100 rounded-full mr-2"
                          >
                             <Edit className="h-5 w-5 text-indigo-600" />
                          </div>
                          <button 
                            onClick={() => handleDeleteProperty(property.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : activeTab === 'projects' ? (
                    projects.map((project) => (
                      <tr key={project.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{project.title}</div>
                              <div className="text-sm text-gray-500">{project.completion_date}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{project.location}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 max-w-[100px]">
                            <div className="bg-primary h-2.5 rounded-full" style={{ width: `${project.progress}%` }}></div>
                          </div>
                          <span className="text-xs text-gray-500 mt-1">{project.progress}%</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            {project.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div 
                            role="button"
                            tabIndex={0}
                            aria-label="Edit project"
                            onClick={() => {
                               handleEditProject(project);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleEditProject(project);
                              }
                            }}
                            className="inline-block cursor-pointer p-2 hover:bg-gray-100 rounded-full mr-2"
                          >
                             <Edit className="h-5 w-5 text-indigo-600" />
                          </div>
                          <button 
                            onClick={() => handleDeleteProject(project.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : activeTab === 'messages' ? (
                    messages.map((message) => (
                      <tr key={message.id} className={message.status === 'unread' ? 'bg-blue-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{message.name}</span>
                            <span className="text-xs text-gray-500">{message.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 font-medium truncate max-w-xs">{message.subject}</div>
                          <div className="text-xs text-gray-500 truncate max-w-xs">{message.message}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{new Date(message.created_at).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-400">{new Date(message.created_at).toLocaleTimeString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full w-fit ${
                              message.status === 'unread' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {message.status}
                            </span>
                            {message.reply_status === 'replied' && (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 w-fit">
                                Replied
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button 
                            onClick={() => handleOpenReply(message)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                            title="View & Reply"
                          >
                            <MessageSquare className="h-5 w-5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteMessage(message.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    agents.map((agent) => (
                      <tr key={agent.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {agent.image_url && (
                              <img className="h-10 w-10 rounded-full object-cover" src={agent.image_url} alt="" />
                            )}
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{agent.role}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{agent.email}</div>
                          <div className="text-sm text-gray-500">{agent.phone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{agent.office_location}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div 
                            role="button"
                            tabIndex={0}
                            aria-label="Edit agent"
                            onClick={() => {
                               handleEditAgent(agent);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleEditAgent(agent);
                              }
                            }}
                            className="inline-block cursor-pointer p-2 hover:bg-gray-100 rounded-full mr-2"
                          >
                             <Edit className="h-5 w-5 text-indigo-600" />
                          </div>
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteAgent(agent.id);
                            }}
                            className="text-red-600 hover:text-red-900 cursor-pointer"
                          >
                            <Trash className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Property Modal */}
      {isPropertyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">{editingPropertyId ? 'Edit Property' : 'Add New Property'}</h2>
            <form onSubmit={editingPropertyId ? handleUpdateProperty : handleAddProperty} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Property Title</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={newProperty.title}
                  onChange={(e) => setNewProperty({ ...newProperty, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  required
                  rows={3}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={newProperty.description}
                  onChange={(e) => setNewProperty({ ...newProperty, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Price (₦)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newProperty.price}
                    onChange={(e) => setNewProperty({ ...newProperty, price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newProperty.type}
                    onChange={(e) => setNewProperty({ ...newProperty, type: e.target.value })}
                  >
                    <option value="house">House</option>
                    <option value="apartment">Apartment</option>
                    <option value="condo">Condo</option>
                    <option value="townhouse">Townhouse</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newProperty.status}
                    onChange={(e) => setNewProperty({ ...newProperty, status: e.target.value })}
                  >
                    <option value="available">Available</option>
                    <option value="sold">Sold</option>
                    <option value="pending">Pending</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </div>
              </div>

              <h3 className="text-lg font-medium text-gray-900 pt-4">Address</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Street</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newProperty.address.street}
                    onChange={(e) => setNewProperty({ ...newProperty, address: { ...newProperty.address, street: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">City</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newProperty.address.city}
                    onChange={(e) => setNewProperty({ ...newProperty, address: { ...newProperty.address, city: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">State</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newProperty.address.state}
                    onChange={(e) => setNewProperty({ ...newProperty, address: { ...newProperty.address, state: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Zip Code</label>
                  <input
                    type="text"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newProperty.address.zip}
                    onChange={(e) => setNewProperty({ ...newProperty, address: { ...newProperty.address, zip: e.target.value } })}
                  />
                </div>
              </div>

              <h3 className="text-lg font-medium text-gray-900 pt-4">Specifications</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bedrooms</label>
                  <input
                    type="number"
                    min="0"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newProperty.specifications.bedrooms}
                    onChange={(e) => setNewProperty({ ...newProperty, specifications: { ...newProperty.specifications, bedrooms: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bathrooms</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newProperty.specifications.bathrooms}
                    onChange={(e) => setNewProperty({ ...newProperty, specifications: { ...newProperty.specifications, bathrooms: parseFloat(e.target.value) || 0 } })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sq Ft</label>
                  <input
                    type="number"
                    min="0"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newProperty.specifications.sqft}
                    onChange={(e) => setNewProperty({ ...newProperty, specifications: { ...newProperty.specifications, sqft: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Year Built</label>
                  <input
                    type="text"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newProperty.specifications.yearBuilt}
                    onChange={(e) => setNewProperty({ ...newProperty, specifications: { ...newProperty.specifications, yearBuilt: e.target.value } })}
                  />
                </div>
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 pt-4">Property Images</h3>
              <div>
                <div className="mt-2 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <div className="text-center">
                    <div className="mt-2 flex justify-center text-sm text-gray-600">
                      <label htmlFor="property-file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary">
                        <span>Upload files</span>
                        <input id="property-file-upload" name="property-file-upload" type="file" className="sr-only" multiple accept="image/jpeg,image/png,image/gif"
                          onChange={(e) => {
                            if (e.target.files) {
                              setPropertyImageFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
                            }
                          }}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                  </div>
                </div>

                {/* Previews Grid */}
                <div className="mt-4 grid grid-cols-4 gap-4">
                  {/* New Files */}
                  {propertyImageFiles.map((file, index) => (
                    <div key={`new-${index}`} className="relative group">
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt="Preview" 
                        className="h-24 w-full object-cover rounded-lg border border-gray-200" 
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => setPropertyImageFiles(prev => prev.filter((_, i) => i !== index))}
                          className="text-white hover:text-red-400"
                        >
                          <Trash className="h-6 w-6" />
                        </button>
                      </div>
                      <span className="absolute bottom-1 right-1 bg-green-500 text-white text-xs px-1 rounded">New</span>
                    </div>
                  ))}
                  
                  {/* Existing Images */}
                  {existingPropertyImages.map((img) => (
                    <div key={img.id} className="relative group">
                      <img 
                        src={img.image_url} 
                        alt="Property" 
                        className={`h-24 w-full object-cover rounded-lg border-2 ${img.is_primary ? 'border-primary' : 'border-gray-200'}`} 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Error';
                        }}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryImage(img.id)}
                          className={`p-1 rounded-full ${img.is_primary ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
                          title="Set as Primary"
                        >
                          <CheckCircle className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePropertyImage(img.id)}
                          className="text-white hover:text-red-400 p-1"
                          title="Delete Image"
                        >
                          <Trash className="h-5 w-5" />
                        </button>
                      </div>
                      {img.is_primary && (
                        <span className="absolute top-1 left-1 bg-primary text-white text-xs px-1 rounded">Featured</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsPropertyModalOpen(false);
                    resetPropertyForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={uploadingPropertyImages}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 flex items-center"
                  disabled={uploadingPropertyImages}
                >
                  {uploadingPropertyImages ? 'Processing...' : (editingPropertyId ? 'Update Property' : 'Save Property')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">{editingProjectId ? 'Edit Project' : 'Add New Project'}</h2>
            <form onSubmit={editingProjectId ? handleUpdateProject : handleAddProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Project Title</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={newProject.title}
                  onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  required
                  rows={3}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Location</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newProject.location}
                    onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newProject.status}
                    onChange={(e) => setNewProject({ ...newProject, status: e.target.value })}
                  >
                    <option>Planning</option>
                    <option>Under Construction</option>
                    <option>Near Completion</option>
                    <option>Completed</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Completion Date</label>
                  <input
                    type="text"
                    placeholder="e.g. Q4 2025"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newProject.completion_date}
                    onChange={(e) => setNewProject({ ...newProject, completion_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Progress (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={newProject.progress}
                    onChange={(e) => setNewProject({ ...newProject, progress: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Project Images</label>
                
                {/* File Upload */}
                <div className="mt-2 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <div className="text-center">
                    <div className="mt-2 flex justify-center text-sm text-gray-600">
                      <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary">
                        <span>Upload files</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple accept="image/jpeg,image/png,image/gif"
                          onChange={(e) => {
                            if (e.target.files) {
                              setProjectImageFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
                            }
                          }}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                  </div>
                </div>

                {/* Previews */}
                {(projectImageFiles.length > 0 || newProject.images) && (
                  <div className="mt-4 grid grid-cols-4 gap-4">
                    {/* New Files */}
                    {projectImageFiles.map((file, index) => (
                      <div key={`new-${index}`} className="relative group">
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="Preview" 
                          className="h-24 w-full object-cover rounded-lg border border-gray-200" 
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => setProjectImageFiles(prev => prev.filter((_, i) => i !== index))}
                            className="text-white hover:text-red-400"
                          >
                            <Trash className="h-6 w-6" />
                          </button>
                        </div>
                        <span className="absolute bottom-1 right-1 bg-green-500 text-white text-xs px-1 rounded">New</span>
                      </div>
                    ))}
                    
                    {/* Existing URLs */}
                    {newProject.images.split(',').map((url, index) => {
                      const trimmedUrl = url.trim();
                      if (!trimmedUrl) return null;
                      return (
                        <div key={`url-${index}`} className="relative group">
                          <img 
                            src={trimmedUrl} 
                            alt="Existing" 
                            className="h-24 w-full object-cover rounded-lg border border-gray-200" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Error';
                            }}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => {
                                const urls = newProject.images.split(',').map(u => u.trim()).filter(u => u);
                                urls.splice(index, 1);
                                setNewProject({ ...newProject, images: urls.join(', ') });
                              }}
                              className="text-white hover:text-red-400"
                            >
                              <Trash className="h-6 w-6" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Legacy URL Input (Hidden or minimized, but kept for direct URL entry if needed) */}
                <div className="mt-4">
                  <details className="text-xs text-gray-500">
                    <summary className="cursor-pointer hover:text-gray-700">Advanced: Edit Image URLs directly</summary>
                    <input
                      type="text"
                      placeholder="https://..., https://..."
                      className="mt-2 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                      value={newProject.images}
                      onChange={(e) => setNewProject({ ...newProject, images: e.target.value })}
                    />
                  </details>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Key Features (comma separated)</label>
                <input
                  type="text"
                  placeholder="Gym, Pool, 24/7 Power"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={newProject.features}
                  onChange={(e) => setNewProject({ ...newProject, features: e.target.value })}
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsProjectModalOpen(false);
                    resetProjectForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={uploadingProjectImages}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 flex items-center"
                  disabled={uploadingProjectImages}
                >
                  {uploadingProjectImages ? 'Processing...' : (editingProjectId ? 'Update Project' : 'Save Project')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Reply Modal */}
      {isReplyModalOpen && selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Reply to Message</h2>
            
            <div className="mb-6 bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Original Message</h3>
              <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                <div>
                  <span className="text-gray-500">From:</span> <span className="font-medium">{selectedMessage.name}</span>
                </div>
                <div>
                  <span className="text-gray-500">Email:</span> <span className="font-medium">{selectedMessage.email}</span>
                </div>
                <div>
                  <span className="text-gray-500">Date:</span> <span className="font-medium">{new Date(selectedMessage.created_at).toLocaleString()}</span>
                </div>
                <div>
                   <span className="text-gray-500">IP:</span> <span className="font-medium">{selectedMessage.ip_address || 'N/A'}</span>
                </div>
              </div>
              <div className="text-gray-700 whitespace-pre-wrap border-t border-gray-200 pt-2 mt-2">
                {selectedMessage.message}
              </div>
            </div>

            <form onSubmit={handleReplySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Subject</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Reply Message</label>
                <textarea
                  required
                  rows={8}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 font-mono text-sm"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsReplyModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={sendingReply}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 flex items-center"
                  disabled={sendingReply}
                >
                  {sendingReply ? 'Sending...' : 'Send Reply'}
                  {!sendingReply && <Send className="ml-2 h-4 w-4" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Agent Modal */}
      {isAgentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto relative">
            <button 
              onClick={() => setIsAgentModalOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <XCircle className="h-6 w-6" />
            </button>
            <h2 className="text-2xl font-bold mb-4">{editingAgentId ? 'Edit Agent' : 'Add New Agent'}</h2>
            <form onSubmit={editingAgentId ? handleUpdateAgent : handleAddAgent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={newAgent.role}
                  onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value })}
                  placeholder="e.g. Senior Consultant"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={newAgent.email}
                  onChange={(e) => setNewAgent({ ...newAgent, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="text"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={newAgent.phone}
                  onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Office Location</label>
                <input
                  type="text"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={newAgent.office_location}
                  onChange={(e) => setNewAgent({ ...newAgent, office_location: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Image</label>
                <div className="mt-2 flex items-center space-x-4">
                  {newAgent.image_url && (
                    <img 
                      src={newAgent.image_url} 
                      alt="Current" 
                      className="h-12 w-12 rounded-full object-cover border border-gray-200" 
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setAgentImageFile(e.target.files[0]);
                      }
                    }}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
                {!editingAgentId && !agentImageFile && <p className="text-xs text-red-500 mt-1">Image is required for new agents</p>}
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAgentModalOpen(false);
                    resetAgentForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={uploadingAgentImage}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 flex items-center"
                  disabled={uploadingAgentImage}
                >
                  {uploadingAgentImage ? 'Processing...' : (editingAgentId ? 'Update Agent' : 'Save Agent')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
