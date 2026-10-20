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

// Get customers for user switching / demo
app.get('/api/customers', (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT 
        c.customer_id, 
        c.customer_name, 
        c.email, 
        c.city, 
        b.monthly_budget, 
        dc.segment
      FROM customers c
      LEFT JOIN (
        SELECT customer_id, monthly_budget 
        FROM budgets 
        GROUP BY customer_id
      ) b ON c.customer_id = b.customer_id
      LEFT JOIN dim_customer dc ON c.customer_id = dc.customer_id
      GROUP BY c.customer_id
      ORDER BY c.customer_id ASC
      LIMIT 100
    `).all();
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
    const todayStr = new Date().toISOString().substring(0, 10);
    const currentMonthYear = todayStr.substring(0, 7);

    // 1. Insert into OLTP customers table
    db.prepare(`
      INSERT INTO customers (customer_id, customer_name, email, city)
      VALUES (?, ?, ?, ?)
    `).run(customerId, cleanName, cleanEmail, cleanCity);

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
      )
      WHERE month_year IS NOT NULL AND month_year != ''
      ORDER BY month_year DESC
    `).all(customerId, customerId, customerId, customerId).map(r => r.month_year);

    const availableMonths = [...rawMonths];
    if (!availableMonths.includes(currentMonthYear)) {
      availableMonths.unshift(currentMonthYear);
      availableMonths.sort((a, b) => b.localeCompare(a));
    }

    if (!monthYear) {
      monthYear = currentMonthYear;
    }

    // Get or initialize configured budget for this customer and month
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

    // Get current spent in this month from orders (handles both DD-MM-YYYY and YYYY-MM-DD formats)
    const [yr, mo] = monthYear.split('-');
    const spendingRow = db.prepare(`
      SELECT IFNULL(SUM(total_amount), 0) AS current_spent
      FROM orders
      WHERE customer_id = ? 
        AND (status = 'COMPLETED' OR status IS NULL)
        AND (
          visit_date LIKE (? || '%')
          OR visit_date LIKE ('%-' || ? || '-' || ?)
        )
    `).get(customerId, monthYear, mo, yr);

    const currentSpent = spendingRow ? Number(spendingRow.current_spent) : 0;
    const remainingBalance = monthlyBudget - currentSpent;
    const percentageUsed = monthlyBudget > 0 ? (currentSpent / monthlyBudget) * 100 : 0;
    const isExceeded = percentageUsed > 100;
    const isNearLimit = percentageUsed >= 80 && percentageUsed <= 100;

    let status = 'UNDER_BUDGET';
    if (isExceeded) status = 'OVER_BUDGET';
    else if (isNearLimit) status = 'NEAR_LIMIT';

    // Synchronize current month in dim_date and fact_budget_performance so the warehouse table immediately reflects this
    try {
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
        `).run(monthlyBudget, currentSpent, currentSpent - monthlyBudget, parseFloat(percentageUsed.toFixed(1)), status, existingFact.budget_fact_id);
      } else {
        db.prepare(`
          INSERT INTO fact_budget_performance (
            customer_id, date_id, month_year, monthly_budget, actual_spent, variance_amount, utilization_rate, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(customerId, dInfo.dateId, monthYear, monthlyBudget, currentSpent, currentSpent - monthlyBudget, parseFloat(percentageUsed.toFixed(1)), status);
      }
    } catch (syncErr) {
      console.warn('Fact sync notice in GET /api/budget:', syncErr.message);
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

    const histAvg = history && history.avg_monthly ? history.avg_monthly : currentSpent;
    let comparisonNote = '';
    if (histAvg > 0) {
      const diff = ((currentSpent - histAvg) / histAvg) * 100;
      if (diff > 0) {
        comparisonNote = `Spending is ${diff.toFixed(1)}% higher than your historical average of ₹${histAvg.toFixed(0)}.`;
      } else {
        comparisonNote = `Spending is ${Math.abs(diff).toFixed(1)}% lower than your historical average of ₹${histAvg.toFixed(0)}.`;
      }
    }

    // Historical monthly performance from Fact_Budget_Performance
    let performanceHistory = db.prepare(`
      SELECT * FROM fact_budget_performance WHERE customer_id = ? ORDER BY month_year DESC
    `).all(customerId);

    // If analytical fact record does not exist yet (e.g. fresh registration), provide synthesized active fact
    if (performanceHistory.length === 0) {
      performanceHistory = [{
        budget_fact_id: 1,
        customer_id: customerId,
        date_id: parseInt(monthYear.replace('-', '') + '01', 10),
        month_year: monthYear,
        monthly_budget: monthlyBudget,
        actual_spent: currentSpent,
        variance_amount: currentSpent - monthlyBudget,
        utilization_rate: parseFloat(percentageUsed.toFixed(1)),
        status: status
      }];
    }

    res.json({
      customerId,
      monthYear,
      availableMonths,
      monthlyBudget,
      currentSpent,
      remainingBalance,
      percentageUsed: parseFloat(percentageUsed.toFixed(1)),
      isExceeded,
      isNearLimit,
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
    db.prepare(`
      INSERT OR REPLACE INTO budgets (customer_id, monthly_budget, month_year)
      VALUES (?, ?, ?)
    `).run(customerId, parseFloat(monthlyBudget), monthYear);

    // Also update Fact_Budget_Performance if record exists for this customer & month
    const existingFact = db.prepare(`
      SELECT * FROM fact_budget_performance WHERE customer_id = ? AND month_year = ?
    `).get(customerId, monthYear);

    const newBudget = parseFloat(monthlyBudget);

    if (existingFact) {
      const spent = existingFact.actual_spent;
      const variance = spent - newBudget;
      const rate = newBudget > 0 ? (spent / newBudget) * 100 : 0;
      let status = 'UNDER_BUDGET';
      if (rate > 100) status = 'OVER_BUDGET';
      else if (rate >= 80) status = 'NEAR_LIMIT';

      db.prepare(`
        UPDATE fact_budget_performance
        SET monthly_budget = ?, variance_amount = ?, utilization_rate = ?, status = ?
        WHERE budget_fact_id = ?
      `).run(newBudget, variance, rate, status, existingFact.budget_fact_id);
    } else {
      // Upsert into analytical layer for new users
      try {
        const todayStr = new Date().toISOString().substring(0, 10);
        const dInfo = parseDateString(todayStr);
        db.prepare(`
          INSERT OR IGNORE INTO dim_date (date_id, full_date, day, month, month_name, quarter, year, day_of_week)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(dInfo.dateId, dInfo.fullDate, dInfo.day, dInfo.month, dInfo.monthName, dInfo.quarter, dInfo.year, dInfo.dayOfWeek);

        db.prepare(`
          INSERT OR REPLACE INTO fact_budget_performance (
            customer_id, date_id, month_year, monthly_budget, actual_spent, variance_amount, utilization_rate, status
          ) VALUES (?, ?, ?, ?, 0.0, ?, 0.0, 'UNDER_BUDGET')
        `).run(customerId, dInfo.dateId, monthYear, newBudget, -newBudget);
      } catch (_) {}
    }

    res.json({ success: true, message: 'Budget updated successfully' });
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
      triggerETL = true
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const orderId = `ORD_${Date.now()}`;
    const today = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
    const currentMonthYear = today.substring(0, 7);
    const totalAmount = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);

    db.exec('BEGIN TRANSACTION;');

    // 1. Insert Order
    db.prepare(`
      INSERT INTO orders (order_id, customer_id, store_id, visit_date, total_amount, status, is_etl_synced)
      VALUES (?, ?, ?, ?, ?, 'COMPLETED', 0)
    `).run(orderId, customerId, storeId, today, totalAmount);

    // 2. Insert Order Items
    const insertItemStmt = db.prepare(`
      INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < items.length; i++) {
      const itm = items[i];
      const itemId = `ITEM_${Date.now()}_${i}`;
      insertItemStmt.run(itemId, orderId, itm.productId, itm.quantity, itm.unitPrice);
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
      budgetRow = { monthly_budget: defaultBudget };
    }

    const monthlyBudget = Number(budgetRow.monthly_budget);

    // 5. Calculate cumulative completed monthly spending including this order
    const [yr, mo] = currentMonthYear.split('-');
    const spendingRow = db.prepare(`
      SELECT IFNULL(SUM(total_amount), 0) AS current_spent
      FROM orders
      WHERE customer_id = ? 
        AND (status = 'COMPLETED' OR status IS NULL)
        AND (
          visit_date LIKE (? || '%')
          OR visit_date LIKE ('%-' || ? || '-' || ?)
        )
    `).get(customerId, currentMonthYear, mo, yr);

    const currentSpent = spendingRow ? Number(spendingRow.current_spent) : totalAmount;
    const remainingBalance = monthlyBudget - currentSpent;
    const percentageUsed = monthlyBudget > 0 ? (currentSpent / monthlyBudget) * 100 : 0;
    const isExceeded = percentageUsed > 100;
    const isNearLimit = percentageUsed >= 80 && percentageUsed <= 100;

    let status = 'UNDER_BUDGET';
    if (isExceeded) status = 'OVER_BUDGET';
    else if (isNearLimit) status = 'NEAR_LIMIT';

    // 6. Immediately update / upsert Data Warehouse Fact_Budget_Performance for this shopper & month
    try {
      const dInfo = parseDateString(today);
      db.prepare(`
        INSERT OR IGNORE INTO dim_date (date_id, full_date, day, month, month_name, quarter, year, day_of_week)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(dInfo.dateId, dInfo.fullDate, dInfo.day, dInfo.month, dInfo.monthName, dInfo.quarter, dInfo.year, dInfo.dayOfWeek);

      const existingFact = db.prepare(`
        SELECT budget_fact_id FROM fact_budget_performance WHERE customer_id = ? AND month_year = ?
      `).get(customerId, currentMonthYear);

      if (existingFact) {
        db.prepare(`
          UPDATE fact_budget_performance
          SET date_id = ?, monthly_budget = ?, actual_spent = ?, variance_amount = ?, utilization_rate = ?, status = ?
          WHERE budget_fact_id = ?
        `).run(dInfo.dateId, monthlyBudget, currentSpent, currentSpent - monthlyBudget, parseFloat(percentageUsed.toFixed(1)), status, existingFact.budget_fact_id);
      } else {
        db.prepare(`
          INSERT INTO fact_budget_performance (
            customer_id, date_id, month_year, monthly_budget, actual_spent, variance_amount, utilization_rate, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(customerId, dInfo.dateId, currentMonthYear, monthlyBudget, currentSpent, currentSpent - monthlyBudget, parseFloat(percentageUsed.toFixed(1)), status);
      }
    } catch (whErr) {
      console.warn('Real-time fact upsert warning:', whErr.message);
    }

    db.exec('COMMIT;');

    // 7. Trigger incremental ETL Pipeline
    let etlSummary = null;
    if (triggerETL) {
      etlSummary = runETL({ incremental: true });
    }

    res.json({
      success: true,
      orderId,
      totalAmount,
      itemCount: items.length,
      monthlyBudget,
      currentSpent,
      remainingBalance,
      percentageUsed: parseFloat(percentageUsed.toFixed(1)),
      monthYear: currentMonthYear,
      isExceeded,
      isNearLimit,
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
      SELECT o.*, s.store_type, s.city, p.payment_method
      FROM orders o
      JOIN stores s ON o.store_id = s.store_id
      LEFT JOIN payments p ON o.order_id = p.order_id
      WHERE o.customer_id = ?
      ORDER BY o.visit_date DESC, o.order_id DESC
      LIMIT 30
    `).all(req.params.customerId);

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 2. AUTOMATED ETL PIPELINE ENDPOINTS
// ============================================================================

// Trigger ETL pipeline
app.post('/api/etl/run', (req, res) => {
  try {
    const incremental = req.body && req.body.incremental === true;
    const result = runETL({ incremental });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// View ETL run history & logs
app.get('/api/etl/history', (req, res) => {
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
