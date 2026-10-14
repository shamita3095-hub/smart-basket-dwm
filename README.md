# SmartBasket DWM 🛒📊
### Intelligent Full-Stack Retail Platform & Data Warehousing/Mining Architecture

SmartBasket DWM is a production-grade retail intelligence platform that unifies operational transactional processing (OLTP), real-time automated ETL pipelining, multidimensional OLAP data warehousing (Star Schema), and data mining algorithms into an interactive React dashboard.

---

## 🌟 Key Features

### 1. Operational E-Commerce & Retail Experience (OLTP)
- **Product Catalog & Live Search:** Dynamic multi-category catalog across Electronics, Groceries, Bakery, Dairy, Personal Care, and Household essentials.
- **Smart Shopping List:** Personalized checklist per customer with item fulfillment tracking and automated budget estimations.
- **Interactive Budget Planner:** Real-time monthly spend monitoring, variance indicators, and dynamic spending limit adjustments.
- **Cart & Order Processing:** Real-time checkout with multiple payment methods (UPI, Card, Cash) and multi-store outlet selection.

### 2. Automated ETL Pipeline & Dimensional Modeling
- **Extract:** Captures newly settled orders and operational transactions.
- **Transform:** Cleanses and parses timestamps into conformed temporal dimensions (`Dim_Date`), calculates RFM segmentation metrics, and maps surrogate dimension keys.
- **Load:** Ingestion into a high-performance Star Schema comprising:
  - **Dimensions:** `Dim_Customer`, `Dim_Product`, `Dim_Store`, `Dim_Category`, `Dim_Date`
  - **Fact Tables:** `Fact_Sales` (grain: line-item per order) and `Fact_Budget_Performance` (grain: monthly budget tracking per customer)

### 3. Interactive OLAP Analytics Suite
- **KPI Metrics:** Total Revenue, Order Volume, AOV (Average Order Value), and Average Budget Variance.
- **Drill-Down / Roll-Up:** Multi-level hierarchical temporal drill-down: **Year ➔ Quarter ➔ Month ➔ Day**.
- **Slice & Dice:** Multi-dimensional filtering by Category, Store Format (Mall, Supermarket, Local Store), City, and Customer RFM Segment.
- **Pivot Matrix (Cross-Tabulation):** Interactive multidimensional aggregations across flexible row and column dimensions.

### 4. Data Mining & Machine Learning
- **Market Basket Analysis (Apriori Algorithm):** Generates association rules based on Support, Confidence, and Lift metrics to uncover item affinity patterns.
- **Real-Time Recommendation Engine:** Suggests companion add-ons in the shopping cart based on high-lift association rules.
- **Customer RFM Segmentation:** Classifies customers into Premium, Gold, Regular, and Budget cohorts for targeted retail strategies.

---

## 🛠️ Architecture & Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS, Lucide Icons
- **Backend:** Node.js, Express.js
- **Database / Warehouse:** SQLite (WAL Mode, ACID compliant, native `node:sqlite`)
- **Dataset:** 5,000+ Indian Retail Store records across 10 normalized tables

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+ or v24+ recommended)
- npm (v10+)

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/shamitachavan38-hue/smart-basket-dwm.git
   cd smart-basket-dwm
   ```

2. **Install Server Dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Install Client Dependencies:**
   ```bash
   cd ../client
   npm install
   ```

4. **Seed Database & Run ETL Pipeline:**
   ```bash
   cd ../server
   npm run seed
   ```

5. **Start the Application:**
   - **Start Backend Server:**
     ```bash
     cd server
     node server.js
     ```
     Backend runs at: `http://localhost:5000`

   - **Start Frontend Dev Server:**
     ```bash
     cd client
     npm run dev
     ```
     Frontend runs at: `http://localhost:5173`

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
