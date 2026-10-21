const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const { db, initSchema } = require('./db');
const { runETL, parseDateString } = require('./etl');
const {
  getKPIs,
  getTimeDrillDown,
  getSliceAndDice,
  getPivotMatrix,
  getMarketBasketRules,
  getRecommendationsForCart,
  getBudgetIntelligence,
  getCustomerSegments
} = require('./analytics');

// Initialize database schema
initSchema();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const crypto = require('node:crypto');

// Server-side administrator secret & password configuration
const ADMIN_SECRET = process.env.ADMIN_JWT_SECRET || 'smartbasket_secret_admin_jwt_2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shamita';

function generateAdminToken() {
  const payload = {
    role: 'admin',
    iat: Date.now(),
    exp: Date.now() + (24 * 60 * 60 * 1000) // Valid for 24 hours
  };
  const dataStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', ADMIN_SECRET).update(dataStr).digest('base64url');
  return `${dataStr}.${signature}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [dataStr, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', ADMIN_SECRET).update(dataStr).digest('base64url');
  if (expectedSig !== signature) return false;
  try {
    const payload = JSON.parse(Buffer.from(dataStr, 'base64url').toString('utf8'));
    if (payload.role !== 'admin') return false;
    if (payload.exp && Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Administrator authentication required' });
  }
  const token = authHeader.substring(7);
  if (!verifyAdminToken(token)) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired administrator credentials' });
  }
  next();
}

// Admin Authentication Endpoints
app.post('/api/auth/admin-login', (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Incorrect administrator password. Access denied.' });
    }
    const token = generateAdminToken();
    res.json({
      success: true,
      token,
      message: 'Administrator authorization granted'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/verify-admin', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (verifyAdminToken(token)) {
      return res.json({ authenticated: true });
    }
    res.status(401).json({ authenticated: false, error: 'Administrator session invalid or expired' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 1. STORE & OPERATIONAL (OLTP) ENDPOINTS
// ============================================================================

// Get categories
app.get('/api/categories', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY category_id').all();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get products with optional category and search query
app.get('/api/products', (req, res) => {
  try {
    const { categoryId, search } = req.query;
    let query = `
      SELECT p.*, c.product_category
      FROM products p
      JOIN categories c ON p.category_id = c.category_id
      WHERE 1=1
    `;
    const params = [];

    if (categoryId && categoryId !== 'ALL') {
      query += ' AND p.category_id = ?';
      params.push(categoryId);
    }

    if (search) {
      query += ' AND (p.product_name LIKE ? OR c.product_category LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY p.product_id ASC';
    const products = db.prepare(query).all(...params);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get stores
app.get('/api/stores', (req, res) => {
  try {
    const stores = db.prepare('SELECT * FROM stores ORDER BY store_id LIMIT 50').all();
    res.json(stores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get customers for user switching / demo with their real warehouse budget status
app.get('/api/customers', (req, res) => {
  try {
    const currentMonth = new Date().toISOString().substring(0, 7);
    const customers = db.prepare(`
      SELECT 
        c.customer_id, 
        c.customer_name, 
        c.email, 
        c.city, 
        c.created_at,
        dc.segment,
        COALESCE(fbp.monthly_budget, b.monthly_budget, 10000) AS monthly_budget,
        COALESCE(fbp.actual_spent, 0) AS current_spent,
        COALESCE(fbp.variance_amount, 0 - COALESCE(b.monthly_budget, 10000)) AS variance_amount,
        COALESCE(fbp.utilization_rate, 0) AS utilization_rate,
        COALESCE(fbp.status, 'UNDER_BUDGET') AS status,
        fbp.month_year AS status_month
      FROM customers c
      LEFT JOIN dim_customer dc ON c.customer_id = dc.customer_id
      LEFT JOIN (
        SELECT customer_id, monthly_budget 
        FROM budgets 
        GROUP BY customer_id
      ) b ON c.customer_id = b.customer_id
      LEFT JOIN fact_budget_performance fbp ON c.customer_id = fbp.customer_id
        AND fbp.budget_fact_id = (
          SELECT f2.budget_fact_id 
          FROM fact_budget_performance f2 
          WHERE f2.customer_id = c.customer_id 
          ORDER BY 
            CASE WHEN f2.month_year = ? THEN 1 ELSE 0 END DESC,
            f2.month_year DESC 
          LIMIT 1
        )
      ORDER BY COALESCE(c.created_at, '') DESC, c.customer_id DESC
      LIMIT 300
    `).all(currentMonth);
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get customer profile + active budget
app.get('/api/customers/:id', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE customer_id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const currentMonthYear = new Date().toISOString().substring(0, 7);
    const budget = db.prepare(`
      SELECT monthly_budget FROM budgets WHERE customer_id = ? AND month_year = ?
    `).get(customer.customer_id, currentMonthYear) || db.prepare(`
      SELECT monthly_budget FROM budgets WHERE customer_id = ? ORDER BY month_year DESC LIMIT 1
    `).get(customer.customer_id);

    res.json({
      ...customer,
      monthlyBudget: budget ? budget.monthly_budget : 10000
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register / Create a new customer account
app.post('/api/customers', (req, res) => {
  try {
    const { customerName, email, city, monthlyBudget = 10000 } = req.body;
    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const cleanName = customerName.trim();
    const cleanCity = (city && city.trim()) || 'Mumbai';
    const cleanEmail = (email && email.trim()) || `${cleanName.toLowerCase().replace(/\\s+/g, '.')}@example.com`;
    const numBudget = Number(monthlyBudget) > 0 ? Number(monthlyBudget) : 10000;

    const customerId = `CUST_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.substring(0, 10);
    const currentMonthYear = todayStr.substring(0, 7);

    // 1. Insert into OLTP customers table with explicit registration timestamp
    db.prepare(`
      INSERT INTO customers (customer_id, customer_name, email, city, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(customerId, cleanName, cleanEmail, cleanCity, nowIso);

    // 2. Set initial budget in OLTP budgets table
    db.prepare(`
      INSERT OR REPLACE INTO budgets (customer_id, monthly_budget, month_year)
      VALUES (?, ?, ?)
    `).run(customerId, numBudget, currentMonthYear);

    // 3. Insert into Conformed Dimension Dim_Customer
    try {
      db.prepare(`
        INSERT OR REPLACE INTO dim_customer (customer_id, customer_name, city, segment)
        VALUES (?, ?, ?, 'New Shopper')
      `).run(customerId, cleanName, cleanCity);
    } catch {
      // Optional sync
    }

    // 4. Initialize default empty shopping list
    const listId = `LIST_${customerId}`;
    db.prepare(`
      INSERT OR IGNORE INTO shopping_lists (shopping_list_id, customer_id, list_name)
      VALUES (?, ?, 'My Smart Shopping List')
    `).run(listId, customerId);

    // 5. Ensure Dim_Date and Fact_Budget_Performance are populated immediately for DWM Analytics
    try {
      const dInfo = parseDateString(todayStr);
      db.prepare(`
        INSERT OR IGNORE INTO dim_date (date_id, full_date, day, month, month_name, quarter, year, day_of_week)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(dInfo.dateId, dInfo.fullDate, dInfo.day, dInfo.month, dInfo.monthName, dInfo.quarter, dInfo.year, dInfo.dayOfWeek);

      db.prepare(`
        INSERT OR REPLACE INTO fact_budget_performance (
          customer_id, date_id, month_year, monthly_budget, actual_spent, variance_amount, utilization_rate, status
        ) VALUES (?, ?, ?, ?, 0.0, ?, 0.0, 'UNDER_BUDGET')
      `).run(customerId, dInfo.dateId, currentMonthYear, numBudget, -numBudget);
    } catch (factErr) {
      console.warn('Initial Fact_Budget sync notice:', factErr.message);
    }

    const newCustomer = {
      customer_id: customerId,
      customer_name: cleanName,
      email: cleanEmail,
      city: cleanCity,
      created_at: nowIso,
      monthly_budget: numBudget,
      monthlyBudget: numBudget,
      segment: 'New Shopper'
    };

    res.status(201).json(newCustomer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shopping List: Get items for a customer
app.get('/api/shopping-list/:customerId', (req, res) => {
  try {
    const { customerId } = req.params;
    // Get or create customer's shopping list
    let list = db.prepare('SELECT * FROM shopping_lists WHERE customer_id = ?').get(customerId);
    if (!list) {
      const listId = `LIST_${customerId}`;
      db.prepare(`
        INSERT INTO shopping_lists (shopping_list_id, customer_id, list_name)
        VALUES (?, ?, 'My Smart Basket')
      `).run(listId, customerId);
      list = { shopping_list_id: listId, customer_id: customerId, list_name: 'My Smart Basket' };
    }

    const items = db.prepare(`
      SELECT 
        sli.shopping_list_item_id,
        sli.shopping_list_id,
        sli.product_id,
        sli.quantity,
        p.product_name,
        p.unit_price,
        p.unit,
        p.image,
        c.product_category,
        (sli.quantity * p.unit_price) AS estimated_cost
      FROM shopping_list_items sli
      JOIN products p ON sli.product_id = p.product_id
      JOIN categories c ON p.category_id = c.category_id
      WHERE sli.shopping_list_id = ?
    `).all(list.shopping_list_id);

    const totalEstimatedCost = items.reduce((acc, item) => acc + item.estimated_cost, 0);

    res.json({
      list,
      items,
      totalEstimatedCost
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shopping List: Add or update item
app.post('/api/shopping-list/item', (req, res) => {
  try {
    const { customerId, productId, quantity = 1 } = req.body;
    let list = db.prepare('SELECT * FROM shopping_lists WHERE customer_id = ?').get(customerId);
    if (!list) {
      const listId = `LIST_${customerId}`;
      db.prepare(`
        INSERT INTO shopping_lists (shopping_list_id, customer_id, list_name)
        VALUES (?, ?, 'My Smart Basket')
      `).run(listId, customerId);
      list = { shopping_list_id: listId };
    }

    const existing = db.prepare(`
      SELECT * FROM shopping_list_items WHERE shopping_list_id = ? AND product_id = ?
    `).get(list.shopping_list_id, productId);

    if (existing) {
      db.prepare(`
        UPDATE shopping_list_items SET quantity = quantity + ? WHERE shopping_list_item_id = ?
      `).run(quantity, existing.shopping_list_item_id);
    } else {
      const itemId = `SLI_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      db.prepare(`
        INSERT INTO shopping_list_items (shopping_list_item_id, shopping_list_id, product_id, quantity)
        VALUES (?, ?, ?, ?)
      `).run(itemId, list.shopping_list_id, productId, quantity);
    }

    res.json({ success: true, message: 'Item added to shopping list' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shopping List: Update quantity
app.put('/api/shopping-list/item/:itemId', (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    if (quantity <= 0) {
      db.prepare('DELETE FROM shopping_list_items WHERE shopping_list_item_id = ?').run(itemId);
    } else {
      db.prepare('UPDATE shopping_list_items SET quantity = ? WHERE shopping_list_item_id = ?').run(quantity, itemId);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shopping List: Remove item
app.delete('/api/shopping-list/item/:itemId', (req, res) => {
  try {
    db.prepare('DELETE FROM shopping_list_items WHERE shopping_list_item_id = ?').run(req.params.itemId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shopping List: Clear all items
app.post('/api/shopping-list/clear', (req, res) => {
  try {
    const { customerId } = req.body;
    const list = db.prepare('SELECT shopping_list_id FROM shopping_lists WHERE customer_id = ?').get(customerId);
    if (list) {
      db.prepare('DELETE FROM shopping_list_items WHERE shopping_list_id = ?').run(list.shopping_list_id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reusable Helper: Consolidate Orders & Expenses, and Sync Warehouse Fact_Budget_Performance
function syncFactBudgetPerformance(customerId, monthYear) {
  if (!monthYear || typeof monthYear !== 'string' || !monthYear.includes('-')) {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    monthYear = `${d.getFullYear()}-${mm}`;
  }
  const [yr, mo] = monthYear.split('-');

  // 1. Get or create configured budget for this customer and month
  let budgetRow = db.prepare(`
    SELECT monthly_budget FROM budgets WHERE customer_id = ? AND month_year = ?
  `).get(customerId, monthYear);

  if (!budgetRow) {
    const prevBudget = db.prepare(`
      SELECT monthly_budget FROM budgets WHERE customer_id = ? ORDER BY month_year DESC LIMIT 1
    `).get(customerId);
    const defaultBudget = prevBudget ? prevBudget.monthly_budget : 10000;
    db.prepare(`
      INSERT OR REPLACE INTO budgets (customer_id, monthly_budget, month_year)
      VALUES (?, ?, ?)
    `).run(customerId, defaultBudget, monthYear);
    budgetRow = { monthly_budget: defaultBudget };
  }
  const monthlyBudget = Number(budgetRow.monthly_budget);

  // 2. Spending from store orders (handles both DD-MM-YYYY and YYYY-MM-DD formats)
  const orderSpendRow = db.prepare(`
    SELECT IFNULL(SUM(total_amount), 0) AS orders_spent
    FROM orders
    WHERE customer_id = ? 
      AND (status = 'COMPLETED' OR status IS NULL)
      AND (
        visit_date LIKE (? || '%')
        OR visit_date LIKE ('%-' || ? || '-' || ?)
      )
  `).get(customerId, monthYear, mo, yr);
  const ordersSpent = orderSpendRow ? Number(orderSpendRow.orders_spent) : 0;

  // 3. Spending from manual expense entries
  const expenseSpendRow = db.prepare(`
    SELECT IFNULL(SUM(amount), 0) AS expenses_spent
    FROM expenses
    WHERE customer_id = ?
      AND (
        expense_date LIKE (? || '%')
        OR expense_date LIKE ('%-' || ? || '-' || ?)
      )
  `).get(customerId, monthYear, mo, yr);
  const expensesSpent = expenseSpendRow ? Number(expenseSpendRow.expenses_spent) : 0;

  const totalSpent = ordersSpent + expensesSpent;
  const remainingBalance = monthlyBudget - totalSpent;
  const varianceAmount = totalSpent - monthlyBudget;
  const percentageUsed = monthlyBudget > 0 ? (totalSpent / monthlyBudget) * 100 : 0;
  const utilizationRate = parseFloat(percentageUsed.toFixed(1));
  const isExceeded = totalSpent > monthlyBudget;
  const isNearLimit = !isExceeded && percentageUsed >= 80;

  let status = 'UNDER_BUDGET';
  if (isExceeded) {
    status = 'OVER_BUDGET';
  } else if (totalSpent === monthlyBudget || (percentageUsed >= 80 && percentageUsed <= 100)) {
    status = 'ON_BUDGET';
  } else {
    status = 'UNDER_BUDGET';
  }

  // 4. Update Fact_Budget_Performance in analytical layer
  try {
    // Ensure dim_customer exists to satisfy foreign key constraints
    const custRow = db.prepare('SELECT customer_name, city FROM customers WHERE customer_id = ?').get(customerId);
    if (custRow) {
      db.prepare(`
        INSERT OR IGNORE INTO dim_customer (customer_id, customer_name, city, segment)
        VALUES (?, ?, ?, 'New Shopper')
      `).run(customerId, custRow.customer_name, custRow.city || 'Mumbai');
    }

    const dInfo = parseDateString(`${monthYear}-01`);
    db.prepare(`
      INSERT OR IGNORE INTO dim_date (date_id, full_date, day, month, month_name, quarter, year, day_of_week)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(dInfo.dateId, dInfo.fullDate, dInfo.day, dInfo.month, dInfo.monthName, dInfo.quarter, dInfo.year, dInfo.dayOfWeek);

    const existingFact = db.prepare(`
      SELECT budget_fact_id FROM fact_budget_performance WHERE customer_id = ? AND month_year = ?
    `).get(customerId, monthYear);

    if (existingFact) {
      db.prepare(`
        UPDATE fact_budget_performance
        SET monthly_budget = ?, actual_spent = ?, variance_amount = ?, utilization_rate = ?, status = ?
        WHERE budget_fact_id = ?
      `).run(monthlyBudget, totalSpent, varianceAmount, utilizationRate, status, existingFact.budget_fact_id);
    } else {
      db.prepare(`
        INSERT INTO fact_budget_performance (
          customer_id, date_id, month_year, monthly_budget, actual_spent, variance_amount, utilization_rate, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(customerId, dInfo.dateId, monthYear, monthlyBudget, totalSpent, varianceAmount, utilizationRate, status);
    }
  } catch (syncErr) {
    console.warn('Fact sync notice in syncFactBudgetPerformance:', syncErr.message);
  }

  return {
    monthlyBudget,
    ordersSpent,
    expensesSpent,
    totalSpent,
    remainingBalance,
    varianceAmount,
    utilizationRate,
    percentageUsed: parseFloat(percentageUsed.toFixed(1)),
    isExceeded,
    isNearLimit,
    status
  };
}

// Budget Planner: Get budget status for customer
app.get('/api/budget/:customerId', (req, res) => {
  try {
    const { customerId } = req.params;
    const currentMonthYear = new Date().toISOString().substring(0, 7);
    let monthYear = req.query.monthYear;

    // Get available months with records for this customer
    const rawMonths = db.prepare(`
      SELECT DISTINCT month_year FROM (
        SELECT month_year FROM budgets WHERE customer_id = ?
        UNION
        SELECT month_year FROM fact_budget_performance WHERE customer_id = ?
        UNION
        SELECT SUBSTR(visit_date, 7, 4) || '-' || SUBSTR(visit_date, 4, 2) AS month_year
        FROM orders WHERE customer_id = ? AND visit_date LIKE '__-__-____'
        UNION
        SELECT SUBSTR(visit_date, 1, 7) AS month_year
        FROM orders WHERE customer_id = ? AND visit_date LIKE '____-__-__'
        UNION
        SELECT SUBSTR(expense_date, 1, 7) AS month_year
        FROM expenses WHERE customer_id = ?
      )
      WHERE month_year IS NOT NULL AND month_year != ''
      ORDER BY month_year DESC
    `).all(customerId, customerId, customerId, customerId, customerId).map(r => r.month_year);

    const availableMonths = [...rawMonths];
    if (!availableMonths.includes(currentMonthYear)) {
      availableMonths.unshift(currentMonthYear);
      availableMonths.sort((a, b) => b.localeCompare(a));
    }

    if (!monthYear) {
      monthYear = currentMonthYear;
    }

    const [yr, mo] = monthYear.split('-');
    const summary = syncFactBudgetPerformance(customerId, monthYear);

    // Category breakdown from Store Orders
    const orderCategoryRows = db.prepare(`
      SELECT 
        c.product_category AS category,
        SUM(oi.quantity * oi.unit_price) AS amount,
        COUNT(DISTINCT o.order_id) AS count
      FROM orders o
      JOIN order_items oi ON o.order_id = oi.order_id
      JOIN products p ON oi.product_id = p.product_id
      JOIN categories c ON p.category_id = c.category_id
      WHERE o.customer_id = ?
        AND (o.status = 'COMPLETED' OR o.status IS NULL)
        AND (
          o.visit_date LIKE (? || '%')
          OR o.visit_date LIKE ('%-' || ? || '-' || ?)
        )
      GROUP BY c.product_category
    `).all(customerId, monthYear, mo, yr);

    // Category breakdown from Manual Expenses
    const expenseCategoryRows = db.prepare(`
      SELECT 
        category,
        SUM(amount) AS amount,
        COUNT(expense_id) AS count
      FROM expenses
      WHERE customer_id = ?
        AND (
          expense_date LIKE (? || '%')
          OR expense_date LIKE ('%-' || ? || '-' || ?)
        )
      GROUP BY category
    `).all(customerId, monthYear, mo, yr);

    // Merge categories
    const categoryMap = {};
    for (const row of orderCategoryRows) {
      categoryMap[row.category] = {
        category: row.category,
        amount: Number(row.amount),
        count: Number(row.count)
      };
    }
    for (const row of expenseCategoryRows) {
      if (categoryMap[row.category]) {
        categoryMap[row.category].amount += Number(row.amount);
        categoryMap[row.category].count += Number(row.count);
      } else {
        categoryMap[row.category] = {
          category: row.category,
          amount: Number(row.amount),
          count: Number(row.count)
        };
      }
    }

    const categoryBreakdown = Object.values(categoryMap).map(cat => ({
      ...cat,
      percentage: summary.totalSpent > 0 ? parseFloat(((cat.amount / summary.totalSpent) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.amount - a.amount);

    // Manual expenses list for this customer & month
    const expenses = db.prepare(`
      SELECT * FROM expenses
      WHERE customer_id = ?
        AND (
          expense_date LIKE (? || '%')
          OR expense_date LIKE ('%-' || ? || '-' || ?)
        )
      ORDER BY expense_date DESC, created_at DESC
    `).all(customerId, monthYear, mo, yr);

    // Historical monthly performance from Fact_Budget_Performance
    let performanceHistory = db.prepare(`
      SELECT * FROM fact_budget_performance WHERE customer_id = ? ORDER BY month_year DESC
    `).all(customerId);

    const activeMonthInHistory = performanceHistory.find(r => r.month_year === monthYear);
    if (!activeMonthInHistory) {
      performanceHistory.unshift({
        budget_fact_id: Date.now(),
        customer_id: customerId,
        date_id: parseInt(monthYear.replace('-', '') + '01', 10),
        month_year: monthYear,
        monthly_budget: summary.monthlyBudget,
        actual_spent: summary.totalSpent,
        variance_amount: summary.varianceAmount !== undefined ? summary.varianceAmount : (summary.totalSpent - summary.monthlyBudget),
        utilization_rate: summary.utilizationRate !== undefined ? summary.utilizationRate : summary.percentageUsed,
        status: summary.status
      });
      performanceHistory.sort((a, b) => b.month_year.localeCompare(a.month_year));
    }

    // Historical spending comparison
    const history = db.prepare(`
      SELECT AVG(total_amount) AS avg_monthly
      FROM (
        SELECT 
          CASE 
            WHEN visit_date LIKE '__-__-____' THEN SUBSTR(visit_date, 7, 4) || '-' || SUBSTR(visit_date, 4, 2)
            ELSE SUBSTR(visit_date, 1, 7)
          END AS my,
          SUM(total_amount) AS total_amount
        FROM orders
        WHERE customer_id = ? AND (status = 'COMPLETED' OR status IS NULL)
        GROUP BY my
      )
    `).get(customerId);

    const histAvg = history && history.avg_monthly ? history.avg_monthly : summary.totalSpent;
    let comparisonNote = '';
    if (histAvg > 0) {
      const diff = ((summary.totalSpent - histAvg) / histAvg) * 100;
      if (diff > 0) {
        comparisonNote = `Spending is ${diff.toFixed(1)}% higher than your historical average of ₹${histAvg.toFixed(0)}.`;
      } else {
        comparisonNote = `Spending is ${Math.abs(diff).toFixed(1)}% lower than your historical average of ₹${histAvg.toFixed(0)}.`;
      }
    }

    res.json({
      customerId,
      monthYear,
      availableMonths,
      monthlyBudget: summary.monthlyBudget,
      ordersSpent: summary.ordersSpent,
      expensesSpent: summary.expensesSpent,
      currentSpent: summary.totalSpent,
      remainingBalance: summary.remainingBalance,
      percentageUsed: summary.percentageUsed,
      isExceeded: summary.isExceeded,
      isNearLimit: summary.isNearLimit,
      status: summary.status,
      categoryBreakdown,
      expenses,
      historicalAvg: histAvg,
      comparisonNote,
      performanceHistory
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Budget Planner: Set/Update monthly budget
app.post('/api/budget', (req, res) => {
  try {
    const { customerId, monthlyBudget, monthYear = new Date().toISOString().substring(0, 7) } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }
    const numBudget = parseFloat(monthlyBudget);
    if (isNaN(numBudget) || numBudget < 0) {
      return res.status(400).json({ error: 'Budget amount must be a positive number' });
    }

    db.prepare(`
      INSERT OR REPLACE INTO budgets (customer_id, monthly_budget, month_year)
      VALUES (?, ?, ?)
    `).run(customerId, numBudget, monthYear);

    const summary = syncFactBudgetPerformance(customerId, monthYear);
    res.json({ success: true, message: 'Budget updated successfully', ...summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// EXPENSE MANAGEMENT CRUD ENDPOINTS
// ============================================================================

// Get expenses for a customer (with optional monthYear filter)
app.get('/api/expenses/:customerId', (req, res) => {
  try {
    const { customerId } = req.params;
    const { monthYear } = req.query;
    let query = 'SELECT * FROM expenses WHERE customer_id = ?';
    const params = [customerId];

    if (monthYear) {
      const [yr, mo] = monthYear.split('-');
      query += ` AND (expense_date LIKE (? || '%') OR expense_date LIKE ('%-' || ? || '-' || ?))`;
      params.push(monthYear, mo, yr);
    }

    query += ' ORDER BY expense_date DESC, created_at DESC';
    const expenses = db.prepare(query).all(...params);
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new expense
app.post('/api/expenses', (req, res) => {
  try {
    const { customerId, title, amount, category = 'Groceries', expenseDate, notes = '' } = req.body;
    if (!customerId) return res.status(400).json({ error: 'Customer ID is required' });
    if (!title || !title.trim()) return res.status(400).json({ error: 'Expense title is required' });
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Expense amount must be a positive number greater than 0' });
    }

    const cleanDate = expenseDate || new Date().toISOString().substring(0, 10);
    const monthYear = cleanDate.substring(0, 7);
    const expenseId = `EXP_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO expenses (expense_id, customer_id, title, amount, category, expense_date, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(expenseId, customerId, title.trim(), numAmount, category.trim(), cleanDate, notes ? notes.trim() : '', nowIso, nowIso);

    const summary = syncFactBudgetPerformance(customerId, monthYear);

    res.status(201).json({
      success: true,
      expense: {
        expense_id: expenseId,
        customer_id: customerId,
        title: title.trim(),
        amount: numAmount,
        category: category.trim(),
        expense_date: cleanDate,
        notes: notes ? notes.trim() : '',
        created_at: nowIso,
        updated_at: nowIso
      },
      summary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update existing expense
app.put('/api/expenses/:expenseId', (req, res) => {
  try {
    const { expenseId } = req.params;
    const { title, amount, category, expenseDate, notes } = req.body;

    const existing = db.prepare('SELECT * FROM expenses WHERE expense_id = ?').get(expenseId);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const cleanTitle = title !== undefined ? title.trim() : existing.title;
    if (!cleanTitle) return res.status(400).json({ error: 'Expense title cannot be empty' });

    let numAmount = existing.amount;
    if (amount !== undefined) {
      numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Expense amount must be greater than 0' });
      }
    }

    const cleanCategory = category !== undefined ? category.trim() : existing.category;
    const cleanDate = expenseDate !== undefined ? expenseDate : existing.expense_date;
    const cleanNotes = notes !== undefined ? notes.trim() : existing.notes;
    const nowIso = new Date().toISOString();

    db.prepare(`
      UPDATE expenses
      SET title = ?, amount = ?, category = ?, expense_date = ?, notes = ?, updated_at = ?
      WHERE expense_id = ?
    `).run(cleanTitle, numAmount, cleanCategory, cleanDate, cleanNotes, nowIso, expenseId);

    const monthYear = cleanDate.substring(0, 7);
    const summary = syncFactBudgetPerformance(existing.customer_id, monthYear);

    // If month changed, also sync previous month
    const oldMonth = existing.expense_date.substring(0, 7);
    if (oldMonth !== monthYear) {
      syncFactBudgetPerformance(existing.customer_id, oldMonth);
    }

    res.json({
      success: true,
      expense: {
        ...existing,
        title: cleanTitle,
        amount: numAmount,
        category: cleanCategory,
        expense_date: cleanDate,
        notes: cleanNotes,
        updated_at: nowIso
      },
      summary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an expense
app.delete('/api/expenses/:expenseId', (req, res) => {
  try {
    const { expenseId } = req.params;
    const existing = db.prepare('SELECT * FROM expenses WHERE expense_id = ?').get(expenseId);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    db.prepare('DELETE FROM expenses WHERE expense_id = ?').run(expenseId);
    const monthYear = existing.expense_date.substring(0, 7);
    const summary = syncFactBudgetPerformance(existing.customer_id, monthYear);

    res.json({ success: true, message: 'Expense deleted successfully', summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cart & Checkout: Place Order
app.post('/api/orders/checkout', (req, res) => {
  try {
    const {
      customerId,
      storeId,
      items, // array of { productId, quantity, unitPrice }
      paymentMethod = 'UPI',
      triggerETL = true,
      orderId: clientOrderId
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`;
    const currentMonthYear = `${yyyy}-${mm}`;

    const totalAmount = parseFloat(items.reduce((acc, item) => {
      const q = Number(item.quantity) || 1;
      const p = Number(item.unitPrice !== undefined ? item.unitPrice : item.unit_price) || 0;
      return acc + (q * p);
    }, 0).toFixed(2));

    // Idempotency: Prevent duplicate order processing if an order with the same orderId already exists
    const orderId = clientOrderId || `ORD_${Date.now()}`;
    const existingOrder = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
    if (existingOrder) {
      const budgetSummary = syncFactBudgetPerformance(customerId, currentMonthYear);
      return res.json({
        success: true,
        duplicatePrevented: true,
        orderId: existingOrder.order_id,
        totalAmount: existingOrder.total_amount,
        itemCount: items.length,
        monthlyBudget: budgetSummary.monthlyBudget,
        currentSpent: budgetSummary.totalSpent,
        remainingBalance: budgetSummary.remainingBalance,
        varianceAmount: budgetSummary.varianceAmount,
        utilizationRate: budgetSummary.utilizationRate,
        percentageUsed: budgetSummary.percentageUsed,
        monthYear: currentMonthYear,
        isExceeded: budgetSummary.isExceeded,
        isNearLimit: budgetSummary.isNearLimit,
        status: budgetSummary.status
      });
    }

    // Also prevent rapid accidental duplicate submission within 3 seconds for the same customer, store, and exact amount
    const recentDuplicate = db.prepare(`
      SELECT * FROM orders
      WHERE customer_id = ?
        AND store_id = ?
        AND ABS(total_amount - ?) < 0.01
        AND (
          created_at >= datetime('now', '-3 seconds')
          OR created_at >= ?
        )
      ORDER BY created_at DESC
      LIMIT 1
    `).get(customerId, storeId, totalAmount, new Date(Date.now() - 3000).toISOString());

    if (recentDuplicate && !clientOrderId) {
      const budgetSummary = syncFactBudgetPerformance(customerId, currentMonthYear);
      return res.json({
        success: true,
        duplicatePrevented: true,
        orderId: recentDuplicate.order_id,
        totalAmount: recentDuplicate.total_amount,
        itemCount: items.length,
        monthlyBudget: budgetSummary.monthlyBudget,
        currentSpent: budgetSummary.totalSpent,
        remainingBalance: budgetSummary.remainingBalance,
        varianceAmount: budgetSummary.varianceAmount,
        utilizationRate: budgetSummary.utilizationRate,
        percentageUsed: budgetSummary.percentageUsed,
        monthYear: currentMonthYear,
        isExceeded: budgetSummary.isExceeded,
        isNearLimit: budgetSummary.isNearLimit,
        status: budgetSummary.status
      });
    }

    db.exec('BEGIN TRANSACTION;');

    // 1. Insert Order with explicit created_at timestamp
    db.prepare(`
      INSERT INTO orders (order_id, customer_id, store_id, visit_date, total_amount, status, created_at, is_etl_synced)
      VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, 0)
    `).run(orderId, customerId, storeId || 'STORE_500', today, totalAmount, nowIso);

    // 2. Insert Order Items
    const insertItemStmt = db.prepare(`
      INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < items.length; i++) {
      const itm = items[i];
      const prodId = itm.productId || itm.product_id;
      const q = Number(itm.quantity) || 1;
      const unitP = Number(itm.unitPrice !== undefined ? itm.unitPrice : itm.unit_price) || 0;
      const itemId = `ITEM_${Date.now()}_${i}`;
      insertItemStmt.run(itemId, orderId, prodId, q, unitP);
    }

    // 3. Insert Payment
    const paymentId = `PAY_${Date.now()}`;
    db.prepare(`
      INSERT INTO payments (payment_id, order_id, payment_method, payment_status, payment_date)
      VALUES (?, ?, ?, 'SUCCESS', ?)
    `).run(paymentId, orderId, paymentMethod, today);

    // 4. Ensure customer has an active monthly budget record for this month
    let budgetRow = db.prepare(`
      SELECT monthly_budget FROM budgets WHERE customer_id = ? AND month_year = ?
    `).get(customerId, currentMonthYear);

    if (!budgetRow) {
      const prevBudget = db.prepare(`
        SELECT monthly_budget FROM budgets WHERE customer_id = ? ORDER BY month_year DESC LIMIT 1
      `).get(customerId);
      const defaultBudget = prevBudget ? prevBudget.monthly_budget : 10000;
      db.prepare(`
        INSERT OR REPLACE INTO budgets (customer_id, monthly_budget, month_year)
        VALUES (?, ?, ?)
      `).run(customerId, defaultBudget, currentMonthYear);
    }

    // 5. Consolidate and sync Fact_Budget_Performance immediately
    let budgetSummary = syncFactBudgetPerformance(customerId, currentMonthYear);

    db.exec('COMMIT;');

    // 6. Trigger incremental ETL Pipeline
    let etlSummary = null;
    if (triggerETL) {
      etlSummary = runETL({ incremental: true });
      // Re-sync Fact_Budget_Performance to guarantee consistency after ETL
      budgetSummary = syncFactBudgetPerformance(customerId, currentMonthYear);
    }

    res.json({
      success: true,
      orderId,
      totalAmount,
      itemCount: items.length,
      monthlyBudget: budgetSummary.monthlyBudget,
      currentSpent: budgetSummary.totalSpent,
      remainingBalance: budgetSummary.remainingBalance,
      varianceAmount: budgetSummary.varianceAmount,
      utilizationRate: budgetSummary.utilizationRate,
      percentageUsed: budgetSummary.percentageUsed,
      monthYear: currentMonthYear,
      isExceeded: budgetSummary.isExceeded,
      isNearLimit: budgetSummary.isNearLimit,
      status: budgetSummary.status,
      etlSynced: !!etlSummary && etlSummary.success,
      etlSummary
    });
  } catch (err) {
    try { db.exec('ROLLBACK;'); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

// Customer order history
app.get('/api/orders/:customerId', (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT o.*, s.store_type, s.city, p.payment_method,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.order_id) AS items_count,
        (SELECT GROUP_CONCAT(p2.product_name, ', ') FROM order_items oi2 JOIN products p2 ON oi2.product_id = p2.product_id WHERE oi2.order_id = o.order_id) AS items_summary
      FROM orders o
      LEFT JOIN stores s ON o.store_id = s.store_id
      LEFT JOIN payments p ON o.order_id = p.order_id
      WHERE o.customer_id = ?
      ORDER BY 
        CASE 
          WHEN o.created_at IS NOT NULL AND o.created_at != '' THEN o.created_at
          WHEN o.visit_date LIKE '__-__-____' THEN SUBSTR(o.visit_date, 7, 4) || '-' || SUBSTR(o.visit_date, 4, 2) || '-' || SUBSTR(o.visit_date, 1, 2)
          ELSE o.visit_date
        END DESC,
        o.order_id DESC
      LIMIT 50
    `).all(req.params.customerId);

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 2. AUTOMATED ETL PIPELINE ENDPOINTS (ADMIN PROTECTED)
// ============================================================================

// Trigger ETL pipeline - Protected by requireAdminAuth
app.post('/api/etl/run', requireAdminAuth, (req, res) => {
  try {
    const incremental = req.body && req.body.incremental === true;
    const result = runETL({ incremental });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// View ETL run history & logs - Protected by requireAdminAuth
app.get('/api/etl/history', requireAdminAuth, (req, res) => {
  try {
    const runs = db.prepare('SELECT * FROM etl_runs ORDER BY id DESC LIMIT 20').all();
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 3. SMART INSIGHTS & DWM SUITE (ANALYTICS & DATA MINING)
// ============================================================================

// Executive KPIs
app.get('/api/analytics/kpis', (req, res) => {
  try {
    const kpis = getKPIs();
    res.json(kpis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OLAP Roll-up & Drill-down
app.get('/api/olap/drilldown', (req, res) => {
  try {
    const data = getTimeDrillDown(req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OLAP Slice & Dice
app.get('/api/olap/slice-dice', (req, res) => {
  try {
    const data = getSliceAndDice(req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OLAP Pivot / Cross-Tabulation Matrix
app.get('/api/olap/pivot', (req, res) => {
  try {
    const { rowDim = 'category', colDim = 'store_type' } = req.query;
    const data = getPivotMatrix(rowDim, colDim);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Data Mining: Market Basket Analysis (Apriori Rules)
app.get('/api/mining/market-basket', (req, res) => {
  try {
    const rules = getMarketBasketRules(req.query);
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Data Mining: Frequently Bought Together Recommendations
app.post('/api/mining/recommendations', (req, res) => {
  try {
    const { productIds = [] } = req.body;
    const recommendations = getRecommendationsForCart(productIds);
    res.json(recommendations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Data Mining: Budget Intelligence & Variance Analysis
app.get('/api/mining/budget-intelligence', (req, res) => {
  try {
    const { customerId } = req.query;
    const intelligence = getBudgetIntelligence(customerId);
    res.json(intelligence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer Segments (RFM Mining)
app.get('/api/mining/customer-segments', (req, res) => {
  try {
    const segments = getCustomerSegments();
    res.json(segments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fact Constellation Schema Architecture Metadata
app.get('/api/schema/constellation', (req, res) => {
  try {
    const schemaInfo = {
      modelType: 'Fact Constellation (Galaxy Schema)',
      conformedDimensions: [
        {
          name: 'Dim_Customer',
          table: 'dim_customer',
          primaryKey: 'customer_key',
          attributes: ['customer_id', 'customer_name', 'city', 'segment'],
          sharedBy: ['Fact_Sales', 'Fact_Budget_Performance']
        },
        {
          name: 'Dim_Date',
          table: 'dim_date',
          primaryKey: 'date_id',
          attributes: ['full_date', 'day', 'month', 'month_name', 'quarter', 'year', 'day_of_week'],
          sharedBy: ['Fact_Sales', 'Fact_Budget_Performance']
        },
        {
          name: 'Dim_Product',
          table: 'dim_product',
          primaryKey: 'product_key',
          attributes: ['product_id', 'product_name', 'category_id', 'category_name', 'unit_price'],
          sharedBy: ['Fact_Sales']
        },
        {
          name: 'Dim_Category',
          table: 'dim_category',
          primaryKey: 'category_key',
          attributes: ['category_id', 'product_category'],
          sharedBy: ['Fact_Sales']
        },
        {
          name: 'Dim_Store',
          table: 'dim_store',
          primaryKey: 'store_key',
          attributes: ['store_id', 'store_type', 'city'],
          sharedBy: ['Fact_Sales']
        }
      ],
      factTables: [
        {
          name: 'Fact_Sales',
          table: 'fact_sales',
          primaryKey: 'sale_id',
          grain: 'One row per line-item per order',
          foreignKeys: ['date_id', 'customer_id', 'product_id', 'category_id', 'store_id'],
          measures: ['quantity', 'unit_price', 'total_amount']
        },
        {
          name: 'Fact_Budget_Performance',
          table: 'fact_budget_performance',
          primaryKey: 'budget_fact_id',
          grain: 'One row per customer per calendar month',
          foreignKeys: ['customer_id', 'date_id'],
          measures: ['monthly_budget', 'actual_spent', 'variance_amount', 'utilization_rate', 'status']
        }
      ]
    };
    res.json(schemaInfo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend build in production if available
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// In direct standalone execution, listen on PORT. In serverless / module imports, export app.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SmartBasket DWM Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
