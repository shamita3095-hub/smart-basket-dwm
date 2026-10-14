import React from 'react';
import {
  ListChecks,
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  ArrowRight,
  Wallet,
  AlertCircle,
  Sparkles,
  ShoppingBag
} from 'lucide-react';

export default function ShoppingList({
  shoppingList,
  onUpdateQuantity,
  onRemoveItem,
  onClearList,
  onMoveAllToCart,
  budgetStatus,
  onNavigateToCatalog
}) {
  const items = shoppingList.items || [];
  const totalCost = shoppingList.totalEstimatedCost || 0;
  const remainingBudget = budgetStatus?.remainingBalance ?? 10000;
  const willExceedBudget = totalCost > remainingBudget && remainingBudget > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <ListChecks className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              {shoppingList.list?.list_name || 'My Shopping List'}
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Database-backed operational shopping list (<code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded text-[11px]">Shopping_Lists</code> & <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded text-[11px]">Shopping_List_Items</code>)
          </p>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={onClearList}
              className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5 border border-rose-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear List</span>
            </button>
            <button
              onClick={onMoveAllToCart}
              className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Move All to Cart</span>
            </button>
          </div>
        )}
      </div>

      {/* Budget Impact Preview Alert */}
      {items.length > 0 && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs ${
          willExceedBudget
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <Wallet className="w-4 h-4 shrink-0" />
            <div>
              <span className="font-bold">Budget Impact Analysis: </span>
              {willExceedBudget ? (
                <span>
                  Adding this entire list (₹{totalCost.toFixed(2)}) will exceed your remaining monthly budget of ₹{remainingBudget.toFixed(2)} by ₹{(totalCost - remainingBudget).toFixed(2)}.
                </span>
              ) : (
                <span>
                  This list totals ₹{totalCost.toFixed(2)}, comfortably within your remaining monthly budget of ₹{remainingBudget.toFixed(2)}.
                </span>
              )}
            </div>
          </div>
          <span className="font-extrabold px-2 py-0.5 bg-white/70 rounded border border-current text-[11px]">
            {((totalCost / (budgetStatus?.monthlyBudget || 10000)) * 100).toFixed(0)}% of Budget
          </span>
        </div>
      )}

      {/* Shopping List Items */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <ListChecks className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">Your shopping list is empty</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Browse products from the catalog and click "Add to List" to plan your upcoming grocery purchase.
            </p>
          </div>
          <button
            onClick={onNavigateToCatalog}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Browse Products</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
          {items.map((item) => (
            <div
              key={item.shopping_list_item_id}
              className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
            >
              {/* Product Info */}
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src={item.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=150&q=80'}
                  alt={item.product_name}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0">
                  <h4 className="font-semibold text-slate-900 text-sm truncate">
                    {item.product_name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px] font-medium">
                      {item.product_category}
                    </span>
                    <span>₹{Number(item.unit_price).toFixed(2)} each</span>
                  </div>
                </div>
              </div>

              {/* Quantity Stepper & Cost */}
              <div className="flex items-center gap-4 shrink-0">
                {/* Stepper */}
                <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-xs">
                  <button
                    onClick={() => onUpdateQuantity(item.shopping_list_item_id, item.quantity - 1)}
                    className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                    title="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3 text-xs font-bold text-slate-800 select-none">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => onUpdateQuantity(item.shopping_list_item_id, item.quantity + 1)}
                    className="p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                    title="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Line Total */}
                <div className="text-right w-20">
                  <span className="font-bold text-slate-900 text-sm">
                    ₹{Number(item.estimated_cost).toFixed(2)}
                  </span>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => onRemoveItem(item.shopping_list_item_id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Remove from list"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* List Summary Footer */}
          <div className="p-4 bg-slate-50 flex items-center justify-between text-sm">
            <span className="text-slate-600 font-medium">
              Total Estimated List Cost ({items.reduce((acc, i) => acc + i.quantity, 0)} items):
            </span>
            <span className="text-lg font-black text-slate-900">
              ₹{totalCost.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
