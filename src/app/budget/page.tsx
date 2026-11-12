"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  BarChart3,
  LogOut,
  Plus,
  Edit2,
  X,
  Menu,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  getStoredBudget,
  setStoredBudget,
  getStoredTransactions,
  calculateBudgetStats,
  Budget,
  Transaction,
} from "@/lib/financeStore";
import UserProfileDropdown from "@/components/UserProfileDropdown";

// Navigation items strictly consistent with other pages
const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, active: false },
  { name: "Accounts", href: "/accounts", icon: Wallet, active: false },
  { name: "Transactions", href: "/transactions", icon: ArrowLeftRight, active: false },
  { name: "Budget", href: "/budget", icon: PieChart, active: true },
  { name: "Reports", href: "/reports", icon: BarChart3, active: false },
];

export default function BudgetPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [budget, setBudget] = useState<Budget>({ amount: 0, isSet: false });
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Modal states for Create / Edit budget
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputAmount, setInputAmount] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // BUG 1 & BUG 3: Loading and Submission Lock States
  // 1. isSaving controls the submit button disabled state and "Saving..." text
  // 2. isSubmittingRef provides an immediate synchronous lock against rapid double-clicks
  const [isSaving, setIsSaving] = useState(false);
  const isSubmittingRef = useRef(false);

  // BUG 3 FIX: Load budget and transactions directly from Supabase
  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        if (isSupabaseConfigured) {
          const { data: { user } } = await supabase.auth.getUser();

          if (user && !ignore) {
            // 1. Fetch user's active budget from Supabase `budgets` table
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

            // 2. Fetch user's actual transactions from Supabase for real-time calculation
            const { data: txData } = await supabase
              .from("transactions")
              .select("id, name, amount, type, category, date, account_id, accounts(name)")
              .eq("user_id", user.id);

            if (txData && !ignore) {
              const formattedTx: Transaction[] = txData.map((t) => {
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
              });
              setTransactions(formattedTx);
            }
            return;
          }
        }

        // Fallback: load local storage data if offline or Supabase is not configured
        if (!ignore) {
          setBudget(getStoredBudget());
          setTransactions(getStoredTransactions());
        }
      } catch {
        if (!ignore) {
          setBudget(getStoredBudget());
          setTransactions(getStoredTransactions());
        }
      }
    }

    loadData();

    // Re-fetch when transactions or budget update anywhere in the application
    window.addEventListener("arthra_finance_update", loadData);
    return () => {
      ignore = true;
      window.removeEventListener("arthra_finance_update", loadData);
    };
  }, []);

  // Compute budget metrics (expenses, remaining amount, status color)
  const stats = calculateBudgetStats(budget, transactions);

  // BUG 3 FIX: Handle Save Budget to Supabase with Duplicate Prevention (Bug 1)
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Synchronous Guard: Block concurrent clicks immediately
    if (isSubmittingRef.current) return;
    setErrorMsg("");

    const parsed = parseFloat(inputAmount);
    if (!inputAmount || isNaN(parsed) || parsed <= 0) {
      setErrorMsg("Please enter a valid budget amount greater than 0.");
      return;
    }

    try {
      // 2. Set synchronous lock and loading UI state
      isSubmittingRef.current = true;
      setIsSaving(true);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setErrorMsg("You must be logged in to set a budget.");
        return;
      }

      // 3. Upsert budget into Supabase `budgets` table
      // onConflict on user_id ensures each user has one persistent overall budget row
      const { error } = await supabase.from("budgets").upsert(
        {
          user_id: user.id,
          amount: parsed,
          is_set: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      // 4. Update local state and backup storage
      setStoredBudget(parsed);
      setBudget({ amount: parsed, isSet: true });
      setIsModalOpen(false);
      setInputAmount("");

      // 5. Broadcast update event so Dashboard and other open components instantly re-fetch
      window.dispatchEvent(new Event("arthra_finance_update"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save budget.";
      setErrorMsg(msg);
    } finally {
      // 6. Release lock and reset button state
      isSubmittingRef.current = false;
      setIsSaving(false);
    }
  };

  // Open Edit Modal
  const openEditModal = () => {
    setInputAmount(budget.amount.toString());
    setErrorMsg("");
    setIsModalOpen(true);
  };

  // Open Create Modal
  const openCreateModal = () => {
    setInputAmount("");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f0f3fd] p-3 sm:p-5 lg:p-8 flex items-center justify-center">
      {/* Outer rounded container matching Dashboard, Accounts, Transactions */}
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

        {/* 1. Left Navigation Sidebar (Budget active) */}
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
            <UserProfileDropdown />
          </header>

          {/* Page Heading & Action */}
          <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Budget
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Manage and monitor your overall spending limit.
              </p>
            </div>

            {stats.isBudgetSet && (
              <button
                onClick={openEditModal}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm transition-all duration-150 shadow-md shadow-blue-500/20"
              >
                <Edit2 size={15} />
                <span>Edit Budget</span>
              </button>
            )}
          </section>

          {/* State A: Before Budget is Created */}
          {!stats.isBudgetSet ? (
            <div className="bg-white rounded-2xl p-10 sm:p-14 border border-dashed border-slate-200 text-center max-w-2xl mx-auto my-auto shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
                <PieChart size={28} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                No Overall Budget Created Yet
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed max-w-md mx-auto mb-6">
                Set a single overall budget limit in Indian Rupees (₹) to automatically track and monitor all your expenses across all accounts in real time.
              </p>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all duration-150 shadow-md shadow-blue-500/25"
              >
                <Plus size={16} />
                <span>Create Budget</span>
              </button>
            </div>
          ) : (
            /* State B: After Budget is Created */
            <div className="space-y-6">
              
              {/* Exceeded Warning Banner */}
              {stats.isExceeded && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 shadow-sm">
                  <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <h3 className="text-sm font-bold text-rose-800">
                      Warning: Budget Exceeded
                    </h3>
                    <p className="text-xs text-rose-700 mt-0.5">
                      Your total expenses have exceeded your overall budget by{" "}
                      <strong className="font-bold underline">
                        ₹ {stats.exceededAmount.toLocaleString()}
                      </strong>
                      . Consider adjusting your budget or reducing non-essential expenses.
                    </p>
                  </div>
                </div>
              )}

              {/* Top 3 Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* 1. Overall Budget */}
                <div className="bg-[#f6f4fe] border border-purple-100 rounded-2xl p-5 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Overall Budget
                  </span>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    ₹ {stats.overallBudget.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">Active target limit</p>
                </div>

                {/* 2. Total Expenses */}
                <div className="bg-[#fff3f3] border border-rose-100 rounded-2xl p-5 shadow-sm">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total Expenses
                  </span>
                  <p className="text-2xl font-bold text-rose-600 mt-1">
                    ₹ {stats.totalExpenses.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">All expense transactions</p>
                </div>

                {/* 3. Remaining Budget OR Exceeded Amount */}
                <div
                  className={`rounded-2xl p-5 shadow-sm border ${
                    stats.isExceeded
                      ? "bg-rose-50/80 border-rose-200"
                      : "bg-[#f0fbf5] border-emerald-100"
                  }`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {stats.isExceeded ? "Exceeded Amount" : "Remaining Budget"}
                  </span>
                  <p
                    className={`text-2xl font-bold mt-1 ${
                      stats.isExceeded ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {stats.isExceeded
                      ? `Exceeded by ₹ ${stats.exceededAmount.toLocaleString()}`
                      : `₹ ${stats.remainingBudget.toLocaleString()}`}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    {stats.isExceeded
                      ? "Limit surpassed"
                      : "Available to spend"}
                  </p>
                </div>
              </div>

              {/* Budget Progress & Status Card */}
              <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-100 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Budget Utilization
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Visual spending progress against your overall budget
                    </p>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        stats.statusColor === "green"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : stats.statusColor === "yellow"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {stats.statusColor === "green" ? (
                        <>
                          <CheckCircle2 size={13} />
                          <span>Within Budget</span>
                        </>
                      ) : stats.statusColor === "yellow" ? (
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
                    <span className="text-sm font-bold text-slate-800">
                      {Math.round(stats.actualPercent)}% used
                    </span>
                  </div>
                </div>

                {/* Horizontal Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden p-0.5">
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

                <div className="flex items-center justify-between mt-3 text-xs text-slate-400 font-medium">
                  <span>₹ 0</span>
                  <span>₹ {stats.overallBudget.toLocaleString()}</span>
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* Modal: Create or Edit Overall Budget */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {budget.isSet ? "Edit Overall Budget" : "Create Overall Budget"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Overall Budget Amount (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  placeholder="e.g. 25000"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Enter your target spending limit. This budget will automatically track all expense transactions across all accounts.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shadow-md shadow-blue-500/20 flex items-center gap-2"
                >
                  {isSaving && (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  <span>{isSaving ? "Saving..." : budget.isSet ? "Save Changes" : "Create Budget"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

