import React from 'react';
import {
  ShoppingBag,
  ListChecks,
  Wallet,
  BarChart3,
  User,
  Sparkles,
  Database,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  Layers,
  Store,
  LogIn,
  UserPlus
} from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  appMode,
  setAppMode,
  customers,
  activeCustomer,
  setActiveCustomer,
  onOpenLoginModal,
  cartItemCount,
  setIsCartOpen,
  shoppingListItemCount,
  budgetStatus
}) {
  const isCustomerMode = appMode === 'customer';

  // Budget calculations for live badge
  const monthlyBudget = Number(budgetStatus?.monthlyBudget || 10000);
  const currentSpent = Number(budgetStatus?.currentSpent || 0);
  const remaining = monthlyBudget - currentSpent;
  const isOverBudget = remaining < 0;

  const getAvatarInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      {/* Top Banner (Only shown in Admin / DWM Mode) */}
      {!isCustomerMode && (
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white text-xs px-4 py-2 flex items-center justify-between border-b border-indigo-800">
          <div className="flex items-center gap-2 font-medium">
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-bold text-amber-300">ADMIN / DWM PORTAL:</span>
            <span className="text-slate-200 hidden md:inline">
              OLTP (10 Relational Tables) • Automated ETL Staging • Star / Fact Constellation • Apriori Mining
            </span>
          </div>
          <button
            onClick={() => {
              setAppMode('customer');
              setActiveTab('catalog');
            }}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 px-3 py-1 rounded-lg text-xs font-bold text-white transition-all shadow-sm"
          >
            <Store className="w-3.5 h-3.5" />
            <span>← Return to Customer Shopping</span>
          </button>
        </div>
      )}

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => {
              setActiveTab('catalog');
            }}
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-tight text-slate-900">
                  SmartBasket
                </span>
                <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full ${
                  isCustomerMode
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                }`}>
                  {isCustomerMode ? 'Customer Store' : 'Admin DWM'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                {isCustomerMode
                  ? 'Personal Shopping & Monthly Budget Planner'
                  : 'Data Warehousing & OLAP Analytics Engine'}
              </p>
            </div>
          </div>

          {/* Customer Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'catalog'
                  ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Shop</span>
            </button>

            <button
              onClick={() => setActiveTab('shopping-list')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all relative ${
                activeTab === 'shopping-list'
                  ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <ListChecks className="w-4 h-4" />
              <span>Shopping List</span>
              {shoppingListItemCount > 0 && (
                <span className="bg-emerald-600 text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                  {shoppingListItemCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('budget')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all relative ${
                activeTab === 'budget'
                  ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Budget Planner</span>
              {isOverBudget ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-300">
                  Over Limit
                </span>
              ) : (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                  ₹{Math.max(0, Math.round(remaining)).toLocaleString('en-IN')} Left
                </span>
              )}
            </button>

            {/* Admin tab only visible in admin mode */}
            {!isCustomerMode && (
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm'
                    : 'text-indigo-700 hover:bg-indigo-50'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>OLAP & ETL Suite</span>
              </button>
            )}
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Quick + New Shopper Action */}
            <button
              onClick={() => onOpenLoginModal('register')}
              className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 hover:border-emerald-400 rounded-xl px-2.5 py-1.5 transition-all text-xs font-bold shadow-2xs group"
              title="Create a new customer account with custom budget"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">+ New Shopper</span>
            </button>

            {/* Customer Login / Profile Button */}
            {activeCustomer ? (
              <button
                onClick={() => onOpenLoginModal('signin')}
                className="flex items-center gap-2 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 rounded-xl px-2.5 py-1.5 transition-all text-left shadow-xs group"
                title="Click to Switch Customer or View Profile"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {getAvatarInitials(activeCustomer.customer_name)}
                </div>
                <div className="hidden sm:block min-w-0 pr-1">
                  <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 truncate max-w-[110px] flex items-center gap-1">
                    <span>{activeCustomer.customer_name}</span>
                    {activeCustomer.segment === 'New Shopper' && (
                      <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1 rounded font-black">
                        New
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <span>{activeCustomer.city}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold">Switch</span>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0" />
              </button>
            ) : (
              <button
                onClick={() => onOpenLoginModal('signin')}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Login</span>
              </button>
            )}

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm hover:shadow-md"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Cart</span>
              {cartItemCount > 0 ? (
                <span className="bg-white text-emerald-800 text-[11px] font-black px-1.5 py-0.5 rounded-full min-w-5 text-center shadow-xs">
                  {cartItemCount}
                </span>
              ) : (
                <span className="text-emerald-200 text-xs hidden sm:inline">(0)</span>
              )}
            </button>

            {/* Admin / Customer Mode Switch Toggle Button */}
            {isCustomerMode ? (
              <button
                onClick={() => {
                  setAppMode('admin');
                  setActiveTab('analytics');
                }}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-700 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all"
                title="Switch to Admin & DWM Analytics view"
              >
                <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden lg:inline">Admin Mode</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setAppMode('customer');
                  setActiveTab('catalog');
                }}
                className="flex items-center gap-1.5 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-800 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all"
                title="Switch back to Customer Store"
              >
                <Store className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden lg:inline">Customer Store</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-200 bg-white py-2 px-1 text-xs font-medium">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'catalog' ? 'text-emerald-700 font-bold' : 'text-slate-600'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Shop</span>
        </button>
        <button
          onClick={() => setActiveTab('shopping-list')}
          className={`flex flex-col items-center gap-1 relative ${
            activeTab === 'shopping-list' ? 'text-emerald-700 font-bold' : 'text-slate-600'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          <span>List ({shoppingListItemCount})</span>
        </button>
        <button
          onClick={() => setActiveTab('budget')}
          className={`flex flex-col items-center gap-1 ${
            activeTab === 'budget' ? 'text-emerald-700 font-bold' : 'text-slate-600'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Budget</span>
        </button>
        {!isCustomerMode && (
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex flex-col items-center gap-1 font-bold ${
              activeTab === 'analytics' ? 'text-indigo-700' : 'text-slate-600'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <span>DWM Suite</span>
          </button>
        )}
      </div>
    </header>
  );
}
