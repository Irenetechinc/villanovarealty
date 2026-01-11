import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Plus, Edit, Trash, Gavel, Calendar, Clock, Eye, X, MapPin, List } from 'lucide-react';

const BidHistoryModal = ({ auction, onClose }: { auction: any, onClose: () => void }) => {
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBids();
    
    // Realtime subscription for this specific auction's bids
    const subscription = supabase
      .channel(`admin-bids-${auction.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids',
          filter: `auction_id=eq.${auction.id}`
        },
        async (payload) => {
          // Fetch the full bid details including user info
          const { data } = await supabase
            .from('bids')
            .select('*, user:users(email, id)') // Adjust fields as needed based on your users table
            .eq('id', payload.new.id)
            .single();
            
          if (data) {
             setBids(prev => {
                const updated = [data, ...prev];
                // Ensure sorting by amount desc
                return updated.sort((a, b) => b.amount - a.amount);
             });
           }
         }
       )
       .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [auction.id]);

  const fetchBids = async () => {
    try {
      const { data, error } = await supabase
        .from('bids')
        .select('*, user:users(email, id)')
        .eq('auction_id', auction.id)
        .order('amount', { ascending: false });

      if (error) throw error;
      setBids(data || []);
    } catch (error) {
      console.error('Error fetching bids:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Live Bid History</h3>
            <p className="text-sm text-gray-500">{auction.property?.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          {loading ? (
            <div className="text-center py-8">Loading bids...</div>
          ) : bids.length === 0 ? (
            <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
              No bids placed yet.
            </div>
          ) : (
            <div className="space-y-4">
               {/* Summary Cards */}
               <div className="grid grid-cols-3 gap-4 mb-6">
                 <div className="bg-blue-50 p-4 rounded-lg">
                   <p className="text-xs text-blue-600 uppercase font-bold">Total Bids</p>
                   <p className="text-2xl font-bold text-blue-900">{bids.length}</p>
                 </div>
                 <div className="bg-green-50 p-4 rounded-lg">
                   <p className="text-xs text-green-600 uppercase font-bold">Highest Bid</p>
                   <p className="text-2xl font-bold text-green-900">₦{bids[0]?.amount.toLocaleString()}</p>
                 </div>
                 <div className="bg-purple-50 p-4 rounded-lg">
                   <p className="text-xs text-purple-600 uppercase font-bold">Unique Bidders</p>
                   <p className="text-2xl font-bold text-purple-900">
                     {new Set(bids.map(b => b.user_id)).size}
                   </p>
                 </div>
               </div>

              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bidder</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bids.map((bid, index) => (
                    <tr key={bid.id} className={index === 0 ? 'bg-green-50/50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' : 
                          index === 1 ? 'bg-gray-100 text-gray-800' :
                          index === 2 ? 'bg-orange-100 text-orange-800' : 'text-gray-500'
                        }`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {bid.user?.email || 'Unknown User'}
                        </div>
                        <div className="text-xs text-gray-500">ID: {bid.user_id?.slice(0, 8)}...</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-bold ${index === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                          ₦{bid.amount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(bid.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AuctionManagement = () => {
  const [auctions, setAuctions] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedAuctionForBids, setSelectedAuctionForBids] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'auction' | 'property' | 'images' | 'amenities'>('auction');
  
  // Auction Data
  const [auctionForm, setAuctionForm] = useState({
    property_id: '',
    start_time: '',
    end_time: '',
    starting_price: '',
    min_increment: '1000',
    status: 'upcoming'
  });

  // Property Data (Linked)
  const [propertyForm, setPropertyForm] = useState({
    title: '',
    description: '',
    type: 'residential',
    video_url: '',
    // Address
    address_city: '',
    address_state: '',
    address_street: '',
    address_country: 'Nigeria',
    // Specifications
    spec_bedrooms: '',
    spec_bathrooms: '',
    spec_sqft: '',
    spec_parking: '',
    // Images
    images: [] as string[]
  });

  // Amenities as comma separated string for easier editing
  const [amenitiesText, setAmenitiesText] = useState('');

  useEffect(() => {
    fetchData();

    // Global subscription for auction price updates
    const subscription = supabase
      .channel('admin-auctions-list')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions'
        },
        (payload) => {
          setAuctions(prev => prev.map(a => 
            a.id === payload.new.id 
              ? { ...a, ...payload.new, property: a.property } // Preserve property join
              : a
          ));
        }
      )
      .subscribe();

    // Also listen for BIDS to update the auction list prices optimistically/immediately
    const bidSubscription = supabase
      .channel('admin-global-bids')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids'
        },
        (payload) => {
           setAuctions(prev => prev.map(a => {
             if (a.id === payload.new.auction_id) {
               // Only update if higher
               if (payload.new.amount > a.current_bid) {
                 return { ...a, current_bid: payload.new.amount };
               }
             }
             return a;
           }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
      supabase.removeChannel(bidSubscription);
    };
  }, []);

  const fetchData = async () => {
    try {
      // Fetch auctions with FULL property details
      const { data: auctionsData, error: auctionsError } = await supabase
        .from('auctions')
        .select(`
          *,
          property:properties(
            *,
            property_images(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (auctionsError) throw auctionsError;

      // Fetch available properties for the dropdown
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('*, property_images(*)')
        .eq('status', 'available');

      if (propertiesError) throw propertiesError;

      setAuctions(auctionsData || []);
      setProperties(propertiesData || []);
    } catch (error) {
      console.error('Error fetching auction data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAuctionForm({
      property_id: '',
      start_time: '',
      end_time: '',
      starting_price: '',
      min_increment: '1000',
      status: 'upcoming'
    });
    setPropertyForm({
      title: '',
      description: '',
      type: 'residential',
      video_url: '',
      address_city: '',
      address_state: '',
      address_street: '',
      address_country: 'Nigeria',
      spec_bedrooms: '',
      spec_bathrooms: '',
      spec_sqft: '',
      spec_parking: '',
      images: []
    });
    setAmenitiesText('');
    setEditingId(null);
    setActiveTab('auction');
  };

  // Helper for datetime-local input
  const toDateTimeLocal = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleEdit = (auction: any) => {
    setEditingId(auction.id);
    
    // 1. Set Auction Form
    setAuctionForm({
      property_id: auction.property_id,
      start_time: auction.start_time ? toDateTimeLocal(auction.start_time) : '',
      end_time: auction.end_time ? toDateTimeLocal(auction.end_time) : '',
      starting_price: auction.starting_bid || auction.starting_price || '',
      min_increment: auction.min_increment || '1000',
      status: auction.status || 'upcoming'
    });

    // 2. Set Property Form
    const prop = auction.property || {};
    const addr = prop.address || {};
    const specs = prop.specifications || {};
    const images = prop.property_images?.map((img: any) => img.image_url) || [];

    setPropertyForm({
      title: prop.title || '',
      description: prop.description || '',
      type: prop.type || 'residential',
      video_url: specs.video_url || prop.video_url || '',
      address_city: addr.city || '',
      address_state: addr.state || '',
      address_street: addr.street || '',
      address_country: addr.country || 'Nigeria',
      spec_bedrooms: specs.bedrooms || '',
      spec_bathrooms: specs.bathrooms || '',
      spec_sqft: specs.sqft || '',
      spec_parking: specs.parking || '',
      images: images
    });

    // 3. Set Amenities
    const features = prop.specifications?.amenities || prop.features || [];
    setAmenitiesText(Array.isArray(features) ? features.join(', ') : '');

    setIsModalOpen(true);
  };

  const handlePropertyChange = (propertyId: string) => {
    if (propertyId === 'custom') {
      // Clear forms for custom entry
      setAuctionForm(prev => ({ ...prev, property_id: 'custom' }));
      setPropertyForm({
        title: '',
        description: '',
        type: 'residential',
        video_url: '',
        address_city: '',
        address_state: '',
        address_street: '',
        address_country: 'Nigeria',
        spec_bedrooms: '',
        spec_bathrooms: '',
        spec_sqft: '',
        spec_parking: '',
        images: []
      });
      setAmenitiesText('');
      return;
    }

    setAuctionForm(prev => ({ ...prev, property_id: propertyId }));
    
    // Auto-populate logic
    const selectedProp = properties.find(p => p.id === propertyId);
    if (selectedProp) {
      const addr = selectedProp.address || {};
      const specs = selectedProp.specifications || {};
      const images = selectedProp.property_images?.map((img: any) => img.image_url) || [];
      const features = specs.amenities || selectedProp.features || [];

      setPropertyForm({
        title: selectedProp.title || '',
        description: selectedProp.description || '',
        type: selectedProp.type || 'residential',
        video_url: specs.video_url || selectedProp.video_url || '',
        address_city: addr.city || '',
        address_state: addr.state || '',
        address_street: addr.street || '',
        address_country: addr.country || 'Nigeria',
        spec_bedrooms: specs.bedrooms || '',
        spec_bathrooms: specs.bathrooms || '',
        spec_sqft: specs.sqft || '',
        spec_parking: specs.parking || '',
        images: images
      });
      setAmenitiesText(Array.isArray(features) ? features.join(', ') : '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 1. Prepare Auction Payload (using starting_bid)
      const auctionPayload: any = {
        title: propertyForm.title,
        start_time: auctionForm.start_time,
        end_time: auctionForm.end_time,
        starting_bid: parseFloat(auctionForm.starting_price), // Correct column name
        min_increment: parseFloat(auctionForm.min_increment),
        status: auctionForm.status
      };

      if (!editingId) {
        auctionPayload.current_bid = auctionPayload.starting_bid;
      }

      // 2. Prepare Property Payload
      const propertyPayload = {
        title: propertyForm.title,
        description: propertyForm.description,
        type: propertyForm.type,
        // video_url: propertyForm.video_url, // Column does not exist
        status: 'available', // Default for auction properties
        address: {
            street: propertyForm.address_street,
            city: propertyForm.address_city,
            state: propertyForm.address_state,
            country: propertyForm.address_country
        },
        specifications: {
            bedrooms: parseInt(propertyForm.spec_bedrooms) || 0,
            bathrooms: parseInt(propertyForm.spec_bathrooms) || 0,
            sqft: parseInt(propertyForm.spec_sqft) || 0,
            parking: parseInt(propertyForm.spec_parking) || 0,
            amenities: amenitiesText.split(',').map(s => s.trim()).filter(s => s),
            video_url: propertyForm.video_url // Moved to specifications JSONB
        }
      };

      let currentPropertyId = auctionForm.property_id;

      // Handle Custom Auction Creation or Updates
      if (currentPropertyId === 'custom' || (!editingId && currentPropertyId === 'custom')) {
        // Create new property first
        const { data: newProp, error: propError } = await supabase
          .from('properties')
          .insert([propertyPayload])
          .select()
          .single();
        
        if (propError) throw propError;
        currentPropertyId = newProp.id;
        auctionPayload.property_id = currentPropertyId;
      } else {
         auctionPayload.property_id = currentPropertyId;
      }

      // 3. Update or Insert Auction
      if (editingId) {
        // Update Auction
        const { error: auctionError } = await supabase
          .from('auctions')
          .update(auctionPayload)
          .eq('id', editingId);

        if (auctionError) throw auctionError;

        // Update Property (only if it exists and isn't a fresh custom one we just made, though updating it again is harmless)
        if (currentPropertyId) {
            const { error: propError } = await supabase
                .from('properties')
                .update(propertyPayload)
                .eq('id', currentPropertyId);
            
            if (propError) throw propError;
        }

      } else {
        // Create Auction
        const { error } = await supabase
          .from('auctions')
          .insert([auctionPayload])
          .single();

        if (error) throw error;
      }

      // Refresh Data
      fetchData();
      setIsModalOpen(false);
      resetForm();
      alert('Auction saved successfully!');

    } catch (error: any) {
      console.error('Error saving auction:', error);
      alert(`Failed to save: ${error.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure? This will delete all associated bids.')) return;
    try {
      const { error } = await supabase.from('auctions').delete().eq('id', id);
      if (error) throw error;
      setAuctions(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting auction:', error);
      alert('Failed to delete auction');
    }
  };

  if (loading) return <div>Loading auctions...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Auction Management</h2>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-primary text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Auction
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        {/* Scrollable Container with hidden scrollbars */}
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price Info</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {auctions.map((auction) => (
                <tr key={auction.id}>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-indigo-50 rounded-lg mr-3">
                        <Gavel className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {auction.property?.title || 'Unknown Property'}
                        </div>
                        <div className="text-xs text-gray-500">ID: {auction.id.slice(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      <div className="flex items-center mb-1">
                        <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                        Start: {new Date(auction.start_time).toLocaleDateString()} {new Date(auction.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 mr-1 text-gray-400" />
                        End: {new Date(auction.end_time).toLocaleDateString()} {new Date(auction.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 font-medium">
                      Curr: ₦{(auction.current_bid || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      Start: ₦{(auction.starting_bid || auction.starting_price || 0).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      auction.status === 'active' ? 'bg-green-100 text-green-800' :
                      auction.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {auction.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => setSelectedAuctionForBids(auction)}
                      className="text-gray-600 hover:text-gray-900 mr-3"
                      title="View Bids"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    <button onClick={() => handleEdit(auction)} className="text-indigo-600 hover:text-indigo-900 mr-3">
                      <Edit className="h-5 w-5" />
                    </button>
                    <button onClick={() => handleDelete(auction.id)} className="text-red-600 hover:text-red-900">
                      <Trash className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {auctions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No auctions found. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bid History Modal */}
      {selectedAuctionForBids && (
        <BidHistoryModal 
          auction={selectedAuctionForBids} 
          onClose={() => setSelectedAuctionForBids(null)} 
        />
      )}

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full p-0 max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-xl font-bold text-gray-900">{editingId ? 'Edit Auction & Property' : 'New Auction'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-6 w-6" />
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar / Tabs */}
                <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 space-y-2 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                    <button 
                        onClick={() => setActiveTab('auction')}
                        className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'auction' ? 'bg-primary text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                        <Gavel className="h-4 w-4 mr-3" /> Auction Settings
                    </button>
                    <button 
                        onClick={() => setActiveTab('property')}
                        className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'property' ? 'bg-primary text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                        <MapPin className="h-4 w-4 mr-3" /> Property Details
                    </button>
                    <button 
                        onClick={() => setActiveTab('amenities')}
                        className={`w-full flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'amenities' ? 'bg-primary text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
                    >
                        <List className="h-4 w-4 mr-3" /> Amenities
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                    <form id="auctionForm" onSubmit={handleSubmit} className="space-y-6">
                        
                        {/* AUCTION SETTINGS TAB */}
                        {activeTab === 'auction' && (
                            <div className="space-y-6 animate-fadeIn">
                                <h4 className="text-lg font-bold border-b pb-2 mb-4">Auction Configuration</h4>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Property</label>
                                    <select
                                        required
                                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-primary focus:border-transparent"
                                        value={auctionForm.property_id}
                                        onChange={(e) => handlePropertyChange(e.target.value)}
                                        disabled={!!editingId}
                                    >
                                        <option value="">Choose a property...</option>
                                        <option value="custom" className="font-bold text-indigo-600">+ Custom Auction (Manual Entry)</option>
                                        <hr />
                                        {properties.map(p => (
                                            <option key={p.id} value={p.id}>{p.title}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Select an existing property to auto-populate details, or 'Custom' to enter manually.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                                        <input
                                            type="datetime-local"
                                            required
                                            className="w-full border border-gray-300 rounded-lg p-3"
                                            value={auctionForm.start_time}
                                            onChange={(e) => setAuctionForm({ ...auctionForm, start_time: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                                        <input
                                            type="datetime-local"
                                            required
                                            className="w-full border border-gray-300 rounded-lg p-3"
                                            value={auctionForm.end_time}
                                            onChange={(e) => setAuctionForm({ ...auctionForm, end_time: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Starting Price (₦)</label>
                                        <input
                                            type="number"
                                            required
                                            className="w-full border border-gray-300 rounded-lg p-3"
                                            value={auctionForm.starting_price}
                                            onChange={(e) => setAuctionForm({ ...auctionForm, starting_price: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Min Increment (₦)</label>
                                        <input
                                            type="number"
                                            required
                                            className="w-full border border-gray-300 rounded-lg p-3"
                                            value={auctionForm.min_increment}
                                            onChange={(e) => setAuctionForm({ ...auctionForm, min_increment: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg p-3"
                                        value={auctionForm.status}
                                        onChange={(e) => setAuctionForm({ ...auctionForm, status: e.target.value })}
                                    >
                                        <option value="upcoming">Upcoming</option>
                                        <option value="active">Active (Live)</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* PROPERTY DETAILS TAB */}
                        {activeTab === 'property' && (
                            <div className="space-y-6 animate-fadeIn">
                                <h4 className="text-lg font-bold border-b pb-2 mb-4">Property Information</h4>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Property Title</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full border border-gray-300 rounded-lg p-3"
                                        value={propertyForm.title}
                                        onChange={(e) => setPropertyForm({ ...propertyForm, title: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <textarea
                                        rows={5}
                                        className="w-full border border-gray-300 rounded-lg p-3"
                                        value={propertyForm.description}
                                        onChange={(e) => setPropertyForm({ ...propertyForm, description: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                     <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                        <input
                                            type="text"
                                            className="w-full border border-gray-300 rounded-lg p-3"
                                            value={propertyForm.address_city}
                                            onChange={(e) => setPropertyForm({ ...propertyForm, address_city: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                        <input
                                            type="text"
                                            className="w-full border border-gray-300 rounded-lg p-3"
                                            value={propertyForm.address_state}
                                            onChange={(e) => setPropertyForm({ ...propertyForm, address_state: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-4">
                                     <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Beds</label>
                                        <input
                                            type="number"
                                            className="w-full border border-gray-300 rounded-lg p-3"
                                            value={propertyForm.spec_bedrooms}
                                            onChange={(e) => setPropertyForm({ ...propertyForm, spec_bedrooms: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Baths</label>
                                        <input
                                            type="number"
                                            className="w-full border border-gray-300 rounded-lg p-3"
                                            value={propertyForm.spec_bathrooms}
                                            onChange={(e) => setPropertyForm({ ...propertyForm, spec_bathrooms: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Sq Ft</label>
                                        <input
                                            type="number"
                                            className="w-full border border-gray-300 rounded-lg p-3"
                                            value={propertyForm.spec_sqft}
                                            onChange={(e) => setPropertyForm({ ...propertyForm, spec_sqft: e.target.value })}
                                        />
                                    </div>
                                     <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                        <select
                                            className="w-full border border-gray-300 rounded-lg p-3"
                                            value={propertyForm.type}
                                            onChange={(e) => setPropertyForm({ ...propertyForm, type: e.target.value })}
                                        >
                                            <option value="residential">Residential</option>
                                            <option value="commercial">Commercial</option>
                                            <option value="land">Land</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                         {/* AMENITIES TAB */}
                         {activeTab === 'amenities' && (
                            <div className="space-y-6 animate-fadeIn">
                                <h4 className="text-lg font-bold border-b pb-2 mb-4">Features & Amenities</h4>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Amenities (Comma separated)</label>
                                    <textarea
                                        rows={8}
                                        placeholder="e.g. Swimming Pool, 24/7 Security, Gym, Smart Home..."
                                        className="w-full border border-gray-300 rounded-lg p-3 font-mono text-sm"
                                        value={amenitiesText}
                                        onChange={(e) => setAmenitiesText(e.target.value)}
                                    />
                                    <p className="text-xs text-gray-500 mt-2">Enter features separated by commas. These will be displayed as a list on the details page.</p>
                                </div>
                            </div>
                        )}

                    </form>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
                <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => {
                         // Trigger form submission programmatically
                         const form = document.getElementById('auctionForm') as HTMLFormElement;
                         if (form) form.requestSubmit();
                    }}
                    className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg"
                >
                    {editingId ? 'Save Changes' : 'Create Auction'}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuctionManagement;