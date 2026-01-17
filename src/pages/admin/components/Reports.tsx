import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { Loader2, TrendingUp, Users, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const Reports = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'7d' | '30d'>('7d');
  const [liveIndicator, setLiveIndicator] = useState(false);

  useEffect(() => {
    fetchData();

    // Real-time listener for new leads/interactions to update chart locally
    const channel = supabase
      .channel('reports_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, () => {
         setLiveIndicator(true);
         setTimeout(() => {
             fetchData(); // Refresh data
             setLiveIndicator(false);
         }, 1000);
      })
      .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [range]);

  const fetchData = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
        
        const res = await fetch(`${API_URL}/api/reports/stats/${user.id}?range=${range}`);
        const json = await res.json();
        setData(json);
    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="h-10 w-10 animate-spin text-cyan-500" /></div>;

  return (
    <div className="space-y-6">
        {/* Header & Controls */}
        <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            <div>
                <h2 className="text-xl font-bold text-white flex items-center">
                    Performance Analytics
                    {liveIndicator && <span className="ml-3 flex items-center text-xs text-green-400 animate-pulse"><span className="h-2 w-2 bg-green-500 rounded-full mr-1"></span> LIVE UPDATE</span>}
                </h2>
                <p className="text-slate-400 text-sm">Real-time data stream from AdRoom campaigns</p>
            </div>
            <div className="flex space-x-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button 
                    onClick={() => setRange('7d')}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${range === '7d' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    7 Days
                </button>
                <button 
                    onClick={() => setRange('30d')}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${range === '30d' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    30 Days
                </button>
            </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
                        <Users className="h-6 w-6" />
                    </div>
                    <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">+12%</span>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">{data?.summary?.leads || 0}</h3>
                <p className="text-sm text-slate-400">Total Leads Generated</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400">
                        <Eye className="h-6 w-6" />
                    </div>
                    <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">+5.2%</span>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">{data?.summary?.interactions || 0}</h3>
                <p className="text-sm text-slate-400">Total Reach / Impressions</p>
            </div>
             <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-orange-500/10 rounded-lg text-orange-400">
                        <TrendingUp className="h-6 w-6" />
                    </div>
                    <span className="text-xs text-slate-500">Avg</span>
                </div>
                <h3 className="text-3xl font-bold text-white mb-1">{data?.summary?.conversion_rate || '0%'}</h3>
                <p className="text-sm text-slate-400">Conversion Rate</p>
            </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-96">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col">
                <h3 className="text-white font-bold mb-6">Leads Trend</h3>
                <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data?.history || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickFormatter={(val) => val ? val.slice(5) : ''} />
                            <YAxis stroke="#64748b" fontSize={10} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Bar dataKey="leads" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

             <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col">
                <h3 className="text-white font-bold mb-6">Reach Growth</h3>
                <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data?.history || []}>
                             <defs>
                                <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickFormatter={(val) => val ? val.slice(5) : ''} />
                            <YAxis stroke="#64748b" fontSize={10} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Area type="monotone" dataKey="reach" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorReach)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Reports;
