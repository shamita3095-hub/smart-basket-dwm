const { db } = require('./db');

/**
 * Returns overall executive KPIs queried against the Data Warehouse.
 */
function getKPIs() {
  const salesSummary = db.prepare(`
    SELECT 
      IFNULL(SUM(total_amount), 0) AS total_revenue,
      IFNULL(SUM(quantity), 0) AS total_units_sold,
      COUNT(DISTINCT order_id) AS total_orders,
      COUNT(DISTINCT customer_id) AS active_customers,
      IFNULL(AVG(total_amount), 0) AS avg_item_revenue
    FROM fact_sales
  `).get();

  const totalRegisteredCust = db.prepare(`
    SELECT COUNT(*) AS total_registered FROM dim_customer
  `).get();

  const newShoppersSummary = db.prepare(`
    SELECT COUNT(*) AS new_shoppers FROM dim_customer WHERE segment = 'New Shopper'
  `).get();

  const recentRegistered = db.prepare(`
    SELECT c.customer_id, c.customer_name, c.city, c.segment, b.monthly_budget
    FROM dim_customer c
    LEFT JOIN (
      SELECT customer_id, monthly_budget FROM budgets GROUP BY customer_id
    ) b ON c.customer_id = b.customer_id
    ORDER BY c.customer_key DESC
    LIMIT 6
  `).all();

  const orderSummary = db.prepare(`
    SELECT AVG(total_amount) AS avg_order_value FROM orders
  `).get();

  const budgetSummary = db.prepare(`
    SELECT 
      COUNT(*) AS total_budget_evals,
      SUM(CASE WHEN status = 'UNDER_BUDGET' THEN 1 ELSE 0 END) AS under_budget_count,
      SUM(CASE WHEN status = 'NEAR_LIMIT' THEN 1 ELSE 0 END) AS near_limit_count,
      SUM(CASE WHEN status = 'OVER_BUDGET' THEN 1 ELSE 0 END) AS over_budget_count,
      AVG(utilization_rate) AS avg_utilization
    FROM fact_budget_performance
  `).get();

  const lastETL = db.prepare(`
    SELECT * FROM etl_runs ORDER BY id DESC LIMIT 1
  `).get();

  const categoryBreakdown = db.prepare(`
    SELECT 
      c.product_category,
      SUM(fs.total_amount) AS revenue,
      SUM(fs.quantity) AS units
    FROM fact_sales fs
    JOIN dim_category c ON fs.category_id = c.category_id
    GROUP BY c.product_category
    ORDER BY revenue DESC
  `).all();

  const storeBreakdown = db.prepare(`
    SELECT 
      s.store_type,
      SUM(fs.total_amount) AS revenue,
      COUNT(DISTINCT fs.order_id) AS orders
    FROM fact_sales fs
    JOIN dim_store s ON fs.store_id = s.store_id
    GROUP BY s.store_type
    ORDER BY revenue DESC
  `).all();

  return {
    revenue: salesSummary.total_revenue,
    unitsSold: salesSummary.total_units_sold,
    orders: salesSummary.total_orders,
    activeCustomers: salesSummary.active_customers,
    registeredCustomers: totalRegisteredCust ? totalRegisteredCust.total_registered : salesSummary.active_customers,
    newShoppers: newShoppersSummary ? newShoppersSummary.new_shoppers : 0,
    recentCustomers: recentRegistered || [],
    avgOrderValue: orderSummary ? orderSummary.avg_order_value : 0,
    budgetAdherenceRate: budgetSummary.total_budget_evals > 0
      ? ((budgetSummary.under_budget_count / budgetSummary.total_budget_evals) * 100).toFixed(1)
      : 100,
    budgetStats: {
      underBudget: budgetSummary.under_budget_count || 0,
      nearLimit: budgetSummary.near_limit_count || 0,
      overBudget: budgetSummary.over_budget_count || 0,
      avgUtilization: (budgetSummary.avg_utilization || 0).toFixed(1)
    },
    categoryBreakdown,
    storeBreakdown,
    lastETL: lastETL || null
  };
}

/**
 * OLAP Roll-up & Drill-down Engine
 * Levels: 'year' -> 'quarter' -> 'month' -> 'day'
 */
function getTimeDrillDown(params = {}) {
  const { level = 'year', year, quarter, month } = params;

  let query = '';
  const queryParams = [];

  if (level === 'year') {
    query = `
      SELECT 
        d.year AS label,
        d.year AS id,
        'year' AS current_level,
        'quarter' AS next_level,
        SUM(fs.total_amount) AS revenue,
        SUM(fs.quantity) AS units,
        COUNT(DISTINCT fs.order_id) AS orders,
        COUNT(DISTINCT fs.customer_id) AS unique_customers
      FROM fact_sales fs
      JOIN dim_date d ON fs.date_id = d.date_id
      GROUP BY d.year
      ORDER BY d.year ASC
    `;
  } else if (level === 'quarter') {
    let whereClause = '';
    if (year) {
      whereClause = 'WHERE d.year = ?';
      queryParams.push(parseInt(year, 10));
    }
    query = `
      SELECT 
        d.year || ' Q' || d.quarter AS label,
        d.quarter AS id,
        d.year,
        'quarter' AS current_level,
        'month' AS next_level,
        SUM(fs.total_amount) AS revenue,
        SUM(fs.quantity) AS units,
        COUNT(DISTINCT fs.order_id) AS orders,
        COUNT(DISTINCT fs.customer_id) AS unique_customers
      FROM fact_sales fs
      JOIN dim_date d ON fs.date_id = d.date_id
      ${whereClause}
      GROUP BY d.year, d.quarter
      ORDER BY d.year ASC, d.quarter ASC
    `;
  } else if (level === 'month') {
    const conditions = [];
    if (year) {
      conditions.push('d.year = ?');
      queryParams.push(parseInt(year, 10));
    }
    if (quarter) {
      conditions.push('d.quarter = ?');
      queryParams.push(parseInt(quarter, 10));
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    query = `
      SELECT 
        d.month_name || ' ' || d.year AS label,
        d.month AS id,
        d.year,
        d.quarter,
        d.month_name,
        'month' AS current_level,
        'day' AS next_level,
        SUM(fs.total_amount) AS revenue,
        SUM(fs.quantity) AS units,
        COUNT(DISTINCT fs.order_id) AS orders,
        COUNT(DISTINCT fs.customer_id) AS unique_customers
      FROM fact_sales fs
      JOIN dim_date d ON fs.date_id = d.date_id
      ${whereClause}
      GROUP BY d.year, d.month, d.month_name
      ORDER BY d.year ASC, d.month ASC
    `;
  } else if (level === 'day') {
    const conditions = [];
    if (year) {
      conditions.push('d.year = ?');
      queryParams.push(parseInt(year, 10));
    }
    if (month) {
      conditions.push('d.month = ?');
      queryParams.push(parseInt(month, 10));
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    query = `
      SELECT 
        d.full_date AS label,
        d.date_id AS id,
        d.day,
        d.day_of_week,
        'day' AS current_level,
        NULL AS next_level,
        SUM(fs.total_amount) AS revenue,
        SUM(fs.quantity) AS units,
        COUNT(DISTINCT fs.order_id) AS orders,
        COUNT(DISTINCT fs.customer_id) AS unique_customers
      FROM fact_sales fs
      JOIN dim_date d ON fs.date_id = d.date_id
      ${whereClause}
      GROUP BY d.date_id, d.full_date, d.day, d.day_of_week
      ORDER BY d.date_id ASC
      LIMIT 60
    `;
  }

  const results = db.prepare(query).all(...queryParams);
  return {
    level,
    appliedFilters: { year, quarter, month },
    data: results
  };
}

/**
 * OLAP Slice & Dice Engine
 * Filters dynamically across dimensions: category, storeType, city, customerSegment, year
 */
function getSliceAndDice(filters = {}) {
  const conditions = [];
  const queryParams = [];

  if (filters.categoryId) {
    conditions.push('fs.category_id = ?');
    queryParams.push(filters.categoryId);
  }
  if (filters.storeType) {
    conditions.push('s.store_type = ?');
    queryParams.push(filters.storeType);
  }
  if (filters.city) {
    conditions.push('s.city = ?');
    queryParams.push(filters.city);
  }
  if (filters.segment) {
    conditions.push('cust.segment = ?');
    queryParams.push(filters.segment);
  }
  if (filters.year) {
    conditions.push('d.year = ?');
    queryParams.push(parseInt(filters.year, 10));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Aggregate metrics for this slice
  const summary = db.prepare(`
    SELECT 
      IFNULL(SUM(fs.total_amount), 0) AS total_revenue,
      IFNULL(SUM(fs.quantity), 0) AS total_units,
      COUNT(DISTINCT fs.order_id) AS total_orders,
      COUNT(DISTINCT fs.customer_id) AS total_customers,
      IFNULL(AVG(fs.total_amount), 0) AS avg_item_value
    FROM fact_sales fs
    JOIN dim_category c ON fs.category_id = c.category_id
    JOIN dim_store s ON fs.store_id = s.store_id
    JOIN dim_customer cust ON fs.customer_id = cust.customer_id
    JOIN dim_date d ON fs.date_id = d.date_id
    ${whereClause}
  `).get(...queryParams);

  // By Category Breakdown
  const byCategory = db.prepare(`
    SELECT 
      c.category_id,
      c.product_category,
      SUM(fs.total_amount) AS revenue,
      SUM(fs.quantity) AS units
    FROM fact_sales fs
    JOIN dim_category c ON fs.category_id = c.category_id
    JOIN dim_store s ON fs.store_id = s.store_id
    JOIN dim_customer cust ON fs.customer_id = cust.customer_id
    JOIN dim_date d ON fs.date_id = d.date_id
    ${whereClause}
    GROUP BY c.category_id, c.product_category
    ORDER BY revenue DESC
  `).all(...queryParams);

  // By Store Type Breakdown
  const byStoreType = db.prepare(`
    SELECT 
      s.store_type,
      SUM(fs.total_amount) AS revenue,
      COUNT(DISTINCT fs.order_id) AS orders
    FROM fact_sales fs
    JOIN dim_category c ON fs.category_id = c.category_id
    JOIN dim_store s ON fs.store_id = s.store_id
    JOIN dim_customer cust ON fs.customer_id = cust.customer_id
    JOIN dim_date d ON fs.date_id = d.date_id
    ${whereClause}
    GROUP BY s.store_type
    ORDER BY revenue DESC
  `).all(...queryParams);

  // By Customer Segment Breakdown
  const bySegment = db.prepare(`
    SELECT 
      cust.segment,
      SUM(fs.total_amount) AS revenue,
      COUNT(DISTINCT fs.customer_id) AS customers
    FROM fact_sales fs
    JOIN dim_category c ON fs.category_id = c.category_id
    JOIN dim_store s ON fs.store_id = s.store_id
    JOIN dim_customer cust ON fs.customer_id = cust.customer_id
    JOIN dim_date d ON fs.date_id = d.date_id
    ${whereClause}
    GROUP BY cust.segment
    ORDER BY revenue DESC
  `).all(...queryParams);

  // Time trend (by month) for this slice
  const timeTrend = db.prepare(`
    SELECT 
      SUBSTR(d.full_date, 1, 7) AS month_year,
      SUM(fs.total_amount) AS revenue,
      COUNT(DISTINCT fs.order_id) AS orders
    FROM fact_sales fs
    JOIN dim_category c ON fs.category_id = c.category_id
    JOIN dim_store s ON fs.store_id = s.store_id
    JOIN dim_customer cust ON fs.customer_id = cust.customer_id
    JOIN dim_date d ON fs.date_id = d.date_id
    ${whereClause}
    GROUP BY SUBSTR(d.full_date, 1, 7)
    ORDER BY month_year ASC
  `).all(...queryParams);

  return {
    filters,
    summary,
    byCategory,
    byStoreType,
    bySegment,
    timeTrend
  };
}

/**
 * OLAP Pivot / Cross-Tabulation Matrix Engine
 */
function getPivotMatrix(rowDim = 'category', colDim = 'store_type') {
  let rowSelect = 'c.product_category';
  let colSelect = 's.store_type';

  if (rowDim === 'category') rowSelect = 'c.product_category';
  else if (rowDim === 'store_type') rowSelect = 's.store_type';
  else if (rowDim === 'segment') rowSelect = 'cust.segment';
  else if (rowDim === 'year') rowSelect = "CAST(d.year AS TEXT)";

  if (colDim === 'store_type') colSelect = 's.store_type';
  else if (colDim === 'quarter') colSelect = "'Q' || d.quarter";
  else if (colDim === 'segment') colSelect = 'cust.segment';
  else if (colDim === 'category') colSelect = 'c.product_category';

  const rows = db.prepare(`
    SELECT DISTINCT ${rowSelect} AS row_val
    FROM fact_sales fs
    JOIN dim_category c ON fs.category_id = c.category_id
    JOIN dim_store s ON fs.store_id = s.store_id
    JOIN dim_customer cust ON fs.customer_id = cust.customer_id
    JOIN dim_date d ON fs.date_id = d.date_id
    ORDER BY row_val ASC
  `).all().map(r => r.row_val);

  const cols = db.prepare(`
    SELECT DISTINCT ${colSelect} AS col_val
    FROM fact_sales fs
    JOIN dim_category c ON fs.category_id = c.category_id
    JOIN dim_store s ON fs.store_id = s.store_id
    JOIN dim_customer cust ON fs.customer_id = cust.customer_id
    JOIN dim_date d ON fs.date_id = d.date_id
    ORDER BY col_val ASC
  `).all().map(c => c.col_val);

  const matrixData = db.prepare(`
    SELECT 
      ${rowSelect} AS row_val,
      ${colSelect} AS col_val,
      SUM(fs.total_amount) AS revenue,
      SUM(fs.quantity) AS units
    FROM fact_sales fs
    JOIN dim_category c ON fs.category_id = c.category_id
    JOIN dim_store s ON fs.store_id = s.store_id
    JOIN dim_customer cust ON fs.customer_id = cust.customer_id
    JOIN dim_date d ON fs.date_id = d.date_id
    GROUP BY row_val, col_val
  `).all();

  const cellMap = {};
  for (const item of matrixData) {
    cellMap[`${item.row_val}___${item.col_val}`] = {
      revenue: item.revenue,
      units: item.units
    };
  }

  // Row and Column Totals
  const rowTotals = {};
  const colTotals = {};
  let grandTotalRevenue = 0;

  for (const r of rows) {
    rowTotals[r] = 0;
    for (const c of cols) {
      if (!colTotals[c]) colTotals[c] = 0;
      const cell = cellMap[`${r}___${c}`] || { revenue: 0, units: 0 };
      rowTotals[r] += cell.revenue;
      colTotals[c] += cell.revenue;
      grandTotalRevenue += cell.revenue;
    }
  }

  return {
    rowDim,
    colDim,
    rows,
    cols,
    cells: cellMap,
    rowTotals,
    colTotals,
    grandTotalRevenue
  };
}

/**
 * Data Mining: Market Basket Analysis (Apriori Algorithm & Co-occurrence)
 * Computes Support, Confidence, and Lift for product pairs.
 */
function getMarketBasketRules(options = {}) {
  const minSupport = options.minSupport !== undefined ? parseFloat(options.minSupport) : 0.005; // 0.5%
  const minConfidence = options.minConfidence !== undefined ? parseFloat(options.minConfidence) : 0.20; // 20%
  const limit = options.limit ? parseInt(options.limit, 10) : 50;

  const totalOrders = db.prepare('SELECT COUNT(DISTINCT order_id) AS cnt FROM order_items').get().cnt;
  if (totalOrders === 0) return { totalOrders: 0, rules: [] };

  // Calculate item frequencies
  const itemFrequencies = db.prepare(`
    SELECT product_id, COUNT(DISTINCT order_id) AS order_count
    FROM order_items
    GROUP BY product_id
  `).all();

  const freqMap = new Map();
  for (const item of itemFrequencies) {
    freqMap.set(item.product_id, item.order_count);
  }

  // Calculate pairs co-occurrence
  const pairs = db.prepare(`
    SELECT 
      oi1.product_id AS item_a_id,
      p1.product_name AS item_a_name,
      p1.category_id AS item_a_cat_id,
      c1.product_category AS item_a_category,
      p1.unit_price AS item_a_price,
      p1.image AS item_a_image,
      oi2.product_id AS item_b_id,
      p2.product_name AS item_b_name,
      p2.category_id AS item_b_cat_id,
      c2.product_category AS item_b_category,
      p2.unit_price AS item_b_price,
      p2.image AS item_b_image,
      COUNT(DISTINCT oi1.order_id) AS pair_orders
    FROM order_items oi1
    JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.product_id != oi2.product_id
    JOIN products p1 ON oi1.product_id = p1.product_id
    JOIN products p2 ON oi2.product_id = p2.product_id
    JOIN categories c1 ON p1.category_id = c1.category_id
    JOIN categories c2 ON p2.category_id = c2.category_id
    GROUP BY oi1.product_id, oi2.product_id
    HAVING pair_orders >= 5
    ORDER BY pair_orders DESC
  `).all();

  const rules = [];

  for (const p of pairs) {
    const countA = freqMap.get(p.item_a_id) || 1;
    const countB = freqMap.get(p.item_b_id) || 1;

    const support = p.pair_orders / totalOrders;
    const confidence = p.pair_orders / countA;
    const expectedProb = countB / totalOrders;
    const lift = expectedProb > 0 ? confidence / expectedProb : 1;

    if (support >= minSupport && confidence >= minConfidence) {
      rules.push({
        antecedentId: p.item_a_id,
        antecedentName: p.item_a_name,
        antecedentCategory: p.item_a_category,
        antecedentPrice: p.item_a_price,
        antecedentImage: p.item_a_image,
        consequentId: p.item_b_id,
        consequentName: p.item_b_name,
        consequentCategory: p.item_b_category,
        consequentPrice: p.item_b_price,
        consequentImage: p.item_b_image,
        pairOrders: p.pair_orders,
        antecedentOrders: countA,
        consequentOrders: countB,
        support: parseFloat((support * 100).toFixed(2)), // in %
        confidence: parseFloat((confidence * 100).toFixed(2)), // in %
        lift: parseFloat(lift.toFixed(2)),
        explanation: `Customers who buy "${p.item_a_name}" are ${(lift).toFixed(1)}x more likely to also buy "${p.item_b_name}" (${(confidence * 100).toFixed(0)}% confidence).`
      });
    }
  }

  // Sort primarily by Lift, then Confidence
  rules.sort((a, b) => b.lift - a.lift || b.confidence - a.confidence);

  return {
    totalOrders,
    minSupport: minSupport * 100,
    minConfidence: minConfidence * 100,
    ruleCount: rules.length,
    rules: rules.slice(0, limit)
  };
}

/**
 * Frequently Bought Together Recommendations for cart/checkout
 */
function getRecommendationsForCart(productIds = []) {
  if (!productIds || productIds.length === 0) {
    // Return overall highest lift rules
    const topRules = getMarketBasketRules({ limit: 6 });
    return topRules.rules.map(r => ({
      recommendedProductId: r.consequentId,
      recommendedProductName: r.consequentName,
      recommendedCategory: r.consequentCategory,
      unitPrice: r.consequentPrice,
      image: r.consequentImage,
      basedOn: r.antecedentName,
      confidence: r.confidence,
      lift: r.lift,
      explanation: r.explanation
    }));
  }

  const recommendations = [];
  const seenConsequents = new Set(productIds);

  const placeholders = productIds.map(() => '?').join(',');
  const query = `
    SELECT 
      oi1.product_id AS antecedent_id,
      p1.product_name AS antecedent_name,
      oi2.product_id AS consequent_id,
      p2.product_name AS consequent_name,
      c2.product_category AS consequent_category,
      p2.unit_price AS consequent_price,
      p2.image AS consequent_image,
      COUNT(DISTINCT oi1.order_id) AS pair_orders
    FROM order_items oi1
    JOIN order_items oi2 ON oi1.order_id = oi2.order_id AND oi1.product_id != oi2.product_id
    JOIN products p1 ON oi1.product_id = p1.product_id
    JOIN products p2 ON oi2.product_id = p2.product_id
    JOIN categories c2 ON p2.category_id = c2.category_id
    WHERE oi1.product_id IN (${placeholders})
    GROUP BY oi1.product_id, oi2.product_id
    ORDER BY pair_orders DESC
  `;

  const rows = db.prepare(query).all(...productIds);

  const totalOrders = db.prepare('SELECT COUNT(DISTINCT order_id) AS cnt FROM order_items').get().cnt || 1;

  for (const r of rows) {
    if (seenConsequents.has(r.consequent_id)) continue;
    seenConsequents.add(r.consequent_id);

    const countA = db.prepare('SELECT COUNT(DISTINCT order_id) AS cnt FROM order_items WHERE product_id = ?').get(r.antecedent_id).cnt || 1;
    const countB = db.prepare('SELECT COUNT(DISTINCT order_id) AS cnt FROM order_items WHERE product_id = ?').get(r.consequent_id).cnt || 1;

    const confidence = r.pair_orders / countA;
    const lift = (confidence / (countB / totalOrders));

    recommendations.push({
      recommendedProductId: r.consequent_id,
      recommendedProductName: r.consequent_name,
      recommendedCategory: r.consequent_category,
      unitPrice: r.consequent_price,
      image: r.consequent_image,
      basedOn: r.antecedent_name,
      confidence: parseFloat((confidence * 100).toFixed(1)),
      lift: parseFloat(lift.toFixed(2)),
      explanation: `Frequently bought with ${r.antecedent_name}`
    });

    if (recommendations.length >= 6) break;
  }

  return recommendations;
}

/**
 * Data Mining: Budget Intelligence & Historical Comparison
 */
function getBudgetIntelligence(customerId = null) {
  // Overall spending vs historical average
  const overallAverages = db.prepare(`
    SELECT 
      AVG(monthly_budget) AS avg_budget,
      AVG(actual_spent) AS avg_spent,
      AVG(variance_amount) AS avg_variance,
      AVG(utilization_rate) AS avg_utilization
    FROM fact_budget_performance
  `).get();

  // Top budget overruns
  const topOverruns = db.prepare(`
    SELECT 
      fbp.customer_id,
      c.customer_name,
      c.city,
      fbp.month_year,
      fbp.monthly_budget,
      fbp.actual_spent,
      fbp.variance_amount,
      fbp.utilization_rate
    FROM fact_budget_performance fbp
    JOIN dim_customer c ON fbp.customer_id = c.customer_id
    WHERE fbp.status = 'OVER_BUDGET'
    ORDER BY fbp.variance_amount DESC
    LIMIT 10
  `).all();

  // Customer-specific intelligence if customerId provided
  let customerProfile = null;
  if (customerId) {
    const custHistory = db.prepare(`
      SELECT 
        fbp.month_year,
        fbp.monthly_budget,
        fbp.actual_spent,
        fbp.variance_amount,
        fbp.utilization_rate,
        fbp.status
      FROM fact_budget_performance fbp
      WHERE fbp.customer_id = ?
      ORDER BY fbp.month_year DESC
    `).all(customerId);

    const custInfo = db.prepare('SELECT * FROM dim_customer WHERE customer_id = ?').get(customerId);
    const historicalAvgSpent = custHistory.length > 0
      ? custHistory.reduce((acc, h) => acc + h.actual_spent, 0) / custHistory.length
      : 0;

    const latest = custHistory[0];
    let comparisonText = '';
    let diffPct = 0;
    if (latest && historicalAvgSpent > 0) {
      diffPct = ((latest.actual_spent - historicalAvgSpent) / historicalAvgSpent) * 100;
      if (diffPct > 0) {
        comparisonText = `Current spending is ${diffPct.toFixed(1)}% higher than your historical average (₹${historicalAvgSpent.toFixed(0)}/mo).`;
      } else {
        comparisonText = `Current spending is ${Math.abs(diffPct).toFixed(1)}% lower than your historical average (₹${historicalAvgSpent.toFixed(0)}/mo).`;
      }
    }

    customerProfile = {
      customer: custInfo,
      history: custHistory,
      historicalAvgSpent,
      latestMonth: latest,
      diffPct: parseFloat(diffPct.toFixed(1)),
      comparisonText
    };
  }

  // Monthly adherence trend
  const monthlyTrend = db.prepare(`
    SELECT 
      month_year,
      AVG(monthly_budget) AS avg_budget,
      AVG(actual_spent) AS avg_spent,
      SUM(CASE WHEN status = 'OVER_BUDGET' THEN 1 ELSE 0 END) AS over_count,
      COUNT(*) AS total_count
    FROM fact_budget_performance
    GROUP BY month_year
    ORDER BY month_year ASC
  `).all();

  // Recent customer budget fact records (including newly registered users)
  const recentBudgetFacts = db.prepare(`
    SELECT 
      fbp.budget_fact_id,
      fbp.customer_id,
      c.customer_name,
      c.city,
      c.segment,
      fbp.month_year,
      fbp.monthly_budget,
      fbp.actual_spent,
      fbp.variance_amount,
      fbp.utilization_rate,
      fbp.status
    FROM fact_budget_performance fbp
    JOIN dim_customer c ON fbp.customer_id = c.customer_id
    ORDER BY fbp.budget_fact_id DESC
    LIMIT 15
  `).all();

  return {
    overallAverages,
    topOverruns,
    monthlyTrend,
    customerProfile,
    recentBudgetFacts: recentBudgetFacts || []
  };
}

/**
 * Customer Segmentation (RFM Mining)
 */
function getCustomerSegments() {
  const segments = db.prepare(`
    SELECT 
      c.segment,
      COUNT(DISTINCT c.customer_id) AS customer_count,
      IFNULL(SUM(fs.total_amount), 0) AS total_revenue,
      IFNULL(AVG(fs.total_amount), 0) AS avg_order_revenue,
      IFNULL(SUM(fs.quantity), 0) AS total_units
    FROM dim_customer c
    LEFT JOIN fact_sales fs ON c.customer_id = fs.customer_id
    GROUP BY c.segment
    ORDER BY total_revenue DESC
  `).all();

  return segments;
}

module.exports = {
  getKPIs,
  getTimeDrillDown,
  getSliceAndDice,
  getPivotMatrix,
  getMarketBasketRules,
  getRecommendationsForCart,
  getBudgetIntelligence,
  getCustomerSegments
};
