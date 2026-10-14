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
  return res.json();
}

export async function updateBudget(customerId, monthlyBudget, monthYear) {
  const res = await fetch(`${API_BASE}/budget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId, monthlyBudget, monthYear })
  });
  return res.json();
}

export async function checkoutOrder(orderData) {
  const res = await fetch(`${API_BASE}/orders/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  });
  return res.json();
}

export async function fetchCustomerOrders(customerId) {
  const res = await fetch(`${API_BASE}/orders/${customerId}`);
  return res.json();
}

export async function runETLPipeline(incremental = false) {
  const res = await fetch(`${API_BASE}/etl/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ incremental })
  });
  return res.json();
}

export async function fetchETLHistory() {
  const res = await fetch(`${API_BASE}/etl/history`);
  return res.json();
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
