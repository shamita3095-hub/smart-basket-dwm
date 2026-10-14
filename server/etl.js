const { db } = require('./db');

/**
 * Helper to convert visit_date string into standard components.
 * Handles both "DD-MM-YYYY" and "YYYY-MM-DD".
 */
function parseDateString(dateStr) {
  let year, month, day;
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      // DD-MM-YYYY
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    }
  } else {
    const d = new Date(dateStr);
    year = d.getFullYear();
    month = d.getMonth() + 1;
    day = d.getDate();
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const fullDate = `${year}-${mm}-${dd}`;
  const dateId = parseInt(`${year}${mm}${dd}`, 10);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const jsDate = new Date(year, month - 1, day);
  const monthName = monthNames[month - 1] || 'Unknown';
  const dayOfWeek = dayNames[jsDate.getDay()] || 'Unknown';
  const quarter = Math.ceil(month / 3);

  return {
    dateId,
    fullDate,
    year,
    quarter,
    month,
    monthName,
    day,
    dayOfWeek,
    monthYear: `${year}-${mm}`
  };
}

/**
 * Execute the automated ETL pipeline:
 * 1. EXTRACT: Pulls newly completed / unsynced orders and order items from OLTP.
 * 2. TRANSFORM: Standardizes dates into Dim_Date attributes, resolves foreign keys, calculates metrics.
 * 3. LOAD: Upserts conformed dimension tables, populates Fact_Sales and Fact_Budget_Performance.
 */
function runETL(options = { incremental: false }) {
  const startTime = Date.now();
  const logs = [];

  logs.push(`[${new Date().toISOString()}] Starting ETL Pipeline execution (Mode: ${options.incremental ? 'Incremental' : 'Full / Refresh'})...`);

  try {
    db.exec('BEGIN TRANSACTION;');

    // ----------------------------------------------------
    // STEP 1: CONFORMED DIMENSIONS UPSERT
    // ----------------------------------------------------
    logs.push('[ETL:LOAD_DIMS] Synchronizing Conformed Dimensions...');

    // 1. Dim_Customer with RFM Segmentation
    db.exec(`
      INSERT OR REPLACE INTO dim_customer (customer_id, customer_name, city, segment)
      SELECT 
        c.customer_id,
        c.customer_name,
        c.city,
        CASE 
          WHEN IFNULL(spend.total_spent, 0) >= 20000 THEN 'Premium'
          WHEN IFNULL(spend.total_spent, 0) >= 8000 THEN 'Gold'
          WHEN IFNULL(spend.total_spent, 0) >= 3000 THEN 'Regular'
          ELSE 'Budget'
        END AS segment
      FROM customers c
      LEFT JOIN (
        SELECT customer_id, SUM(total_amount) as total_spent
        FROM orders
        GROUP BY customer_id
      ) spend ON c.customer_id = spend.customer_id;
    `);

    // 2. Dim_Category
    db.exec(`
      INSERT OR REPLACE INTO dim_category (category_id, product_category)
      SELECT category_id, product_category
      FROM categories;
    `);

    // 3. Dim_Product
    db.exec(`
      INSERT OR REPLACE INTO dim_product (product_id, product_name, category_id, category_name, unit_price)
      SELECT 
        p.product_id,
        p.product_name,
        p.category_id,
        c.product_category,
        p.unit_price
      FROM products p
      JOIN categories c ON p.category_id = c.category_id;
    `);

    // 4. Dim_Store
    db.exec(`
      INSERT OR REPLACE INTO dim_store (store_id, store_type, city)
      SELECT store_id, store_type, city
      FROM stores;
    `);

    // ----------------------------------------------------
    // STEP 2: EXTRACT ORDERS TO SYNC
    // ----------------------------------------------------
    let queryOrdersSql = `
      SELECT o.order_id, o.customer_id, o.store_id, o.visit_date, o.total_amount
      FROM orders o
    `;
    if (options.incremental) {
      queryOrdersSql += ` WHERE o.is_etl_synced = 0`;
    }

    const ordersToSync = db.prepare(queryOrdersSql).all();
    logs.push(`[ETL:EXTRACT] Extracted ${ordersToSync.length} orders for processing.`);

    // ----------------------------------------------------
    // STEP 3: TRANSFORM & LOAD DIM_DATE
    // ----------------------------------------------------
    const insertDateStmt = db.prepare(`
      INSERT OR IGNORE INTO dim_date (date_id, full_date, day, month, month_name, quarter, year, day_of_week)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const dateMap = new Map();
    for (const ord of ordersToSync) {
      if (!dateMap.has(ord.visit_date)) {
        const dInfo = parseDateString(ord.visit_date);
        dateMap.set(ord.visit_date, dInfo);
        insertDateStmt.run(
          dInfo.dateId,
          dInfo.fullDate,
          dInfo.day,
          dInfo.month,
          dInfo.monthName,
          dInfo.quarter,
          dInfo.year,
          dInfo.dayOfWeek
        );
      }
    }
    logs.push(`[ETL:TRANSFORM] Resolved and verified ${dateMap.size} unique calendar dates in Dim_Date.`);

    // ----------------------------------------------------
    // STEP 4: TRANSFORM & LOAD FACT_SALES
    // ----------------------------------------------------
    if (!options.incremental) {
      // Clear fact tables on full refresh
      db.exec('DELETE FROM fact_sales;');
      db.exec('DELETE FROM fact_budget_performance;');
    }

    const insertFactSaleStmt = db.prepare(`
      INSERT INTO fact_sales (
        order_id, order_item_id, date_id, customer_id, product_id, category_id, store_id, quantity, unit_price, total_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let salesLoadedCount = 0;
    const orderItemsStmt = options.incremental
      ? db.prepare(`
          SELECT oi.order_item_id, oi.order_id, oi.product_id, oi.quantity, oi.unit_price,
                 p.category_id, o.customer_id, o.store_id, o.visit_date
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.order_id
          JOIN products p ON oi.product_id = p.product_id
          WHERE o.is_etl_synced = 0
        `)
      : db.prepare(`
          SELECT oi.order_item_id, oi.order_id, oi.product_id, oi.quantity, oi.unit_price,
                 p.category_id, o.customer_id, o.store_id, o.visit_date
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.order_id
          JOIN products p ON oi.product_id = p.product_id
        `);

    const items = orderItemsStmt.all();
    for (const item of items) {
      const dInfo = dateMap.get(item.visit_date) || parseDateString(item.visit_date);
      const lineTotal = item.quantity * item.unit_price;

      insertFactSaleStmt.run(
        item.order_id,
        item.order_item_id,
        dInfo.dateId,
        item.customer_id,
        item.product_id,
        item.category_id,
        item.store_id,
        item.quantity,
        item.unit_price,
        lineTotal
      );
      salesLoadedCount++;
    }
    logs.push(`[ETL:LOAD_FACT_SALES] Loaded ${salesLoadedCount} line-item records into Fact_Sales.`);

    // ----------------------------------------------------
    // STEP 5: TRANSFORM & LOAD FACT_BUDGET_PERFORMANCE
    // ----------------------------------------------------
    // Aggregate customer spending by month, compare against monthly_budget, compute variance & status
    const budgetFactsStmt = db.prepare(`
      WITH MonthlyActuals AS (
        SELECT 
          o.customer_id,
          SUBSTR(d.full_date, 1, 7) AS month_year,
          MIN(d.date_id) AS date_id,
          SUM(fs.total_amount) AS actual_spent
        FROM fact_sales fs
        JOIN dim_date d ON fs.date_id = d.date_id
        JOIN orders o ON fs.order_id = o.order_id
        GROUP BY o.customer_id, SUBSTR(d.full_date, 1, 7)
      )
      SELECT 
        ma.customer_id,
        ma.date_id,
        ma.month_year,
        COALESCE(b.monthly_budget, (SELECT monthly_budget FROM budgets WHERE customer_id = ma.customer_id ORDER BY month_year DESC LIMIT 1), 10000.0) AS monthly_budget,
        ma.actual_spent
      FROM MonthlyActuals ma
      LEFT JOIN budgets b ON ma.customer_id = b.customer_id AND ma.month_year = b.month_year
    `);

    const budgetActuals = budgetFactsStmt.all();

    // Clear and reload Fact_Budget_Performance
    db.exec('DELETE FROM fact_budget_performance;');
    const insertBudgetFactStmt = db.prepare(`
      INSERT INTO fact_budget_performance (
        customer_id, date_id, month_year, monthly_budget, actual_spent, variance_amount, utilization_rate, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let budgetFactsLoadedCount = 0;
    for (const b of budgetActuals) {
      const variance = b.actual_spent - b.monthly_budget;
      const rate = b.monthly_budget > 0 ? (b.actual_spent / b.monthly_budget) * 100 : 100;
      let status = 'UNDER_BUDGET';
      if (rate > 100) {
        status = 'OVER_BUDGET';
      } else if (rate >= 80) {
        status = 'NEAR_LIMIT';
      }

      insertBudgetFactStmt.run(
        b.customer_id,
        b.date_id,
        b.month_year,
        b.monthly_budget,
        b.actual_spent,
        variance,
        rate,
        status
      );
      budgetFactsLoadedCount++;
    }
    logs.push(`[ETL:LOAD_FACT_BUDGET] Computed and loaded ${budgetFactsLoadedCount} customer monthly records into Fact_Budget_Performance.`);

    // ----------------------------------------------------
    // STEP 6: MARK ORDERS AS ETL-SYNCED
    // ----------------------------------------------------
    db.exec(`UPDATE orders SET is_etl_synced = 1 WHERE is_etl_synced = 0;`);

    // ----------------------------------------------------
    // STEP 7: RECORD AUDIT METRICS
    // ----------------------------------------------------
    const duration = Date.now() - startTime;
    const logDetails = logs.join('\n');

    db.prepare(`
      INSERT INTO etl_runs (run_timestamp, status, extracted_count, sales_loaded_count, budget_facts_loaded_count, duration_ms, log_details)
      VALUES (?, 'SUCCESS', ?, ?, ?, ?, ?)
    `).run(
      new Date().toISOString(),
      ordersToSync.length,
      salesLoadedCount,
      budgetFactsLoadedCount,
      duration,
      logDetails
    );

    db.exec('COMMIT;');

    logs.push(`[${new Date().toISOString()}] ETL Pipeline completed successfully in ${duration}ms!`);

    return {
      success: true,
      durationMs: duration,
      extractedOrders: ordersToSync.length,
      salesLoaded: salesLoadedCount,
      budgetFactsLoaded: budgetFactsLoadedCount,
      logs
    };
  } catch (error) {
    db.exec('ROLLBACK;');
    const duration = Date.now() - startTime;
    const errMsg = `ETL Error: ${error.message}`;
    logs.push(`[ERROR] ${errMsg}`);

    try {
      db.prepare(`
        INSERT INTO etl_runs (run_timestamp, status, extracted_count, sales_loaded_count, budget_facts_loaded_count, duration_ms, log_details)
        VALUES (?, 'FAILED', 0, 0, 0, ?, ?)
      `).run(new Date().toISOString(), duration, logs.join('\n'));
    } catch (_) {}

    return {
      success: false,
      error: error.message,
      durationMs: duration,
      logs
    };
  }
}

module.exports = {
  runETL,
  parseDateString
};
