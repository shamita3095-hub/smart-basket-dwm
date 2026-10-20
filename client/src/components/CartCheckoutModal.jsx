import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  Sparkles,
  ShoppingBag,
  Store,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  Database,
  RefreshCw,
  AlertCircle,
  Wallet,
  AlertTriangle,
  Receipt,
  User,
  UserPlus
} from 'lucide-react';
import { fetchRecommendations, createCustomer } from '../api';

export default function CartCheckoutModal({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onAddToCart,
  stores,
  activeCustomer,
  onCheckoutComplete,
  budgetStatus,
  appMode = 'customer',
  onRegisterCustomer,
  onOpenLoginModal
}) {
  const [selectedStore, setSelectedStore] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [triggerETL, setTriggerETL] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [orderSuccess, setOrderSuccess] = useState(null);

  // Quick New User checkout state if not signed in
  const [guestName, setGuestName] = useState('');
  const [guestCity, setGuestCity] = useState('Mumbai');
  const [guestBudget, setGuestBudget] = useState(10000);

  const isCustomerMode = appMode === 'customer';
  const cartItems = Object.values(cart);
  const subtotal = cartItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);

  // Budget calculations
  const monthlyBudget = Number(budgetStatus?.monthlyBudget || 10000);
  const currentSpent = Number(budgetStatus?.currentSpent || 0);
  const projectedSpent = currentSpent + subtotal;
  const projectedRemaining = monthlyBudget - projectedSpent;
  const willExceedBudget = projectedRemaining < 0;

  // Set default store matching customer's city if available
  useEffect(() => {
    if (stores && stores.length > 0 && !selectedStore) {
      const match = stores.find(s => s.city.toLowerCase() === activeCustomer?.city?.toLowerCase());
      setSelectedStore(match ? match.store_id : stores[0].store_id);
    }
  }, [stores, activeCustomer, selectedStore]);

  // Fetch Market Basket Recommendations based on items in cart
  useEffect(() => {
    if (cartItems.length > 0) {
      const productIds = cartItems.map(i => i.product_id);
      fetchRecommendations(productIds)
        .then(data => setRecommendations(data || []))
        .catch(err => console.error('Recs error:', err));
    } else {
      setRecommendations([]);
    }
  }, [cartItems.length]);

  if (!isOpen) return null;

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) return;

    setIsSubmitting(true);
    try {
      let customerToUse = activeCustomer;
      if (!customerToUse) {
        if (!guestName.trim()) {
          alert('Please enter your full name to create an account and place your order.');
          setIsSubmitting(false);
          return;
        }
        const createdCust = await createCustomer({
          customerName: guestName.trim(),
          city: guestCity.trim() || 'Mumbai',
          monthlyBudget: Number(guestBudget) || 10000
        });
        customerToUse = createdCust;
        if (onRegisterCustomer) {
          onRegisterCustomer(createdCust);
        }
      }

      const payload = {
        customerId: customerToUse.customer_id,
        storeId: selectedStore || (stores[0]?.store_id || 'STORE_500'),
        items: cartItems.map(i => ({
          productId: i.product_id,
          quantity: i.quantity,
          unitPrice: i.unit_price
        })),
        paymentMethod,
        triggerETL: true
      };

      const result = await onCheckoutComplete(payload);
      setOrderSuccess({
        ...result,
        customerName: customerToUse.customer_name,
        city: customerToUse.city,
        totalAmount: subtotal,
        itemCount: cartItems.length,
        paymentMethod,
        storeName: stores.find(s => s.store_id === selectedStore)?.store_type || 'Retail Outlet'
      });
      onClearCart();
    } catch (err) {
      alert(`Checkout failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Your Shopping Cart</h2>
              <p className="text-[11px] text-slate-500">
                Shopper: <span className="font-bold text-slate-700">{activeCustomer ? `${activeCustomer.customer_name} (${activeCustomer.city})` : 'New Shopper Guest'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setOrderSuccess(null);
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Order Success View */}
          {orderSuccess ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Order Confirmed!</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Thank you, <strong className="font-semibold">{activeCustomer?.customer_name}</strong>! Your order has been placed.
                </p>
              </div>

              {/* Order Receipt Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left max-w-md mx-auto space-y-2.5 text-xs text-slate-700">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    <span>Order Receipt</span>
                  </span>
                  <span className="font-mono text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded">
                    {orderSuccess.orderId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Paid:</span>
                  <span className="font-black text-slate-900 text-sm">₹{Number(orderSuccess.totalAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment:</span>
                  <span className="font-medium">{orderSuccess.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Outlet:</span>
                  <span className="font-medium">{orderSuccess.storeName}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-emerald-800 font-semibold">
                  <span>Budget Tracker:</span>
                  <span>Updated in real-time</span>
                </div>
              </div>

              {/* Technical ETL Notification only shown in Admin mode */}
              {!isCustomerMode && orderSuccess.etlSynced && (
                <div className="bg-gradient-to-r from-indigo-50 to-emerald-50 border border-indigo-200 rounded-2xl p-3 text-left max-w-md mx-auto text-xs text-indigo-900">
                  <div className="flex items-center gap-2 font-bold">
                    <Database className="w-4 h-4 text-indigo-600" />
                    <span>Real-time ETL Pipeline Synchronized</span>
                  </div>
                  <p className="text-[11px] text-indigo-800 mt-0.5">
                    Populated into <code className="font-mono text-indigo-900 font-bold">Fact_Sales</code> & <code className="font-mono text-indigo-900 font-bold">Fact_Budget_Performance</code>.
                  </p>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={() => {
                    setOrderSuccess(null);
                    onClose();
                  }}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          ) : cartItems.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">Your cart is empty</h3>
              <p className="text-xs text-slate-500">
                Explore our catalog to add fresh groceries, daily essentials, or shopping list items.
              </p>
            </div>
          ) : (
            <>
              {/* Cart Line Items */}
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {cartItems.map((item) => (
                  <div key={item.product_id} className="p-3.5 flex items-center justify-between gap-3 bg-white">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=120&q=80'}
                        alt={item.product_name}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                          {item.product_name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          ₹{Number(item.unit_price).toFixed(2)} {item.unit ? `• ${item.unit}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-xs">
                        <button
                          onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
                          className="p-1 text-slate-500 hover:bg-slate-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 text-xs font-bold text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
                          className="p-1 text-slate-500 hover:bg-slate-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right w-16">
                        <span className="text-xs font-black text-slate-900">
                          ₹{(item.quantity * item.unit_price).toFixed(2)}
                        </span>
                      </div>

                      <button
                        onClick={() => onRemoveItem(item.product_id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="p-3.5 bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Cart Subtotal ({cartItems.reduce((acc, i) => acc + i.quantity, 0)} items):</span>
                  <span className="text-base font-black text-slate-900">₹{subtotal.toFixed(2)}</span>
                </div>
              </div>

              {/* LIVE BUDGET IMPACT CHECKER */}
              <div className={`p-4 rounded-2xl border transition-all ${
                willExceedBudget
                  ? 'bg-rose-50/90 border-rose-200 text-rose-900'
                  : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    {willExceedBudget ? (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    ) : (
                      <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <span>Monthly Budget Impact Check</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    willExceedBudget
                      ? 'bg-rose-200 text-rose-800'
                      : 'bg-emerald-200 text-emerald-800'
                  }`}>
                    {willExceedBudget ? 'Exceeds Budget' : 'Safe to Spend'}
                  </span>
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-2 text-[11px] text-center">
                  <div className="bg-white/80 p-2 rounded-xl border border-slate-200/50">
                    <span className="text-slate-500 block text-[10px]">Monthly Budget</span>
                    <strong className="font-bold text-slate-800">₹{Math.round(monthlyBudget).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-slate-200/50">
                    <span className="text-slate-500 block text-[10px]">Already Spent</span>
                    <strong className="font-bold text-slate-800">₹{Math.round(currentSpent).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-slate-200/50">
                    <span className="text-slate-500 block text-[10px]">
                      {willExceedBudget ? 'Over Budget By' : 'Remaining After'}
                    </span>
                    <strong className={`font-black ${willExceedBudget ? 'text-rose-600' : 'text-emerald-700'}`}>
                      ₹{Math.abs(Math.round(projectedRemaining)).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>

                {willExceedBudget ? (
                  <p className="text-[11px] text-rose-700 mt-2">
                    ⚠️ This order will push your monthly spend to <strong className="font-bold">₹{Math.round(projectedSpent).toLocaleString('en-IN')}</strong>, exceeding your limit by <strong className="font-bold">₹{Math.abs(Math.round(projectedRemaining)).toLocaleString('en-IN')}</strong>. You can adjust your limit in the Budget Planner.
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-700 mt-2">
                    ✅ Great planning! You will still have <strong className="font-bold">₹{Math.round(projectedRemaining).toLocaleString('en-IN')}</strong> left in your budget for this month.
                  </p>
                )}
              </div>

              {/* Data Mining: Market Basket Recommendations */}
              {recommendations.length > 0 && (
                <div className="bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-emerald-50/50 p-4 rounded-2xl border border-indigo-100 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-900">
                        Frequently Bought Together
                      </span>
                    </div>
                    <span className="text-[10px] text-indigo-700 font-semibold">
                      Companion Add-ons
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {recommendations.slice(0, 4).map((rec) => (
                      <div
                        key={rec.recommendedProductId}
                        className="bg-white p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between gap-2 shadow-xs hover:border-indigo-300 transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={rec.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=100&q=80'}
                            alt={rec.recommendedProductName}
                            className="w-9 h-9 rounded-lg object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-800 truncate">
                              {rec.recommendedProductName}
                            </div>
                            <div className="text-[10px] text-indigo-700 font-medium">
                              ₹{Number(rec.unitPrice).toFixed(2)}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            onAddToCart({
                              product_id: rec.recommendedProductId,
                              product_name: rec.recommendedProductName,
                              unit_price: rec.unitPrice,
                              image: rec.image,
                              product_category: rec.recommendedCategory
                            });
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shrink-0 transition-colors"
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Checkout Form */}
              <form onSubmit={handleCheckout} className="space-y-4 pt-1">
                {/* Guest / New Shopper Info Section */}
                {!activeCustomer && (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-emerald-700" />
                        <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                          New Shopper Account Setup
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenLoginModal && onOpenLoginModal('signin')}
                        className="text-[11px] font-bold text-emerald-700 underline"
                      >
                        Sign in existing
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Shamita Chavan"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            City
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Mumbai"
                            value={guestCity}
                            onChange={(e) => setGuestCity(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Monthly Budget (₹)
                          </label>
                          <input
                            type="number"
                            min="500"
                            step="500"
                            value={guestBudget}
                            onChange={(e) => setGuestBudget(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        ⚡ Placing order automatically registers your account, saves your budget in OLTP, and syncs into DWM analytics.
                      </p>
                    </div>
                  </div>
                )}

                {activeCustomer && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-600">
                        Ordering as <strong className="text-slate-900 font-bold">{activeCustomer.customer_name}</strong> ({activeCustomer.city})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenLoginModal && onOpenLoginModal('register')}
                      className="text-[11px] text-emerald-700 font-bold hover:underline"
                    >
                      + New Shopper
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Store Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-slate-500" />
                      <span>Select Retail Store Outlet</span>
                    </label>
                    <select
                      value={selectedStore}
                      onChange={(e) => setSelectedStore(e.target.value)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {stores.slice(0, 30).map((s) => (
                        <option key={s.store_id} value={s.store_id}>
                          {s.store_type} ({s.city})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                      <span>Payment Method</span>
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Cash">Cash on Delivery (Cash)</option>
                    </select>
                  </div>
                </div>

                {/* Submit Checkout Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Confirming Order...</span>
                      </>
                    ) : (
                      <>
                        <span>Place Order (₹{subtotal.toFixed(2)})</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
