import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { Users, Clock, Eye, Activity } from 'lucide-react';

const AnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalVisits: 0,
    activeVisitors: 0,
    avgDuration: 0,
    totalPageViews: 0
  });
  const [visitsOverTime, setVisitsOverTime] = useState<any[]>([]);
  const [topPages, setTopPages] = useState<any[]>([]);

  // 1. Process Data whenever rawData changes
  useEffect(() => {
    if (rawData.length === 0) return;

    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // 1. Active Visitors (seen in last 5 mins)
    const activeCount = new Set(
      rawData.filter(d => new Date(d.created_at) > fiveMinutesAgo).map(d => d.visitor_id)
    ).size;

    // 2. Visits Over Time (Group by Hour for the last 24h)
    const visitsByHour = rawData.reduce((acc: any, curr) => {
      const date = new Date(curr.created_at);
      const key = `${date.getHours()}:00`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const chartData = Object.entries(visitsByHour).map(([time, count]) => ({
      time,
      visitors: count
    })).slice(-24); // Last 24 entries

    // 3. Top Pages
    const pagesCount = rawData.reduce((acc: any, curr) => {
      // Clean URL to get path
      let page = curr.page_url || '/';
      try {
        // Try to parse as URL to get pathname
        if (page.startsWith('http')) {
           const urlObj = new URL(page);
           page = urlObj.pathname;
        }
      } catch (e) {
        // Fallback if invalid URL string
      }
      
      acc[page] = (acc[page] || 0) + 1;
      return acc;
    }, {});

    const topPagesData = Object.entries(pagesCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5);

    setStats({
      totalVisits: rawData.length,
      activeVisitors: activeCount,
      avgDuration: Math.round(rawData.reduce((acc, curr) => acc + (curr.duration_seconds || 0), 0) / rawData.length) || 0,
      totalPageViews: rawData.length
    });

    setVisitsOverTime(chartData);
    setTopPages(topPagesData);
  }, [rawData]);

  // 2. Initial Fetch & Subscription
  useEffect(() => {
    fetchAnalytics();

    // Real-time subscription
    const subscription = supabase
      .channel('admin-analytics')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'visitor_analytics'
        },
        (payload) => {
          // Prepend new data to rawData
          setRawData(prev => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from('visitor_analytics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      if (data) {
        setRawData(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Visitor Analytics</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full animate-pulse">Live</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.activeVisitors}</h3>
          <p className="text-sm text-gray-500">Active Now</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <Eye className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.totalPageViews}</h3>
          <p className="text-sm text-gray-500">Total Page Views</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.avgDuration}s</h3>
          <p className="text-sm text-gray-500">Avg. Duration</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">98%</h3>
          <p className="text-sm text-gray-500">System Health</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Traffic Overview</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visitsOverTime}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="visitors" 
                  stroke="#3B82F6" 
                  strokeWidth={3} 
                  dot={false}
                  activeDot={{ r: 8 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Top Pages</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topPages} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={150} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;