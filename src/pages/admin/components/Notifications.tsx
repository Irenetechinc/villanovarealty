import { useState, useEffect } from 'react';
import { Bell, X, Phone, Facebook, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';

interface Notification {
    id: string;
    type: 'lead' | 'inspection' | 'system';
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    metadata?: {
        phone?: string;
        facebook_url?: string;
        whatsapp_url?: string;
        [key: string]: any;
    };
}

const Notifications = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        fetchNotifications();

        // Real-time listener
        const channel = supabase
            .channel('notifications_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
                const newNotif = payload.new as Notification;
                setNotifications(prev => [newNotif, ...prev]);
                setUnreadCount(prev => prev + 1);
                
                // Play sound
                const audio = new Audio('/notification.mp3'); // Ensure this file exists or use a base64 string
                audio.play().catch(e => console.log('Audio play failed', e));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchNotifications = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (data) {
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
        }
    };

    const markAsRead = async () => {
        if (unreadCount === 0) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);
        
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    return (
        <div className="relative">
            <button 
                onClick={() => { setIsOpen(!isOpen); markAsRead(); }}
                className="relative p-2 text-slate-400 hover:text-white transition-colors"
            >
                <Bell className="h-6 w-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold border border-slate-900">
                        {unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
                    >
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                            <h3 className="font-bold text-white">Notifications</h3>
                            <button onClick={() => setIsOpen(false)}><X className="h-4 w-4 text-slate-400 hover:text-white" /></button>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-sm">
                                    No notifications yet.
                                </div>
                            ) : (
                                notifications.map(notif => (
                                    <div key={notif.id} className={`p-4 border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${!notif.is_read ? 'bg-slate-800/20' : ''}`}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                                                notif.type === 'lead' ? 'bg-green-500/20 text-green-400' :
                                                notif.type === 'inspection' ? 'bg-purple-500/20 text-purple-400' :
                                                'bg-blue-500/20 text-blue-400'
                                            }`}>
                                                {notif.type}
                                            </span>
                                            <span className="text-[10px] text-slate-500">{new Date(notif.created_at).toLocaleTimeString()}</span>
                                        </div>
                                        <h4 className="text-sm font-bold text-white mb-1">{notif.title}</h4>
                                        <p className="text-xs text-slate-400 mb-3">{notif.message}</p>
                                        
                                        {/* Action Buttons */}
                                        {notif.metadata && (
                                            <div className="flex space-x-2 mt-2">
                                                {notif.metadata.phone && (
                                                    <a href={`tel:${notif.metadata.phone}`} className="flex items-center px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs hover:bg-green-600/30">
                                                        <Phone className="h-3 w-3 mr-1" /> Call
                                                    </a>
                                                )}
                                                {notif.metadata.whatsapp_url && (
                                                    <a href={notif.metadata.whatsapp_url} target="_blank" rel="noreferrer" className="flex items-center px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30">
                                                        <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                                                    </a>
                                                )}
                                                {notif.metadata.facebook_url && (
                                                    <a href={notif.metadata.facebook_url} target="_blank" rel="noreferrer" className="flex items-center px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs hover:bg-blue-600/30">
                                                        <Facebook className="h-3 w-3 mr-1" /> Profile
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Notifications;
