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
  Trash2,
  Eye,
  X,
  Menu,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import UserProfileDropdown from "@/components/UserProfileDropdown";
import { formatDateDMY } from "@/lib/dateUtils";

interface AccountData {
  id: string;
  name: string;
  opening_balance: number;
  currentBalance: number;
  totalIncome: number;
  totalExpenses: number;
}

interface AccountTransaction {
  id: string;
  accountId: string;
  name: string;
  amount: number;
  type: "Income" | "Expense";
  category: string;
  date: string;
}

// Navigation items matching Dashboard
const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, active: false },
  { name: "Accounts", href: "/accounts", icon: Wallet, active: true },
  { name: "Transactions", href: "/transactions", icon: ArrowLeftRight, active: false },
  { name: "Budget", href: "/budget", icon: PieChart, active: false },
  { name: "Reports", href: "/reports", icon: BarChart3, active: false },
];

export default function AccountsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected account for in-page details view
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Add Account Modal State (ONLY Account Name & Opening Balance)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addBalance, setAddBalance] = useState("");

  // Edit Account Modal State (ONLY Account Name & Opening Balance)
  const [editingAccount, setEditingAccount] = useState<AccountData | null>(null);
  const [editName, setEditName] = useState("");
  const [editBalance, setEditBalance] = useState("");

  // Delete Confirmation State
  const [accountToDelete, setAccountToDelete] = useState<AccountData | null>(null);

  // Form Validation Message State
  const [formError, setFormError] = useState("");

  // BUG 1 FIX: Loading & Duplicate Prevention States
  // 1. isSaving controls UI feedback (disables submit button and shows "Saving...")
  // 2. isSubmittingRef provides an immediate synchronous lock to block rapid duplicate clicks
  const [isSaving, setIsSaving] = useState(false);
  const isSubmittingRef = useRef(false);

  // Fetch live accounts and transactions from Supabase
  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      try {
        if (isSupabaseConfigured) {
          const { data: { user } } = await supabase.auth.getUser();

          if (user && !ignore) {
            // 1. Fetch user's accounts
            const { data: accData } = await supabase
              .from("accounts")
              .select("*")
              .eq("user_id", user.id)
              .order("name", { ascending: true });

            // 2. Fetch user's transactions
            const { data: txData } = await supabase
              .from("transactions")
              .select("id, name, amount, type, category, date, account_id")
              .eq("user_id", user.id)
              .order("date", { ascending: false });

            if (!ignore) {
              const userTx: AccountTransaction[] = (txData || []).map((t) => ({
                id: t.id,
                accountId: t.account_id,
                name: t.name,
                amount: Number(t.amount || 0),
                type: t.type as "Income" | "Expense",
                category: t.category,
                date: t.date,
              }));

              setTransactions(userTx);

              // 3. Compute dynamic balances: Opening Balance + Total Income − Total Expenses
              const calculatedAccounts: AccountData[] = (accData || []).map((acc) => {
                const accTx = userTx.filter((t) => t.accountId === acc.id);
                const inc = accTx
                  .filter((t) => t.type === "Income")
                  .reduce((sum, t) => sum + t.amount, 0);
                const exp = accTx
                  .filter((t) => t.type === "Expense")
                  .reduce((sum, t) => sum + t.amount, 0);
                const opening = Number(acc.opening_balance || 0);
                const current = opening + inc - exp;

                return {
                  id: acc.id,
                  name: acc.name,
                  opening_balance: opening,
                  currentBalance: current,
                  totalIncome: inc,
                  totalExpenses: exp,
                };
              });

              setAccounts(calculatedAccounts);
            }
          }
        }
      } catch {
        // safe fallback
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchData();

    // Re-fetch when accounts or transactions update
    const handleUpdate = () => {
      fetchData();
    };

    window.addEventListener("arthra_finance_update", handleUpdate);
    return () => {
      ignore = true;
      window.removeEventListener("arthra_finance_update", handleUpdate);
    };
  }, []);

  // Handler: Add Account with In-flight Lock and Idempotency Protection (Bug 1 Fix)
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Synchronous Guard: Block concurrent clicks immediately before React re-renders
    if (isSubmittingRef.current) return;
    setFormError("");

    if (!addName.trim()) {
      setFormError("Please enter an account name.");
      return;
    }

    const numBalance = parseFloat(addBalance) || 0;

    try {
      // 2. Set both ref-lock and UI state
      isSubmittingRef.current = true;
      setIsSaving(true);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setFormError("You must be logged in to create an account.");
        return;
      }

      // 3. Generate a client-side UUID for idempotency
      // If a request is resent, Supabase PostgreSQL primary key constraint prevents duplicate entries
      const newAccountId = crypto.randomUUID();

      const { error } = await supabase.from("accounts").insert({
        id: newAccountId,
        user_id: user.id,
        name: addName.trim(),
        opening_balance: numBalance,
      });

      if (error) {
        setFormError(error.message);
        return;
      }

      // 4. Success: Notify app, reset form inputs, and close modal
      window.dispatchEvent(new Event("arthra_finance_update"));
      setAddName("");
      setAddBalance("");
      setIsAddModalOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create account.";
      setFormError(message);
    } finally {
      // 5. Always release lock and reset loading state so user can retry on failure or add another
      isSubmittingRef.current = false;
      setIsSaving(false);
    }
  };

  // Handler: Open Edit Modal
  const openEditModal = (acc: AccountData) => {
    setEditingAccount(acc);
    setEditName(acc.name);
    setEditBalance(acc.opening_balance.toString());
    setFormError("");
  };

  // Handler: Save Edit Account with In-flight Guard (Bug 1 Fix)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guard against multiple rapid clicks
    if (isSubmittingRef.current) return;
    if (!editingAccount) return;
    setFormError("");

    if (!editName.trim()) {
      setFormError("Please enter an account name.");
      return;
    }

    const numBalance = parseFloat(editBalance) || 0;

    try {
      isSubmittingRef.current = true;
      setIsSaving(true);

      const { error } = await supabase
        .from("accounts")
        .update({
          name: editName.trim(),
          opening_balance: numBalance,
        })
        .eq("id", editingAccount.id);

      if (error) {
        setFormError(error.message);
        return;
      }

      window.dispatchEvent(new Event("arthra_finance_update"));
      setEditingAccount(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update account.";
      setFormError(message);
    } finally {
      isSubmittingRef.current = false;
      setIsSaving(false);
    }
  };

  // Handler: Confirm Delete Account (with cascading transaction deletion)
  const handleConfirmDelete = async () => {
    if (!accountToDelete) return;

    try {
      const { error } = await supabase
        .from("accounts")
        .delete()
        .eq("id", accountToDelete.id);

      if (!error) {
        if (selectedAccountId === accountToDelete.id) {
          setSelectedAccountId(null);
        }
        window.dispatchEvent(new Event("arthra_finance_update"));
      }
    } finally {
      setAccountToDelete(null);
    }
  };

  // Get active selected account details
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // Filter most recent 10 transactions belonging to the selected account
  const accountTransactions = transactions
    .filter((tx) => tx.accountId === selectedAccountId)
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-[#f0f3fd] p-3 sm:p-5 lg:p-8 flex items-center justify-center">
      {/* Outer rounded container matching Dashboard design */}
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

        {/* 1. Left Navigation Sidebar (Accounts highlighted as active) */}
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

          {/* Page Heading & Add Account Button */}
          <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Accounts
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Manage and monitor your financial accounts.
              </p>
            </div>
            <button
              onClick={() => {
                setFormError("");
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm transition-all duration-150 shadow-md shadow-blue-500/20"
            >
              <Plus size={16} />
              <span>+ Add Account</span>
            </button>
          </section>

          {/* Account Cards Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
            {loading ? (
              <div className="col-span-full py-12 text-center text-xs text-slate-400">
                Loading accounts...
              </div>
            ) : accounts.length === 0 ? (
              <div className="col-span-full bg-white rounded-2xl p-12 border border-dashed border-slate-200 text-center">
                <p className="text-slate-600 font-semibold text-base mb-1">
                  No accounts added yet
                </p>
                <p className="text-slate-400 text-xs mb-5">
                  Create your first account (e.g. HDFC Bank, SBI Bank, Cash) to begin tracking.
                </p>
                <button
                  onClick={() => {
                    setFormError("");
                    setIsAddModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-sm"
                >
                  <Plus size={14} />
                  <span>Add Account</span>
                </button>
              </div>
            ) : (
              accounts.map((acc) => {
                const isSelected = selectedAccountId === acc.id;

                return (
                  <div
                    key={acc.id}
                    className={`bg-white rounded-2xl p-6 border transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
                        : "border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200"
                    }`}
                  >
                    {/* Card Top: Account Name & Balance */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                          <Wallet size={18} />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400">
                          Opening: ₹ {acc.opening_balance.toLocaleString("en-IN")}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 mb-1">
                        {acc.name}
                      </h3>
                      <p className="text-xs text-slate-400">Current Balance</p>
                      <p className="text-2xl font-bold text-slate-900 mt-0.5 mb-4">
                        ₹ {acc.currentBalance.toLocaleString("en-IN")}
                      </p>

                      {/* Cash Flow Summary */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl mb-4 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Total In</span>
                          <span className="font-bold text-emerald-600">
                            + ₹ {acc.totalIncome.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Total Out</span>
                          <span className="font-bold text-rose-600">
                            - ₹ {acc.totalExpenses.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions: View Details, Edit, Delete */}
                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-xs">
                      <button
                        onClick={() =>
                          setSelectedAccountId(isSelected ? null : acc.id)
                        }
                        className={`font-semibold transition-colors flex items-center gap-1.5 ${
                          isSelected
                            ? "text-blue-700 underline"
                            : "text-blue-600 hover:text-blue-800"
                        }`}
                      >
                        <Eye size={14} />
                        <span>{isSelected ? "Hide Details" : "View Details"}</span>
                      </button>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEditModal(acc)}
                          className="text-slate-500 hover:text-indigo-600 font-medium transition-colors flex items-center gap-1"
                          title="Edit Account"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => setAccountToDelete(acc)}
                          className="text-slate-500 hover:text-rose-600 font-medium transition-colors flex items-center gap-1"
                          title="Delete Account"
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          {/* In-Page Account Details View (10 Most Recent Transactions for Selected Account) */}
          {selectedAccount && (
            <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      {selectedAccount.name}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Opening Balance: ₹ {selectedAccount.opening_balance.toLocaleString("en-IN")} • Current Balance: ₹ {selectedAccount.currentBalance.toLocaleString("en-IN")}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAccountId(null)}
                  className="self-start sm:self-auto text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-slate-50 border border-slate-200"
                >
                  <X size={14} />
                  <span>Close Details</span>
                </button>
              </div>

              {/* Transactions Table for this account */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Recent Activity (Up to 10 transactions)
                </h3>

                {accountTransactions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No transactions associated with this account yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3 text-right">Amount</th>
                          <th className="py-2.5 px-3 text-right">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {accountTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
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
                                tx.type === "Income"
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                              }`}
                            >
                              {tx.type === "Income" ? "+ " : "- "}₹ {tx.amount.toLocaleString("en-IN")}
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

        </main>
      </div>

      {/* Modal: Add Account (ONLY Account Name & Opening Balance) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                Add New Account
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddAccount} className="space-y-4">
              {/* Account Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Account Name
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. HDFC Bank, SBI Bank, Cash, Savings Account"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>

              {/* Opening Balance */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Opening Balance (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  value={addBalance}
                  onChange={(e) => setAddBalance(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
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
                  <span>{isSaving ? "Saving..." : "Create Account"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Account (ONLY Account Name & Opening Balance) */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                Edit Account
              </h2>
              <button
                onClick={() => setEditingAccount(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Account Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Account Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. HDFC Bank, SBI Bank, Cash"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>

              {/* Opening Balance */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Opening Balance (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editBalance}
                  onChange={(e) => setEditBalance(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
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
                  <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Account (With Cascading Transactions Warning) */}
      {accountToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Delete Account?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Deleting this account will also permanently delete all transactions associated with it. This action cannot be undone. Are you sure you want to continue?
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors shadow-md shadow-rose-500/20"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
