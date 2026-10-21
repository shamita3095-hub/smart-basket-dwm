const API_BASE = '/api';

export async function fetchCategories() {
  const res = await fetch(`${API_BASE}/categories`);
  return res.json();
}

export async function fetchProducts(categoryId = 'ALL', search = '') {
  const params = new URLSearchParams();
  if (categoryId && categoryId !== 'ALL') params.append('categoryId', categoryId);
  if (search) params.append('search', search);
  const res = await fetch(`${API_BASE}/products?${params.toString()}`);
  return res.json();
}

export async function fetchStores() {
  const res = await fetch(`${API_BASE}/stores`);
  return res.json();
}

export async function fetchCustomers() {
  const res = await fetch(`${API_BASE}/customers`);
  return res.json();
}

export async function fetchCustomer(id) {
  const res = await fetch(`${API_BASE}/customers/${id}`);
  return res.json();
}

export async function createCustomer(customerData) {
  const res = await fetch(`${API_BASE}/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(customerData)
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to register customer');
  }
  return res.json();
}

export async function fetchShoppingList(customerId) {
  const res = await fetch(`${API_BASE}/shopping-list/${customerId}`);
  return res.json();
}

export async function addShoppingListItem(customerId, productId, quantity = 1) {
  const res = await fetch(`${API_BASE}/shopping-list/item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId, productId, quantity })
  });
  return res.json();
}

export async function updateShoppingListItem(itemId, quantity) {
  const res = await fetch(`${API_BASE}/shopping-list/item/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity })
  });
  return res.json();
}

export async function removeShoppingListItem(itemId) {
  const res = await fetch(`${API_BASE}/shopping-list/item/${itemId}`, {
    method: 'DELETE'
  });
  return res.json();
}

export async function clearShoppingList(customerId) {
  const res = await fetch(`${API_BASE}/shopping-list/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId })
  });
  return res.json();
}

export async function fetchBudget(customerId, monthYear) {
  const params = monthYear ? `?monthYear=${monthYear}` : '';
  const res = await fetch(`${API_BASE}/budget/${customerId}${params}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch budget');
  }
  return res.json();
}

export async function updateBudget(customerId, monthlyBudget, monthYear) {
  const res = await fetch(`${API_BASE}/budget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId, monthlyBudget, monthYear })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update budget');
  }
  return res.json();
}

export async function checkoutOrder(orderData) {
  const res = await fetch(`${API_BASE}/orders/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Checkout failed');
  }
  return res.json();
}

export async function fetchCustomerOrders(customerId) {
  const res = await fetch(`${API_BASE}/orders/${customerId}`);
  return res.json();
}

export async function runETLPipeline(incremental = false) {
  const token = getAdminToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/etl/run`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ incremental })
  });
  return res.json();
}

export async function fetchETLHistory() {
  const token = getAdminToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/etl/history`, { headers });
  return res.json();
}

// ============================================================================
// ADMIN AUTHENTICATION API
// ============================================================================

export function getAdminToken() {
  return sessionStorage.getItem('smartbasket_admin_token') || localStorage.getItem('smartbasket_admin_token') || '';
}

export function setAdminToken(token) {
  if (token) {
    sessionStorage.setItem('smartbasket_admin_token', token);
  } else {
    sessionStorage.removeItem('smartbasket_admin_token');
    localStorage.removeItem('smartbasket_admin_token');
  }
}

export async function adminLogin(password) {
  const res = await fetch(`${API_BASE}/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Admin authentication failed');
  }
  if (data.token) {
    setAdminToken(data.token);
  }
  return data;
}

export async function verifyAdminToken(token) {
  const t = token || getAdminToken();
  if (!t) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/verify-admin`, {
      headers: { Authorization: `Bearer ${t}` }
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function logoutAdmin() {
  setAdminToken(null);
}

// ============================================================================
// EXPENSE MANAGEMENT CRUD API
// ============================================================================

export async function fetchExpenses(customerId, monthYear) {
  const params = monthYear ? `?monthYear=${monthYear}` : '';
  const res = await fetch(`${API_BASE}/expenses/${customerId}${params}`);
  return res.json();
}

export async function createExpense(expenseData) {
  const res = await fetch(`${API_BASE}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expenseData)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save expense');
  }
  return data;
}

export async function updateExpense(expenseId, expenseData) {
  const res = await fetch(`${API_BASE}/expenses/${expenseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expenseData)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update expense');
  }
  return data;
}

export async function deleteExpense(expenseId) {
  const res = await fetch(`${API_BASE}/expenses/${expenseId}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete expense');
  }
  return data;
}

export async function fetchKPIs() {
  const res = await fetch(`${API_BASE}/analytics/kpis`);
  return res.json();
}

export async function fetchTimeDrillDown(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/olap/drilldown?${qs}`);
  return res.json();
}

export async function fetchSliceAndDice(filters = {}) {
  const qs = new URLSearchParams(filters).toString();
  const res = await fetch(`${API_BASE}/olap/slice-dice?${qs}`);
  return res.json();
}

export async function fetchPivot(rowDim, colDim) {
  const res = await fetch(`${API_BASE}/olap/pivot?rowDim=${rowDim}&colDim=${colDim}`);
  return res.json();
}

export async function fetchMarketBasketRules(options = {}) {
  const qs = new URLSearchParams(options).toString();
  const res = await fetch(`${API_BASE}/mining/market-basket?${qs}`);
  return res.json();
}

export async function fetchRecommendations(productIds = []) {
  const res = await fetch(`${API_BASE}/mining/recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productIds })
  });
  return res.json();
}

export async function fetchBudgetIntelligence(customerId) {
  const params = customerId ? `?customerId=${customerId}` : '';
  const res = await fetch(`${API_BASE}/mining/budget-intelligence${params}`);
  return res.json();
}

export async function fetchCustomerSegments() {
  const res = await fetch(`${API_BASE}/mining/customer-segments`);
  return res.json();
}

export async function fetchConstellationSchema() {
  const res = await fetch(`${API_BASE}/schema/constellation`);
  return res.json();
}
