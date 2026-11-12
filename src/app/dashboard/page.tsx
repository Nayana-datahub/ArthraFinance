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
  TrendingUp,
  TrendingDown,
  Menu,
  X,
} from "lucide-react";
import {
  getStoredBudget,
  getStoredTransactions,
  getStoredAccounts,
  calculateBudgetStats,
  Transaction,
  Budget,
  Account,
} from "@/lib/financeStore";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import UserProfileDropdown from "@/components/UserProfileDropdown";
import { formatDateDMY } from "@/lib/dateUtils";

// Navigation items matching app design
const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, active: true },
  { name: "Accounts", href: "/accounts", icon: Wallet, active: false },
  { name: "Transactions", href: "/transactions", icon: ArrowLeftRight, active: false },
  { name: "Budget", href: "/budget", icon: PieChart, active: false },
  { name: "Reports", href: "/reports", icon: BarChart3, active: false },
];

// Palette for dynamic category donut chart
const categoryColors = [
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#14b8a6", // Teal
  "#f97316", // Orange
];

export default function DashboardPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState("Nayana");
  const [budget, setBudget] = useState<Budget>({ amount: 0, isSet: false });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Load actual financial data from Supabase (or fallback to local storage)
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        if (isSupabaseConfigured) {
          const { data: { user } } = await supabase.auth.getUser();

          if (user && isMounted) {
            if (user.user_metadata?.full_name) {
              setUserName(user.user_metadata.full_name);
            }

            // 1. Fetch live Accounts from Supabase
            const { data: accData } = await supabase
              .from("accounts")
              .select("*")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false });

            if (accData && isMounted) {
              setAccounts(
                accData.map((a) => ({
                  id: a.id,
                  name: a.name,
                  openingBalance: Number(a.opening_balance || 0),
                  balance: Number(a.opening_balance || 0),
                  totalIncome: 0,
                  totalExpenses: 0,
                }))
              );
            }

            // 2. Fetch live Transactions from Supabase
            const { data: txData } = await supabase
              .from("transactions")
              .select("id, name, amount, type, category, date, account_id, accounts(name)")
              .eq("user_id", user.id)
              .order("date", { ascending: false });

            if (txData && isMounted) {
              setTransactions(
                txData.map((t) => {
                  const accountRel = t.accounts as unknown as { name?: string } | null;
                  return {
                    id: t.id,
                    name: t.name,
                    amount: Number(t.amount || 0),
                    type: t.type as "Income" | "Expense",
                    category: t.category,
                    account: accountRel?.name || "Account",
                    date: t.date,
                  };
                })
              );
            }

            // 3. Fetch live Budget from Supabase
            const { data: budgetData } = await supabase
              .from("budgets")
              .select("amount, is_set")
              .eq("user_id", user.id)
              .maybeSingle();

            if (budgetData && isMounted) {
              setBudget({
                amount: Number(budgetData.amount || 0),
                isSet: Boolean(budgetData.is_set),
              });
            } else if (isMounted) {
              setBudget({
                amount: 0,
                isSet: false,
              });
            }

            setLoading(false);
            return;
          }
        }

        // Fallback: load verified local data if offline or not logged into Supabase
        if (isMounted) {
          setAccounts(getStoredAccounts());
          setTransactions(getStoredTransactions());
          setBudget(getStoredBudget());
        }
      } catch {
        if (isMounted) {
          setAccounts(getStoredAccounts());
          setTransactions(getStoredTransactions());
          setBudget(getStoredBudget());
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    // Listen for local updates if transactions or budget are edited in other tabs/pages
    const handleLocalUpdate = () => {
      loadData();
    };

    window.addEventListener("arthra_finance_update", handleLocalUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener("arthra_finance_update", handleLocalUpdate);
    };
  }, []);

  // 1. Dynamic Metric Calculations
  const totalIncome = useMemo(() => {
    return transactions
      .filter((t) => t.type === "Income")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [transactions]);

  const totalExpenses = useMemo(() => {
    return transactions
      .filter((t) => t.type === "Expense")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [transactions]);

  const totalOpeningBalance = useMemo(() => {
    return accounts.reduce(
      (sum, acc) => sum + Number(acc.openingBalance ?? acc.balance ?? 0),
      0
    );
  }, [accounts]);

  // Current Total Balance = Opening Balance of accounts + Income − Expenses
  const totalBalance = totalOpeningBalance + totalIncome - totalExpenses;

  // 2. Dynamic Spending by Category calculation for SVG Donut Chart
  const categoryBreakdown = useMemo(() => {
    const expenseTx = transactions.filter((t) => t.type === "Expense");
    if (expenseTx.length === 0 || totalExpenses <= 0) {
      return [];
    }

    const catMap = new Map<string, number>();
    expenseTx.forEach((tx) => {
      const cat = tx.category?.trim() || "Others";
      catMap.set(cat, (catMap.get(cat) || 0) + Number(tx.amount || 0));
    });

    const list = Array.from(catMap.entries()).map(([name, amount], index) => {
      const percent = Math.round((amount / totalExpenses) * 100);
      return {
        name,
        amount,
        percent,
        color: categoryColors[index % categoryColors.length],
      };
    });

    return list.sort((a, b) => b.amount - a.amount);
  }, [transactions, totalExpenses]);

  // SVG Circle circumference for r=38 is ~238.76
  const circleCircumference = 238.76;

  // 3. Dynamic Budget Status
  const stats = calculateBudgetStats(budget, transactions);

  // 4. Latest 5 Transactions for Recent Transactions Table
  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 5);
  }, [transactions]);

  return (
    <div className="min-h-screen bg-[#f0f3fd] p-3 sm:p-5 lg:p-8 flex items-center justify-center">
      {/* Outer rounded container matching reference design */}
      <div className="w-full max-w-[1400px] bg-white rounded-[28px] shadow-2xl shadow-indigo-100/70 border border-slate-100 overflow-hidden flex flex-col lg:flex-row min-h-[820px]">
        
        {/* Mobile Header (Hamburger + Brand) */}
        <div className="lg:hidden flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white">
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

        {/* 1. Left Navigation Sidebar */}
        <aside
          className={`${
            mobileMenuOpen ? "flex" : "hidden"
          } lg:flex flex-col justify-between w-full lg:w-[240px] shrink-0 bg-gradient-to-b from-blue-700 via-indigo-700 to-indigo-900 text-white p-6 transition-all duration-200`}
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
        <main className="flex-1 flex flex-col bg-[#fafbfe] p-5 sm:p-7 lg:p-9 overflow-y-auto">
          
          {/* Top-Right Profile Section */}
          <header className="flex justify-end items-center mb-6">
            <UserProfileDropdown initialUserName={userName} onNameChange={setUserName} />
          </header>

          {/* Greeting Section */}
          <section className="mb-7">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Hello {userName}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Here&apos;s your financial overview.
            </p>
          </section>

          {/* Top 3 Metric Cards (Calculated from actual database records) */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            {/* Total Balance Card */}
            <div className="bg-[#f6f4fe] border border-purple-100/80 rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Balance
                </span>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  ₹ {totalBalance.toLocaleString("en-IN")}
                </p>
                <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-indigo-600">
                  <TrendingUp size={13} />
                  <span>
                    {accounts.length} active account{accounts.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/90 text-indigo-600 flex items-center justify-center shadow-sm">
                <Wallet size={22} />
              </div>
            </div>

            {/* Total Income Card */}
            <div className="bg-[#f0fbf5] border border-emerald-100/80 rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Income
                </span>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  ₹ {totalIncome.toLocaleString("en-IN")}
                </p>
                <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-emerald-600">
                  <TrendingUp size={13} />
                  <span>Actual recorded income</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/90 text-emerald-600 flex items-center justify-center shadow-sm">
                <TrendingUp size={22} />
              </div>
            </div>

            {/* Total Expenses Card */}
            <div className="bg-[#fff3f3] border border-rose-100/80 rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Expenses
                </span>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  ₹ {totalExpenses.toLocaleString("en-IN")}
                </p>
                <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-rose-600">
                  <TrendingDown size={13} />
                  <span>Actual recorded spending</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/90 text-rose-500 flex items-center justify-center shadow-sm">
                <TrendingDown size={22} />
              </div>
            </div>
          </section>

          {/* Middle Row: Spending by Category & Monthly Budget */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            
            {/* Spending by Category Card (Dynamic SVG Donut Chart) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
              <h2 className="text-sm font-bold text-slate-900 mb-4">
                Spending by Category
              </h2>
              
              {categoryBreakdown.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-3">
                    <PieChart size={24} />
                  </div>
                  <p className="text-xs font-semibold text-slate-600">No expenses recorded yet</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[240px]">
                    Add an expense transaction to see your spending distribution by category.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
                  {/* Donut Chart */}
                  <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      {categoryBreakdown.map((cat, idx) => {
                        // Calculate offset from all previous segments
                        const previousPercent = categoryBreakdown
                          .slice(0, idx)
                          .reduce((sum, c) => sum + c.percent, 0);
                        const dashLength = (cat.percent / 100) * circleCircumference;
                        const dashOffset = -(previousPercent / 100) * circleCircumference;

                        return (
                          <circle
                            key={cat.name}
                            cx="50"
                            cy="50"
                            r="38"
                            fill="none"
                            stroke={cat.color}
                            strokeWidth="12"
                            strokeDasharray={`${dashLength} ${circleCircumference - dashLength}`}
                            strokeDashoffset={dashOffset}
                            className="transition-all duration-500"
                          />
                        );
                      })}
                    </svg>
                    {/* Donut Center text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-base font-bold text-slate-900 leading-tight">
                        ₹ {totalExpenses.toLocaleString("en-IN")}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Total Expenses
                      </span>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-col gap-2.5 w-full sm:w-auto">
                    {categoryBreakdown.map((cat) => (
                      <div key={cat.name} className="flex items-center justify-between sm:justify-start gap-4 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="text-slate-600 font-medium">{cat.name}</span>
                        </div>
                        <span className="text-slate-900 font-bold ml-auto">{cat.percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Compact Budget Summary Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-900">
                    Budget Summary
                  </h2>
                  <Link
                    href="/budget"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    View Budget &rarr;
                  </Link>
                </div>

                {!stats.isBudgetSet ? (
                  <div className="py-8 text-center">
                    <p className="text-xs text-slate-500 mb-3">No overall budget set yet.</p>
                    <Link
                      href="/budget"
                      className="inline-block px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-colors"
                    >
                      Set Overall Budget
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-800">
                        ₹ {stats.totalExpenses.toLocaleString("en-IN")}{" "}
                        <span className="text-xs font-normal text-slate-400">
                          of ₹ {stats.overallBudget.toLocaleString("en-IN")}
                        </span>
                      </span>
                      <span className="text-sm font-bold text-slate-800">
                        {Math.round(stats.actualPercent)}%
                      </span>
                    </div>

                    {/* Progress Bar with Green/Yellow/Red indicator */}
                    <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          stats.statusColor === "green"
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                            : stats.statusColor === "yellow"
                            ? "bg-gradient-to-r from-amber-400 to-amber-500"
                            : "bg-gradient-to-r from-rose-500 to-red-600"
                        }`}
                        style={{ width: `${stats.percentUsed}%` }}
                      />
                    </div>

                    <div className="mt-6 pt-5 border-t border-slate-50 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {stats.isExceeded ? "Exceeded amount:" : "Remaining budget:"}{" "}
                        <strong
                          className={
                            stats.isExceeded ? "text-rose-700 font-bold" : "text-slate-700"
                          }
                        >
                          {stats.isExceeded
                            ? `Exceeded by ₹ ${stats.exceededAmount.toLocaleString("en-IN")}`
                            : `₹ ${stats.remainingBudget.toLocaleString("en-IN")}`}
                        </strong>
                      </span>
                      <span
                        className={`font-semibold ${
                          stats.statusColor === "green"
                            ? "text-emerald-600"
                            : stats.statusColor === "yellow"
                            ? "text-amber-600"
                            : "text-rose-600"
                        }`}
                      >
                        {stats.statusColor === "green"
                          ? "On Track"
                          : stats.statusColor === "yellow"
                          ? "Near Limit"
                          : "Exceeded"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Bottom Row: Recent Transactions Table (Live User Records) */}
          <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900">
                Recent Transactions
              </h2>
              <Link
                href="/transactions"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                View all &rarr;
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-right">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                        Loading transactions...
                      </td>
                    </tr>
                  ) : recentTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                        No transactions recorded yet. Add your first transaction in the{" "}
                        <Link href="/transactions" className="text-blue-600 hover:underline font-medium">
                          Transactions page
                        </Link>
                        .
                      </td>
                    </tr>
                  ) : (
                    recentTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 text-slate-500 font-medium whitespace-nowrap">
                          {formatDateDMY(tx.date)}
                        </td>
                        <td className="py-3 px-3 text-slate-800 font-semibold whitespace-nowrap">
                          {tx.category}
                        </td>
                        <td className="py-3 px-3 text-slate-500 max-w-[200px] truncate">
                          {tx.name}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-bold whitespace-nowrap ${
                            tx.type === "Income" ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {tx.type === "Income" ? "+ " : "- "}₹ {Number(tx.amount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                              tx.type === "Income"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : "bg-rose-50 text-rose-700 border-rose-100"
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
