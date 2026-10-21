import React, { useState, useEffect } from 'react';
import {
  Wallet,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Info,
  Calendar,
  Save,
  Clock,
  Sparkles,
  ArrowRight,
  Database,
  BarChart2,
  Plus,
  Edit2,
  Trash2,
  X,
  Tag,
  Receipt,
  FileText,
  PieChart
} from 'lucide-react';

export default function BudgetPlanner({
  budgetStatus,
  onUpdateBudget,
  onSelectMonth,
  activeCustomer,
  orderHistory = [],
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense
}) {
  const [budgetInput, setBudgetInput] = useState(budgetStatus?.monthlyBudget || 10000);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);

  // Expense modal state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    amount: '',
    category: 'Groceries',
    expenseDate: new Date().toISOString().substring(0, 10),
    notes: ''
  });
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    if (budgetStatus?.monthlyBudget) {
      setBudgetInput(budgetStatus.monthlyBudget);
    }
  }, [budgetStatus?.monthlyBudget]);

  const monthlyBudget = Number(budgetStatus?.monthlyBudget || 10000);
  const ordersSpent = Number(budgetStatus?.ordersSpent || 0);
  const expensesSpent = Number(budgetStatus?.expensesSpent || 0);
  const currentSpent = Number(budgetStatus?.currentSpent || (ordersSpent + expensesSpent));
  const remainingBalance = Number(budgetStatus?.remainingBalance || (monthlyBudget - currentSpent));
  const percentageUsed = Number(budgetStatus?.percentageUsed || (monthlyBudget > 0 ? (currentSpent / monthlyBudget) * 100 : 0));
  const isExceeded = percentageUsed > 100;
  const isNearLimit = percentageUsed >= 80 && !isExceeded;
  const selectedMonthYear = budgetStatus?.monthYear || new Date().toISOString().substring(0, 7);
  const availableMonths = budgetStatus?.availableMonths || [selectedMonthYear];
  const performanceHistory = budgetStatus?.performanceHistory || [];
  const categoryBreakdown = budgetStatus?.categoryBreakdown || [];
  const expenses = budgetStatus?.expenses || [];

  const formatMonthLabel = (my) => {
    if (!my) return '';
    const [year, month] = my.split('-');
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const mIdx = parseInt(month, 10) - 1;
    return `${monthNames[mIdx] || month} ${year}`;
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    const num = Number(budgetInput);
    if (isNaN(num) || num <= 0) return;
    setSavingBudget(true);
    try {
      await onUpdateBudget(num, selectedMonthYear);
      setIsEditingBudget(false);
    } finally {
      setSavingBudget(false);
    }
  };

  const handleOpenAddExpense = () => {
    setEditingExpenseId(null);
    setExpenseForm({
      title: '',
      amount: '',
      category: 'Groceries',
      expenseDate: new Date().toISOString().substring(0, 10),
      notes: ''
    });
    setExpenseError('');
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (exp) => {
    setEditingExpenseId(exp.expense_id);
    setExpenseForm({
      title: exp.title,
      amount: exp.amount,
      category: exp.category,
      expenseDate: exp.expense_date,
      notes: exp.notes || ''
    });
    setExpenseError('');
    setIsExpenseModalOpen(true);
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!expenseForm.title.trim()) {
      setExpenseError('Please enter an expense title');
      return;
    }
    const numAmt = Number(expenseForm.amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setExpenseError('Please enter a valid amount greater than 0');
      return;
    }

    setExpenseSubmitting(true);
    setExpenseError('');
    try {
      if (editingExpenseId) {
        if (onUpdateExpense) {
          await onUpdateExpense(editingExpenseId, {
            title: expenseForm.title.trim(),
            amount: numAmt,
            category: expenseForm.category,
            expenseDate: expenseForm.expenseDate,
            notes: expenseForm.notes.trim()
          });
        }
      } else {
        if (onAddExpense) {
          await onAddExpense({
            customerId: activeCustomer?.customer_id,
            title: expenseForm.title.trim(),
            amount: numAmt,
            category: expenseForm.category,
            expenseDate: expenseForm.expenseDate,
            notes: expenseForm.notes.trim()
          });
        }
      }
      setIsExpenseModalOpen(false);
    } catch (err) {
      setExpenseError(err.message || 'Failed to save expense');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleDeleteExpenseConfirm = async (id) => {
    if (onDeleteExpense) {
      await onDeleteExpense(id);
    }
    setDeleteConfirmId(null);
  };

  const categoriesList = [
    'Groceries',
    'Dairy & Bakery',
    'Snacks & Beverages',
    'Fruits & Vegetables',
    'Household & Cleaning',
    'Personal Care',
    'Dining Out',
    'Utilities',
    'Other'
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Visual Alert Banner when Spending Exceeds Budget (>100%) */}
      {isExceeded && (
        <div className="bg-rose-500 text-white p-5 rounded-2xl shadow-lg flex items-start gap-4 animate-bounce-once">
          <div className="p-2 bg-white/20 rounded-xl shrink-0">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-base flex items-center gap-2">
              <span>CRITICAL ALERT: Monthly Budget Limit Exceeded!</span>
              <span className="bg-white text-rose-600 text-xs px-2 py-0.5 rounded-full font-black uppercase">
                {percentageUsed.toFixed(1)}% Used
              </span>
            </h3>
            <p className="text-rose-100 text-xs sm:text-sm">
              Your combined spending of <span className="font-bold underline">₹{currentSpent.toFixed(2)}</span> has breached your monthly allocated budget of <span className="font-bold underline">₹{monthlyBudget.toFixed(2)}</span> by <span className="font-bold">₹{Math.abs(remainingBalance).toFixed(2)}</span> for {formatMonthLabel(selectedMonthYear)}.
            </p>
          </div>
        </div>
      )}

      {/* Warning banner when spending is near limit (80% - 100%) */}
      {isNearLimit && !isExceeded && (
        <div className="bg-amber-500 text-white p-4 rounded-2xl shadow-md flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">Budget Caution ({formatMonthLabel(selectedMonthYear)}): </span>
            You have used <span className="font-black">{percentageUsed.toFixed(1)}%</span> of your monthly budget. Only <span className="font-black">₹{remainingBalance.toFixed(2)}</span> remaining.
          </div>
        </div>
      )}

      {/* Main Budget Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Personal Grocery & Household Budget</h2>
              {activeCustomer?.segment === 'New Shopper' && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  New Shopper
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Active profile: <span className="font-semibold text-slate-700">{activeCustomer?.customer_name}</span> ({activeCustomer?.city || 'Mumbai'}) • ID: <code className="text-slate-600 bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">{activeCustomer?.customer_id}</code>
            </p>
          </div>

          {/* Month Selector & Quick Edit Budget Button */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Period Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500 font-medium">Period:</span>
              <select
                value={selectedMonthYear}
                onChange={(e) => onSelectMonth && onSelectMonth(e.target.value)}
                className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)} ({m})
                  </option>
                ))}
              </select>
            </div>

            {!isEditingBudget ? (
              <button
                onClick={() => {
                  setBudgetInput(monthlyBudget);
                  setIsEditingBudget(true);
                }}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Budget</span>
              </button>
            ) : (
              <form onSubmit={handleSaveBudget} className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="500"
                    max="500000"
                    step="500"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    className="pl-7 pr-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 w-28"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingBudget}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingBudget(false)}
                  className="px-2.5 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        </div>

        {/* 4 Real-Time Core KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Card 1: Monthly Budget */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Monthly Budget</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              ₹{monthlyBudget.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Allocated limit</span>
          </div>

          {/* Card 2: Total Spending */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Spent</span>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${isExceeded ? 'text-rose-600' : 'text-slate-900'}`}>
              ₹{currentSpent.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
              <span>Orders: ₹{ordersSpent.toFixed(0)}</span>
              <span>•</span>
              <span>Expenses: ₹{expensesSpent.toFixed(0)}</span>
            </div>
          </div>

          {/* Card 3: Remaining Balance */}
          <div className={`rounded-xl p-4 border ${
            isExceeded ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'
          }`}>
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${
              isExceeded ? 'text-rose-600' : 'text-emerald-700'
            }`}>
              Remaining Balance
            </span>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${
              isExceeded ? 'text-rose-700' : 'text-emerald-800'
            }`}>
              ₹{remainingBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <span className={`text-[11px] mt-1 block ${
              isExceeded ? 'text-rose-600 font-bold' : 'text-emerald-600'
            }`}>
              {isExceeded ? `Over limit by ₹${Math.abs(remainingBalance).toFixed(2)}` : 'Available to spend'}
            </span>
          </div>

          {/* Card 4: Percentage Used */}
          <div className={`rounded-xl p-4 border ${
            isExceeded
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : isNearLimit
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-slate-50 border-slate-200/80 text-slate-900'
          }`}>
            <span className="text-[11px] font-bold uppercase tracking-wider block opacity-75">Budget Used</span>
            <div className="text-xl sm:text-2xl font-black mt-1">
              {percentageUsed.toFixed(1)}%
            </div>
            <span className="text-[11px] opacity-75 mt-1 block">
              {isExceeded ? 'Limit exceeded' : `${(100 - percentageUsed).toFixed(1)}% remaining`}
            </span>
          </div>
        </div>

        {/* Progress Bar with Color Zones */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Monthly Utilization Indicator ({formatMonthLabel(selectedMonthYear)})</span>
            <span>{percentageUsed.toFixed(1)}% of ₹{monthlyBudget.toFixed(0)}</span>
          </div>
          <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200 flex">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isExceeded
                  ? 'bg-gradient-to-r from-rose-500 to-rose-600'
                  : isNearLimit
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500'
              }`}
              style={{ width: `${Math.min(percentageUsed, 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
            <span>₹0 (Start)</span>
            <span>₹{(monthlyBudget * 0.5).toFixed(0)} (50%)</span>
            <span>₹{(monthlyBudget * 0.8).toFixed(0)} (80% Caution)</span>
            <span>₹{monthlyBudget.toFixed(0)} (100% Limit)</span>
          </div>
        </div>

        {/* Data Mining: Budget Intelligence Callout */}
        {budgetStatus?.comparisonNote && (
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
            <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                Budget Mining Intelligence
              </h4>
              <p className="text-xs sm:text-sm text-indigo-800 mt-0.5">
                {budgetStatus.comparisonNote}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Category-Wise Spending Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Category-Wise Spending Breakdown ({formatMonthLabel(selectedMonthYear)})
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total Spent: <span className="font-bold text-slate-900">₹{currentSpent.toFixed(2)}</span>
          </span>
        </div>

        {categoryBreakdown.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl p-6 bg-slate-50/50">
            <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">No category spending recorded yet</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
              Make purchases in the store or log manual grocery and household expenses below to view category-wise analysis.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {categoryBreakdown.map((cat) => (
              <div key={cat.category} className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 truncate">{cat.category}</span>
                  <span className="font-black text-slate-900">₹{Number(cat.amount).toFixed(2)}</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full"
                    style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                  <span>{cat.count} {cat.count === 1 ? 'item / entry' : 'items / entries'}</span>
                  <span className="font-bold text-emerald-700">{cat.percentage}% of spent</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User-Specific Manual Expense Management */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Manual Expense Entries ({activeCustomer?.customer_name})
              </h3>
              <p className="text-[11px] text-slate-500">
                Log external grocery, dairy, and household expenses to deduct from monthly budget
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenAddExpense}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Expense</span>
          </button>
        </div>

        {expenses.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl p-6 bg-slate-50/50">
            <Wallet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">No manual expenses logged for this month</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
              Your store purchases are automatically deducted above. Click "+ Add Expense" to track additional grocery or daily household expenses.
            </p>
            <button
              onClick={handleOpenAddExpense}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-emerald-500 text-emerald-700 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log First Expense</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Expense Title</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((exp) => (
                  <tr key={exp.expense_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-600 whitespace-nowrap">
                      {exp.expense_date}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {exp.title}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 truncate max-w-xs text-[11px]">
                      {exp.notes || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                      ₹{Number(exp.amount).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditExpense(exp)}
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Edit expense"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {deleteConfirmId === exp.expense_id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteExpenseConfirm(exp.expense_id)}
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-600 text-white rounded hover:bg-rose-700 cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-600 rounded hover:bg-slate-300 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(exp.expense_id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Analytical Layer: Fact_Budget_Performance Table (Data Warehouse Constellation) */}
      {performanceHistory.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Data Warehouse Fact Table: <code className="text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded text-xs">Fact_Budget_Performance</code>
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">Conformed Dim_Customer × Dim_Date</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Month-Year</th>
                  <th className="py-2.5 px-3 text-right">Monthly Budget</th>
                  <th className="py-2.5 px-3 text-right">Actual Spent</th>
                  <th className="py-2.5 px-3 text-right">Variance Amount</th>
                  <th className="py-2.5 px-3 text-right">Utilization Rate</th>
                  <th className="py-2.5 px-3 text-center">Warehouse Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {performanceHistory.map((row) => {
                  const isCurrent = row.month_year === selectedMonthYear;
                  return (
                    <tr key={row.budget_fact_id} className={`hover:bg-slate-50/80 ${isCurrent ? 'bg-emerald-50/40 font-semibold' : ''}`}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {formatMonthLabel(row.month_year)} ({row.month_year})
                        {isCurrent && <span className="ml-2 text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">Active</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                        ₹{Number(row.monthly_budget).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900">
                        ₹{Number(row.actual_spent).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${row.variance_amount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {row.variance_amount > 0 ? '+' : ''}₹{Number(row.variance_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                        {Number(row.utilization_rate).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                          row.status === 'OVER_BUDGET'
                            ? 'bg-rose-100 text-rose-700 border border-rose-300'
                            : (row.status === 'ON_BUDGET' || row.status === 'NEAR_LIMIT')
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {!isCurrent && (
                          <button
                            onClick={() => onSelectMonth && onSelectMonth(row.month_year)}
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Historical Order Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-slate-900 text-sm">Recent Operational Orders ({activeCustomer?.customer_name})</h3>
          </div>
          <span className="text-xs text-slate-500">Live OLTP records from <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded text-[11px]">Orders</code></span>
        </div>

        {orderHistory.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No recent store orders recorded for this customer.</p>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
            {orderHistory.slice(0, 10).map((ord) => {
              const isThisMonth = ord.visit_date?.startsWith(selectedMonthYear) || 
                (ord.visit_date?.includes('-') && (ord.visit_date.endsWith(`-${selectedMonthYear.split('-')[1]}-${selectedMonthYear.split('-')[0]}`) || ord.visit_date.startsWith(selectedMonthYear)));
              return (
                <div key={ord.order_id} className={`p-3.5 flex items-center justify-between text-xs hover:bg-slate-50 ${isThisMonth ? 'bg-emerald-50/20' : ''}`}>
                  <div>
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                      <span>{ord.order_id}</span>
                      {isThisMonth && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                          Deducted from {formatMonthLabel(selectedMonthYear)}
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      {ord.visit_date} • {ord.store_type || 'Retail Outlet'} ({ord.city || activeCustomer?.city || 'City'}) • Paid via {ord.payment_method || 'UPI'}
                      {ord.items_count ? ` • ${ord.items_count} ${ord.items_count === 1 ? 'item' : 'items'}` : ''}
                    </div>
                    {ord.items_summary && (
                      <div className="text-slate-400 text-[10px] truncate max-w-md mt-0.5" title={ord.items_summary}>
                        {ord.items_summary}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-900 text-sm">₹{Number(ord.total_amount).toFixed(2)}</div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                      {ord.status || 'COMPLETED'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Expense Modal Dialog */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingExpenseId ? 'Edit Logged Expense' : 'Log New Expense'}
                </h3>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="p-6 space-y-4">
              {expenseError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
                  {expenseError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expense Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Organic Milk & Sourdough Bread"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 350"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseForm.expenseDate}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Category *
                </label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white cursor-pointer"
                >
                  {categoriesList.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bought at Local Organic Farmers Market"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expenseSubmitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{expenseSubmitting ? 'Saving...' : editingExpenseId ? 'Update Expense' : 'Save Expense'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
