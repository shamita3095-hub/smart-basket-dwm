import React, { useState, useMemo, useEffect } from 'react';
import {
  User,
  LogIn,
  UserPlus,
  Search,
  CheckCircle2,
  X,
  Wallet,
  Sparkles,
  MapPin,
  Shield,
  ArrowRight,
  RefreshCw,
  Mail,
  Building,
  Check,
  Database
} from 'lucide-react';
import { createCustomer } from '../api';

export default function CustomerLoginModal({
  isOpen,
  initialTab = 'signin',
  onClose,
  customers = [],
  activeCustomer,
  onSelectCustomer,
  onCustomerCreated
}) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'signin' or 'register'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'OVER_BUDGET', 'ON_BUDGET', 'UNDER_BUDGET'

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setErrorMsg('');
      setSuccessNotice('');
    }
  }, [isOpen, initialTab]);

  // Register Form State
  const [formData, setFormData] = useState({
    customerName: '',
    city: 'Mumbai',
    email: '',
    monthlyBudget: 10000
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Count customers across all budget types
  const statusCounts = useMemo(() => {
    const counts = { ALL: customers.length, OVER_BUDGET: 0, ON_BUDGET: 0, UNDER_BUDGET: 0 };
    customers.forEach(c => {
      const st = c.status || 'UNDER_BUDGET';
      counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }, [customers]);

  // Multi-type featured profiles showcasing all budget statuses (New, Over Budget, On Budget, Under Budget)
  const featuredProfiles = useMemo(() => {
    if (!customers || customers.length === 0) return [];
    const seen = new Set();
    const result = [];
    const addCust = (c) => {
      if (c && !seen.has(c.customer_id)) {
        seen.add(c.customer_id);
        result.push(c);
      }
    };

    // 1. Newly registered shoppers
    customers.filter(c => c.segment === 'New Shopper' || (c.created_at && String(c.customer_id).startsWith('CUST_17'))).slice(0, 2).forEach(addCust);

    // 2. Over Budget shoppers (spent > budget)
    customers.filter(c => c.status === 'OVER_BUDGET').slice(0, 2).forEach(addCust);

    // 3. On Budget shoppers (80% - 100% utilized)
    customers.filter(c => c.status === 'ON_BUDGET').slice(0, 2).forEach(addCust);

    // 4. Under Budget shoppers (< 80% utilized)
    customers.filter(c => c.status === 'UNDER_BUDGET').slice(0, 2).forEach(addCust);

    // Fill up to 6 if needed
    for (const c of customers) {
      if (result.length >= 6) break;
      addCust(c);
    }
    return result;
  }, [customers]);

  // Filtered customer list for full search and budget status tab
  const filteredCustomers = useMemo(() => {
    let list = customers;
    if (statusFilter !== 'ALL') {
      list = list.filter(c => (c.status || 'UNDER_BUDGET') === statusFilter);
    }
    if (!search.trim()) return list.slice(0, 40);
    const q = search.toLowerCase();
    return list
      .filter(c =>
        c.customer_name?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.customer_id?.toLowerCase().includes(q) ||
        (c.status || '').toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [customers, search, statusFilter]);

  if (!isOpen) return null;

  const handleConfirmLogin = (customer) => {
    onSelectCustomer(customer);
    onClose();
  };

  const getStatusBadge = (status, utilization) => {
    const util = Number(utilization || 0).toFixed(0);
    if (status === 'OVER_BUDGET') {
      return {
        label: `OVER BUDGET (${util}%)`,
        tag: 'OVER_BUDGET',
        color: 'bg-rose-100 text-rose-800 border-rose-300'
      };
    }
    if (status === 'ON_BUDGET') {
      return {
        label: `ON BUDGET (${util}%)`,
        tag: 'ON_BUDGET',
        color: 'bg-amber-100 text-amber-900 border-amber-300'
      };
    }
    return {
      label: `UNDER BUDGET (${util}%)`,
      tag: 'UNDER_BUDGET',
      color: 'bg-emerald-100 text-emerald-800 border-emerald-300'
    };
  };

  const handleRegisterNewCustomer = async (e) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      setErrorMsg('Please enter your full name');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const newCustomer = await createCustomer({
        customerName: formData.customerName.trim(),
        city: formData.city.trim() || 'Mumbai',
        email: formData.email.trim() || `${formData.customerName.trim().toLowerCase().replace(/\s+/g, '.')}@example.com`,
        monthlyBudget: Number(formData.monthlyBudget) || 10000
      });

      setSuccessNotice(`Account created successfully for ${newCustomer.customer_name}!`);
      if (onCustomerCreated) {
        onCustomerCreated(newCustomer);
      }
      onSelectCustomer(newCustomer);

      setTimeout(() => {
        setSuccessNotice('');
        onClose();
      }, 1000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create user account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAvatarInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getPersonaBadge = (idx) => {
    const badges = [
      { label: 'Premium Shopper', color: 'bg-amber-100 text-amber-800 border-amber-300' },
      { label: 'Family Groceries', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      { label: 'Budget Smart', color: 'bg-blue-100 text-blue-800 border-blue-300' },
      { label: 'Tech & Electronics', color: 'bg-purple-100 text-purple-800 border-purple-300' },
      { label: 'Daily Essentials', color: 'bg-teal-100 text-teal-800 border-teal-300' },
      { label: 'Regular Member', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' }
    ];
    return badges[idx % badges.length];
  };

  const budgetPresets = [5000, 10000, 15000, 25000];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white backdrop-blur-xs shadow-inner">
              {activeTab === 'signin' ? (
                <LogIn className="w-5 h-5 text-emerald-200" />
              ) : (
                <UserPlus className="w-5 h-5 text-emerald-200" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <span>{activeTab === 'signin' ? 'Customer Sign In' : 'Create New Shopper Account'}</span>
                <span className="text-[10px] bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded-full font-semibold border border-emerald-400/30">
                  User Portal
                </span>
              </h2>
              <p className="text-xs text-emerald-100/90">
                {activeTab === 'signin'
                  ? 'Sign in to access your personal shopping list, cart, and monthly budget planner.'
                  : 'Register a new customer profile with a customized monthly spending budget.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs (Sign In vs Register New) */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('signin')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'signin'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Select Existing Customer</span>
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'register'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Create New User</span>
          </button>
        </div>

        {/* Success Alert */}
        {successNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center gap-2 text-xs font-bold text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Tab 1: SIGN IN CONTENT */}
        {activeTab === 'signin' && (
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* Currently logged in alert */}
            {activeCustomer && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                    {getAvatarInitials(activeCustomer.customer_name)}
                  </div>
                  <div>
                    <span>Signed in as <strong className="font-bold">{activeCustomer.customer_name}</strong> ({activeCustomer.city})</span>
                    <p className="text-[10px] text-emerald-700">ID: {activeCustomer.customer_id}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full">
                  Active
                </span>
              </div>
            )}

            {/* Quick Select Diverse Customer Profiles (Over Budget, On Budget, Under Budget) */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Featured Customer Profiles (All Budget Types)</span>
                </label>
                <button
                  onClick={() => setActiveTab('register')}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                >
                  + Register New User
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {featuredProfiles.map((cust) => {
                  const isSelected = activeCustomer?.customer_id === cust.customer_id;
                  const badge = getStatusBadge(cust.status, cust.utilization_rate);
                  return (
                    <button
                      key={cust.customer_id}
                      onClick={() => handleConfirmLogin(cust)}
                      className={`text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 group cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-500/50'
                          : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50/80 shadow-xs'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                        {getAvatarInitials(cust.customer_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-700">
                            {cust.customer_name}
                          </h4>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span className="truncate">{cust.city}</span>
                          <span>•</span>
                          <span className="font-mono text-[10px] text-slate-400">{cust.customer_id}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-1 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.color}`}>
                            {badge.label}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold">
                            ₹{Number(cust.current_spent || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} / ₹{Number(cust.monthly_budget || 10000).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Or Browse All Customer Profiles
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-xl font-bold border transition-all cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                All ({statusCounts.ALL})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('OVER_BUDGET')}
                className={`px-2.5 py-1 rounded-xl font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                  statusFilter === 'OVER_BUDGET'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                }`}
              >
                <span>🔴 Over Budget</span>
                <span className="text-[10px] font-black">({statusCounts.OVER_BUDGET})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ON_BUDGET')}
                className={`px-2.5 py-1 rounded-xl font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                  statusFilter === 'ON_BUDGET'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <span>🟡 On Budget</span>
                <span className="text-[10px] font-black">({statusCounts.ON_BUDGET})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('UNDER_BUDGET')}
                className={`px-2.5 py-1 rounded-xl font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                  statusFilter === 'UNDER_BUDGET'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <span>🟢 Under Budget</span>
                <span className="text-[10px] font-black">({statusCounts.UNDER_BUDGET})</span>
              </button>
            </div>

            {/* Search Box */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by customer name, city, or ID (e.g. Meera, Nashik)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Scrollable Customer List */}
              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-white">
                {filteredCustomers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No customers found matching your filter criteria.
                  </div>
                ) : (
                  filteredCustomers.map((cust) => {
                    const isCurrent = activeCustomer?.customer_id === cust.customer_id;
                    const badge = getStatusBadge(cust.status, cust.utilization_rate);
                    return (
                      <div
                        key={cust.customer_id}
                        onClick={() => handleConfirmLogin(cust)}
                        className={`px-4 py-3 flex items-center justify-between hover:bg-emerald-50/50 cursor-pointer transition-colors ${
                          isCurrent ? 'bg-emerald-50/80' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center border border-slate-200 shrink-0">
                            {getAvatarInitials(cust.customer_name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-bold text-slate-800">{cust.customer_name}</p>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${badge.color}`}>
                                {cust.status || 'UNDER_BUDGET'}
                              </span>
                              {isCurrent && (
                                <span className="text-[9px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.2 rounded-full">
                                  Current
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span>{cust.city}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono text-[10px] text-slate-400">{cust.customer_id}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-semibold text-slate-700">Spent: ₹{Number(cust.current_spent || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} / ₹{Number(cust.monthly_budget || 10000).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <button className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 flex items-center gap-1 transition-colors cursor-pointer">
                            <span>Select</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: REGISTER NEW USER CONTENT */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterNewCustomer} className="p-6 space-y-4 overflow-y-auto flex-1">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <span>⚠️ {errorMsg}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Full Name *</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shamita Chavan"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>

              {/* City and Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-emerald-600" />
                    <span>City</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai, Pune, Nashik"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Email Address (Optional)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. user@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Monthly Spending Budget */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Initial Monthly Budget (₹)</span>
                  </span>
                  <span className="text-emerald-700 font-extrabold text-sm">
                    ₹{Number(formData.monthlyBudget || 0).toLocaleString('en-IN')}
                  </span>
                </label>

                {/* Quick preset buttons */}
                <div className="flex gap-2 mb-2">
                  {budgetPresets.map((amount) => (
                    <button
                      type="button"
                      key={amount}
                      onClick={() => setFormData({ ...formData, monthlyBudget: amount })}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        formData.monthlyBudget === amount
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      ₹{amount / 1000}k
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  min="500"
                  step="500"
                  value={formData.monthlyBudget}
                  onChange={(e) => setFormData({ ...formData, monthlyBudget: Number(e.target.value) })}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  You can adjust or increase this anytime in the <strong>Budget Planner</strong> tab.
                </p>
              </div>

              {/* Live Preview Card */}
              <div className="bg-gradient-to-tr from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">
                    New Customer Account Preview
                  </span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                    Live DWM Synced
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      {getAvatarInitials(formData.customerName || 'New User')}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {formData.customerName || 'Your Name'}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {formData.city || 'City'} • <span className="font-semibold text-emerald-700">New Shopper</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Starting Budget</span>
                    <strong className="text-xs font-black text-emerald-700">
                      ₹{Number(formData.monthlyBudget || 0).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-emerald-200/60 grid grid-cols-2 gap-2 text-[10px] text-slate-600 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>OLTP: Customers & Budgets</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Database className="w-3 h-3 text-indigo-600" />
                    <span>OLAP: Dim_Customer & Fact_Budget</span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !formData.customerName.trim()}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Registering Account in Database...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create Account & Start Shopping</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>{customers.length} registered customers</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 hover:bg-white text-slate-700 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
