import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { 
  Users, DollarSign, Shield, TrendingUp, AlertTriangle, 
  Wallet, ArrowRightLeft, LayoutDashboard, Settings, 
  LogOut, Bell, Search, Menu, X, Briefcase
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area 
} from 'recharts';

function MetricCard({ title, value, icon: Icon, color, trend, alert = false, loading = false }: any) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    sky: 'bg-sky-50 text-sky-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <div className={`bg-white rounded-2xl border ${alert ? 'border-rose-200' : 'border-slate-200'} shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group`}>
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 transition-transform group-hover:scale-150 duration-700 ease-out ${colorMap[color]}`}></div>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-3 rounded-xl ${colorMap[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full shadow-sm border border-emerald-100/50">{trend}</span>
        )}
      </div>
      <div className="relative z-10">
        <h3 className="text-slate-500 font-medium text-sm mb-1">{title}</h3>
        <p className={`text-3xl font-bold tracking-tight ${alert ? 'text-rose-600' : 'text-slate-800'}`}>
          {loading ? '...' : value}
        </p>
      </div>
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    standardSavings: 0,
    shieldedSavings: 0,
    netStockInvestments: 0,
    suspiciousFlags: 0,
    transactionVolume: 0,
    totalWallets: 0,
    totalPrivateMarketVolume: 0,
    charts: {
      dailyUsers: [],
      monthlyUsers: [],
      dailyTransactions: [],
      monthlyTransactions: []
    }
  });
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [timeframe, setTimeframe] = useState<'daily' | 'monthly'>('daily');
  const [currentView, setCurrentView] = useState<'overview' | 'users'>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'https://defi-corre.onrender.com';
        const res = await fetch(`${apiUrl}/admin/stats`, {
          headers: { 'x-admin-key': import.meta.env.VITE_ADMIN_KEY || '' },
        });
        const data = await res.json();
        if (data.error) {
          console.error("API Error:", data.error);
        } else {
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to fetch admin stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    if (currentView === 'users' && usersList.length === 0) {
      const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'https://defi-corre.onrender.com';
          const res = await fetch(`${apiUrl}/admin/users`, {
            headers: { 'x-admin-key': import.meta.env.VITE_ADMIN_KEY || '' },
          });
          const data = await res.json();
          setUsersList(data);
        } catch (err) {
          console.error("Failed to fetch users:", err);
        } finally {
          setLoadingUsers(false);
        }
      };
      fetchUsers();
    }
  }, [currentView]);

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-72 bg-[#0B1120] text-slate-300 flex flex-col shadow-2xl z-40 transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 lg:h-20 flex items-center justify-between px-6 lg:px-8 border-b border-white/5">
          <div className="flex items-center">
            <img src="/corre_logo.png" alt="Corre Logo" className="h-8 w-auto mr-3 brightness-200" />
            <h1 className="text-xl font-bold text-white tracking-tight">Corre Admin</h1>
          </div>
          <button className="lg:hidden p-2 text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-1 py-8 px-4 space-y-2">
          <button 
            onClick={() => { setCurrentView('overview'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${currentView === 'overview' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-semibold">Overview</span>
          </button>
          <button 
            onClick={() => { setCurrentView('users'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${currentView === 'users' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium">User Management</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 rounded-xl transition-all text-slate-400 hover:text-white">
            <ArrowRightLeft className="w-5 h-5" />
            <span className="font-medium">Transactions</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 rounded-xl transition-all text-slate-400 hover:text-white">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Security Alerts</span>
          </button>
        </nav>
        <div className="p-4 border-t border-white/5 bg-white/[0.02]">
          <button className="flex items-center gap-3 px-4 py-3.5 w-full hover:bg-white/5 rounded-xl transition-all text-left text-slate-400 hover:text-white">
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </button>
          <button className="flex items-center gap-3 px-4 py-3.5 w-full hover:bg-rose-500/10 text-rose-400 rounded-xl transition-all text-left mt-1">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden w-full relative">
        {/* Top Header */}
        <header className="h-16 lg:h-20 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 flex items-center justify-between z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-800"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden md:block relative w-64 lg:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search users, transactions, logs..." 
                className="w-full bg-slate-100/50 hover:bg-slate-100 border border-transparent focus:bg-white focus:border-indigo-500/30 rounded-full py-2 lg:py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-700 placeholder:text-slate-400" 
              />
            </div>
          </div>
          <div className="flex items-center gap-4 lg:gap-6">
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors bg-slate-100 hover:bg-slate-200 rounded-full">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-3 border-l border-slate-200 pl-4 lg:pl-6 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold shadow-md ring-2 ring-indigo-50">
                A
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-sm font-bold text-slate-800 leading-tight">Admin User</span>
                <span className="text-xs text-slate-500 font-medium">admin@corre.bond</span>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Dashboard Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar">
          <div className="max-w-[1600px] mx-auto space-y-6 lg:space-y-8">
            
            {currentView === 'overview' ? (
              <>
                {/* Page Title & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl lg:text-3xl font-bold text-slate-800 tracking-tight">Dashboard Overview</h2>
                    <p className="text-slate-500 mt-1 text-sm font-medium">Welcome back. Here's what's happening across Corre today.</p>
                  </div>
                </div>

                {/* Primary Metrics (Top 3) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                  <MetricCard 
                    loading={loading}
                    title="Total Users" 
                    value={stats.totalUsers} 
                    icon={Users} 
                    color="blue" 
                  />
                  <MetricCard 
                    loading={loading}
                    title="Active Users" 
                    value={stats.activeUsers} 
                    icon={LayoutDashboard} 
                    color="sky" 
                  />
                  <MetricCard 
                    loading={loading}
                    title="USDC Tx Volume" 
                    value={`$${stats.transactionVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
                    icon={ArrowRightLeft} 
                    color="emerald" 
                  />
                  <MetricCard 
                    loading={loading}
                    title="Net Stock Investments" 
                    value={`$${stats.netStockInvestments.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
                    icon={TrendingUp} 
                    color="indigo" 
                  />
                </div>

            {/* Secondary Metrics (Bottom 4) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              <MetricCard 
                loading={loading}
                title="Standard Savings" 
                value={`$${stats.standardSavings.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
                icon={DollarSign} 
                color="sky" 
              />
              <MetricCard 
                loading={loading}
                title="Shielded Savings" 
                value={`$${stats.shieldedSavings.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
                icon={Shield} 
                color="purple" 
              />
              <MetricCard 
                loading={loading}
                title="Linked Wallets" 
                value={stats.totalWallets} 
                icon={Wallet} 
                color="orange" 
              />
              <MetricCard 
                loading={loading}
                title="Suspicious Activity" 
                value={stats.suspiciousFlags} 
                icon={AlertTriangle} 
                color="rose" 
                alert 
              />
              <MetricCard 
                loading={loading}
                title="Private Market Volume" 
                value={`₦${stats.totalPrivateMarketVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} 
                icon={Briefcase} 
                color="indigo" 
              />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* User Signups */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 lg:p-8 hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                    User Signups
                  </h3>
                  <div className="bg-slate-100/80 rounded-xl p-0.5 flex border border-slate-200/50">
                    <button 
                      onClick={() => setTimeframe('daily')} 
                      className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${timeframe === 'daily' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Daily
                    </button>
                    <button 
                      onClick={() => setTimeframe('monthly')} 
                      className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${timeframe === 'monthly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Monthly
                    </button>
                  </div>
                </div>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeframe === 'daily' ? stats.charts.dailyUsers : stats.charts.monthlyUsers} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#94a3b8" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickMargin={12} 
                        minTickGap={20} 
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickMargin={10}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        name="New Users" 
                        stroke="#3b82f6" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#colorUsers)" 
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Transaction Volume */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 lg:p-8 hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                    USDC Tx Volume <span className="text-slate-400 font-normal text-sm ml-1">({timeframe})</span>
                  </h3>
                </div>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timeframe === 'daily' ? stats.charts.dailyTransactions : stats.charts.monthlyTransactions} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#94a3b8" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickMargin={12} 
                        minTickGap={20} 
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickMargin={10}
                        tickFormatter={(val) => `$${val >= 1000 ? (val/1000).toFixed(1)+'k' : val}`} 
                      />
                      <Tooltip 
                        formatter={(value: any) => [`$${Number(value || 0).toLocaleString()}`, 'Volume']}
                        cursor={{fill: '#f8fafc'}}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar 
                        name="Volume" 
                        dataKey="volume" 
                        fill="#10b981" 
                        radius={[6, 6, 0, 0]} 
                        barSize={timeframe === 'monthly' ? 32 : undefined} 
                        activeBar={{ fill: '#059669' }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
              </>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl lg:text-3xl font-bold text-slate-800 tracking-tight">User Management</h2>
                    <p className="text-slate-500 mt-1 text-sm font-medium">View and manage all registered users on Corre.</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                          <th className="px-6 py-4">User Email</th>
                          <th className="px-6 py-4">Solana Wallet</th>
                          <th className="px-6 py-4">Date Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {loadingUsers ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-12 text-center text-slate-400">Loading users...</td>
                          </tr>
                        ) : usersList.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-12 text-center text-slate-400">No users found.</td>
                          </tr>
                        ) : (
                          usersList.map((user, idx) => (
                            <tr key={user.id || idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 font-medium text-slate-800">
                                {user.email || 'N/A'}
                              </td>
                              <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                {user.solana_wallet ? `${user.solana_wallet.slice(0, 6)}...${user.solana_wallet.slice(-4)}` : 'Not connected'}
                              </td>
                              <td className="px-6 py-4 text-slate-500">
                                {new Date(user.joined_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
