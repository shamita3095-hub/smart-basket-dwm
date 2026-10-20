import React, { useState, useEffect } from 'react';
import {
  Database,
  BarChart3,
  TrendingUp,
  Layers,
  Sparkles,
  RefreshCw,
  Sliders,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  Clock,
  Calendar,
  Grid,
  Info,
  Users,
  Building,
  Tag,
  Hash
} from 'lucide-react';
import {
  fetchKPIs,
  fetchTimeDrillDown,
  fetchSliceAndDice,
  fetchPivot,
  fetchMarketBasketRules,
  fetchBudgetIntelligence,
  fetchCustomerSegments,
  fetchConstellationSchema,
  runETLPipeline,
  fetchETLHistory
} from '../api';

export default function AnalyticsSuite({ activeCustomer }) {
  const [subTab, setSubTab] = useState('kpis'); // 'kpis', 'schema', 'olap', 'mining', 'etl'
  const [loading, setLoading] = useState(false);

  // Data states
  const [kpis, setKpis] = useState(null);
  const [schemaInfo, setSchemaInfo] = useState(null);

  // OLAP Drill-down state
  const [drillLevel, setDrillLevel] = useState('year'); // 'year', 'quarter', 'month', 'day'
  const [selectedYear, setSelectedYear] = useState('2025');
  const [selectedQuarter, setSelectedQuarter] = useState('1');
  const [selectedMonth, setSelectedMonth] = useState('11');
  const [drillData, setDrillData] = useState([]);

  // OLAP Slice & Dice state
  const [sliceCategory, setSliceCategory] = useState('');
  const [sliceStoreType, setSliceStoreType] = useState('');
  const [sliceCity, setSliceCity] = useState('');
  const [sliceSegment, setSliceSegment] = useState('');
  const [sliceData, setSliceData] = useState(null);

  // OLAP Pivot state
  const [pivotRow, setPivotRow] = useState('category');
  const [pivotCol, setPivotCol] = useState('store_type');
  const [pivotData, setPivotData] = useState(null);

  // Data Mining state
  const [minSupport, setMinSupport] = useState(0.5); // %
  const [minConfidence, setMinConfidence] = useState(25); // %
  const [miningRules, setMiningRules] = useState([]);
  const [budgetIntel, setBudgetIntel] = useState(null);
  const [customerSegments, setCustomerSegments] = useState([]);

  // ETL Pipeline state
  const [isETLRunning, setIsETLRunning] = useState(false);
  const [etlLogs, setEtlLogs] = useState([]);
  const [etlHistory, setEtlHistory] = useState([]);
  const [lastRunStats, setLastRunStats] = useState(null);

  // Load Initial KPIs & Schema
  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const [kpiRes, schemaRes, etlHist] = await Promise.all([
        fetchKPIs(),
        fetchConstellationSchema(),
        fetchETLHistory()
      ]);
      setKpis(kpiRes);
      setSchemaInfo(schemaRes);
      setEtlHistory(etlHist || []);
    } catch (err) {
      console.error('Error loading overview:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Drill-down data
  useEffect(() => {
    if (subTab === 'olap') {
      loadDrillDown();
    }
  }, [subTab, drillLevel, selectedYear, selectedQuarter, selectedMonth]);

  const loadDrillDown = async () => {
    try {
      const res = await fetchTimeDrillDown({
        level: drillLevel,
        year: selectedYear,
        quarter: selectedQuarter,
        month: selectedMonth
      });
      setDrillData(res?.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Load Slice & Dice
  useEffect(() => {
    if (subTab === 'olap') {
      loadSliceAndDice();
    }
  }, [subTab, sliceCategory, sliceStoreType, sliceCity, sliceSegment]);

  const loadSliceAndDice = async () => {
    try {
      const res = await fetchSliceAndDice({
        categoryId: sliceCategory,
        storeType: sliceStoreType,
        city: sliceCity,
        segment: sliceSegment
      });
      setSliceData(res);
    } catch (err) {
      console.error(err);
    }
  };

  // Load Pivot
  useEffect(() => {
    if (subTab === 'olap') {
      loadPivot();
    }
  }, [subTab, pivotRow, pivotCol]);

  const loadPivot = async () => {
    try {
      const res = await fetchPivot(pivotRow, pivotCol);
      setPivotData(res);
    } catch (err) {
      console.error(err);
    }
  };

  // Load Mining Data
  useEffect(() => {
    if (subTab === 'mining') {
      loadMining();
    }
  }, [subTab, minSupport, minConfidence, activeCustomer]);

  const loadMining = async () => {
    try {
      const [rulesRes, budgetRes, segRes] = await Promise.all([
        fetchMarketBasketRules({
          minSupport: minSupport / 100,
          minConfidence: minConfidence / 100,
          limit: 30
        }),
        fetchBudgetIntelligence(activeCustomer?.customer_id),
        fetchCustomerSegments()
      ]);
      setMiningRules(rulesRes?.rules || []);
      setBudgetIntel(budgetRes);
      setCustomerSegments(segRes || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger ETL Execution
  const handleTriggerETL = async (incremental = false) => {
    setIsETLRunning(true);
    setEtlLogs([`Initiating ${incremental ? 'Incremental' : 'Full'} ETL Pipeline...`]);
    try {
      const res = await runETLPipeline(incremental);
      setLastRunStats(res);
      setEtlLogs(res.logs || ['ETL executed successfully.']);
      // Refresh KPIs and ETL history
      loadOverview();
    } catch (err) {
      setEtlLogs(prev => [...prev, `[ERROR] ${err.message}`]);
    } finally {
      setIsETLRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Academic Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-800/40">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-semibold border border-indigo-400/20">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>Academic Data Warehousing & Mining (DWM) Demonstration Suite</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              SmartBasket Analytics & OLAP Constellation
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl">
              End-to-end analytical query engine powered by a Conformed Fact Constellation schema, Apriori market basket co-occurrence mining, and automated ETL staging.
            </p>
          </div>

          {/* Quick ETL Run Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleTriggerETL(false)}
              disabled={isETLRunning}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isETLRunning ? 'animate-spin' : ''}`} />
              <span>Run Automated ETL</span>
            </button>
          </div>
        </div>

        {/* Subtab Navigation Pills */}
        <div className="flex items-center gap-2 mt-6 pt-6 border-t border-indigo-800/60 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'kpis', label: 'Executive KPIs', icon: BarChart3 },
            { id: 'schema', label: 'Fact Constellation Schema', icon: Layers },
            { id: 'olap', label: 'OLAP Operations (Roll-up / Slice / Pivot)', icon: Sliders },
            { id: 'mining', label: 'Data Mining (Apriori & Budget AI)', icon: Sparkles },
            { id: 'etl', label: 'ETL Pipeline Console', icon: RefreshCw }
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-white text-indigo-950 shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. EXECUTIVE KPIS VIEW                                                    */}
      {/* ========================================================================= */}
      {subTab === 'kpis' && kpis && (
        <div className="space-y-6">
          {/* Warehouse Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Warehouse Revenue
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                ₹{Number(kpis.revenue).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <span className="text-xs text-emerald-600 font-semibold mt-1 block">
                Strictly queried from Fact_Sales
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Units Sold
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {Number(kpis.unitsSold).toLocaleString()}
              </div>
              <span className="text-xs text-slate-500 mt-1 block">
                Across {kpis.orders} completed transactions
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Warehouse Shoppers
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-2">
                <span>{Number(kpis.registeredCustomers || kpis.activeCustomers).toLocaleString()}</span>
                {kpis.newShoppers > 0 && (
                  <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                    {kpis.newShoppers} New
                  </span>
                )}
              </div>
              <span className="text-xs text-indigo-600 font-semibold mt-1 block">
                {kpis.activeCustomers} Purchasing in Fact_Sales
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Budget Adherence Rate
              </span>
              <div className="text-2xl font-black text-emerald-700 mt-1">
                {kpis.budgetAdherenceRate}%
              </div>
              <span className="text-xs text-slate-500 mt-1 block">
                {kpis.budgetStats.underBudget} within / {kpis.budgetStats.overBudget} exceeded
              </span>
            </div>
          </div>

          {/* Revenue by Category & Store Type */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  <span>Category Revenue Breakdown (Dim_Category × Fact_Sales)</span>
                </h3>
              </div>
              <div className="space-y-3">
                {kpis.categoryBreakdown.map((cat) => {
                  const pct = (cat.revenue / kpis.revenue) * 100;
                  return (
                    <div key={cat.product_category} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-800">{cat.product_category}</span>
                        <span className="text-slate-900">
                          ₹{Number(cat.revenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Store Type Breakdown */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-600" />
                  <span>Store Outlet Performance (Dim_Store × Fact_Sales)</span>
                </h3>
              </div>
              <div className="space-y-3">
                {kpis.storeBreakdown.map((st) => {
                  const pct = (st.revenue / kpis.revenue) * 100;
                  return (
                    <div key={st.store_type} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-800">{st.store_type}</span>
                        <span className="text-slate-900">
                          ₹{Number(st.revenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Live Data Warehouse Shopper Dimension & Budget Registry */}
          {kpis.recentCustomers && kpis.recentCustomers.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>Conformed Dimension: Recent Shoppers & New User Data (Dim_Customer & Budgets)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Newly registered shoppers, customer RFM segmentation tags, and allocated monthly spending limits.
                  </p>
                </div>
                <span className="text-[11px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-1 rounded-full border border-emerald-300">
                  Live Database Sync
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Customer ID</th>
                      <th className="py-2.5 px-3">Customer Name</th>
                      <th className="py-2.5 px-3">City</th>
                      <th className="py-2.5 px-3">Warehouse RFM Segment</th>
                      <th className="py-2.5 px-3 text-right">Allocated Monthly Budget</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {kpis.recentCustomers.map((cust) => (
                      <tr key={cust.customer_id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{cust.customer_id}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{cust.customer_name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{cust.city}</td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                            cust.segment === 'New Shopper'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : cust.segment === 'Premium'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {cust.segment || 'New Shopper'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-800">
                          ₹{Number(cust.monthly_budget || 10000).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. FACT CONSTELLATION SCHEMA ARCHITECTURE VIEW                            */}
      {/* ========================================================================= */}
      {subTab === 'schema' && schemaInfo && (
        <div className="space-y-6">
          {/* Architecture Explanation Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Fact Constellation Schema (Galaxy Schema) Architecture
              </h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Unlike a simple Star Schema with only one fact table, SmartBasket implements a sophisticated <strong>Fact Constellation Schema</strong>. Multiple fact tables (<code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded text-[11px]">Fact_Sales</code> and <code className="text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded text-[11px]">Fact_Budget_Performance</code>) share <strong>conformed dimensions</strong> (<code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded text-[11px]">Dim_Customer</code> and <code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded text-[11px]">Dim_Date</code>), allowing cross-functional analysis between operational retail sales and customer financial budget tracking.
            </p>
          </div>

          {/* Interactive Constellation Schema Visualizer */}
          <div className="bg-slate-950 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl overflow-x-auto">
            <div className="min-w-[750px] space-y-8">
              {/* Conformed Dimensions Header */}
              <div className="text-center">
                <span className="text-[11px] uppercase tracking-widest text-emerald-400 font-extrabold bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800/60">
                  Shared / Conformed Dimension Layer
                </span>
              </div>

              {/* Conformed Dimensions Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {schemaInfo.conformedDimensions.map((dim) => (
                  <div
                    key={dim.name}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md hover:border-emerald-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                      <span className="text-xs font-bold text-emerald-300">{dim.name}</span>
                      <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded">PK: {dim.primaryKey}</span>
                    </div>
                    <ul className="mt-2 space-y-0.5 text-[10px] text-slate-400">
                      {dim.attributes.map((attr) => (
                        <li key={attr} className="font-mono flex items-center gap-1">
                          <span className="text-emerald-500">•</span> {attr}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 pt-1 border-t border-slate-800/60 text-[9px] text-indigo-300">
                      Shared by: {dim.sharedBy.join(', ')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Connecting Arrows */}
              <div className="flex justify-around text-slate-600 text-xs font-mono select-none">
                <div className="flex flex-col items-center">
                  <span>↓ Foreign Keys (date_id, customer_id, product_id, category_id, store_id) ↓</span>
                </div>
              </div>

              {/* 2 Fact Tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Fact Table 1: Fact_Sales */}
                <div className="bg-gradient-to-b from-slate-900 to-emerald-950/40 border-2 border-emerald-500/40 rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                      <h4 className="font-black text-sm text-emerald-300">FACT TABLE 1: Fact_Sales</h4>
                    </div>
                    <span className="text-[10px] bg-emerald-900 text-emerald-200 font-bold px-2 py-0.5 rounded">
                      Grain: Line-Item Order
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Foreign Keys (FK)
                      </span>
                      <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-slate-300">
                        {schemaInfo.factTables[0].foreignKeys.map((fk) => (
                          <li key={fk} className="text-emerald-400/90">🔑 {fk}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Measures (Numeric Facts)
                      </span>
                      <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-amber-300">
                        {schemaInfo.factTables[0].measures.map((m) => (
                          <li key={m}>Σ {m}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Fact Table 2: Fact_Budget_Performance */}
                <div className="bg-gradient-to-b from-slate-900 to-indigo-950/40 border-2 border-indigo-500/40 rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between pb-2 border-b border-indigo-500/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse"></div>
                      <h4 className="font-black text-sm text-indigo-300">FACT TABLE 2: Fact_Budget_Performance</h4>
                    </div>
                    <span className="text-[10px] bg-indigo-900 text-indigo-200 font-bold px-2 py-0.5 rounded">
                      Grain: Customer Month
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Foreign Keys (FK)
                      </span>
                      <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-slate-300">
                        {schemaInfo.factTables[1].foreignKeys.map((fk) => (
                          <li key={fk} className="text-indigo-400/90">🔑 {fk}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Measures (Numeric Facts)
                      </span>
                      <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-amber-300">
                        {schemaInfo.factTables[1].measures.map((m) => (
                          <li key={m}>Σ {m}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. OLAP OPERATIONS (ROLL-UP / DRILL-DOWN / SLICE & DICE / PIVOT)          */}
      {/* ========================================================================= */}
      {subTab === 'olap' && (
        <div className="space-y-6">
          {/* Operation 1: Roll-up & Drill-down */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Interactive Time Hierarchy: Roll-up & Drill-down</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Navigate temporal granularities: <span className="font-semibold text-slate-700">Year (2025/2026) → Quarter (Q1..Q4) → Month → Day</span>
                </p>
              </div>

              {/* Hierarchy Granularity Selector */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setDrillLevel('year')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    drillLevel === 'year' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Year
                </button>
                <button
                  onClick={() => setDrillLevel('quarter')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    drillLevel === 'quarter' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Quarter
                </button>
                <button
                  onClick={() => setDrillLevel('month')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    drillLevel === 'month' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setDrillLevel('day')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    drillLevel === 'day' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Day
                </button>
              </div>
            </div>

            {/* Drill-down Breadcrumb Filters */}
            {(drillLevel === 'quarter' || drillLevel === 'month' || drillLevel === 'day') && (
              <div className="flex items-center gap-3 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-500">Filter Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-white border border-slate-200 px-2 py-1 rounded-lg font-semibold text-slate-800"
                >
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>

                {drillLevel === 'month' && (
                  <>
                    <span className="font-bold text-slate-500 ml-2">Quarter:</span>
                    <select
                      value={selectedQuarter}
                      onChange={(e) => setSelectedQuarter(e.target.value)}
                      className="bg-white border border-slate-200 px-2 py-1 rounded-lg font-semibold text-slate-800"
                    >
                      <option value="1">Q1</option>
                      <option value="2">Q2</option>
                      <option value="3">Q3</option>
                      <option value="4">Q4</option>
                    </select>
                  </>
                )}
              </div>
            )}

            {/* Drill-down Results Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Time Attribute ({drillLevel})</th>
                    <th className="py-2.5 px-3 text-right">Revenue (Fact_Sales)</th>
                    <th className="py-2.5 px-3 text-right">Units Sold</th>
                    <th className="py-2.5 px-3 text-right">Total Orders</th>
                    <th className="py-2.5 px-3 text-right">Unique Customers</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {drillData.map((row) => (
                    <tr key={row.label} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{row.label}</td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        ₹{Number(row.revenue).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-700">{row.units}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-700">{row.orders}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-700">{row.unique_customers}</td>
                      <td className="py-2.5 px-3 text-center">
                        {row.next_level ? (
                          <button
                            onClick={() => {
                              if (drillLevel === 'year') {
                                setSelectedYear(row.id);
                                setDrillLevel('quarter');
                              } else if (drillLevel === 'quarter') {
                                setSelectedQuarter(row.id);
                                setDrillLevel('month');
                              } else if (drillLevel === 'month') {
                                setSelectedMonth(row.id);
                                setDrillLevel('day');
                              }
                            }}
                            className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded text-[11px] inline-flex items-center gap-1"
                          >
                            <span>Drill down to {row.next_level}</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">Base Grain</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operation 2: Slice & Dice Multi-dimensional Filtering */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>Multi-Dimensional Slicing & Dicing</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Slice fact records across conformed dimensions: Category, Store Type, City, and Customer Segment.
              </p>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Category Slice</label>
                <select
                  value={sliceCategory}
                  onChange={(e) => setSliceCategory(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-medium text-slate-800"
                >
                  <option value="">All Categories</option>
                  <option value="CAT_100">Electronics</option>
                  <option value="CAT_101">Grocery</option>
                  <option value="CAT_102">Clothing</option>
                  <option value="CAT_103">Stationery</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Store Type Slice</label>
                <select
                  value={sliceStoreType}
                  onChange={(e) => setSliceStoreType(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-medium text-slate-800"
                >
                  <option value="">All Store Types</option>
                  <option value="Mall Store">Mall Store</option>
                  <option value="Supermarket">Supermarket</option>
                  <option value="Local Store">Local Store</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">City Slice</label>
                <select
                  value={sliceCity}
                  onChange={(e) => setSliceCity(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-medium text-slate-800"
                >
                  <option value="">All Cities</option>
                  <option value="Nashik">Nashik</option>
                  <option value="Bilaspur">Bilaspur</option>
                  <option value="Bhopal">Bhopal</option>
                  <option value="Indore">Indore</option>
                  <option value="Meerut">Meerut</option>
                  <option value="Kolkata">Kolkata</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Segment Slice</label>
                <select
                  value={sliceSegment}
                  onChange={(e) => setSliceSegment(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-medium text-slate-800"
                >
                  <option value="">All Segments</option>
                  <option value="New Shopper">New Shopper</option>
                  <option value="Premium">Premium</option>
                  <option value="Gold">Gold</option>
                  <option value="Regular">Regular</option>
                  <option value="Budget">Budget</option>
                </select>
              </div>
            </div>

            {/* Sliced Aggregation Summary */}
            {sliceData && sliceData.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase">Sliced Revenue</span>
                  <div className="text-lg font-black text-emerald-950 mt-0.5">
                    ₹{Number(sliceData.summary.total_revenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Sliced Units</span>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {Number(sliceData.summary.total_units).toLocaleString()}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Sliced Orders</span>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {Number(sliceData.summary.total_orders).toLocaleString()}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Unique Customers</span>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {Number(sliceData.summary.total_customers).toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Operation 3: Pivot / Cross-Tabulation Matrix */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Grid className="w-4 h-4 text-purple-600" />
                  <span>OLAP Pivot / Cross-Tabulation Matrix</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Multi-way cross-tabulation table with dynamic row and column dimensional aggregation.
                </p>
              </div>

              {/* Dimension Switchers */}
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-slate-500">Rows:</span>
                  <select
                    value={pivotRow}
                    onChange={(e) => setPivotRow(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-bold"
                  >
                    <option value="category">Category</option>
                    <option value="store_type">Store Type</option>
                    <option value="segment">Segment</option>
                    <option value="year">Year</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="font-bold text-slate-500">Cols:</span>
                  <select
                    value={pivotCol}
                    onChange={(e) => setPivotCol(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-bold"
                  >
                    <option value="store_type">Store Type</option>
                    <option value="quarter">Quarter</option>
                    <option value="segment">Segment</option>
                    <option value="category">Category</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Cross-tab Table */}
            {pivotData && (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 bg-slate-200/60 font-black">
                        {pivotRow.toUpperCase()} \ {pivotCol.toUpperCase()}
                      </th>
                      {pivotData.cols.map((c) => (
                        <th key={c} className="py-2.5 px-3 text-right">{c}</th>
                      ))}
                      <th className="py-2.5 px-3 text-right bg-slate-200/80 font-black">Row Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pivotData.rows.map((r) => (
                      <tr key={r} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900 bg-slate-50/50">{r}</td>
                        {pivotData.cols.map((c) => {
                          const cell = pivotData.cells[`${r}___${c}`];
                          return (
                            <td key={c} className="py-2.5 px-3 text-right font-medium text-slate-800">
                              {cell ? `₹${Number(cell.revenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-right font-black text-slate-950 bg-slate-100/50">
                          ₹{Number(pivotData.rowTotals[r] || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                    {/* Column Totals Row */}
                    <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                      <td className="py-2.5 px-3 text-slate-900">COLUMN TOTAL</td>
                      {pivotData.cols.map((c) => (
                        <td key={c} className="py-2.5 px-3 text-right text-slate-900">
                          ₹{Number(pivotData.colTotals[c] || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                      ))}
                      <td className="py-2.5 px-3 text-right text-emerald-800 font-black bg-emerald-100">
                        ₹{Number(pivotData.grandTotalRevenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DATA MINING LOGIC (APRIORI ASSOCIATION RULES & BUDGET INTELLIGENCE)    */}
      {/* ========================================================================= */}
      {subTab === 'mining' && (
        <div className="space-y-6">
          {/* Apriori Association Rules Section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Market Basket Analysis: Apriori Association Rules</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mining co-occurrences in <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded text-[11px]">Order_Items</code>: Support, Confidence, and Lift metrics.
                </p>
              </div>

              {/* Threshold Sliders */}
              <div className="flex items-center gap-4 text-xs bg-slate-50 p-2 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-600">Min Support:</span>
                  <input
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={minSupport}
                    onChange={(e) => setMinSupport(parseFloat(e.target.value))}
                    className="w-20 accent-indigo-600"
                  />
                  <span className="font-black text-indigo-700 w-8">{minSupport}%</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-600">Min Confidence:</span>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                    className="w-20 accent-indigo-600"
                  />
                  <span className="font-black text-indigo-700 w-8">{minConfidence}%</span>
                </div>
              </div>
            </div>

            {/* Rules Table */}
            {miningRules.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No association rules meet the selected thresholds. Try lowering Min Support or Min Confidence.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Rule Antecedent (X)</th>
                      <th className="py-2.5 px-3">Rule Consequent (Y)</th>
                      <th className="py-2.5 px-3 text-center">Support (%)</th>
                      <th className="py-2.5 px-3 text-center">Confidence (%)</th>
                      <th className="py-2.5 px-3 text-center">Lift Ratio</th>
                      <th className="py-2.5 px-3">Mining Interpretation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {miningRules.map((rule, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <span className="bg-indigo-50 text-indigo-900 px-2 py-0.5 rounded font-bold">
                            {rule.antecedentName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <span className="bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded font-bold">
                            {rule.consequentName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                          {rule.support}%
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                          {rule.confidence}%
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-indigo-700">
                          <span className="px-2 py-0.5 bg-indigo-100 rounded-full">
                            {rule.lift}x
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                          {rule.explanation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Budget Intelligence & Customer Variance Section */}
          {budgetIntel && (
            <div className="space-y-6">
              {/* Active Customer Budget Intelligence Banner if selected */}
              {budgetIntel.customerProfile && budgetIntel.customerProfile.customer && (
                <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 border border-indigo-700/60 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        Active Shopper Intelligence
                      </span>
                      <span className="text-xs text-indigo-300 font-mono">
                        {budgetIntel.customerProfile.customer.customer_id}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      <span>{budgetIntel.customerProfile.customer.customer_name}</span>
                      <span className="text-xs font-semibold text-slate-300">({budgetIntel.customerProfile.customer.city})</span>
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-indigo-500/30 text-indigo-200">
                        {budgetIntel.customerProfile.customer.segment}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      {budgetIntel.customerProfile.comparisonText || 'Historical spending records in Fact_Budget_Performance are active and monitored in real-time.'}
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 border border-white/15 text-right shrink-0">
                    <span className="text-[10px] text-slate-300 block uppercase font-bold">Historical Monthly Avg</span>
                    <strong className="text-sm font-black text-emerald-300">
                      ₹{Math.round(budgetIntel.customerProfile.historicalAvgSpent || 0).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Budget Overruns */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span>Significant Budget Overruns (Fact_Budget_Performance)</span>
                  </h3>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden text-xs">
                    {budgetIntel.topOverruns.slice(0, 6).map((item, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="font-bold text-slate-800">{item.customer_name} ({item.city})</div>
                          <div className="text-[11px] text-slate-500">
                            Month: {item.month_year} • Budget: ₹{item.monthly_budget}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-rose-600">
                            +₹{Number(item.variance_amount).toFixed(2)}
                          </div>
                          <span className="text-[10px] bg-rose-100 text-rose-800 font-extrabold px-1.5 py-0.2 rounded">
                            {Number(item.utilization_rate).toFixed(0)}% used
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer Segmentation (RFM Mining) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-600" />
                    <span>Customer Clusters & RFM Spend Tiers</span>
                  </h3>
                  <div className="space-y-3">
                    {customerSegments.map((seg) => (
                      <div key={seg.segment} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-black text-slate-900 text-sm flex items-center gap-2">
                            <span>{seg.segment} Segment</span>
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-bold">
                              {seg.customer_count} Customers
                            </span>
                          </div>
                          <div className="text-slate-500 mt-1">
                            Avg Item Revenue: ₹{Number(seg.avg_order_revenue).toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-slate-900">
                            ₹{Number(seg.total_revenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </div>
                          <span className="text-[10px] text-slate-400">Total Segment Revenue</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Fact Table: Fact_Budget_Performance for All Shoppers & New Users */}
              {budgetIntel.recentBudgetFacts && budgetIntel.recentBudgetFacts.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <Database className="w-4 h-4 text-indigo-600" />
                        <span>Data Warehouse Fact Table: <code className="text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded text-xs font-mono">Fact_Budget_Performance</code></span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Live analytical fact measurements across all shoppers, including newly registered user budget performance records.
                      </p>
                    </div>
                    <span className="text-[11px] font-extrabold bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full border border-indigo-200">
                      Live Analytical Grain
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Customer</th>
                          <th className="py-2.5 px-3">Segment</th>
                          <th className="py-2.5 px-3">Month</th>
                          <th className="py-2.5 px-3 text-right">Allocated Budget</th>
                          <th className="py-2.5 px-3 text-right">Actual Spent</th>
                          <th className="py-2.5 px-3 text-right">Variance Amount</th>
                          <th className="py-2.5 px-3 text-right">Utilization</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {budgetIntel.recentBudgetFacts.map((row) => (
                          <tr key={row.budget_fact_id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 block">{row.customer_name}</span>
                              <span className="font-mono text-[10px] text-slate-400">{row.customer_id} • {row.city}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                row.segment === 'New Shopper'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : row.segment === 'Premium'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {row.segment || 'Shopper'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-700">{row.month_year}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              ₹{Number(row.monthly_budget).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-slate-900">
                              ₹{Number(row.actual_spent).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold ${row.variance_amount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                              {row.variance_amount > 0 ? '+' : ''}₹{Number(row.variance_amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                              {Number(row.utilization_rate).toFixed(1)}%
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                row.status === 'OVER_BUDGET'
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : row.status === 'NEAR_LIMIT'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. AUTOMATED ETL PIPELINE CONSOLE                                         */}
      {/* ========================================================================= */}
      {subTab === 'etl' && (
        <div className="space-y-6">
          {/* ETL Action & Terminal Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-600" />
                  <span>Automated Backend ETL Pipeline Controller (/api/etl/run)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stages: <strong>Extract</strong> (Orders & Order_Items) → <strong>Transform</strong> (Dim_Date & foreign keys) → <strong>Load</strong> (Fact_Sales & Fact_Budget_Performance).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTriggerETL(true)}
                  disabled={isETLRunning}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  Incremental Sync
                </button>
                <button
                  onClick={() => handleTriggerETL(false)}
                  disabled={isETLRunning}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isETLRunning ? 'animate-spin' : ''}`} />
                  <span>Run Full ETL Sync</span>
                </button>
              </div>
            </div>

            {/* Execution Metrics (if just run) */}
            {lastRunStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl text-xs">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase">Status</span>
                  <div className="font-black text-emerald-900 text-sm mt-0.5">
                    {lastRunStats.success ? 'SUCCESS' : 'FAILED'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase">Execution Time</span>
                  <div className="font-black text-emerald-900 text-sm mt-0.5">
                    {lastRunStats.durationMs}ms
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase">Fact_Sales Loaded</span>
                  <div className="font-black text-emerald-900 text-sm mt-0.5">
                    {lastRunStats.salesLoaded} records
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase">Budget Facts Loaded</span>
                  <div className="font-black text-emerald-900 text-sm mt-0.5">
                    {lastRunStats.budgetFactsLoaded} records
                  </div>
                </div>
              </div>
            )}

            {/* Terminal Log Console */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700">Real-time Execution Terminal Logs:</span>
              <div className="bg-slate-950 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-64 overflow-y-auto space-y-1 border border-slate-800">
                {etlLogs.length === 0 ? (
                  <span className="text-slate-500">Pipeline ready. Click "Run Full ETL Sync" to execute.</span>
                ) : (
                  etlLogs.map((log, i) => (
                    <div key={i} className="leading-relaxed">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Historical ETL Run Audit Table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">ETL Audit History (<code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded text-[11px]">etl_runs</code> table)</h3>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Run ID</th>
                    <th className="py-2 px-3">Timestamp</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Extracted</th>
                    <th className="py-2 px-3 text-right">Sales Facts</th>
                    <th className="py-2 px-3 text-right">Budget Facts</th>
                    <th className="py-2 px-3 text-right">Duration (ms)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {etlHistory.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">#{run.id}</td>
                      <td className="py-2 px-3 text-slate-600">{new Date(run.run_timestamp).toLocaleString()}</td>
                      <td className="py-2 px-3">
                        <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                          run.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-medium">{run.extracted_count}</td>
                      <td className="py-2 px-3 text-right font-medium">{run.sales_loaded_count}</td>
                      <td className="py-2 px-3 text-right font-medium">{run.budget_facts_loaded_count}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">{run.duration_ms}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
