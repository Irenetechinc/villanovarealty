import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Edit, Trash, Plus, ArrowUp, ArrowDown, Save, X } from 'lucide-react';

interface AboutSection {
  id: string;
  type: 'hero' | 'content_split' | 'features_grid' | 'team_grid';
  title: string;
  subtitle?: string;
  content?: string;
  image_url?: string;
  items?: any[];
  order_index: number;
  is_visible: boolean;
}

const SECTION_TYPES = [
  { value: 'hero', label: 'Hero Section' },
  { value: 'content_split', label: 'Split Content (Text + Items)' },
  { value: 'features_grid', label: 'Features Grid' },
  { value: 'team_grid', label: 'Team Grid' },
];

const AboutSectionsEditor = () => {
  const [sections, setSections] = useState<AboutSection[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Partial<AboutSection>>({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    try {
      const { data, error } = await supabase
        .from('about_sections')
        .select('*')
        .order('order_index');
      
      if (error) throw error;
      setSections(data || []);
    } catch (error) {
      console.error('Error fetching sections:', error);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sections.length - 1) return;

    const newSections = [...sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap order_index
    const tempOrder = newSections[index].order_index;
    newSections[index].order_index = newSections[targetIndex].order_index;
    newSections[targetIndex].order_index = tempOrder;

    // Swap in array
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    
    setSections(newSections);

    // Update DB
    try {
      const updates = [
        { id: newSections[index].id, order_index: newSections[index].order_index },
        { id: newSections[targetIndex].id, order_index: newSections[targetIndex].order_index }
      ];

      for (const update of updates) {
        await supabase.from('about_sections').update({ order_index: update.order_index }).eq('id', update.id);
      }
    } catch (error) {
      console.error('Error updating order:', error);
      fetchSections(); // Revert on error
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this section?')) return;
    try {
      const { error } = await supabase.from('about_sections').delete().eq('id', id);
      if (error) throw error;
      setSections(sections.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error deleting section:', error);
      alert('Failed to delete section');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      // Ensure items is valid JSON
      const sectionData = {
        ...editingSection,
        items: typeof editingSection.items === 'string' ? JSON.parse(editingSection.items) : (editingSection.items || []),
        order_index: editingSection.order_index ?? sections.length
      };

      if (editingSection.id) {
        const { error } = await supabase
          .from('about_sections')
          .update(sectionData)
          .eq('id', editingSection.id);
        if (error) throw error;

        // Save Revision
        await supabase.from('about_section_revisions').insert({
            section_id: editingSection.id,
            content_snapshot: sectionData
        });
      } else {
        const { error } = await supabase
          .from('about_sections')
          .insert([sectionData]);
        if (error) throw error;
      }

      await fetchSections();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving section:', error);
      alert('Failed to save section');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'image_url' | 'item_image', itemIndex?: number) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    // Validation
    if (file.size > 5 * 1024 * 1024) {
      alert('File is too large. Max size is 5MB.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      alert('Invalid file type. Only JPG, PNG, GIF, WEBP are allowed.');
      return;
    }
    
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to a generic bucket or reusing one (using 'project-images' as a fallback if specific one doesn't exist, ideally create 'content-images')
      // Let's assume 'project-images' exists from previous turns or use a new one. 
      // Safest is to use 'public' if available or create one. 
      // I'll try 'project-images' as it likely exists.
      const { error: uploadError } = await supabase.storage
        .from('project-images') 
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('project-images').getPublicUrl(filePath);
      const url = data.publicUrl;

      if (field === 'image_url') {
        setEditingSection(prev => ({ ...prev, image_url: url }));
      } else if (field === 'item_image' && itemIndex !== undefined) {
        const items = [...(editingSection.items || [])];
        items[itemIndex] = { ...items[itemIndex], image: url };
        setEditingSection(prev => ({ ...prev, items }));
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const addNewItem = (subtype?: 'stat' | 'feature') => {
    const items = [...(editingSection.items || [])];
    if (editingSection.type === 'team_grid') {
      items.push({ name: '', role: '', image: '' });
    } else if (editingSection.type === 'features_grid') {
      items.push({ title: '', description: '', icon: 'Star' });
    } else if (editingSection.type === 'content_split') {
      if (subtype === 'feature') {
         items.push({ title: '', description: '', icon: 'Star' });
      } else {
         items.push({ label: '', value: '' });
      }
    } else {
      items.push({ label: '', value: '' });
    }
    setEditingSection(prev => ({ ...prev, items }));
  };

  const updateItem = (index: number, key: string, value: string) => {
    const items = [...(editingSection.items || [])];
    items[index] = { ...items[index], [key]: value };
    setEditingSection(prev => ({ ...prev, items }));
  };

  const removeItem = (index: number) => {
    const items = [...(editingSection.items || [])];
    items.splice(index, 1);
    setEditingSection(prev => ({ ...prev, items }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">About Page Sections</h3>
        <button
          onClick={() => {
            setEditingSection({ type: 'content_split', items: [], is_visible: true });
            setIsModalOpen(true);
          }}
          className="bg-primary text-white px-4 py-2 rounded-md flex items-center hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Section
        </button>
      </div>

      <div className="bg-white rounded-md shadow overflow-hidden">
        <ul className="divide-y divide-gray-200">
          {sections.map((section, index) => (
            <li key={section.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center space-x-4">
                <div className="flex flex-col space-y-1">
                  <button 
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === sections.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{section.title}</h4>
                  <p className="text-xs text-gray-500 capitalize">{section.type.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 text-xs rounded-full ${section.is_visible ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {section.is_visible ? 'Visible' : 'Hidden'}
                </span>
                <button
                  onClick={() => {
                    setEditingSection(section);
                    setIsModalOpen(true);
                  }}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(section.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{editingSection.id ? 'Edit Section' : 'New Section'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Section Type</label>
                  <select
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={editingSection.type}
                    onChange={(e) => setEditingSection({ ...editingSection, type: e.target.value as any, items: [] })}
                    disabled={!!editingSection.id}
                  >
                    {SECTION_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Visibility</label>
                  <div className="mt-2">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                        checked={editingSection.is_visible}
                        onChange={(e) => setEditingSection({ ...editingSection, is_visible: e.target.checked })}
                      />
                      <span className="ml-2 text-gray-700">Visible on site</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Title</label>
                  <input
                    type="text"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={editingSection.title || ''}
                    onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Subtitle</label>
                  <input
                    type="text"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={editingSection.subtitle || ''}
                    onChange={(e) => setEditingSection({ ...editingSection, subtitle: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Content</label>
                <textarea
                  rows={4}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={editingSection.content || ''}
                  onChange={(e) => setEditingSection({ ...editingSection, content: e.target.value })}
                />
              </div>

              {/* Image Upload for Section */}
              {(editingSection.type === 'hero' || editingSection.type === 'content_split') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Section Image</label>
                  <div className="mt-1 flex items-center space-x-4">
                    {editingSection.image_url && (
                      <img src={editingSection.image_url} alt="Section" className="h-20 w-32 object-cover rounded border" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'image_url')}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                </div>
              )}

              {/* Dynamic Items Editor */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {editingSection.type === 'team_grid' ? 'Team Members' : 
                     editingSection.type === 'features_grid' ? 'Features' : 'Additional Items'}
                  </label>
                  <div className="flex gap-2">
                    {editingSection.type === 'content_split' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => addNewItem('stat')}
                          className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700 font-medium flex items-center"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add Stat
                        </button>
                        <button
                          type="button"
                          onClick={() => addNewItem('feature')}
                          className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700 font-medium flex items-center"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add Feature
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addNewItem()}
                        className="text-sm text-primary hover:text-blue-700 font-medium flex items-center"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Item
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-3 bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                  {editingSection.items?.map((item, index) => (
                    <div key={index} className="flex gap-3 items-start bg-white p-3 rounded shadow-sm">
                      {editingSection.type === 'team_grid' ? (
                        <>
                          <div className="flex-1 space-y-2">
                            <input
                              placeholder="Name"
                              className="w-full text-sm border-gray-300 rounded"
                              value={item.name || ''}
                              onChange={(e) => updateItem(index, 'name', e.target.value)}
                            />
                            <input
                              placeholder="Role"
                              className="w-full text-sm border-gray-300 rounded"
                              value={item.role || ''}
                              onChange={(e) => updateItem(index, 'role', e.target.value)}
                            />
                            <input
                              type="file"
                              accept="image/*"
                              className="text-xs"
                              onChange={(e) => handleFileUpload(e, 'item_image', index)}
                            />
                          </div>
                          {item.image && <img src={item.image} className="h-16 w-16 object-cover rounded" />}
                        </>
                      ) : (
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          {/* Determine if it's a Stat (label/value) or Feature (title/desc) based on keys or section type */}
                          {(editingSection.type === 'features_grid' || (item.title !== undefined || item.description !== undefined)) ? (
                            <>
                              <input
                                placeholder="Title"
                                className="text-sm border-gray-300 rounded"
                                value={item.title || ''}
                                onChange={(e) => updateItem(index, 'title', e.target.value)}
                              />
                              <input
                                placeholder="Description"
                                className="text-sm border-gray-300 rounded"
                                value={item.description || ''}
                                onChange={(e) => updateItem(index, 'description', e.target.value)}
                              />
                              <select
                                className="text-sm border-gray-300 rounded col-span-2"
                                value={item.icon || 'Star'}
                                onChange={(e) => updateItem(index, 'icon', e.target.value)}
                              >
                                <option value="Star">Star</option>
                                <option value="Shield">Shield</option>
                                <option value="Users">Users</option>
                                <option value="Target">Target</option>
                                <option value="Award">Award</option>
                                <option value="Building">Building</option>
                                <option value="CheckCircle">CheckCircle</option>
                              </select>
                            </>
                          ) : (
                            <>
                              <input
                                placeholder="Label (e.g. Clients)"
                                className="text-sm border-gray-300 rounded"
                                value={item.label || ''}
                                onChange={(e) => updateItem(index, 'label', e.target.value)}
                              />
                              <input
                                placeholder="Value (e.g. 100+)"
                                className="text-sm border-gray-300 rounded"
                                value={item.value || ''}
                                onChange={(e) => updateItem(index, 'value', e.target.value)}
                              />
                            </>
                          )}
                        </div>
                      )}
                      <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {(!editingSection.items || editingSection.items.length === 0) && (
                    <p className="text-sm text-gray-500 text-center italic">No items added yet.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {uploading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AboutSectionsEditor;
