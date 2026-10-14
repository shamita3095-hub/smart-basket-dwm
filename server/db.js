const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'smartbasket.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for high performance
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function initSchema() {
  db.exec(`
    -- ============================================================
    -- OPERATIONAL LAYER (OLTP - 10 RELATIONAL TABLES)
    -- ============================================================

    -- 1. Customers
    CREATE TABLE IF NOT EXISTS customers (
      customer_id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      email TEXT,
      city TEXT
    );

    -- 2. Categories
    CREATE TABLE IF NOT EXISTS categories (
      category_id TEXT PRIMARY KEY,
      product_category TEXT NOT NULL
    );

    -- 3. Products
    CREATE TABLE IF NOT EXISTS products (
      product_id TEXT PRIMARY KEY,
      product_name TEXT NOT NULL,
      category_id TEXT NOT NULL,
      unit_price REAL NOT NULL,
      unit TEXT DEFAULT 'unit',
      image TEXT,
      description TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(category_id)
    );

    -- 4. Stores
    CREATE TABLE IF NOT EXISTS stores (
      store_id TEXT PRIMARY KEY,
      store_type TEXT NOT NULL,
      city TEXT NOT NULL
    );

    -- 5. Orders
    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'COMPLETED',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_etl_synced INTEGER DEFAULT 0,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
      FOREIGN KEY (store_id) REFERENCES stores(store_id)
    );

    -- 6. Order_Items
    CREATE TABLE IF NOT EXISTS order_items (
      order_item_id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(order_id),
      FOREIGN KEY (product_id) REFERENCES products(product_id)
    );

    -- 7. Shopping_Lists
    CREATE TABLE IF NOT EXISTS shopping_lists (
      shopping_list_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      list_name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );

    -- 8. Shopping_List_Items
    CREATE TABLE IF NOT EXISTS shopping_list_items (
      shopping_list_item_id TEXT PRIMARY KEY,
      shopping_list_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists(shopping_list_id),
      FOREIGN KEY (product_id) REFERENCES products(product_id)
    );

    -- 9. Budgets
    CREATE TABLE IF NOT EXISTS budgets (
      customer_id TEXT NOT NULL,
      monthly_budget REAL NOT NULL,
      month_year TEXT NOT NULL,
      PRIMARY KEY (customer_id, month_year),
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );

    -- 10. Payments
    CREATE TABLE IF NOT EXISTS payments (
      payment_id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT DEFAULT 'SUCCESS',
      payment_date TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(order_id)
    );

    -- ============================================================
    -- ANALYTICAL LAYER (OLAP - FACT CONSTELLATION SCHEMA)
    -- ============================================================

    -- Conformed Dimensions
    CREATE TABLE IF NOT EXISTS dim_customer (
      customer_key INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      city TEXT NOT NULL,
      segment TEXT DEFAULT 'Regular'
    );

    CREATE TABLE IF NOT EXISTS dim_product (
      product_key INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT UNIQUE NOT NULL,
      product_name TEXT NOT NULL,
      category_id TEXT NOT NULL,
      category_name TEXT NOT NULL,
      unit_price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dim_category (
      category_key INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id TEXT UNIQUE NOT NULL,
      product_category TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dim_store (
      store_key INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id TEXT UNIQUE NOT NULL,
      store_type TEXT NOT NULL,
      city TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dim_date (
      date_id INTEGER PRIMARY KEY,
      full_date TEXT UNIQUE NOT NULL,
      day INTEGER NOT NULL,
      month INTEGER NOT NULL,
      month_name TEXT NOT NULL,
      quarter INTEGER NOT NULL,
      year INTEGER NOT NULL,
      day_of_week TEXT NOT NULL
    );

    -- Fact Table 1: Fact_Sales
    CREATE TABLE IF NOT EXISTS fact_sales (
      sale_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      order_item_id TEXT NOT NULL,
      date_id INTEGER NOT NULL,
      customer_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_amount REAL NOT NULL,
      FOREIGN KEY (date_id) REFERENCES dim_date(date_id),
      FOREIGN KEY (customer_id) REFERENCES dim_customer(customer_id),
      FOREIGN KEY (product_id) REFERENCES dim_product(product_id),
      FOREIGN KEY (category_id) REFERENCES dim_category(category_id),
      FOREIGN KEY (store_id) REFERENCES dim_store(store_id)
    );

    -- Fact Table 2: Fact_Budget_Performance
    CREATE TABLE IF NOT EXISTS fact_budget_performance (
      budget_fact_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id TEXT NOT NULL,
      date_id INTEGER NOT NULL,
      month_year TEXT NOT NULL,
      monthly_budget REAL NOT NULL,
      actual_spent REAL NOT NULL,
      variance_amount REAL NOT NULL,
      utilization_rate REAL NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (date_id) REFERENCES dim_date(date_id),
      FOREIGN KEY (customer_id) REFERENCES dim_customer(customer_id)
    );

    -- ETL Audit Table
    CREATE TABLE IF NOT EXISTS etl_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_timestamp TEXT NOT NULL,
      status TEXT NOT NULL,
      extracted_count INTEGER DEFAULT 0,
      sales_loaded_count INTEGER DEFAULT 0,
      budget_facts_loaded_count INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      log_details TEXT
    );

    -- Indices for high performance OLAP queries
    CREATE INDEX IF NOT EXISTS idx_fact_sales_date ON fact_sales(date_id);
    CREATE INDEX IF NOT EXISTS idx_fact_sales_category ON fact_sales(category_id);
    CREATE INDEX IF NOT EXISTS idx_fact_sales_store ON fact_sales(store_id);
    CREATE INDEX IF NOT EXISTS idx_fact_sales_customer ON fact_sales(customer_id);
    CREATE INDEX IF NOT EXISTS idx_fact_sales_product ON fact_sales(product_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  `);
}

module.exports = {
  db,
  initSchema
};
