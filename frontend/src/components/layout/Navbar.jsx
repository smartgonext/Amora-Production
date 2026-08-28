import { useState, useEffect, useRef, useContext } from 'react';
import { FiSearch, FiBell, FiShoppingCart, FiLogOut, FiSettings, FiPackage, FiChevronRight, FiUser } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SidebarContext } from '../../App';
import { useManufacturingConfig } from '../../hooks/useManufacturingConfig';
import apiClient from '../../api/client';

export default function Navbar() {
  const { collapsed } = useContext(SidebarContext);
  const { user, logout } = useAuth();
  const { config: mfgConfig } = useManufacturingConfig();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lowStockAlerts, setLowStockAlerts] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [pendingBills, setPendingBills] = useState(0);
  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await apiClient.get('/notifications');
        setNotifications(res.data.data || []);
        setUnreadCount(res.data.meta?.unread_count || 0);
        setLowStockAlerts(res.data.meta?.low_stock_alerts || 0);
      } catch (err) {}
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch pending bills count
  useEffect(() => {
    const fetchBills = async () => {
      try {
        const res = await apiClient.get('/invoices', { params: { status: 'pending' } });
        setPendingBills(res.data?.meta?.total || res.data?.data?.length || 0);
      } catch (err) {}
    };
    fetchBills();
  }, []);

  // Global search with debounce
  const handleSearch = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    setShowSearch(true);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await apiClient.get(`/search?q=${encodeURIComponent(q)}`);
        const data = res.data.data || {};
        const combined = [
          ...(data.customers || []).map(c => ({ ...c, icon: '👤' })),
          ...(data.products || []).map(p => ({ ...p, icon: '📦' })),
          ...(data.invoices || []).map(i => ({ ...i, icon: '📄' })),
        ];
        setSearchResults(combined);
      } catch (err) {
        setSearchResults([]);
      }
    }, 300);
  };

  const handleSearchResultClick = (item) => {
    setShowSearch(false);
    setSearchQuery('');
    if (item.type === 'customer') navigate(`/customers?id=${item.id}`);
    else if (item.type === 'product') navigate(`/products?id=${item.id}`);
    else if (item.type === 'invoice') navigate(`/sales?id=${item.id}`);
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.post('/notifications/read/all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {}
  };

  const handleMarkRead = async (id) => {
    try {
      await apiClient.post(`/notifications/read/${id}`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {}
  };

  const handleNotificationClick = (notif) => {
    handleMarkRead(notif.id);
    if (notif.action_url) navigate(notif.action_url);
    setShowNotifications(false);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const getNotifStyle = (type) => {
    const map = {
      stock_alert: { color: 'text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
      rental_due: { color: 'text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      amc_expiry: { color: 'text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
      bill_pending: { color: 'text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20' },
      transfer: { color: 'text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    };
    return map[type] || { color: 'text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800' };
  };

  return (
    <header
      className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 fixed top-0 right-0 z-30 flex items-center px-4 shadow-sm"
      style={{ left: collapsed ? '5rem' : '16rem' }}
    >
      

      {/* CENTER — Global Search */}
      <div className="flex-1 max-w-xl mx-4 relative" ref={searchRef}>
        <div className="relative">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            onFocus={() => searchQuery.length >= 2 && setShowSearch(true)}
            placeholder="Search products, customers, invoices..."
            className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Search Results Dropdown */}
        {showSearch && searchQuery.length >= 2 && (
          <div className="absolute top-full mt-2 left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
            {searchResults.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                <FiSearch className="mx-auto text-2xl mb-2 opacity-50" />
                No results found for "{searchQuery}"
              </div>
            ) : (
              searchResults.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearchResultClick(item)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-0"
                >
                  <span className="text-lg">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{item.name || item.invoice_number || item.product_name}</p>
                    <p className="text-xs text-slate-400 capitalize">{item.type} {item.phone && `• ${item.phone}`} {item.sku && `• ${item.sku}`}</p>
                  </div>
                  <FiChevronRight className="text-slate-300 flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* RIGHT SIDE — Profile, Notifications, Alerts, Bills */}
      <div className="flex items-center gap-1">
        {/* Manufacturing mode indicator (adaptive to tenant config) */}
        {mfgConfig && (
          <Link
            to="/manufacturing/bom"
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            title={`Enabled: ${(mfgConfig.enabled_features || []).join(', ')}`}
          >
            <FiSettings className="text-sm" />
            {mfgConfig.operation_label || mfgConfig.mfg_type} mode
          </Link>
        )}

        {/* Low Stock Warning */}
        {lowStockAlerts > 0 && (
          <Link
            to="/inventory"
            className="relative p-2.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-500 transition-colors"
            title="Low Stock Alerts"
          >
            <FiPackage className="text-lg" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          </Link>
        )}

        {/* Pending Bills */}
        <Link
          to="/billing"
          className="relative p-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-500 transition-colors"
          title="Pending Bills"
        >
          <FiShoppingCart className="text-lg" />
          {pendingBills > 0 && (
            <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold min-w-[18px] min-h-[18px] flex items-center justify-center rounded-full px-1">
              {pendingBills > 99 ? '99+' : pendingBills}
            </span>
          )}
        </Link>

        {/* Notifications Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Notifications"
          >
            <FiBell className="text-lg" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-[10px] font-bold min-w-[18px] min-h-[18px] flex items-center justify-center rounded-full px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <div className="absolute top-full right-0 mt-2 w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-xs text-indigo-500 hover:text-indigo-400 font-semibold">Mark all read</button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400">
                    <FiBell className="mx-auto text-2xl mb-2 opacity-50" />
                    No notifications yet
                  </div>
                ) : (
                  notifications.slice(0, 20).map((notif) => {
                    const style = getNotifStyle(notif.type);
                    return (
                      <button
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700/50 last:border-0 ${!notif.is_read ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                      >
                        <div className={`p-1.5 rounded-lg ${style.bg} ${style.color} mt-0.5`}>
                          <FiBell className="text-sm" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${!notif.is_read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{notif.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{notif.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {notif.created_at ? new Date(notif.created_at).toLocaleString() : ''}
                          </p>
                        </div>
                        {!notif.is_read && <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 mt-2" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Profile"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          </button>

          {/* Profile Dropdown */}
          {showProfile && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.email || ''}</p>
                    {user?.role && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold rounded-full">
                        {user.role}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-2">
                <button
                  onClick={() => { navigate('/settings'); setShowProfile(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <FiSettings className="text-base" />
                  Settings
                </button>
                <button
                  onClick={() => { logout(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                >
                  <FiLogOut className="text-base" />
                  Sign Out
                </button>
              </div>
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700">
                <p className="text-[10px] text-slate-400">SmartGoNext ERP v1.0.0</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}