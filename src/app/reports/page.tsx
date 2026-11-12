"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  BarChart3,
  LogOut,
  Download,
  TrendingUp,
  TrendingDown,
  Calendar,
  Menu,
  X,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { downloadFinancialReportPdf } from "@/lib/pdfGenerator";
import {
  getStoredTransactions,
  getStoredBudget,
  calculateBudgetStats,
  Transaction,
  Budget,
} from "@/lib/financeStore";
import UserProfileDropdown from "@/components/UserProfileDropdown";
import { formatDateDMY } from "@/lib/dateUtils";

// Navigation items matching Dashboard, Accounts, Transactions, Budget
const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, active: false },
  { name: "Accounts", href: "/accounts", icon: Wallet, active: false },
  { name: "Transactions", href: "/transactions", icon: ArrowLeftRight, active: false },
  { name: "Budget", href: "/budget", icon: PieChart, active: false },
  { name: "Reports", href: "/reports", icon: BarChart3, active: true },
];

// Pre-defined color palette for category breakdown bars
const categoryColors = [
  "bg-blue-600",
  "bg-emerald-500",
  "bg-violet-600",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-orange-500",
];

export default function ReportsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalOpeningBalance, setTotalOpeningBalance] = useState<number>(0);
  const [budget, setBudget] = useState<Budget>({ amount: 0, isSet: false });
  const [userName, setUserName] = useState("Nayana");
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  // All-time scope constant
  const filterLabel = "All Time (Complete History)";

  // Load user's actual financial data from Supabase (Accounts, Transactions, Budget)
  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      try {
        if (isSupabaseConfigured) {
          const { data: { user } } = await supabase.auth.getUser();

          if (user && !ignore) {
            if (user.user_metadata?.full_name) {
              setUserName(user.user_metadata.full_name);
            }

            // 1. Fetch user's accounts to calculate true Total Balance
            // Total Balance = sum(opening_balance) + total_income - total_expenses
            const { data: accData } = await supabase
              .from("accounts")
              .select("id, name, opening_balance")
              .eq("user_id", user.id);

            if (accData && !ignore) {
              const opBal = accData.reduce(
                (sum, a) => sum + Number(a.opening_balance || 0),
                0
              );
              setTotalOpeningBalance(opBal);
            }

            // 2. Fetch all-time transactions for the authenticated user from Supabase
            const { data: txData } = await supabase
              .from("transactions")
              .select("id, name, amount, type, category, date, created_at, account_id, accounts(name)")
              .eq("user_id", user.id)
              .order("date", { ascending: false });

            if (txData && !ignore) {
              const mapped: Transaction[] = txData.map((t) => {
                const accRel = t.accounts as unknown as { name?: string } | null;
                const rawCreatedAt = (t as unknown as { created_at?: string }).created_at;
                return {
                  id: t.id,
                  name: t.name,
                  amount: Number(t.amount || 0),
                  type: t.type as "Income" | "Expense",
                  category: t.category,
                  account: accRel?.name || "Account",
                  date: t.date,
                  createdAt: rawCreatedAt,
                };
              });

              setTransactions(mapped);
            }

            // 3. Fetch user's overall budget from Supabase
            const { data: budgetData } = await supabase
              .from("budgets")
              .select("amount, is_set")
              .eq("user_id", user.id)
              .maybeSingle();

            if (budgetData && !ignore) {
              setBudget({
                amount: Number(budgetData.amount || 0),
                isSet: Boolean(budgetData.is_set),
              });
            } else if (!ignore) {
              setBudget({ amount: 0, isSet: false });
            }

            setLoading(false);
            return;
          }
        }

        // Fallback to local storage if offline or not logged in
        if (!ignore) {
          setTransactions(getStoredTransactions());
          setBudget(getStoredBudget());
          setLoading(false);
        }
      } catch {
        if (!ignore) {
          setTransactions(getStoredTransactions());
          setBudget(getStoredBudget());
          setLoading(false);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchData();

    // Re-fetch when accounts, transactions, or budget are modified elsewhere in the application
    const handleUpdate = () => {
      fetchData();
    };

    window.addEventListener("arthra_finance_update", handleUpdate);
    return () => {
      ignore = true;
      window.removeEventListener("arthra_finance_update", handleUpdate);
    };
  }, []);

  // 1. Calculations: Summary Cards (Total Income, Total Expenses, Total Balance)
  // Preserving filteredTransactions for all-time transactions display
  const filteredTransactions = useMemo(() => {
    return transactions;
  }, [transactions]);

  const totalIncome = useMemo(() => {
    return filteredTransactions
      .filter((tx) => tx.type === "Income")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  }, [filteredTransactions]);

  const totalExpenses = useMemo(() => {
    return filteredTransactions
      .filter((tx) => tx.type === "Expense")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  }, [filteredTransactions]);

  // Total Balance: Opening balances of all accounts + all income - all expenses
  const totalBalance = useMemo(() => {
    return totalOpeningBalance + totalIncome - totalExpenses;
  }, [totalOpeningBalance, totalIncome, totalExpenses]);

  // 2. Calculations: Overall Budget Performance Metrics
  const budgetStats = useMemo(() => {
    return calculateBudgetStats(budget, transactions);
  }, [budget, transactions]);

  // 3. Calculations: Category Breakdown (Expenses grouped by category)
  const categoryBreakdown = useMemo(() => {
    const expenseTx = transactions.filter((tx) => tx.type === "Expense");
    const map = new Map<string, { total: number; count: number }>();

    expenseTx.forEach((tx) => {
      const cat = tx.category?.trim() || "Uncategorized";
      const existing = map.get(cat) || { total: 0, count: 0 };
      map.set(cat, {
        total: existing.total + Number(tx.amount || 0),
        count: existing.count + 1,
      });
    });

    const list = Array.from(map.entries()).map(([category, data]) => {
      const percentage = totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0;
      return {
        category,
        total: data.total,
        count: data.count,
        percentage,
      };
    });

    // Sort descending by highest expense amount so the top category is first
    return list.sort((a, b) => b.total - a.total);
  }, [transactions, totalExpenses]);

  // 4. Calculations: All transactions sorted newest first (tie-break by creation time)
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      // 1. Sort by transaction date, newest first
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (!isNaN(dateA) && !isNaN(dateB) && dateB !== dateA) {
        return dateB - dateA;
      }
      // 2. If same date, use creation time where available
      if (a.createdAt && b.createdAt) {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (!isNaN(timeA) && !isNaN(timeB) && timeB !== timeA) {
          return timeB - timeA;
        }
      }
      return 0;
    });
  }, [filteredTransactions]);

  // Latest 10 transactions for display
  const latestTransactions = useMemo(() => {
    return sortedTransactions.slice(0, 10);
  }, [sortedTransactions]);

  // Max bar value and proportional heights for the Income vs Expenses chart
  const maxBarValue = Math.max(totalIncome, totalExpenses, 1);
  const incomeBarHeight = Math.round((totalIncome / maxBarValue) * 100);
  const expenseBarHeight = Math.round((totalExpenses / maxBarValue) * 100);

  // Direct PDF File Download without Browser Print Dialog
  const handleDownloadPDF = () => {
    try {
      setIsDownloading(true);

      const currentDateFormatted = formatDateDMY(new Date());

      downloadFinancialReportPdf(
        {
          userName,
          reportTitle: "ArthraFinance — Financial Report",
          dateRangeLabel: filterLabel,
          generatedDate: currentDateFormatted,
          totalIncome,
          totalExpenses,
          totalBalance,
          totalTransactionCount: filteredTransactions.length,
          budget: {
            isSet: budgetStats.isBudgetSet,
            overallBudget: budgetStats.overallBudget,
            totalSpent: budgetStats.totalExpenses,
            remainingBudget: budgetStats.remainingBudget,
            exceededAmount: budgetStats.exceededAmount,
            isExceeded: budgetStats.isExceeded,
            percentUsed: budgetStats.percentUsed,
          },
          categoryBreakdown,
          transactions: sortedTransactions.map((tx) => ({
            id: tx.id,
            date: tx.date,
            name: tx.name,
            type: tx.type,
            category: tx.category,
            account: tx.account,
            amount: tx.amount,
          })),
        },
        "ArthraFinance_Report_All_Time.pdf"
      );
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f3fd] p-3 sm:p-5 lg:p-8 flex items-center justify-center print:bg-white print:p-0">
      {/* Outer rounded container */}
      <div className="w-full max-w-[1400px] bg-white rounded-[28px] shadow-2xl shadow-indigo-100/70 border border-slate-100 overflow-hidden flex flex-col lg:flex-row min-h-[820px] print:shadow-none print:border-none print:rounded-none">

        {/* Mobile Header (Hidden in Print) */}
        <div className="lg:hidden flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <span className="font-bold text-sm">AF</span>
            </div>
            <span className="font-bold text-base tracking-tight">ArthraFinance</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* 1. Left Navigation Sidebar (Hidden in Print) */}
        <aside
          className={`${
            mobileMenuOpen ? "flex" : "hidden"
          } lg:flex flex-col justify-between w-full lg:w-[240px] shrink-0 bg-gradient-to-b from-blue-700 via-indigo-700 to-indigo-900 text-white p-6 transition-all duration-200 print:hidden`}
        >
          <div>
            {/* Logo */}
            <div className="hidden lg:flex items-center gap-2.5 mb-10 select-none">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
                <span className="font-bold text-sm tracking-tight text-white">AF</span>
              </div>
              <span className="font-bold text-lg tracking-tight">ArthraFinance</span>
            </div>

            {/* Navigation Items */}
            <nav className="flex flex-col gap-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                      item.active
                        ? "bg-white text-blue-700 shadow-md font-semibold"
                        : "text-blue-100 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon size={18} className={item.active ? "text-blue-700" : "text-blue-200"} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Logout at bottom */}
          <div className="pt-6 border-t border-white/10 mt-6 lg:mt-0">
            <Link
              href="/login"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-blue-200 hover:bg-white/10 hover:text-white transition-colors text-sm font-medium"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </Link>
          </div>
        </aside>

        {/* 2. Main Content Area */}
        <main className="flex-1 flex flex-col bg-[#fafbfe] p-5 sm:p-7 lg:p-9 overflow-y-auto print:bg-white print:p-6 print:overflow-visible">

          {/* Top-Right Profile Section (Hidden in Print) */}
          <header className="flex justify-end items-center mb-6 print:hidden">
            <UserProfileDropdown initialUserName={userName} onNameChange={setUserName} />
          </header>

          {/* Printable Report Header (Visible only when printing) */}
          <div className="hidden print:block mb-8 pb-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">ArthraFinance — Financial Report</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Report Scope: <span className="font-semibold text-slate-800">{filterLabel}</span>
                </p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>Account Owner: <span className="font-semibold text-slate-700">{userName}</span></p>
                <p>Scope: {filterLabel}</p>
              </div>
            </div>
          </div>

          {/* Page Heading & Action Bar (Hidden in Print) */}
          <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-7 print:hidden">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Reports
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Analyze your income, expenses, and category breakdown.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* All Time Filter Indicator */}
              <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100/90 border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm">
                <Calendar size={14} className="text-blue-600" />
                <span>All Time</span>
              </div>

              {/* Download PDF Button */}
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                {isDownloading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Download size={15} />
                )}
                <span>{isDownloading ? "Generating PDF..." : "Download PDF"}</span>
              </button>
            </div>
          </section>

          {/* Current Filter Indicator Banner */}
          <div className="mb-6 flex items-center justify-between bg-blue-50/70 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-800 print:bg-slate-50 print:border-slate-200 print:text-slate-700">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-blue-600 print:text-slate-600" />
              <span className="font-medium">Active Report Filter:</span>
              <span className="font-bold">All Time (Complete History)</span>
            </div>
            <span className="text-[11px] text-blue-600/80 font-medium print:text-slate-500">
              {loading
                ? "Loading data..."
                : `${transactions.length} transaction${transactions.length === 1 ? "" : "s"} included`}
            </span>
          </div>

          {/* SECTION A: Summary Cards (Total Income, Total Expenses, Total Balance) */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
            {/* Total Income */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm print:border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Income
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp size={16} />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                ₹ {totalIncome.toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
                <span>Income across all accounts</span>
              </p>
            </div>

            {/* Total Expenses */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm print:border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Expenses
                </span>
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <TrendingDown size={16} />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                ₹ {totalExpenses.toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-rose-600 mt-1 font-medium flex items-center gap-1">
                <span>Expenses across all accounts</span>
              </p>
            </div>

            {/* Total Balance: Sum of opening balances + total income - total expenses */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm print:border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Balance
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Wallet size={16} />
                </div>
              </div>
              <div
                className={`text-2xl font-bold ${
                  totalBalance >= 0 ? "text-slate-900" : "text-amber-600"
                }`}
              >
                {totalBalance < 0 ? "-" : ""}₹ {Math.abs(totalBalance).toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Combined balance across all accounts
              </p>
            </div>
          </section>

          {/* Charts & Breakdown Row (Side by side on desktop, stacked on mobile) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-7 items-stretch">
            {/* SECTION B: Income vs Expenses Comparative Bar Chart */}
            <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between print:border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Income vs Expenses
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Visual comparative cash flow across all accounts
                  </p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <BarChart3 size={16} />
                </div>
              </div>

              {/* Empty check if no data */}
              {totalIncome === 0 && totalExpenses === 0 ? (
                <div className="py-14 text-center flex-1 flex flex-col items-center justify-center">
                  <p className="text-sm font-semibold text-slate-700">No data available</p>
                  <p className="text-xs text-slate-400 mt-1">
                    No income or expense transactions recorded.
                  </p>
                </div>
              ) : (
                <div className="pt-4 pb-2 flex-1 flex flex-col justify-end">
                  <div className="grid grid-cols-2 gap-6 sm:gap-10 w-full max-w-xs sm:max-w-sm mx-auto items-end h-64 px-4 pb-2 border-b border-slate-100">
                    {/* Income Bar Column */}
                    <div className="flex flex-col items-center h-full justify-end group">
                      <span className="text-xs sm:text-sm font-bold text-emerald-700 mb-2">
                        ₹ {totalIncome.toLocaleString("en-IN")}
                      </span>
                      <div
                        className="w-full max-w-[80px] sm:max-w-[100px] bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-xl transition-all duration-500 shadow-sm"
                        style={{ height: `${totalIncome > 0 ? Math.max(incomeBarHeight, 6) : 0}%` }}
                      />
                      <span className="text-xs sm:text-sm font-semibold text-slate-700 mt-3">
                        Income
                      </span>
                    </div>

                    {/* Expense Bar Column */}
                    <div className="flex flex-col items-center h-full justify-end group">
                      <span className="text-xs sm:text-sm font-bold text-rose-700 mb-2">
                        ₹ {totalExpenses.toLocaleString("en-IN")}
                      </span>
                      <div
                        className="w-full max-w-[80px] sm:max-w-[100px] bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-xl transition-all duration-500 shadow-sm"
                        style={{ height: `${totalExpenses > 0 ? Math.max(expenseBarHeight, 6) : 0}%` }}
                      />
                      <span className="text-xs sm:text-sm font-semibold text-slate-700 mt-3">
                        Expenses
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* SECTION C: Expense Breakdown by Category */}
            <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between print:border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-bold text-slate-900">
                  Expense Breakdown by Category
                </h2>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <PieChart size={16} />
                </div>
              </div>

              {categoryBreakdown.length === 0 ? (
                <div className="py-14 text-center flex-1 flex flex-col items-center justify-center">
                  <p className="text-sm font-semibold text-slate-700">No expenses found</p>
                  <p className="text-xs text-slate-400 mt-1">
                    No expense transactions were recorded.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 pt-1 flex-1">
                  {categoryBreakdown.map((item, index) => {
                    const colorClass = categoryColors[index % categoryColors.length];
                    return (
                      <div key={item.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`w-2.5 h-2.5 rounded-full ${colorClass}`} />
                            <span className="font-semibold text-slate-800">
                              {item.category}
                            </span>
                            {index === 0 && item.total > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-xs">
                                Highest Spending Category
                              </span>
                            )}
                            <span className="text-slate-400 text-[11px]">
                              ({item.count} {item.count === 1 ? "entry" : "entries"})
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-900">
                              ₹ {item.total.toLocaleString("en-IN")}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500 w-11 text-right">
                              {item.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Horizontal Progress Bar */}
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colorClass}`}
                            style={{ width: `${Math.min(100, Math.max(item.percentage, 2))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* SECTION C: Budget Overview */}
          <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm mb-7 print:border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Budget Overview
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Performance tracking against overall spending budget
                </p>
              </div>

              {budgetStats.isBudgetSet && budgetStats.overallBudget > 0 && (
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                      budgetStats.statusColor === "green"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : budgetStats.statusColor === "yellow"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {budgetStats.statusColor === "green" ? (
                      <>
                        <CheckCircle2 size={13} />
                        <span>Within Budget</span>
                      </>
                    ) : budgetStats.statusColor === "yellow" ? (
                      <>
                        <AlertTriangle size={13} />
                        <span>Approaching Limit</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={13} />
                        <span>Budget Exceeded</span>
                      </>
                    )}
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {Math.round(budgetStats.actualPercent)}% used
                  </span>
                </div>
              )}
            </div>

            {/* Empty State: If no budget is set */}
            {!budgetStats.isBudgetSet || budgetStats.overallBudget <= 0 ? (
              <div className="p-8 sm:p-10 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50/50">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                  <PieChart size={24} />
                </div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">
                  No Overall Budget Created Yet
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-5 leading-relaxed">
                  Set an overall budget to track your spending limits across all accounts and view real-time budget utilization in your financial reports.
                </p>
                <Link
                  href="/budget"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-xs transition-colors shadow-sm"
                >
                  <span>Go to Budget Page</span>
                </Link>
              </div>
            ) : (
              /* Populated State: Budget is set */
              <div className="space-y-6">
                {/* Warning Banner if exceeded */}
                {budgetStats.isExceeded && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs">
                    <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={16} />
                    <div>
                      <strong className="font-semibold text-rose-800 block">
                        Warning: Budget Exceeded
                      </strong>
                      <span className="text-rose-700 mt-0.5 block">
                        Total all-time expenses have exceeded your overall budget limit by{" "}
                        <strong className="font-bold underline">
                          ₹ {budgetStats.exceededAmount.toLocaleString("en-IN")}
                        </strong>
                        .
                      </span>
                    </div>
                  </div>
                )}

                {/* 3 Performance Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: Set Budget */}
                  <div className="bg-[#f6f4fe] border border-purple-100 rounded-xl p-4">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Set Budget
                    </span>
                    <p className="text-xl font-bold text-slate-900 mt-1">
                      ₹ {budgetStats.overallBudget.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">Active spending limit</p>
                  </div>

                  {/* Card 2: Total Spent (All-time Expense across all accounts) */}
                  <div className="bg-[#fff3f3] border border-rose-100 rounded-xl p-4">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      Total Spent
                    </span>
                    <p className="text-xl font-bold text-rose-600 mt-1">
                      ₹ {budgetStats.totalExpenses.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">All recorded expenses</p>
                  </div>

                  {/* Card 3: Remaining Budget OR Exceeded Amount */}
                  <div
                    className={`rounded-xl p-4 border ${
                      budgetStats.isExceeded
                        ? "bg-rose-50/80 border-rose-200"
                        : "bg-[#f0fbf5] border-emerald-100"
                    }`}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                      {budgetStats.isExceeded ? "Exceeded Amount" : "Remaining Budget"}
                    </span>
                    <p
                      className={`text-xl font-bold mt-1 ${
                        budgetStats.isExceeded ? "text-rose-700" : "text-emerald-700"
                      }`}
                    >
                      {budgetStats.isExceeded
                        ? `₹ ${budgetStats.exceededAmount.toLocaleString("en-IN")}`
                        : `₹ ${budgetStats.remainingBudget.toLocaleString("en-IN")}`}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {budgetStats.isExceeded ? "Amount over limit" : "Available to spend"}
                    </p>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>Spending Consumption</span>
                    <span className="font-bold text-slate-800">
                      {budgetStats.percentUsed}% consumed
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        budgetStats.statusColor === "green"
                          ? "bg-emerald-500"
                          : budgetStats.statusColor === "yellow"
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${budgetStats.percentUsed}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* SECTION D: Transactions Summary Table for Printed PDF and Review */}
          <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm print:border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Report Transaction Details
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Latest {latestTransactions.length} transactions displayed | Total = {filteredTransactions.length} transactions
                </p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-medium">
                {latestTransactions.length} of {filteredTransactions.length} items
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                <span>Loading report transactions from database...</span>
              </div>
            ) : latestTransactions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No transactions recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="pb-3 pl-1">Date</th>
                      <th className="pb-3">Description</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Account</th>
                      <th className="pb-3 pr-1 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {latestTransactions.map((tx: Transaction) => (
                      <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 pl-1 text-slate-600 font-medium whitespace-nowrap">
                          {formatDateDMY(tx.date)}
                        </td>
                        <td className="py-2.5 text-slate-800 font-semibold">
                          {tx.name}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              tx.type === "Income"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-600 font-medium">
                          {tx.category || "—"}
                        </td>
                        <td className="py-2.5 text-slate-500">
                          {tx.account || "—"}
                        </td>
                        <td
                          className={`py-2.5 pr-1 text-right font-bold whitespace-nowrap ${
                            tx.type === "Income" ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {tx.type === "Income" ? "+ " : "- "}₹ {Number(tx.amount || 0).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Print Footer */}
          <div className="hidden print:block mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
            End of ArthraFinance Report • Generated for {userName} • Confidential
          </div>

        </main>
      </div>
    </div>
  );
}
