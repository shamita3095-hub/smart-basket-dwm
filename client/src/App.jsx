import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import StoreCatalog from './components/StoreCatalog';
import ShoppingList from './components/ShoppingList';
import BudgetPlanner from './components/BudgetPlanner';
import CartCheckoutModal from './components/CartCheckoutModal';
import AnalyticsSuite from './components/AnalyticsSuite';
import {
  fetchCustomers,
  fetchCategories,
  fetchProducts,
  fetchStores,
  fetchShoppingList,
  addShoppingListItem,
  updateShoppingListItem,
  removeShoppingListItem,
  clearShoppingList,
  fetchBudget,
  updateBudget,
  checkoutOrder,
  fetchCustomerOrders
} from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog', 'shopping-list', 'budget', 'analytics'
  const [customers, setCustomers] = useState([]);
  const [activeCustomer, setActiveCustomer] = useState(null);

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [shoppingList, setShoppingList] = useState({ list: null, items: [], totalEstimatedCost: 0 });
  const [budgetStatus, setBudgetStatus] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);

  const [cart, setCart] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initial Load of Customers, Categories, Stores
  useEffect(() => {
    async function initApp() {
      try {
        const [custRes, catRes, storeRes] = await Promise.all([
          fetchCustomers(),
          fetchCategories(),
          fetchStores()
        ]);

        setCustomers(custRes || []);
        if (custRes && custRes.length > 0) {
          setActiveCustomer(custRes[0]);
        }
        setCategories(catRes || []);
        setStores(storeRes || []);
      } catch (err) {
        console.error('App init error:', err);
      } finally {
        setLoading(false);
      }
    }
    initApp();
  }, []);

  // Fetch Products on Category or Search change
  useEffect(() => {
    fetchProducts(selectedCategory, searchQuery)
      .then(data => setProducts(data || []))
      .catch(err => console.error(err));
  }, [selectedCategory, searchQuery]);

  // Load customer-specific data whenever activeCustomer changes
  useEffect(() => {
    if (activeCustomer) {
      loadCustomerData(activeCustomer.customer_id);
    }
  }, [activeCustomer]);

  const loadCustomerData = async (customerId) => {
    try {
      const [listRes, budgetRes, ordersRes] = await Promise.all([
        fetchShoppingList(customerId),
        fetchBudget(customerId),
        fetchCustomerOrders(customerId)
      ]);
      setShoppingList(listRes || { list: null, items: [], totalEstimatedCost: 0 });
      setBudgetStatus(budgetRes || null);
      setOrderHistory(ordersRes || []);
    } catch (err) {
      console.error('Error loading customer data:', err);
    }
  };

  // Cart Handlers
  const handleAddToCart = (product) => {
    setCart(prev => {
      const existing = prev[product.product_id];
      const newQty = existing ? existing.quantity + 1 : 1;
      return {
        ...prev,
        [product.product_id]: {
          ...product,
          quantity: newQty
        }
      };
    });
  };

  const handleUpdateCartQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      handleRemoveCartItem(productId);
    } else {
      setCart(prev => ({
        ...prev,
        [productId]: {
          ...prev[productId],
          quantity
        }
      }));
    }
  };

  const handleRemoveCartItem = (productId) => {
    setCart(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const handleClearCart = () => {
    setCart({});
  };

  // Shopping List Handlers
  const handleAddToList = async (product) => {
    if (!activeCustomer) return;
    await addShoppingListItem(activeCustomer.customer_id, product.product_id, 1);
    await loadCustomerData(activeCustomer.customer_id);
  };

  const handleUpdateListQuantity = async (itemId, quantity) => {
    if (!activeCustomer) return;
    await updateShoppingListItem(itemId, quantity);
    await loadCustomerData(activeCustomer.customer_id);
  };

  const handleRemoveListItem = async (itemId) => {
    if (!activeCustomer) return;
    await removeShoppingListItem(itemId);
    await loadCustomerData(activeCustomer.customer_id);
  };

  const handleClearList = async () => {
    if (!activeCustomer) return;
    await clearShoppingList(activeCustomer.customer_id);
    await loadCustomerData(activeCustomer.customer_id);
  };

  const handleMoveAllToCart = () => {
    if (!shoppingList.items || shoppingList.items.length === 0) return;
    setCart(prev => {
      const next = { ...prev };
      for (const item of shoppingList.items) {
        const existing = next[item.product_id];
        const newQty = (existing ? existing.quantity : 0) + item.quantity;
        next[item.product_id] = {
          product_id: item.product_id,
          product_name: item.product_name,
          unit_price: item.unit_price,
          unit: item.unit,
          image: item.image,
          product_category: item.product_category,
          quantity: newQty
        };
      }
      return next;
    });
    setIsCartOpen(true);
  };

  // Budget Handlers
  const handleSelectBudgetMonth = async (monthYear) => {
    if (!activeCustomer) return;
    try {
      const res = await fetchBudget(activeCustomer.customer_id, monthYear);
      setBudgetStatus(res);
    } catch (err) {
      console.error('Error fetching budget for month:', err);
    }
  };

  const handleUpdateBudget = async (newAmount, monthYear) => {
    if (!activeCustomer) return;
    const my = monthYear || budgetStatus?.monthYear || new Date().toISOString().substring(0, 7);
    await updateBudget(activeCustomer.customer_id, newAmount, my);
    const updated = await fetchBudget(activeCustomer.customer_id, my);
    setBudgetStatus(updated);
  };

  // Checkout Handler
  const handleCheckoutComplete = async (orderPayload) => {
    const res = await checkoutOrder(orderPayload);
    if (activeCustomer) {
      await loadCustomerData(activeCustomer.customer_id);
    }
    return res;
  };

  const cartItemCount = Object.values(cart).reduce((acc, i) => acc + i.quantity, 0);
  const shoppingListProductIds = new Set((shoppingList.items || []).map(i => i.product_id));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        customers={customers}
        activeCustomer={activeCustomer}
        setActiveCustomer={setActiveCustomer}
        cartItemCount={cartItemCount}
        setIsCartOpen={setIsCartOpen}
        shoppingListItemCount={shoppingList.items?.length || 0}
        budgetStatus={budgetStatus}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="text-center py-24 space-y-3">
            <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-semibold text-slate-600">Loading SmartBasket DWM Environment...</p>
          </div>
        ) : (
          <>
            {activeTab === 'catalog' && (
              <StoreCatalog
                products={products}
                categories={categories}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onAddToCart={handleAddToCart}
                onAddToList={handleAddToList}
                shoppingListProductIds={shoppingListProductIds}
              />
            )}

            {activeTab === 'shopping-list' && (
              <ShoppingList
                shoppingList={shoppingList}
                onUpdateQuantity={handleUpdateListQuantity}
                onRemoveItem={handleRemoveListItem}
                onClearList={handleClearList}
                onMoveAllToCart={handleMoveAllToCart}
                budgetStatus={budgetStatus}
                onNavigateToCatalog={() => setActiveTab('catalog')}
              />
            )}

            {activeTab === 'budget' && (
              <BudgetPlanner
                budgetStatus={budgetStatus}
                onUpdateBudget={handleUpdateBudget}
                onSelectMonth={handleSelectBudgetMonth}
                activeCustomer={activeCustomer}
                orderHistory={orderHistory}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsSuite activeCustomer={activeCustomer} />
            )}
          </>
        )}
      </main>

      {/* Cart & Checkout Modal Drawer */}
      <CartCheckoutModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={handleClearCart}
        onAddToCart={handleAddToCart}
        stores={stores}
        activeCustomer={activeCustomer}
        onCheckoutComplete={handleCheckoutComplete}
        budgetStatus={budgetStatus}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p className="font-semibold text-slate-700">
            SmartBasket — Intelligent Shopping List & Budget Planner (Full-Stack DWM Project)
          </p>
          <p>
            Relational Operational Layer (OLTP: 10 Normalized Tables) • Automated Staging ETL Pipeline • OLAP Fact Constellation Schema • Apriori Market Basket Association Mining
          </p>
        </div>
      </footer>
    </div>
  );
}
