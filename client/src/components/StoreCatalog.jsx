import React, { useState } from 'react';
import {
  Search,
  Plus,
  Check,
  ShoppingBag,
  ListPlus,
  Sparkles,
  Filter,
  CheckCircle2,
  Wallet,
  AlertTriangle,
  ArrowRight,
  User,
  LogIn
} from 'lucide-react';

export default function StoreCatalog({
  products,
  categories,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  onAddToCart,
  onAddToList,
  shoppingListProductIds = new Set(),
  activeCustomer,
  budgetStatus,
  onOpenLoginModal,
  onNavigateToBudget,
  onOpenCart,
  cartItemCount = 0
}) {
  const [addedNotice, setAddedNotice] = useState(null);

  const handleListClick = async (product) => {
    await onAddToList(product);
    setAddedNotice({ id: product.product_id, type: 'list', text: 'Added to Shopping List!' });
    setTimeout(() => setAddedNotice(null), 2000);
  };

  const handleCartClick = (product) => {
    onAddToCart(product);
    setAddedNotice({ id: product.product_id, type: 'cart', text: 'Added to Cart!' });
    setTimeout(() => setAddedNotice(null), 2000);
  };

  // Budget computations
  const monthlyBudget = Number(budgetStatus?.monthlyBudget || 10000);
  const currentSpent = Number(budgetStatus?.currentSpent || 0);
  const remaining = monthlyBudget - currentSpent;
  const percentageUsed = monthlyBudget > 0 ? (currentSpent / monthlyBudget) * 100 : 0;
  const isOverBudget = remaining < 0;

  const getAvatarInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Customer Profile & Live Budget Tracker Bar */}
      {activeCustomer ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white font-black text-base flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              {getAvatarInitials(activeCustomer.customer_name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  Welcome, {activeCustomer.customer_name}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {activeCustomer.city}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>Personalized Shopping & Budget Portal</span>
                <span>•</span>
                <button
                  onClick={onOpenLoginModal}
                  className="text-emerald-700 hover:text-emerald-800 font-bold underline"
                >
                  Switch User
                </button>
              </p>
            </div>
          </div>

          {/* Quick Budget & Cart Pills */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Monthly Budget Card */}
            <div
              onClick={onNavigateToBudget}
              className={`cursor-pointer px-3.5 py-2 rounded-xl border transition-all flex items-center gap-2.5 ${
                isOverBudget
                  ? 'bg-rose-50 border-rose-200 hover:border-rose-300'
                  : 'bg-slate-50 border-slate-200 hover:border-emerald-300'
              }`}
              title="Click to view detailed Budget Planner"
            >
              <div className={`p-1.5 rounded-lg ${isOverBudget ? 'bg-rose-500 text-white' : 'bg-emerald-600 text-white'}`}>
                {isOverBudget ? <AlertTriangle className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  {isOverBudget ? 'Budget Exceeded' : 'Remaining Budget'}
                </div>
                <div className={`text-xs sm:text-sm font-black ${isOverBudget ? 'text-rose-600' : 'text-slate-900'}`}>
                  {isOverBudget
                    ? `Over by ₹${Math.abs(Math.round(remaining)).toLocaleString('en-IN')}`
                    : `₹${Math.round(remaining).toLocaleString('en-IN')} Left`}
                </div>
              </div>
            </div>

            {/* Total Spent Card */}
            <div
              onClick={onNavigateToBudget}
              className="cursor-pointer px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:border-emerald-300 transition-all flex items-center gap-2.5"
            >
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500">Month Spend</div>
                <div className="text-xs sm:text-sm font-black text-slate-800">
                  ₹{Math.round(currentSpent).toLocaleString('en-IN')}{' '}
                  <span className="text-[10px] font-normal text-slate-500">
                    / ₹{Math.round(monthlyBudget).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Button to Budget Planner */}
            <button
              onClick={onNavigateToBudget}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <span>Planner</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-emerald-700" />
            <div>
              <p className="text-xs font-bold text-emerald-900">Sign in to track your personal budget</p>
              <p className="text-[11px] text-emerald-700">Choose your customer profile to customize shopping lists and monthly limits.</p>
            </div>
          </div>
          <button
            onClick={onOpenLoginModal}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Login Now</span>
          </button>
        </div>
      )}

      {/* Hero Store Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-950 text-white p-6 sm:p-8 shadow-md">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 text-xs font-semibold backdrop-blur-xs border border-emerald-400/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Smart Shopping & Budget Tracking</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Daily Essentials, Groceries & Electronics
          </h1>
          <p className="text-emerald-100/90 text-xs sm:text-sm leading-relaxed">
            Browse verified Indian retail inventory, add items to your cart or saved checklist, and watch your monthly budget update in real-time.
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Search Input */}
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search groceries, milk, tea, rice, electronics, snacks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Product Count Indicator */}
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{products.length}</span> retail products
        </div>
      </div>

      {/* Category Pills Slider */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            selectedCategory === 'ALL'
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          All Categories
        </button>

        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.category_id;
          return (
            <button
              key={cat.category_id}
              onClick={() => setSelectedCategory(cat.category_id)}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat.product_category}
            </button>
          );
        })}
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">No items found</h3>
          <p className="text-sm text-slate-500 mt-1">Try refining your search keyword or selected category filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {products.map((product) => {
            const isListed = shoppingListProductIds.has(product.product_id);
            const isCurrentNotice = addedNotice && addedNotice.id === product.product_id;

            return (
              <div
                key={product.product_id}
                className="group bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden"
              >
                {/* Product Image */}
                <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                  <img
                    src={product.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80'}
                    alt={product.product_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute top-2.5 left-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/90 text-slate-700 shadow-xs backdrop-blur-xs">
                      {product.product_category}
                    </span>
                  </div>

                  {/* Temporary feedback banner */}
                  {isCurrentNotice && (
                    <div className="absolute inset-0 bg-emerald-900/80 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold p-3 text-center animate-fade-in">
                      <div className="flex flex-col items-center gap-1">
                        <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                        <span>{addedNotice.text}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base line-clamp-1 group-hover:text-emerald-700 transition-colors">
                      {product.product_name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {product.description || `Quality ${product.product_category} item from verified retail suppliers.`}
                    </p>
                  </div>

                  {/* Pricing and Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-baseline justify-between mb-3">
                      <div>
                        <span className="text-lg font-black text-slate-900">
                          ₹{Number(product.unit_price).toFixed(2)}
                        </span>
                        {product.unit && product.unit !== 'unit' && (
                          <span className="text-xs text-slate-500 ml-1">/ {product.unit}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold">
                        In Stock
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Add to Shopping List */}
                      <button
                        onClick={() => handleListClick(product)}
                        className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          isListed
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                        title="Add to saved shopping list"
                      >
                        {isListed ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Listed</span>
                          </>
                        ) : (
                          <>
                            <ListPlus className="w-3.5 h-3.5 text-slate-500" />
                            <span>Add to List</span>
                          </>
                        )}
                      </button>

                      {/* Add to Cart */}
                      <button
                        onClick={() => handleCartClick(product)}
                        className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Cart</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
