import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Settings, Loader2, Send, Bot, Wallet, 
  Activity, PlayCircle, XCircle, Zap, 
  MessageSquare, Clock, BarChart3, Terminal, CheckCircle2, AlertOctagon
} from 'lucide-react';
import WalletManagement from './WalletManagement';
import { motion, AnimatePresence } from 'framer-motion';

// --- Interfaces ---

interface StrategyContent {
  theme: string;
  duration: string;
  goal: string;
  content_plan: { title: string; caption: string; image_idea?: string; ad_format?: string }[];
  expected_outcome: string;
  schedule: string;
  recommended_budget?: string;
  cost_optimization_tactic?: string;
}

interface Message {
  id: string;
  role: 'admin' | 'adroom';
  content: any;
  type: 'text' | 'strategies' | 'report' | 'status' | 'adjustment';
  timestamp: Date;
}

interface InteractionLog {
  id: string;
  type: 'message' | 'comment';
  content: string;
  created_at: string;
  facebook_id: string;
}

interface Post {
    id: string;
    content: string;
    scheduled_time: string;
    status: 'pending' | 'posted' | 'failed';
    image_url?: string;
}

interface Insights {
    reach: number;
    engagement: number;
}

// --- Main Component ---

const AdRoom = () => {
  // State
  const [view, setView] = useState<'chat' | 'settings' | 'wallet' | 'dashboard' | 'monitor'>('dashboard');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [fbSettings, setFbSettings] = useState({ page_id: '', access_token: '' });
  
  // Dashboard Data
  const [activeStrategy, setActiveStrategy] = useState<any>(null);
  const [botStatus, setBotStatus] = useState<'offline' | 'idle' | 'analyzing' | 'posting'>('idle');
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [recentActivity, setRecentActivity] = useState<InteractionLog[]>([]);
  const [insights, setInsights] = useState<Insights>({ reach: 0, engagement: 0 });
  const [analyzingInsights, setAnalyzingInsights] = useState(false);
  const [strategyHealth, setStrategyHealth] = useState<any[]>([]);

  // UI State
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [showTestModal, setShowTestModal] = useState(false);

  // --- Initialization & Real-time ---

  useEffect(() => {
    let ignore = false;

    const init = async () => {
        if (ignore) return;
        fetchWalletBalance();
        fetchDashboardData();
        
        if (messages.length === 0) await initChat();
    };

    init();

    // REAL-TIME SUBSCRIPTION
    const channel = supabase
      .channel('adroom_realtime_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'adroom_posts' }, (payload) => {
          console.log('Realtime Post Update:', payload);
          fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'adroom_strategies' }, () => {
           console.log('Realtime Strategy Update');
           fetchDashboardData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'adroom_interactions' }, (payload) => {
           console.log('New Interaction:', payload);
           setRecentActivity(prev => [payload.new as InteractionLog, ...prev].slice(0, 10));
           fetchInsights(); // Refresh insights on interaction
      })
      .subscribe();

    return () => {
        ignore = true;
        supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (view === 'chat') scrollToBottom();
  }, [messages, view]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // --- Data Fetching ---

  const fetchWalletBalance = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
      const url = API_URL ? `${API_URL}/api/wallet/${user.id}` : `/api/wallet/${user.id}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setBalance(Number(data.balance));
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const fetchInsights = async () => {
      setAnalyzingInsights(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
        const url = API_URL ? `${API_URL}/api/adroom/insights/${user.id}` : `/api/adroom/insights/${user.id}`;

        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            setInsights(data);
        }
      } catch (e) {
          console.error('Insights fetch failed', e);
      } finally {
          setAnalyzingInsights(false);
      }
  };

  const fetchStrategyHealth = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
        const url = API_URL ? `${API_URL}/api/adroom/monitoring/health/${user.id}` : `/api/adroom/monitoring/health/${user.id}`;
        
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            setStrategyHealth(data);
        }
    } catch (e) {
        console.error('Health fetch error:', e);
    }
  };

  const fetchDashboardData = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // 1. Get Pending Posts
        const { data: posts } = await supabase
            .from('adroom_posts')
            .select('*')
            .eq('status', 'pending')
            .order('scheduled_time', { ascending: true });
        
        setPendingPosts(posts || []);

        // 2. Get Recent Activity (Interactions)
        const { data: activity } = await supabase
            .from('adroom_interactions')
            .select('*')
            .eq('admin_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10);
        
        setRecentActivity(activity || []);

        // 3. Get Active Strategy
        const { data: strategy } = await supabase
            .from('adroom_strategies')
            .select('*')
            .eq('admin_id', user.id)
            .eq('status', 'active')
            .single();
        
        if (strategy) {
            setActiveStrategy(strategy);
            setBotStatus('posting');
        } else {
            setActiveStrategy(null);
            // Check if we are configured
            if (fbSettings.page_id) setBotStatus('idle');
        }

        // 4. Fetch Insights
        fetchInsights();
        
        // 5. Fetch Health
        fetchStrategyHealth();

    } catch (error) {
        console.error('Dashboard fetch error:', error);
    }
  };

  const initChat = async () => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const { data: { user } } = await supabase.auth.getUser();
    const userName = user?.user_metadata?.name || 'Admin';

    setMessages([{
        id: 'greeting',
        role: 'adroom',
        content: `Systems Online. Welcome back, ${userName}.\n\nI am monitoring your real estate assets and awaiting instructions.`,
        type: 'text',
        timestamp: new Date()
    }]);

    const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    const API_PREFIX = BASE_URL ? `${BASE_URL}/api` : '/api';
    
    try {
        const res = await fetch(`${API_PREFIX}/adroom/settings/${user?.id}`);
        if (res.ok) {
            const settings = await res.json();
            setFbSettings({
                page_id: settings.facebook_page_id || '',
                access_token: settings.is_configured ? '********' : ''
            });
            if (!settings.is_configured) {
                setBotStatus('offline');
                setMessages(prev => [...prev, {
                    id: 'config-alert',
                    role: 'adroom',
                    content: 'CRITICAL: Facebook integration missing. Access Settings to configure.',
                    type: 'text',
                    timestamp: new Date()
                }]);
            }
        }
    } catch (e) {
        setBotStatus('offline');
    }
  };

  // --- Actions ---

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'admin',
      content: input,
      type: 'text',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    if (input.toLowerCase().includes('analyze') || input.toLowerCase().includes('strategy')) {
         const { data: { user } } = await supabase.auth.getUser();
         const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
         const API_PREFIX = BASE_URL ? `${BASE_URL}/api` : '/api';
         
         setMessages(prev => [...prev, {
             id: 'thinking-' + Date.now(),
             role: 'adroom',
             content: 'Initiating deep asset analysis protocol...',
             type: 'text',
             timestamp: new Date()
         }]);

         try {
             const response = await fetch(`${API_PREFIX}/adroom/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_id: user?.id })
             });
             const data = await response.json();
             
             if (data.status === 'proposed') {
                 setMessages(prev => [...prev, {
                    id: 'strategies-' + Date.now(),
                    role: 'adroom',
                    content: data.strategies,
                    type: 'strategies',
                    timestamp: new Date()
                 }]);
             } else if (data.status === 'active_campaign') {
                 setMessages(prev => [...prev, {
                    id: 'active-' + Date.now(),
                    role: 'adroom',
                    content: 'An active campaign is already in progress. Check the dashboard for details.',
                    type: 'text',
                    timestamp: new Date()
                 }]);
             }
         } catch (e) {
             setMessages(prev => [...prev, { id: 'err', role: 'adroom', content: 'Analysis failed. System error.', type: 'text', timestamp: new Date() }]);
         }
    } else {
        setTimeout(() => {
            setMessages(prev => [...prev, {
              id: 'reply-' + Date.now(),
              role: 'adroom',
              content: "Command received. Processing...",
              type: 'text',
              timestamp: new Date()
            }]);
        }, 1000);
    }
    setIsLoading(false);
  };

  const handleApproveStrategy = async (type: 'paid' | 'free', content: StrategyContent) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
      const API_PREFIX = BASE_URL ? `${BASE_URL}/api` : '/api';

      const response = await fetch(`${API_PREFIX}/adroom/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_id: user?.id,
          type,
          content,
          expected_outcome: content.expected_outcome
        })
      });

      if (response.ok) {
        setMessages(prev => [...prev, {
          id: 'confirmed-' + Date.now(),
          role: 'adroom',
          content: `Strategy "${content.theme}" ACTIVATED. Execution sequence initiated.`,
          type: 'text',
          timestamp: new Date()
        }]);
        fetchDashboardData();
        setView('dashboard');
      }
    } catch (error) {
      alert('Failed to approve strategy');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelCampaign = async () => {
     if (!window.confirm('WARNING: Cancelling campaign will purge all pending posts. Proceed?')) return;
     
     setIsLoading(true);
     try {
       const { data: { user } } = await supabase.auth.getUser();
       const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
       const API_PREFIX = BASE_URL ? `${BASE_URL}/api` : '/api';
 
       const response = await fetch(`${API_PREFIX}/adroom/cancel`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ admin_id: user?.id })
       });
 
       if (response.ok) {
         setActiveStrategy(null);
         setPendingPosts([]);
         setBotStatus('idle');
         alert('Campaign terminated.');
         fetchDashboardData();
       }
     } catch (error) {
       console.error('Cancel error:', error);
     } finally {
       setIsLoading(false);
     }
   };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
      const API_PREFIX = BASE_URL ? `${BASE_URL}/api` : '/api';
      
      const payload: any = {
          admin_id: user?.id,
          facebook_page_id: fbSettings.page_id
      };
      
      if (fbSettings.access_token !== '********') {
          payload.facebook_access_token = fbSettings.access_token;
      }
      
      await fetch(`${API_PREFIX}/adroom/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      setFbSettings(prev => ({ ...prev, access_token: '********' }));
      alert('Configuration updated.');
      fetchDashboardData();
      setView('dashboard');
      
    } catch (error) {
      alert('Failed to save settings');
    }
  };

  const runTestSequence = async () => {
    setIsTesting(true);
    setTestLogs(['[SYSTEM] Initializing Diagnostics Protocol...', '[SYSTEM] Connecting to Neural Core...']);
    setShowTestModal(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
      const API_PREFIX = BASE_URL ? `${BASE_URL}/api` : '/api';
      
      const response = await fetch(`${API_PREFIX}/adroom/test-sequence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: user?.id })
      });

      const result = await response.json();
      
      if (result.success) {
        setTestLogs(prev => [...prev, ...result.logs]);
      } else {
        setTestLogs(prev => [...prev, `[ERROR] ${result.error || 'Unknown error'}`]);
      }
    } catch (error: any) {
      setTestLogs(prev => [...prev, `[CRITICAL] ${error.message}`]);
    } finally {
      setIsTesting(false);
    }
  };

  // --- RENDER ---

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <motion.div 
        initial={{ x: -100 }}
        animate={{ x: 0 }}
        className="w-20 lg:w-64 bg-slate-900 border-r border-slate-800 flex flex-col items-center lg:items-stretch py-6 z-20 shadow-2xl"
      >
        <div className="mb-8 px-4 flex items-center justify-center lg:justify-start space-x-3">
            <div className="h-10 w-10 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                <Bot className="h-6 w-6 text-cyan-400" />
            </div>
            <span className="hidden lg:block text-xl font-bold tracking-wider text-white">AdRoom<span className="text-cyan-400">.AI</span></span>
        </div>

        <nav className="flex-1 space-y-2 px-2">
            {[
                { id: 'dashboard', icon: Activity, label: 'Command Center' },
                { id: 'monitor', icon: CheckCircle2, label: 'Strategy Monitor' },
                { id: 'chat', icon: MessageSquare, label: 'Neural Chat' },
                { id: 'wallet', icon: Wallet, label: 'Wallet' },
                { id: 'settings', icon: Settings, label: 'Configuration' }
            ].map((item) => (
                <button
                    key={item.id}
                    onClick={() => setView(item.id as any)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-300 group ${
                        view === item.id 
                        ? 'bg-cyan-500/10 text-cyan-400 border-r-2 border-cyan-400' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                >
                    <item.icon className={`h-5 w-5 ${view === item.id ? 'animate-pulse' : ''}`} />
                    <span className="hidden lg:block font-medium">{item.label}</span>
                </button>
            ))}
        </nav>

        <div className="px-4 mt-auto">
             <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                 <div className="flex items-center justify-between mb-2">
                     <span className="text-xs text-slate-400">System Status</span>
                     <span className={`h-2 w-2 rounded-full ${botStatus === 'offline' ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></span>
                 </div>
                 <p className="font-mono text-sm font-bold text-white capitalize">{botStatus}</p>
             </div>
        </div>
      </motion.div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Futuristic Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/10 via-slate-950 to-slate-950 pointer-events-none"></div>

        <AnimatePresence mode="wait">
        {view === 'dashboard' && (
            <motion.main 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-1 overflow-y-auto p-4 lg:p-8 z-10 scrollbar-thin scrollbar-thumb-slate-700"
            >
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-1">Mission Control</h1>
                        <p className="text-slate-400 text-sm">Real-time autonomous marketing overview</p>
                    </div>
                    <div className="flex space-x-3">
                        <button onClick={runTestSequence} className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors">
                            <PlayCircle className="h-4 w-4 text-cyan-400" />
                            <span>Run Diagnostics</span>
                        </button>
                        <button onClick={fetchWalletBalance} className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors">
                            <Wallet className="h-4 w-4 text-green-400" />
                            <span>₦{balance.toLocaleString()}</span>
                        </button>
                    </div>
                </header>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-500">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Zap className="h-16 w-16 text-cyan-400" />
                        </div>
                        <p className="text-slate-400 text-sm font-medium mb-1">Active Campaign</p>
                        <h3 className="text-xl font-bold text-white truncate pr-2">
                            {activeStrategy ? activeStrategy.content.theme : 'No Active Campaign'}
                        </h3>
                        <p className="text-xs text-cyan-400 mt-2 flex items-center">
                            {activeStrategy ? <Activity className="h-3 w-3 mr-1" /> : <AlertOctagon className="h-3 w-3 mr-1" />}
                            {activeStrategy ? 'Running' : 'Idle'}
                        </p>
                    </div>

                    <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-purple-500/30 transition-all duration-500">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Clock className="h-16 w-16 text-purple-400" />
                        </div>
                        <p className="text-slate-400 text-sm font-medium mb-1">Queue Status</p>
                        <h3 className="text-2xl font-bold text-white">{pendingPosts.length} <span className="text-sm font-normal text-slate-500">pending</span></h3>
                        <p className="text-xs text-purple-400 mt-2">Next: {pendingPosts[0] ? new Date(pendingPosts[0].scheduled_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'None'}</p>
                    </div>

                    <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-green-500/30 transition-all duration-500">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <MessageSquare className="h-16 w-16 text-green-400" />
                        </div>
                        <p className="text-slate-400 text-sm font-medium mb-1">Bot Interactions</p>
                        <h3 className="text-2xl font-bold text-white">{recentActivity.length} <span className="text-sm font-normal text-slate-500">recent</span></h3>
                        <p className="text-xs text-green-400 mt-2">Auto-replies active</p>
                    </div>

                    <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-orange-500/30 transition-all duration-500">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <BarChart3 className="h-16 w-16 text-orange-400" />
                        </div>
                        <p className="text-slate-400 text-sm font-medium mb-1">Total Reach</p>
                        <h3 className="text-2xl font-bold text-white">{insights.reach.toLocaleString()}</h3>
                        <p className="text-xs text-orange-400 mt-2 flex items-center">
                            {analyzingInsights ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : null}
                            {analyzingInsights ? 'Updating...' : 'Live Data'}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[500px]">
                    {/* Live Terminal Feed */}
                    <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
                        <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                                <Terminal className="h-4 w-4 text-cyan-400" />
                                <span className="text-sm font-mono text-slate-300">SYSTEM_LOGS</span>
                            </div>
                            <div className="flex space-x-1.5">
                                <div className="h-2.5 w-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
                                <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                                <div className="h-2.5 w-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
                            </div>
                        </div>
                        <div className="flex-1 p-4 font-mono text-xs space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 bg-black/40">
                            {recentActivity.length === 0 ? (
                                <div className="text-slate-600 italic">No recent activity recorded. Waiting for triggers...</div>
                            ) : (
                                recentActivity.map((log) => (
                                    <motion.div 
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        key={log.id} 
                                        className="flex space-x-2 border-b border-white/5 pb-1"
                                    >
                                        <span className="text-slate-500">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                                        <span className={log.type === 'message' ? 'text-blue-400' : 'text-green-400'}>
                                            {log.type.toUpperCase()}:
                                        </span>
                                        <span className="text-slate-300">{log.content}</span>
                                    </motion.div>
                                ))
                            )}
                            {botStatus === 'analyzing' && <div className="text-cyan-400 animate-pulse">_ Processing market data...</div>}
                        </div>
                    </div>

                    {/* Active Strategy / Queue */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col backdrop-blur-sm">
                        <h3 className="font-bold text-white mb-4 flex items-center">
                            <Clock className="h-4 w-4 mr-2 text-purple-400" />
                            Upcoming Queue
                        </h3>
                        
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                            {pendingPosts.length === 0 ? (
                                <div className="text-center py-10 text-slate-500">
                                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p>Queue is empty</p>
                                    <button onClick={() => setView('chat')} className="text-cyan-400 text-xs mt-2 hover:underline">Create Strategy</button>
                                </div>
                            ) : (
                                pendingPosts.map((post, i) => (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        key={post.id} 
                                        className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 hover:border-cyan-500/30 transition-all"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-bold text-cyan-400">#{i + 1}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(post.scheduled_time).toLocaleString()}</span>
                                        </div>
                                        <p className="text-xs text-slate-300 line-clamp-2">{post.content}</p>
                                    </motion.div>
                                ))
                            )}
                        </div>

                        {activeStrategy && (
                            <button 
                                onClick={handleCancelCampaign}
                                className="mt-4 w-full py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-colors"
                            >
                                TERMINATE CAMPAIGN
                            </button>
                        )}
                    </div>
                </div>
            </motion.main>
        )}

        {/* VIEW: MONITOR */}
        {view === 'monitor' && (
             <motion.div 
                key="monitor"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-y-auto p-4 lg:p-8 z-10 scrollbar-thin scrollbar-thumb-slate-700"
             >
                 <h1 className="text-3xl font-bold text-white mb-8">Strategy Health Monitor</h1>
                 
                 <div className="grid gap-6">
                     {strategyHealth.length === 0 ? (
                         <div className="text-slate-500 text-center py-10">No active strategies to monitor.</div>
                     ) : (
                         strategyHealth.map((strat: any) => (
                             <div key={strat.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                                 <div className="flex justify-between items-start mb-4">
                                     <div>
                                         <h3 className="text-xl font-bold text-white capitalize">{strat.type} Strategy</h3>
                                         <span className={`inline-block px-2 py-0.5 rounded text-xs mt-1 ${
                                             strat.status === 'healthy' ? 'bg-green-500/20 text-green-400' :
                                             strat.status === 'at_risk' ? 'bg-yellow-500/20 text-yellow-400' :
                                             'bg-red-500/20 text-red-400'
                                         }`}>
                                             {strat.status.toUpperCase()}
                                         </span>
                                     </div>
                                     <div className="text-right">
                                         <p className="text-2xl font-bold text-white">{strat.posted_count} / {strat.posts_count}</p>
                                         <p className="text-xs text-slate-500">Posts Completed</p>
                                     </div>
                                 </div>
                                 
                                 {strat.alerts.length > 0 && (
                                     <div className="bg-red-500/10 border border-red-500/20 rounded p-3 mb-4">
                                         <h4 className="text-red-400 font-bold text-sm mb-2 flex items-center"><AlertOctagon className="h-4 w-4 mr-2"/> Active Alerts</h4>
                                         <ul className="list-disc list-inside text-xs text-red-300 space-y-1">
                                             {strat.alerts.map((alert: string, i: number) => (
                                                 <li key={i}>{alert}</li>
                                             ))}
                                         </ul>
                                     </div>
                                 )}
                                 
                                 <div className="flex space-x-3 mt-4">
                                     {strat.status !== 'healthy' && (
                                         <button 
                                            onClick={async () => {
                                                if(!confirm('Trigger manual auto-fix?')) return;
                                                const { data: { user } } = await supabase.auth.getUser();
                                                const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
                                                await fetch(`${BASE_URL ? BASE_URL : ''}/api/adroom/monitoring/fix/${strat.id}`, {
                                                    method: 'POST',
                                                    headers: {'Content-Type': 'application/json'},
                                                    body: JSON.stringify({ adminId: user?.id })
                                                });
                                                alert('Fix triggered. Refreshing...');
                                                fetchStrategyHealth();
                                            }}
                                            className="px-4 py-2 bg-cyan-600 text-white text-sm rounded hover:bg-cyan-500"
                                         >
                                             Auto-Fix Issues
                                         </button>
                                     )}
                                 </div>
                             </div>
                         ))
                     )}
                 </div>
             </motion.div>
        )}

        {/* VIEW: CHAT */}
        {view === 'chat' && (
            <motion.div 
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full bg-slate-950"
            >
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex w-full ${msg.role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                             <div className={`max-w-[85%] ${msg.role === 'admin' ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-50' : 'bg-slate-800 border border-slate-700 text-slate-200'} p-4 rounded-xl shadow-lg`}>
                                 {msg.type === 'text' && <p className="whitespace-pre-wrap text-sm">{msg.content}</p>}
                                 
                                 {msg.type === 'strategies' && (
                                     <div className="mt-4 grid gap-4 md:grid-cols-2">
                                         {/* Strategy Cards */}
                                         <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 hover:border-green-500/50 transition-colors">
                                             <h4 className="font-bold text-green-400 mb-2">Free Strategy</h4>
                                             <p className="text-xs text-slate-400 mb-3">{msg.content.free_strategy.theme}</p>
                                             <button onClick={() => handleApproveStrategy('free', msg.content.free_strategy)} className="w-full bg-green-600/20 text-green-400 border border-green-500/30 py-1.5 rounded text-xs hover:bg-green-600/30">Activate</button>
                                         </div>
                                         <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 hover:border-purple-500/50 transition-colors">
                                             <h4 className="font-bold text-purple-400 mb-2">Paid Strategy</h4>
                                             <p className="text-xs text-slate-400 mb-3">{msg.content.paid_strategy.theme}</p>
                                             <button onClick={() => handleApproveStrategy('paid', msg.content.paid_strategy)} className="w-full bg-purple-600/20 text-purple-400 border border-purple-500/30 py-1.5 rounded text-xs hover:bg-purple-600/30">Activate</button>
                                         </div>
                                     </div>
                                 )}
                             </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="p-4 bg-slate-900 border-t border-slate-800">
                    <div className="relative">
                        <input 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Input command..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                        <button type="submit" disabled={isLoading} className="absolute right-2 top-2 p-1.5 bg-cyan-600 rounded-md text-white hover:bg-cyan-500 disabled:opacity-50">
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </button>
                    </div>
                </form>
            </motion.div>
        )}

        {/* VIEW: SETTINGS */}
        {view === 'settings' && (
            <motion.div 
                key="settings"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-8 text-white max-w-2xl mx-auto"
            >
                <h2 className="text-2xl font-bold mb-6">System Configuration</h2>
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl">
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-slate-400">Facebook Page ID</label>
                            <input 
                                value={fbSettings.page_id} 
                                onChange={(e) => setFbSettings({...fbSettings, page_id: e.target.value})}
                                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded p-2 text-white focus:border-cyan-500 focus:outline-none transition-colors" 
                            />
                        </div>
                        <div>
                            <label className="text-sm text-slate-400">Access Token</label>
                            <input 
                                type="password"
                                value={fbSettings.access_token} 
                                onChange={(e) => setFbSettings({...fbSettings, access_token: e.target.value})}
                                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded p-2 text-white focus:border-cyan-500 focus:outline-none transition-colors" 
                            />
                        </div>
                        <button onClick={handleSaveSettings} className="bg-cyan-600 text-white px-4 py-2 rounded hover:bg-cyan-500 w-full font-bold">Save Configuration</button>
                    </div>
                </div>
            </motion.div>
        )}

        {/* VIEW: WALLET */}
        {view === 'wallet' && (
             <motion.div 
                key="wallet"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full overflow-y-auto p-8 bg-slate-950"
             >
                 <div className="max-w-4xl mx-auto">
                     <h1 className="text-2xl font-bold text-white mb-6">Wallet Management</h1>
                     <WalletManagement />
                 </div>
             </motion.div>
        )}
        </AnimatePresence>

      </div>

      {/* MODALS */}
      {showTestModal && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl">
                  <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between">
                      <h3 className="text-green-400 font-mono flex items-center"><Terminal className="h-4 w-4 mr-2" /> SYSTEM DIAGNOSTICS</h3>
                      {!isTesting && <button onClick={() => setShowTestModal(false)}><XCircle className="h-5 w-5 text-slate-500 hover:text-white" /></button>}
                  </div>
                  <div className="p-4 h-64 overflow-y-auto font-mono text-xs text-green-300 space-y-1 bg-black">
                      {testLogs.map((log, i) => <div key={i}>{log}</div>)}
                      {isTesting && <div className="animate-pulse">_</div>}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default AdRoom;