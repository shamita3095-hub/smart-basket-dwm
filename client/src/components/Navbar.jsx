import React from 'react';
import {
  ShoppingBag,
  ListChecks,
  Wallet,
  BarChart3,
  User,
  Sparkles,
  Database,
  ArrowRight
} from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  customers,
  activeCustomer,
  setActiveCustomer,
  cartItemCount,
  setIsCartOpen,
  shoppingListItemCount,
  budgetStatus
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      {/* Top Academic Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-indigo-900 text-white text-xs px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <Database className="w-3.5 h-3.5 text-emerald-300" />
          <span>SmartBasket End-to-End DWM Architecture:</span>
          <span className="text-emerald-200 hidden md:inline">
            Web Store (UI) → Relational OLTP (10 Normalized Tables) → ETL Pipeline → Fact Constellation (OLAP) → Apriori Mining
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('analytics')}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-2.5 py-0.5 rounded text-[11px] font-semibold text-white transition-colors"
          >
            <BarChart3 className="w-3 h-3" />
            <span>Launch DWM Suite</span>
            <ArrowRight className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Project Title */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('catalog')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl tracking-tight text-slate-900">SmartBasket</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">DWM</span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Intelligent Shopping & Budget Planner</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'catalog'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Catalog</span>
            </button>

            <button
              onClick={() => setActiveTab('shopping-list')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all relative ${
                activeTab === 'shopping-list'
                  ? 'bg-white text-emerald-700 shadow-xs'
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
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all relative ${
                activeTab === 'budget'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Budget Planner</span>
              {budgetStatus && budgetStatus.percentageUsed > 100 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'analytics'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-sm'
                  : 'text-indigo-700 hover:bg-indigo-50'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>DWM Analytics</span>
              <span className="text-[10px] bg-amber-400 text-amber-950 px-1 py-0.2 rounded font-extrabold uppercase">
                Demo
              </span>
            </button>
          </nav>

          {/* Customer Switcher & Cart Action */}
          <div className="flex items-center gap-3">
            {/* Customer Switcher */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500 font-medium hidden lg:inline">Customer:</span>
              <select
                value={activeCustomer?.customer_id || ''}
                onChange={(e) => {
                  const cust = customers.find(c => c.customer_id === e.target.value);
                  if (cust) setActiveCustomer(cust);
                }}
                className="bg-transparent font-semibold text-slate-800 outline-none cursor-pointer max-w-[130px] sm:max-w-[160px] truncate"
              >
                {customers.map((row) => (
                  <option key={row.customer_id} value={row.customer_id}>
                    {row['customer_name']} ({row['city']})
                  </option>
                ))}
              </select>
            </div>

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Cart</span>
              {cartItemCount > 0 && (
                <span className="bg-white text-emerald-800 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-200 bg-white py-2 px-1 text-xs font-medium">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'catalog' ? 'text-emerald-700 font-bold' : 'text-slate-600'}`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Catalog</span>
        </button>
        <button
          onClick={() => setActiveTab('shopping-list')}
          className={`flex flex-col items-center gap-1 relative ${activeTab === 'shopping-list' ? 'text-emerald-700 font-bold' : 'text-slate-600'}`}
        >
          <ListChecks className="w-4 h-4" />
          <span>List ({shoppingListItemCount})</span>
        </button>
        <button
          onClick={() => setActiveTab('budget')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'budget' ? 'text-emerald-700 font-bold' : 'text-slate-600'}`}
        >
          <Wallet className="w-4 h-4" />
          <span>Budget</span>
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center gap-1 font-bold ${activeTab === 'analytics' ? 'text-indigo-700' : 'text-slate-600'}`}
        >
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          <span>DWM Analytics</span>
        </button>
      </div>
    </header>
  );
}
