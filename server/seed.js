const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { db, initSchema } = require('./db');
const { runETL, parseDateString } = require('./etl');

async function seed() {
  console.log('--- Initializing SmartBasket Database Schema ---');
  initSchema();

  const csvPath = path.resolve(__dirname, '..', 'Indian_Retail_Store_5000_With_10_Tables.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at ${csvPath}`);
    process.exit(1);
  }

  console.log(`--- Reading and Parsing CSV: ${csvPath} ---`);

  // Clear existing OLTP data
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec(`
    DELETE FROM shopping_list_items;
    DELETE FROM shopping_lists;
    DELETE FROM payments;
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM budgets;
    DELETE FROM products;
    DELETE FROM categories;
    DELETE FROM stores;
    DELETE FROM customers;
  `);
  db.exec('PRAGMA foreign_keys = ON;');

  // Prepare batch insert statements
  const insertCustomer = db.prepare(`
    INSERT OR IGNORE INTO customers (customer_id, customer_name, email, city)
    VALUES (?, ?, ?, ?)
  `);

  const insertCategory = db.prepare(`
    INSERT OR IGNORE INTO categories (category_id, product_category)
    VALUES (?, ?)
  `);

  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (product_id, product_name, category_id, unit_price, unit, image, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertStore = db.prepare(`
    INSERT OR IGNORE INTO stores (store_id, store_type, city)
    VALUES (?, ?, ?)
  `);

  const insertOrder = db.prepare(`
    INSERT OR IGNORE INTO orders (order_id, customer_id, store_id, visit_date, total_amount, status, is_etl_synced)
    VALUES (?, ?, ?, ?, ?, 'COMPLETED', 0)
  `);

  const insertOrderItem = db.prepare(`
    INSERT OR IGNORE INTO order_items (order_item_id, order_id, product_id, quantity, unit_price)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertShoppingList = db.prepare(`
    INSERT OR IGNORE INTO shopping_lists (shopping_list_id, customer_id, list_name)
    VALUES (?, ?, ?)
  `);

  const insertShoppingListItem = db.prepare(`
    INSERT OR IGNORE INTO shopping_list_items (shopping_list_item_id, shopping_list_id, product_id, quantity)
    VALUES (?, ?, ?, ?)
  `);

  const insertBudget = db.prepare(`
    INSERT OR IGNORE INTO budgets (customer_id, monthly_budget, month_year)
    VALUES (?, ?, ?)
  `);

  const insertPayment = db.prepare(`
    INSERT OR IGNORE INTO payments (payment_id, order_id, payment_method, payment_status, payment_date)
    VALUES (?, ?, ?, 'SUCCESS', ?)
  `);

  // Track sets to prevent duplicates
  const customerSet = new Set();
  const categorySet = new Set();
  const productSet = new Set();
  const storeSet = new Set();
  const orderSet = new Set();
  const shoppingListSet = new Set();
  const budgetSet = new Set();

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  let isHeader = true;

  db.exec('BEGIN TRANSACTION;');

  const rawRows = [];

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(',');
    if (parts.length < 23) continue;

    const [
      bill_id, customer_name, city, product_category, quantity, total_amount,
      payment_method, store_type, visit_date, customer_id, email,
      category_id, store_id, unit_price, product_name, product_id,
      order_id, order_item_id, shopping_list_id, shopping_list_item_id,
      list_name, monthly_budget, payment_id
    ] = parts;

    rawRows.push({
      bill_id, customer_name, city, product_category,
      quantity: parseInt(quantity, 10),
      total_amount: parseFloat(total_amount),
      payment_method, store_type, visit_date, customer_id, email,
      category_id, store_id,
      unit_price: parseFloat(unit_price),
      product_name, product_id, order_id, order_item_id,
      shopping_list_id, shopping_list_item_id, list_name,
      monthly_budget: parseFloat(monthly_budget),
      payment_id
    });

    // 1. Customers
    if (!customerSet.has(customer_id)) {
      customerSet.add(customer_id);
      insertCustomer.run(customer_id, customer_name, email, city);
    }

    // 2. Categories
    if (!categorySet.has(category_id)) {
      categorySet.add(category_id);
      insertCategory.run(category_id, product_category);
    }

    // 3. Products (from CSV)
    if (!productSet.has(product_id)) {
      productSet.add(product_id);
      insertProduct.run(
        product_id,
        product_name,
        category_id,
        parseFloat(unit_price),
        'unit',
        `https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80`,
        `High quality ${product_name} sourced for retail stores.`
      );
    }

    // 4. Stores
    if (!storeSet.has(store_id)) {
      storeSet.add(store_id);
      insertStore.run(store_id, store_type, city);
    }

    // 5. Orders
    if (!orderSet.has(order_id)) {
      orderSet.add(order_id);
      insertOrder.run(order_id, customer_id, store_id, visit_date, parseFloat(total_amount));
    }

    // 6. Order_Items
    insertOrderItem.run(order_item_id, order_id, product_id, parseInt(quantity, 10), parseFloat(unit_price));

    // 7. Shopping_Lists
    if (!shoppingListSet.has(shopping_list_id)) {
      shoppingListSet.add(shopping_list_id);
      insertShoppingList.run(shopping_list_id, customer_id, list_name);
    }

    // 8. Shopping_List_Items
    insertShoppingListItem.run(shopping_list_item_id, shopping_list_id, product_id, parseInt(quantity, 10));

    // 9. Budgets
    const dInfo = parseDateString(visit_date);
    const budgetKey = `${customer_id}_${dInfo.monthYear}`;
    if (!budgetSet.has(budgetKey)) {
      budgetSet.add(budgetKey);
      insertBudget.run(customer_id, parseFloat(monthly_budget), dInfo.monthYear);
    }

    // 10. Payments
    insertPayment.run(payment_id, order_id, payment_method, dInfo.fullDate);

    lineCount++;
  }

  // Add Retail Categories requested: Groceries, Dairy, Bakery, Beverages, Snacks, Personal Care, Household, Fruits & Vegetables
  const retailCategories = [
    { id: 'CAT_104', name: 'Dairy' },
    { id: 'CAT_105', name: 'Bakery' },
    { id: 'CAT_106', name: 'Beverages' },
    { id: 'CAT_107', name: 'Snacks' },
    { id: 'CAT_108', name: 'Personal Care' },
    { id: 'CAT_109', name: 'Household' },
    { id: 'CAT_110', name: 'Fruits & Vegetables' }
  ];

  for (const cat of retailCategories) {
    if (!categorySet.has(cat.id)) {
      categorySet.add(cat.id);
      insertCategory.run(cat.id, cat.name);
    }
  }

  // Add rich retail grocery products for catalog
  const catalogProducts = [
    // Dairy
    { id: 'PROD_3001', name: 'Amul Taaza Fresh Milk (1L)', cat: 'CAT_104', price: 68.0, unit: '1L', img: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80', desc: 'Pasteurized toned fresh cow milk rich in calcium and vitamins.' },
    { id: 'PROD_3002', name: 'Amul Salted Butter (500g)', cat: 'CAT_104', price: 275.0, unit: '500g', img: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=400&q=80', desc: 'Pure dairy salted cream butter for cooking and breakfast.' },
    { id: 'PROD_3003', name: 'Fresh Malai Paneer (200g)', cat: 'CAT_104', price: 95.0, unit: '200g', img: 'https://images.unsplash.com/photo-1631451095765-2c91616fc9e6?auto=format&fit=crop&w=400&q=80', desc: 'Soft and creamy cottage cheese cubes prepared from fresh milk.' },
    { id: 'PROD_3004', name: 'Epigamia Greek Yogurt (400g)', cat: 'CAT_104', price: 130.0, unit: '400g', img: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=400&q=80', desc: 'High protein natural yogurt without artificial preservatives.' },
    { id: 'PROD_3005', name: 'Britannia Cheese Slices (10pk)', cat: 'CAT_104', price: 145.0, unit: '200g', img: 'https://images.unsplash.com/photo-1624806992066-5ffcf7ca186b?auto=format&fit=crop&w=400&q=80', desc: 'Processed cheddar cheese slices ideal for toasts and burgers.' },

    // Bakery
    { id: 'PROD_3006', name: 'Modern 100% Whole Wheat Bread (400g)', cat: 'CAT_105', price: 45.0, unit: '400g', img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80', desc: 'Freshly baked wholesome brown wheat bread rich in dietary fiber.' },
    { id: 'PROD_3007', name: 'Fresh Multigrain Pav (6 pcs)', cat: 'CAT_105', price: 35.0, unit: '6 pcs', img: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=400&q=80', desc: 'Fluffy traditional pav buns baked with multigrain grains.' },
    { id: 'PROD_3008', name: 'Garlic Herb Butter Toast (150g)', cat: 'CAT_105', price: 65.0, unit: '150g', img: 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?auto=format&fit=crop&w=400&q=80', desc: 'Crispy oven-roasted bread rusks with roasted garlic herbs.' },
    { id: 'PROD_3009', name: 'Bourbon & Butter Cookies Pack', cat: 'CAT_105', price: 110.0, unit: '300g', img: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=400&q=80', desc: 'Delicious rich buttery bakery cookies baked to golden perfection.' },

    // Beverages
    { id: 'PROD_3010', name: 'Wagh Bakri Premium Assam Tea (500g)', cat: 'CAT_106', price: 280.0, unit: '500g', img: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=400&q=80', desc: 'Strong aromatic CTC black tea blend from upper Assam gardens.' },
    { id: 'PROD_3011', name: 'Bru South Indian Filter Coffee (200g)', cat: 'CAT_106', price: 175.0, unit: '200g', img: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80', desc: 'Roasted coffee and chicory blend with robust flavor and froth.' },
    { id: 'PROD_3012', name: 'Raw Pressery Tender Coconut Water (1L)', cat: 'CAT_106', price: 120.0, unit: '1L', img: 'https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=400&q=80', desc: '100% natural cold pressed tender coconut water rich in electrolytes.' },
    { id: 'PROD_3013', name: 'Organic India Tulsi Green Tea (25 bags)', cat: 'CAT_106', price: 165.0, unit: '25 bags', img: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?auto=format&fit=crop&w=400&q=80', desc: 'Revitalizing herbal green tea with stress-relieving holy basil.' },

    // Snacks
    { id: 'PROD_3014', name: 'Haldiram Nagpur Aloo Bhujia (400g)', cat: 'CAT_107', price: 99.0, unit: '400g', img: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=400&q=80', desc: 'Crispy spiced mint-potato gram flour noodles snack.' },
    { id: 'PROD_3015', name: 'Farmley Himalayan Salted Makhana (100g)', cat: 'CAT_107', price: 135.0, unit: '100g', img: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=400&q=80', desc: 'Crunchy slow roasted foxnuts tossed in pink rock salt.' },
    { id: 'PROD_3016', name: 'Spicy Roasted Masala Peanuts (200g)', cat: 'CAT_107', price: 75.0, unit: '200g', img: 'https://images.unsplash.com/photo-1534483509719-3feaee7c30da?auto=format&fit=crop&w=400&q=80', desc: 'Zesty chili pepper crusted peanuts roasted with desi spices.' },
    { id: 'PROD_3017', name: 'Amul 70% Dark Chocolate Bar (100g)', cat: 'CAT_107', price: 150.0, unit: '100g', img: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=400&q=80', desc: 'Rich cocoa bittersweet chocolate crafted with real cocoa butter.' },

    // Household
    { id: 'PROD_3018', name: 'Vim Lemon Concentrated Dishwash Gel (750ml)', cat: 'CAT_109', price: 155.0, unit: '750ml', img: 'https://images.unsplash.com/photo-1585670270608-b404fb880222?auto=format&fit=crop&w=400&q=80', desc: 'Removes stubborn grease with natural lime power in one spoon.' },
    { id: 'PROD_3019', name: 'Surf Excel Matic Detergent Powder (2kg)', cat: 'CAT_109', price: 340.0, unit: '2kg', img: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=400&q=80', desc: 'Advanced top load washing powder with optical brighteners.' },
    { id: 'PROD_3020', name: 'Oxo-Biodegradable Garbage Bags (30s)', cat: 'CAT_109', price: 125.0, unit: '30 pcs', img: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=400&q=80', desc: 'Tough leak-proof medium black trash bags for kitchen waste.' },

    // Fruits & Vegetables
    { id: 'PROD_3021', name: 'Farm Fresh Red Onions (1kg)', cat: 'CAT_110', price: 42.0, unit: '1kg', img: 'https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?auto=format&fit=crop&w=400&q=80', desc: 'Crisp pungent red onions sourced straight from Nashik farms.' },
    { id: 'PROD_3022', name: 'Golden Farm Potatoes (1kg)', cat: 'CAT_110', price: 38.0, unit: '1kg', img: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=400&q=80', desc: 'Fresh new-crop starchy golden potatoes for curries and baking.' },
    { id: 'PROD_3023', name: 'Plump Vine Ripe Tomatoes (1kg)', cat: 'CAT_110', price: 35.0, unit: '1kg', img: 'https://images.unsplash.com/photo-1546470427-0d4db154ceb7?auto=format&fit=crop&w=400&q=80', desc: 'Sweet tangy juicy farm tomatoes picked ripe on the vine.' },
    { id: 'PROD_3024', name: 'Fresh Cavendish Bananas (1 Dozen)', cat: 'CAT_110', price: 65.0, unit: '1 dozen', img: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=400&q=80', desc: 'Sweet naturally ripened bananas packed with potassium and energy.' },
    { id: 'PROD_3025', name: 'Shimla Crisp Royal Gala Apples (1kg)', cat: 'CAT_110', price: 180.0, unit: '1kg', img: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=400&q=80', desc: 'Juicy crunchy mountain apples bursting with sweet floral juice.' },

    // Personal Care
    { id: 'PROD_3026', name: 'Himalaya Anti-Dandruff Herbal Shampoo (340ml)', cat: 'CAT_108', price: 290.0, unit: '340ml', img: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=400&q=80', desc: 'Enriched with tea tree oil and aloe vera for gentle scalp care.' },
    { id: 'PROD_3027', name: 'Medimix Ayurvedic 18-Herb Bath Soap (4x100g)', cat: 'CAT_108', price: 165.0, unit: '4 bars', img: 'https://images.unsplash.com/photo-1607006314605-726487217349?auto=format&fit=crop&w=400&q=80', desc: 'Classic ayurvedic handmade cleansing bar with 18 pure herbs.' },
    { id: 'PROD_3028', name: 'Dabur Red Ayurvedic Toothpaste (150g)', cat: 'CAT_108', price: 98.0, unit: '150g', img: 'https://images.unsplash.com/photo-1559591937-e1032c525166?auto=format&fit=crop&w=400&q=80', desc: 'Traditional clove and mint dental paste protecting gums and teeth.' }
  ];

  for (const p of catalogProducts) {
    if (!productSet.has(p.id)) {
      productSet.add(p.id);
      insertProduct.run(p.id, p.name, p.cat, p.price, p.unit, p.img, p.desc);
    }
  }

  // -------------------------------------------------------------------------
  // Realistic Retail Market Basket Companion Item Enrichments
  // -------------------------------------------------------------------------
  // Retail grocery stores have clear co-occurrence patterns:
  // - Wheat Flour (PROD_2001) <-> Cooking Oil (PROD_2003) & Sugar (PROD_2009)
  // - Basmati Rice (PROD_2005) <-> Toor Dal (PROD_2007) & Cooking Oil (PROD_2003)
  // - Smart Bulb (PROD_2000) <-> USB Cable (PROD_2002)
  // - Bluetooth Speaker (PROD_2004) <-> Earbuds (PROD_2011) & Power Bank (PROD_2013)
  // - Denim Jeans (PROD_2006) <-> Cotton T-Shirt (PROD_2010) & Socks Pack (PROD_2015)
  // - Track Pants (PROD_2008) <-> Cotton T-Shirt (PROD_2010)
  // - Generic Item 1 (PROD_2012) <-> Generic Item 2 (PROD_2014)

  const companionRules = {
    'PROD_2001': [
      { prodId: 'PROD_2003', price: 137.0, prob: 0.65 }, // Cooking Oil
      { prodId: 'PROD_2009', price: 518.72, prob: 0.45 } // Sugar
    ],
    'PROD_2005': [
      { prodId: 'PROD_2007', price: 201.07, prob: 0.70 }, // Toor Dal
      { prodId: 'PROD_2003', price: 137.0, prob: 0.50 }  // Cooking Oil
    ],
    'PROD_2000': [
      { prodId: 'PROD_2002', price: 909.86, prob: 0.68 }  // USB Cable
    ],
    'PROD_2004': [
      { prodId: 'PROD_2011', price: 1261.69, prob: 0.62 }, // Earbuds
      { prodId: 'PROD_2013', price: 4201.32, prob: 0.35 }  // Power Bank
    ],
    'PROD_2006': [
      { prodId: 'PROD_2010', price: 1591.59, prob: 0.64 }, // Cotton T-Shirt
      { prodId: 'PROD_2015', price: 554.92, prob: 0.48 }   // Socks Pack
    ],
    'PROD_2008': [
      { prodId: 'PROD_2010', price: 1591.59, prob: 0.58 }  // Cotton T-Shirt
    ],
    'PROD_2012': [
      { prodId: 'PROD_2014', price: 95.68, prob: 0.72 }    // Generic Item 2
    ]
  };

  const updateOrderTotalStmt = db.prepare(`
    UPDATE orders SET total_amount = total_amount + ? WHERE order_id = ?
  `);

  let addedCompanionCount = 0;
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rules = companionRules[row.product_id];
    if (rules) {
      for (let rIndex = 0; rIndex < rules.length; rIndex++) {
        const rule = rules[rIndex];
        // Use deterministic pseudo-random based on order_id
        const hash = (i * 31 + rIndex * 17) % 100;
        if (hash < rule.prob * 100) {
          const compItemId = `ITEM_COMP_${row.order_id}_${rIndex}`;
          const compQty = ((i + rIndex) % 3) + 1;
          const compLineTotal = compQty * rule.price;

          insertOrderItem.run(compItemId, row.order_id, rule.prodId, compQty, rule.price);
          updateOrderTotalStmt.run(compLineTotal, row.order_id);
          addedCompanionCount++;
        }
      }
    }
  }

  console.log(`Attached ${addedCompanionCount} realistic companion items to orders for Market Basket Mining.`);

  db.exec('COMMIT;');

  console.log(`Seeded OLTP:`);
  console.log(`- Customers: ${customerSet.size}`);
  console.log(`- Categories: ${categorySet.size}`);
  console.log(`- Products: ${productSet.size}`);
  console.log(`- Stores: ${storeSet.size}`);
  console.log(`- Orders: ${orderSet.size}`);
  console.log(`- Base Items: ${rawRows.length} + ${addedCompanionCount} companions`);

  // Run initial ETL pipeline to populate Data Warehouse (OLAP Fact Constellation)
  console.log('\n--- Executing Automated Initial ETL to Populate Data Warehouse ---');
  const etlResult = runETL({ incremental: false });
  console.log(`ETL Status: ${etlResult.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`- Duration: ${etlResult.durationMs}ms`);
  console.log(`- Fact_Sales rows loaded: ${etlResult.salesLoaded}`);
  console.log(`- Fact_Budget_Performance rows loaded: ${etlResult.budgetFactsLoaded}`);

  console.log('\n=== Database & Data Warehouse Initialization Complete! ===');
}

seed().catch(err => {
  console.error('Seeding fatal error:', err);
  process.exit(1);
});
