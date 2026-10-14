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
  AlertCircle
} from 'lucide-react';
import { fetchRecommendations } from '../api';

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
  budgetStatus
}) {
  const [selectedStore, setSelectedStore] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [triggerETL, setTriggerETL] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [orderSuccess, setOrderSuccess] = useState(null);

  const cartItems = Object.values(cart);
  const subtotal = cartItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);

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
      const payload = {
        customerId: activeCustomer.customer_id,
        storeId: selectedStore || (stores[0]?.store_id || 'STORE_500'),
        items: cartItems.map(i => ({
          productId: i.product_id,
          quantity: i.quantity,
          unitPrice: i.unit_price
        })),
        paymentMethod,
        triggerETL
      };

      const result = await onCheckoutComplete(payload);
      setOrderSuccess(result);
      onClearCart();
    } catch (err) {
      alert(`Checkout failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Your Shopping Cart & Checkout</h2>
              <p className="text-[11px] text-slate-500">
                Customer: <span className="font-semibold text-slate-700">{activeCustomer?.customer_name}</span> ({activeCustomer?.city})
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
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Order Placed Successfully!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Order ID: <code className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">{orderSuccess.orderId}</code>
                </p>
              </div>

              {/* ETL Sync Notification */}
              {orderSuccess.etlSynced && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 text-left max-w-lg mx-auto">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <span>Real-time ETL Pipeline Synchronization Completed!</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 mt-1">
                    Your order was inserted into the operational layer (<code className="font-mono text-emerald-900">Orders</code> & <code className="font-mono text-emerald-900">Order_Items</code>) and automatically transformed into <code className="font-mono text-emerald-900">Fact_Sales</code> and <code className="font-mono text-emerald-900">Fact_Budget_Performance</code> in the Data Warehouse.
                  </p>
                </div>
              )}

              <div className="pt-4">
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
              <h3 className="text-base font-bold text-slate-700">Your cart is currently empty</h3>
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
                        <div className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
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
                        <span className="text-xs font-bold text-slate-900">
                          ₹{(item.quantity * item.unit_price).toFixed(2)}
                        </span>
                      </div>

                      <button
                        onClick={() => onRemoveItem(item.product_id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="p-3 bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Cart Subtotal ({cartItems.reduce((acc, i) => acc + i.quantity, 0)} items):</span>
                  <span className="text-sm font-black text-slate-900">₹{subtotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Data Mining: Market Basket Recommendations */}
              {recommendations.length > 0 && (
                <div className="bg-gradient-to-br from-indigo-50/80 via-purple-50/50 to-emerald-50/60 p-4 rounded-2xl border border-indigo-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider">
                        Frequently Bought Together (Apriori Mining)
                      </span>
                    </div>
                    <span className="text-[10px] bg-indigo-200/80 text-indigo-900 px-1.5 py-0.2 rounded font-bold">
                      Confidence &gt; 50%
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
                              ₹{Number(rec.unitPrice).toFixed(2)} • {rec.confidence}% confidence
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
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg shrink-0 transition-colors"
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Checkout Form (Store & Payment Method) */}
              <form onSubmit={handleCheckout} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Store Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
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
                          {s.store_id} — {s.store_type} ({s.city})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                      <span>Payment Method</span>
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Cash">Cash on Delivery (Cash)</option>
                    </select>
                  </div>
                </div>

                {/* Real-Time ETL Sync Option */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-800">Auto-Sync to Data Warehouse via ETL</span>
                      <p className="text-[10px] text-slate-500">
                        Automatically populates <code className="text-emerald-700">Fact_Sales</code> & <code className="text-emerald-700">Fact_Budget_Performance</code>
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={triggerETL}
                    onChange={(e) => setTriggerETL(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Order Summary & Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Processing Order & Executing ETL Pipeline...</span>
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
