import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { AlertTriangle, Settings, Loader2, Send, Bot, User, ArrowLeft, Wallet, Activity, Eye, Download, FileText, PlayCircle, XCircle } from 'lucide-react';
import WalletManagement from './WalletManagement';
import { jsPDF } from 'jspdf';

// Interfaces for structured strategies
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
  content: any; // Can be string or component data
  type: 'text' | 'strategies' | 'report' | 'status' | 'adjustment';
  timestamp: Date;
}

const AdRoom = () => {
  const [view, setView] = useState<'chat' | 'settings' | 'wallet' | 'dashboard'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [fbSettings, setFbSettings] = useState({ page_id: '', access_token: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyContent | null>(null);
  const [showStrategyModal, setShowStrategyModal] = useState(false);

  // Test Mode State
  const [isTesting, setIsTesting] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [showTestModal, setShowTestModal] = useState(false);
  
  // Dashboard Metrics
  const [activeStrategy, setActiveStrategy] = useState<any>(null);
  const [botStatus, setBotStatus] = useState<'offline' | 'idle' | 'analyzing' | 'posting'>('idle');
  const [pendingPosts, setPendingPosts] = useState(0);

  useEffect(() => {
    let ignore = false;

    const init = async () => {
        if (ignore) return;
        fetchWalletBalance();
        
        // Prevent re-init if messages exist (already loaded)
        if (messages.length > 0) return;
        
        await initChat();
        fetchDashboardData();
    };

    init();

    // REAL-TIME SUBSCRIPTION
    const channel = supabase
      .channel('adroom_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'adroom_posts' },
        (payload) => {
          console.log('Realtime update:', payload);
          // Refresh dashboard data when posts change
          fetchDashboardData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'adroom_strategies' },
        (payload) => {
             console.log('Strategy update:', payload);
             // Refresh strategy status
             fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
        ignore = true;
        supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, view]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  const initChat = async () => {
    // Prevent re-init if messages exist or already initialized
    if (messages.length > 0 || hasInitialized.current) return;
    hasInitialized.current = true;

    setIsLoading(true);
    setBotStatus('analyzing');
    
    // Define API_URL once for the scope
    const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    const API_PREFIX = BASE_URL ? `${BASE_URL}/api` : '/api';
    let settingsRes;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userName = user?.user_metadata?.name || 'Admin';

      // 1. Initial Greeting
      const greeting: Message = {
        id: 'greeting',
        role: 'adroom',
        content: `Hello ${userName}! I am AdRoom, your autonomous AI marketing director.\n\nI am here to analyze your assets and execute a data-driven Facebook marketing strategy.`,
        type: 'text',
        timestamp: new Date()
      };
      
      // Use functional update to check duplicates atomically
      setMessages(prev => {
        if (prev.some(m => m.id === 'greeting')) return prev;
        return [greeting];
      });

      // 2. Fetch Settings (to check if configured)
      try {
          settingsRes = await fetch(`${API_PREFIX}/adroom/settings/${user?.id}`);
      } catch (error) {
          console.error('Failed to connect to server:', error);
          setMessages(prev => {
              // Prevent duplicates
              if (prev.some(m => m.id === 'server-error')) return prev;
              
              return [...prev, {
                  id: 'server-error',
                  role: 'adroom',
                  content: '⚠️ Unable to connect to the AdRoom server. Please ensure the backend API is running.',
                  type: 'text',
                  timestamp: new Date()
              }];
          });
          setIsLoading(false);
          return;
      }

      let isConfigured = false;
      
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        setFbSettings({
          page_id: settings.facebook_page_id || '',
          access_token: settings.is_configured ? '********' : ''
        });
        
        if (settings.facebook_page_id && settings.is_configured) {
            isConfigured = true;
        }
      }

      setBotStatus('idle'); // Set to idle until analysis starts

      if (!isConfigured) {
          setMessages(prev => {
              // Prevent duplicates
              if (prev.some(m => m.id === 'config-alert')) return prev;
              
              return [...prev, {
                  id: 'config-alert',
                  role: 'adroom',
                  content: 'I noticed that your Facebook Page is not configured yet. Please click the settings icon (⚙️) above to connect your page so I can start analyzing and posting.',
                  type: 'text',
                  timestamp: new Date()
              }];
          });
          setIsLoading(false);
          return;
      }

      setBotStatus('analyzing');
      setMessages(prev => [...prev, {
        id: 'analyzing',
        role: 'adroom',
        content: 'Configuration confirmed. I am now analyzing all properties, auctions, and projects to formulate a strategy...',
        type: 'text',
        timestamp: new Date()
      }]);

      // 3. Trigger Analysis
      const response = await fetch(`${API_PREFIX}/adroom/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: user?.id })
      });

      // Handle non-JSON responses (like rate limit text)
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Failed to parse API response:', text);
        throw new Error('Invalid response from server. ' + (text.includes('Too many requests') ? 'Rate limit exceeded. Please try again in a few minutes.' : ''));
      }

      if (data.status === 'active_campaign') {
        setBotStatus('posting');
        setActiveStrategy(data.strategy);
        setMessages(prev => {
            if (prev.some(m => m.id.startsWith('status-'))) return prev;
            return [...prev, {
                id: 'status-' + Date.now(),
                role: 'adroom',
                content: `We have an active campaign running: "${data.strategy.content.theme}".\n\nI am monitoring performance and will execute posts according to schedule.`,
                type: 'status',
                timestamp: new Date()
            }];
        });

        // Fetch and show recent adjustments if any
        const reportsRes = await fetch(`${API_PREFIX}/adroom/reports/${user?.id}`);
        if (reportsRes.ok) {
            const reports = await reportsRes.json();
            const adjustments = reports.filter((r: any) => r.type === 'adjustment').slice(0, 3);
            
            adjustments.forEach((adj: any) => {
                setMessages(prev => [...prev, {
                    id: 'adj-' + adj.id,
                    role: 'adroom',
                    content: adj.content,
                    type: 'adjustment',
                    timestamp: new Date(adj.created_at)
                }]);
            });
        }
      } else if (data.status === 'proposed') {
        setBotStatus('idle'); // Waiting for approval
        setMessages(prev => {
            if (prev.some(m => m.id.startsWith('strategies-'))) return prev;
            return [...prev, {
                id: 'strategies-' + Date.now(),
                role: 'adroom',
                content: data.strategies,
                type: 'strategies',
                timestamp: new Date()
            }];
        });
      } else if (data.error) {
          setBotStatus('offline');
          throw new Error(data.error);
      }

    } catch (error: any) {
      console.error('Init error:', error);
      setBotStatus('offline');
      setMessages(prev => [...prev, {
        id: 'error-' + Date.now(),
        role: 'adroom',
        content: `Error: ${error.message || 'I encountered an issue accessing the database.'}`,
        type: 'text',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // 1. Get Pending Posts Count
        const { count } = await supabase
            .from('adroom_posts')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
        
        setPendingPosts(count || 0);

        // 2. Get Active Strategy details if not already set
        if (!activeStrategy) {
            const { data } = await supabase
                .from('adroom_strategies')
                .select('*')
                .eq('admin_id', user.id)
                .eq('status', 'active')
                .single();
            
            if (data) {
                setActiveStrategy(data);
                setBotStatus('posting');
            }
        }
    } catch (error) {
        console.error('Dashboard fetch error:', error);
    }
  };

  const runTestSequence = async () => {
    setIsTesting(true);
    setTestLogs(['Initializing Real-Time Test Sequence...']);
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
        setTestLogs(prev => [...prev, `ERROR: ${result.error || 'Unknown error'}`]);
      }
    } catch (error: any) {
      setTestLogs(prev => [...prev, `CRITICAL FAILURE: ${error.message}`]);
    } finally {
      setIsTesting(false);
    }
  };

  const generatePDF = (strategy: any, type: string = 'strategy') => {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Title
      doc.setFontSize(20);
      doc.setTextColor(0, 0, 255);
      doc.text(`AdRoom Strategy: ${type.toUpperCase()}`, 20, 20);
      
      // Theme
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(`Theme: ${strategy.theme}`, 20, 35);
      
      // Details
      doc.setFontSize(11);
      doc.text(`Goal: ${strategy.goal}`, 20, 50);
      doc.text(`Duration: ${strategy.duration}`, 20, 60);
      doc.text(`Expected Outcome: ${strategy.expected_outcome}`, 20, 70);
      doc.text(`Schedule: ${strategy.schedule}`, 20, 80);
      if (strategy.recommended_budget) {
          doc.text(`Budget: ${strategy.recommended_budget}`, 20, 90);
      }
      if (strategy.cost_optimization_tactic) {
          doc.setTextColor(220, 20, 60);
          doc.text(`Optimization Tactic: ${strategy.cost_optimization_tactic}`, 20, 100);
          doc.setTextColor(0, 0, 0);
      }

      // Content Plan
      doc.setFontSize(14);
      doc.text("Content Plan:", 20, 115);
      
      let y = 125;
      strategy.content_plan.forEach((item: any, index: number) => {
          if (y > 250) {
              doc.addPage();
              y = 20;
          }
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text(`Post ${index + 1}: ${item.title}`, 20, y);
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          const captionLines = doc.splitTextToSize(item.caption, pageWidth - 40);
          doc.text(captionLines, 20, y + 7);
          
          y += 15 + (captionLines.length * 5);
      });

      doc.save(`adroom_${type}_strategy.pdf`);
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
          id: 'approval-' + Date.now(),
          role: 'admin',
          content: `Approved ${type} strategy: ${content.theme}`,
          type: 'text',
          timestamp: new Date()
        }, {
          id: 'confirmed-' + Date.now(),
          role: 'adroom',
          content: `Excellent choice! I have activated the "${content.theme}" strategy. I will now autonomously generate and schedule the content plan.`,
          type: 'text',
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      alert('Failed to approve strategy');
    } finally {
      setIsLoading(false);
    }
  };

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

    try {
      // Simple chat endpoint or logic here
      // For now, let's just echo a placeholder response since the main flow is autonomous
      // Ideally, you'd call a chat endpoint that has context of the strategies
      
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: 'reply-' + Date.now(),
          role: 'adroom',
          content: "I'm focused on executing the current strategy. Check the reports section for updates, or use the configuration menu to adjust my parameters.",
          type: 'text',
          timestamp: new Date()
        }]);
        setIsLoading(false);
      }, 1000);

    } catch (error) {
      console.error('Chat error:', error);
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
      const API_PREFIX = BASE_URL ? `${BASE_URL}/api` : '/api';
      
      // Only send access token if it's being updated (i.e. not the placeholder)
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
      alert('Settings saved successfully!');
      
      // Update local state to show "Connected" status immediately
      setFbSettings(prev => ({
          ...prev,
          access_token: '********'
      }));

      // If we were blocked by configuration, we can now proceed
      // Check if we have the "config-alert" message and if so, refresh the chat init
      const hasConfigAlert = messages.some(m => m.id === 'config-alert');
      if (hasConfigAlert) {
          // Remove the alert and trigger init logic manually or just guide user back
          setMessages(prev => prev.filter(m => m.id !== 'config-alert'));
          // Re-run init logic effectively
          const { data: { user } } = await supabase.auth.getUser();
          
          setMessages(prev => [...prev, {
            id: 'analyzing-' + Date.now(),
            role: 'adroom',
            content: 'Configuration confirmed. I am now analyzing all properties, auctions, and projects to formulate a strategy...',
            type: 'text',
            timestamp: new Date()
          }]);

          // Trigger the analysis in background
          fetch(`${API_PREFIX}/adroom/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_id: user?.id })
          }).then(async () => {
          // ... handle response logic similar to initChat ...
          // For simplicity, we just let the user go back to chat and see the new messages
      });
      }
      
    } catch (error) {
      alert('Failed to save settings');
    }
  };

  const handleCancelCampaign = async () => {
    if (!window.confirm('Are you sure you want to cancel the current campaign? This will stop all pending posts.')) return;
    
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
        setBotStatus('idle');
        setMessages(prev => [...prev, {
          id: 'cancel-' + Date.now(),
          role: 'adroom',
          content: 'Campaign cancelled successfully. I am now idle and awaiting further instructions.',
          type: 'text',
          timestamp: new Date()
        }]);
      } else {
        throw new Error('Failed to cancel campaign');
      }
    } catch (error) {
      console.error('Cancel error:', error);
      alert('Failed to cancel campaign. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900 text-white z-50 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
            <Bot className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white tracking-wide">AdRoom</h2>
            <div className="flex items-center space-x-2">
                <span className={`h-2 w-2 rounded-full ${
                    botStatus === 'posting' || botStatus === 'analyzing' ? 'bg-green-500 animate-pulse' : 
                    botStatus === 'offline' ? 'bg-red-500' : 'bg-gray-400'
                }`}></span>
                <p className="text-xs text-gray-400 capitalize">{botStatus}</p>
            </div>
          </div>
        </div>
        
        {/* Top Right Actions */}
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setView('dashboard')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                view === 'dashboard' 
                  ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span className="inline">Dashboard</span>
          </button>

          <button 
            onClick={() => {
                fetchWalletBalance();
                setView('wallet');
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                view === 'wallet' 
                  ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <Wallet className="h-4 w-4" />
            <span>₦{balance.toLocaleString()}</span>
          </button>
          
          <button 
            onClick={() => setView('settings')}
            className={`p-2 rounded-full transition-all ${
                view === 'settings' 
                  ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        
        {/* VIEW: CHAT (Default) */}
        {view === 'chat' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
              
              {/* Quick Dashboard Access for Mobile/Visibility */}
              <div className="flex justify-center md:hidden">
                  <button onClick={() => setView('dashboard')} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full flex items-center">
                      <Activity className="h-3 w-3 mr-1" /> View Dashboard & Diagnostics
                  </button>
              </div>

              {messages.map((msg) => (
                <div key={msg.id} className={`flex w-full ${msg.role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-[90%] md:max-w-[80%] ${msg.role === 'admin' ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    {/* Avatar */}
                    <div className={`flex-shrink-0 h-8 w-8 rounded-sm flex items-center justify-center mt-1 ${
                      msg.role === 'admin' ? 'ml-3 bg-gray-200' : 'mr-3 bg-black'
                    }`}>
                      {msg.role === 'admin' ? <User className="h-5 w-5 text-gray-600" /> : <Bot className="h-5 w-5 text-white" />}
                    </div>

                    {/* Content Bubble */}
                    <div className={`text-sm leading-relaxed ${
                        msg.role === 'admin' ? 'bg-gray-100 text-gray-900 p-3 rounded-2xl rounded-tr-sm' : 'text-gray-800 pt-1'
                    }`}>
                        
                        {/* Text Content */}
                        {msg.type === 'text' || msg.type === 'status' ? (
                            <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
                        ) : null}

                        {/* Adjustment Notification */}
                        {msg.type === 'adjustment' && (
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r mt-2">
                                <div className="flex items-center mb-2">
                                    <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                                    <h4 className="text-sm font-bold text-yellow-800">Strategy Auto-Adjusted</h4>
                                </div>
                                <p className="text-xs text-yellow-700 mb-2">{msg.content.diagnosis}</p>
                                <div className="text-xs bg-white p-2 rounded border border-yellow-100">
                                    <p className="font-semibold text-gray-800">Action Taken:</p>
                                    <p className="text-gray-600">{msg.content.action}</p>
                                </div>
                            </div>
                        )}

                        {/* Strategy Selector Component */}
                        {msg.type === 'strategies' && (
                            <div className="mt-2 space-y-4">
                                <p className="mb-2">I have analyzed the current market conditions and asset inventory. Here are two recommended strategies:</p>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {/* Free Strategy */}
                                    <div className="border border-green-200 bg-green-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-green-800">Free Strategy</h4>
                                            <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">Organic</span>
                                        </div>
                                        <p className="font-medium text-gray-900 mb-1">{msg.content.free_strategy.theme}</p>
                                        <div className="text-xs text-gray-600 space-y-1 mb-3">
                                            <p><strong>Goal:</strong> {msg.content.free_strategy.goal}</p>
                                            <p><strong>Duration:</strong> {msg.content.free_strategy.duration}</p>
                                            <p><strong>Outcome:</strong> {msg.content.free_strategy.expected_outcome}</p>
                                        </div>
                                        
                                        <div className="bg-white p-2 rounded border border-green-100 mb-3 text-xs">
                                            <p className="font-semibold text-green-700 mb-1">Sample Content:</p>
                                            <p className="italic text-gray-600">"{msg.content.free_strategy.content_plan[0].title}"</p>
                                        </div>

                                        <button 
                                            onClick={() => handleApproveStrategy('free', msg.content.free_strategy)}
                                            className="w-full bg-green-600 text-white py-1.5 rounded text-xs font-medium hover:bg-green-700 mb-2"
                                        >
                                            Approve Free
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setSelectedStrategy(msg.content.free_strategy);
                                                setShowStrategyModal(true);
                                            }}
                                            className="w-full border border-green-600 text-green-700 py-1.5 rounded text-xs font-medium hover:bg-green-50 mb-2"
                                        >
                                            View Full Details
                                        </button>
                                        <button 
                                            onClick={() => generatePDF(msg.content.free_strategy, 'free')}
                                            className="w-full flex items-center justify-center space-x-1 bg-gray-100 text-gray-700 py-1.5 rounded text-xs font-medium hover:bg-gray-200"
                                        >
                                            <Download className="h-3 w-3" />
                                            <span>Download PDF</span>
                                        </button>
                                    </div>

                                    {/* Paid Strategy */}
                                    <div className="border border-purple-200 bg-purple-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-purple-800">Paid Strategy</h4>
                                            <span className="text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded">Ads</span>
                                        </div>
                                        <p className="font-medium text-gray-900 mb-1">{msg.content.paid_strategy.theme}</p>
                                        <div className="text-xs text-gray-600 space-y-1 mb-3">
                                            <p><strong>Goal:</strong> {msg.content.paid_strategy.goal}</p>
                                            <p><strong>Duration:</strong> {msg.content.paid_strategy.duration}</p>
                                            <p><strong>Outcome:</strong> {msg.content.paid_strategy.expected_outcome}</p>
                                            <p className="text-purple-700 font-bold">Budget: {msg.content.paid_strategy.recommended_budget}</p>
                                        </div>

                                        <div className="bg-white p-2 rounded border border-purple-100 mb-3 text-xs">
                                            <p className="font-semibold text-purple-700 mb-1">Sample Ad:</p>
                                            <p className="italic text-gray-600">"{msg.content.paid_strategy.content_plan[0].title}"</p>
                                        </div>
                                        
                                        {msg.content.paid_strategy.cost_optimization_tactic && (
                                            <div className="bg-purple-100 p-2 rounded border border-purple-200 mb-3 text-xs">
                                                <p className="font-bold text-purple-800 flex items-center">
                                                    <Activity className="h-3 w-3 mr-1" />
                                                    Cost Optimization:
                                                </p>
                                                <p className="text-purple-900">{msg.content.paid_strategy.cost_optimization_tactic}</p>
                                            </div>
                                        )}

                                        <button 
                                            onClick={() => handleApproveStrategy('paid', msg.content.paid_strategy)}
                                            className="w-full bg-purple-600 text-white py-1.5 rounded text-xs font-medium hover:bg-purple-700 mb-2"
                                        >
                                            Approve Paid
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setSelectedStrategy(msg.content.paid_strategy);
                                                setShowStrategyModal(true);
                                            }}
                                            className="w-full border border-purple-600 text-purple-700 py-1.5 rounded text-xs font-medium hover:bg-purple-50 mb-2"
                                        >
                                            View Full Details
                                        </button>
                                        <button 
                                            onClick={() => generatePDF(msg.content.paid_strategy, 'paid')}
                                            className="w-full flex items-center justify-center space-x-1 bg-gray-100 text-gray-700 py-1.5 rounded text-xs font-medium hover:bg-gray-200"
                                        >
                                            <Download className="h-3 w-3" />
                                            <span>Download PDF</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <span className={`text-[10px] mt-2 block opacity-50 ${msg.role === 'admin' ? 'text-right' : 'text-left'}`}>
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex w-full justify-start">
                    <div className="flex max-w-[85%] flex-row">
                        <div className="flex-shrink-0 h-8 w-8 rounded-sm flex items-center justify-center mt-1 mr-3 bg-black">
                            <Bot className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                    </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100">
                <div className="max-w-4xl mx-auto relative">
                    <form onSubmit={handleSendMessage} className="relative flex items-center border border-gray-300 rounded-xl shadow-sm bg-white focus-within:ring-2 focus-within:ring-black focus-within:border-transparent transition-all">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(e);
                                }
                            }}
                            placeholder="Type a message..."
                            className="flex-1 max-h-32 py-3 px-4 focus:outline-none bg-transparent resize-none text-sm"
                            rows={1}
                            style={{ minHeight: '44px' }}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className={`p-2 mr-2 rounded-lg transition-all ${
                                input.trim() && !isLoading ? 'bg-black text-white hover:bg-gray-800' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </button>
                    </form>
                </div>
            </div>
          </div>
        )}

        {/* VIEW: DASHBOARD */}
        {view === 'dashboard' && (
            <div className="h-full overflow-y-auto p-8 bg-gray-50">
                <div className="max-w-4xl mx-auto">
                    <button onClick={() => setView('chat')} className="mb-4 flex items-center text-sm text-gray-500 hover:text-gray-900">
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Chat
                    </button>
                    
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold">Bot Operations Center</h1>
                            <p className="text-gray-500">Real-time status of your autonomous marketing director</p>
                        </div>
                        <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${
                            botStatus === 'posting' || botStatus === 'analyzing' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                            <span className={`h-2.5 w-2.5 rounded-full ${
                                botStatus === 'posting' || botStatus === 'analyzing' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                            }`}></span>
                            <span className="font-semibold capitalize">{botStatus} Mode</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* Card 1: Status */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-gray-500 text-sm font-medium">System Status</h3>
                                <Activity className="h-5 w-5 text-blue-500" />
                            </div>
                            <div className="flex items-center space-x-2">
                                <p className="text-2xl font-bold text-gray-900 capitalize">{botStatus}</p>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                {botStatus === 'posting' ? 'Autonomously executing strategy' : 
                                 botStatus === 'analyzing' ? 'Analyzing market data' : 
                                 'Waiting for commands'}
                            </p>
                        </div>

                        {/* Card 2: Pending Posts */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-gray-500 text-sm font-medium">Pending Posts</h3>
                                <FileText className="h-5 w-5 text-purple-500" />
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{pendingPosts}</p>
                            <p className="text-xs text-gray-500 mt-2">Scheduled for auto-publishing</p>
                        </div>

                        {/* Card 3: Active Strategy */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-gray-500 text-sm font-medium">Active Strategy</h3>
                                <Eye className="h-5 w-5 text-green-500" />
                            </div>
                            <p className="text-lg font-bold text-gray-900 truncate">
                                {activeStrategy ? activeStrategy.content.theme : 'None Active'}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                                {activeStrategy ? `Goal: ${activeStrategy.content.goal}` : 'Select a strategy in chat'}
                            </p>
                            {activeStrategy && (
                                <div className="mt-2 flex space-x-2">
                                    <button 
                                        onClick={() => {
                                            setSelectedStrategy(activeStrategy.content);
                                            setShowStrategyModal(true);
                                        }}
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        View Queue
                                    </button>
                                    <button 
                                        onClick={handleCancelCampaign}
                                        className="text-xs text-red-600 hover:underline"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Card 4: System Diagnostics */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors" onClick={runTestSequence}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-gray-500 text-sm font-medium">Diagnostics</h3>
                                <PlayCircle className="h-5 w-5 text-red-500" />
                            </div>
                            <p className="text-lg font-bold text-gray-900">Run Test</p>
                            <p className="text-xs text-gray-500 mt-2">
                                Execute Real-Time Post/Delete Test
                            </p>
                        </div>
                    </div>

                    {/* Active Strategy Details */}
                    {activeStrategy && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <h3 className="font-semibold text-gray-800">Current Execution Plan</h3>
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Live</span>
                            </div>
                            <div className="p-6">
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-500 mb-3">Targeting & Goals</h4>
                                        <ul className="space-y-3 text-sm">
                                            <li className="flex justify-between">
                                                <span className="text-gray-600">Theme:</span>
                                                <span className="font-medium">{activeStrategy.content.theme}</span>
                                            </li>
                                            <li className="flex justify-between">
                                                <span className="text-gray-600">Duration:</span>
                                                <span className="font-medium">{activeStrategy.content.duration}</span>
                                            </li>
                                            <li className="flex justify-between">
                                                <span className="text-gray-600">Expected Outcome:</span>
                                                <span className="font-medium">{activeStrategy.expected_outcome}</span>
                                            </li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-500 mb-3">Content Queue</h4>
                                        <div className="space-y-3">
                                            {activeStrategy.content.content_plan.map((post: any, i: number) => (
                                                <div key={i} className="flex items-start p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex-shrink-0 h-6 w-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                                                        {i + 1}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">{post.title}</p>
                                                        <p className="text-xs text-gray-500 truncate w-48">{post.caption}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* STRATEGY DETAILS MODAL */}
        {showStrategyModal && selectedStrategy && (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                    <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
                        <h2 className="text-xl font-bold">Strategy Details: {selectedStrategy.theme}</h2>
                        <button onClick={() => setShowStrategyModal(false)} className="text-gray-500 hover:text-gray-800">
                            ✕
                        </button>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <p className="text-xs text-gray-500 uppercase">Goal</p>
                                <p className="font-medium">{selectedStrategy.goal}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <p className="text-xs text-gray-500 uppercase">Duration</p>
                                <p className="font-medium">{selectedStrategy.duration}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <p className="text-xs text-gray-500 uppercase">Schedule</p>
                                <p className="font-medium">{selectedStrategy.schedule}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <p className="text-xs text-gray-500 uppercase">Outcome</p>
                                <p className="font-medium">{selectedStrategy.expected_outcome}</p>
                            </div>
                        </div>

                        {selectedStrategy.recommended_budget && (
                            <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg">
                                <div className="flex items-center mb-2">
                                    <Wallet className="h-4 w-4 text-purple-600 mr-2" />
                                    <h3 className="font-bold text-purple-900">Budget & Optimization</h3>
                                </div>
                                <p className="text-sm mb-2"><span className="font-semibold">Recommended Budget:</span> {selectedStrategy.recommended_budget}</p>
                                {selectedStrategy.cost_optimization_tactic && (
                                    <p className="text-sm text-purple-800"><span className="font-semibold">Tactic:</span> {selectedStrategy.cost_optimization_tactic}</p>
                                )}
                            </div>
                        )}

                        <div>
                            <h3 className="font-bold text-lg mb-3">Content Plan</h3>
                            <div className="space-y-4">
                                {selectedStrategy.content_plan.map((post, i) => (
                                    <div key={i} className="border rounded-lg p-4">
                                        <div className="flex justify-between mb-2">
                                            <span className="font-bold text-gray-900">Post #{i+1}: {post.title}</span>
                                            {post.ad_format && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{post.ad_format}</span>}
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 italic mb-2">
                                            "{post.caption}"
                                        </div>
                                        {post.image_idea && (
                                            <p className="text-xs text-gray-500"><span className="font-semibold">Visual:</span> {post.image_idea}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t flex justify-end space-x-3">
                        <button 
                            onClick={() => generatePDF(selectedStrategy, 'strategy')}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                        >
                            Download PDF
                        </button>
                        <button 
                            onClick={() => setShowStrategyModal(false)}
                            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* VIEW: SETTINGS */}
        {view === 'settings' && (
            <div className="h-full overflow-y-auto p-8 bg-gray-50">
                <div className="max-w-2xl mx-auto">
                    <button onClick={() => setView('chat')} className="mb-4 flex items-center text-sm text-gray-500 hover:text-gray-900">
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Chat
                    </button>
                    <div className="bg-white p-8 rounded-xl shadow-sm">
                        <h1 className="text-2xl font-bold mb-6">Facebook Configuration</h1>
                        <form onSubmit={handleSaveSettings} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Facebook Page ID</label>
                                <input 
                                    type="text" 
                                    className="mt-1 block w-full p-2 border rounded-md"
                                    value={fbSettings.page_id}
                                    onChange={e => setFbSettings({...fbSettings, page_id: e.target.value})}
                                    placeholder="e.g. 1023456789"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Page Access Token</label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <input 
                                        type="password" 
                                        className="block w-full p-2 border rounded-md"
                                        value={fbSettings.access_token}
                                        onChange={e => setFbSettings({...fbSettings, access_token: e.target.value})}
                                        placeholder={fbSettings.access_token === '********' ? '********' : 'EAA...'}
                                        required={!fbSettings.access_token}
                                    />
                                    {fbSettings.access_token === '********' && (
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            <span className="text-green-500 text-xs">Connected</span>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-2 text-xs bg-blue-50 text-blue-800 p-2 rounded border border-blue-100">
                                    <strong>Required Permissions:</strong> You must use a token with these scopes:
                                    <ul className="list-disc ml-4 mt-1">
                                        <li><code>pages_manage_posts</code> (To publish content)</li>
                                        <li><code>pages_read_engagement</code> (To read comments/messages)</li>
                                        <li><code>pages_messaging</code> (To reply to messages)</li>
                                    </ul>
                                    <p className="mt-1">
                                        Use <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="underline font-bold">Graph API Explorer</a> to generate a token for your Page.
                                    </p>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    {fbSettings.access_token === '********' 
                                        ? 'Token is securely stored. Enter a new one only if you want to update it.' 
                                        : 'Required for posting to Facebook.'}
                                </p>
                            </div>
                            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                                Save Configuration
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        )}

        {/* VIEW: WALLET */}
        {view === 'wallet' && (
            <div className="h-full overflow-y-auto p-8 bg-gray-50">
                <div className="max-w-4xl mx-auto">
                    <button onClick={() => setView('chat')} className="mb-4 flex items-center text-sm text-gray-500 hover:text-gray-900">
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Chat
                    </button>
                    <h1 className="text-2xl font-bold mb-6">Wallet Management</h1>
                    <WalletManagement />
                </div>
            </div>
        )}

        {/* TEST MODE LOGS MODAL */}
        {showTestModal && (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col relative">
                    {/* Status indicator overlay for "Realtime Mode" reassurance */}
                    {activeStrategy && botStatus === 'posting' && (
                        <div className="absolute top-0 right-0 -mt-2 -mr-2 bg-green-500 text-white text-[10px] px-2 py-1 rounded-full shadow-lg z-50 animate-pulse border-2 border-white">
                            LIVE CAMPAIGN ACTIVE
                        </div>
                    )}
                    
                    <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            <Activity className={`h-5 w-5 ${isTesting ? 'text-blue-500 animate-pulse' : 'text-green-500'}`} />
                            <h2 className="text-xl font-bold">System Diagnostics</h2>
                        </div>
                        {!isTesting && (
                            <button onClick={() => setShowTestModal(false)} className="text-gray-500 hover:text-gray-800">
                                <XCircle className="h-6 w-6" />
                            </button>
                        )}
                    </div>
                    <div className="p-6 bg-gray-900 text-green-400 font-mono text-sm overflow-y-auto h-96">
                        {testLogs.map((log, i) => (
                            <div key={i} className="mb-1 border-b border-gray-800 pb-1 last:border-0">
                                {log}
                            </div>
                        ))}
                        {isTesting && (
                            <div className="animate-pulse mt-2">_ Processing...</div>
                        )}
                    </div>
                    <div className="p-4 border-t bg-gray-50 flex justify-end">
                        <button 
                            onClick={() => setShowTestModal(false)}
                            disabled={isTesting}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${isTesting ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-black text-white hover:bg-gray-800'}`}
                        >
                            {isTesting ? 'Running Test...' : 'Close Diagnostics'}
                        </button>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default AdRoom;
