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
  Calendar,
  X,
  Menu,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import UserProfileDropdown from "@/components/UserProfileDropdown";
import { formatDateDMY, parseDMYToISO } from "@/lib/dateUtils";

// Navigation items matching Dashboard and Accounts
const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, active: false },
  { name: "Accounts", href: "/accounts", icon: Wallet, active: false },
  { name: "Transactions", href: "/transactions", icon: ArrowLeftRight, active: true },
  { name: "Budget", href: "/budget", icon: PieChart, active: false },
  { name: "Reports", href: "/reports", icon: BarChart3, active: false },
];

export type TransactionType = "Income" | "Expense";

interface AccountOption {
  id: string;
  name: string;
}

interface UserTransaction {
  id: string;
  name: string;
  amount: number;
  type: TransactionType;
  category: string;
  accountId: string;
  accountName: string;
  date: string;
}

// Available default categories
const defaultCategories = [
  "Salary",
  "Food & Dining",
  "Transport",
  "Bills & Utilities",
  "Shopping",
  "Health & Wellness",
  "Consulting",
  "Entertainment",
  "Others",
];

export default function TransactionsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Transaction Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addType, setAddType] = useState<TransactionType>("Expense");
  const [addCategory, setAddCategory] = useState("Food & Dining");
  const [addAccountId, setAddAccountId] = useState("");
  const [addDate, setAddDate] = useState("2026-10-28");
  const [addDateDisplay, setAddDateDisplay] = useState("28/10/2026");
  const addDateInputRef = useRef<HTMLInputElement>(null);

  // Edit Transaction Modal State
  const [editingTransaction, setEditingTransaction] = useState<UserTransaction | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editType, setEditType] = useState<TransactionType>("Expense");
  const [editCategory, setEditCategory] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDateDisplay, setEditDateDisplay] = useState("");
  const editDateInputRef = useRef<HTMLInputElement>(null);

  // Form Validation Message State
  const [formError, setFormError] = useState("");

  // BUG 1 FIX: Loading & In-flight Locks for Duplicate Prevention
  // 1. isSaving controls UI feedback (disables submit button and shows "Saving...")
  // 2. isSubmittingRef provides an immediate synchronous lock to block rapid duplicate clicks
  const [isSaving, setIsSaving] = useState(false);
  const isSubmittingRef = useRef(false);

  // Load user's actual accounts and transactions from Supabase
  useEffect(() => {
    let ignore = false;

    async function fetchData() {
      try {
        if (isSupabaseConfigured) {
          const { data: { user } } = await supabase.auth.getUser();

          if (user && !ignore) {
            // 1. Fetch user's actual accounts
            const { data: accData } = await supabase
              .from("accounts")
              .select("id, name")
              .eq("user_id", user.id)
              .order("name", { ascending: true });

            if (!ignore) {
              const userAccounts = accData || [];
              setAccounts(userAccounts);
              if (userAccounts.length > 0) {
                setAddAccountId((prev) => prev || userAccounts[0].id);
              }
            }

            // 2. Fetch user's actual transactions
            const { data: txData } = await supabase
              .from("transactions")
              .select("id, name, amount, type, category, date, account_id, accounts(name)")
              .eq("user_id", user.id)
              .order("date", { ascending: false });

            if (txData && !ignore) {
              setTransactions(
                txData.map((t) => {
                  const accountRel = t.accounts as unknown as { name?: string } | null;
                  return {
                    id: t.id,
                    name: t.name,
                    amount: Number(t.amount || 0),
                    type: t.type as TransactionType,
                    category: t.category,
                    accountId: t.account_id,
                    accountName: accountRel?.name || "Account",
                    date: t.date,
                  };
                })
              );
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

    // Listen for updates in accounts or transactions from other parts of the app
    const handleUpdate = () => {
      fetchData();
    };

    window.addEventListener("arthra_finance_update", handleUpdate);
    return () => {
      ignore = true;
      window.removeEventListener("arthra_finance_update", handleUpdate);
    };
  }, []);

  // Handler: Add Transaction with Balance Validation (Bug 2) & Duplicate Prevention (Bug 1)
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Guard against rapid multiple clicks immediately
    if (isSubmittingRef.current) return;
    setFormError("");

    if (!addName.trim()) {
      setFormError("Please enter a transaction name.");
      return;
    }

    const numAmount = parseFloat(addAmount);
    if (!addAmount || isNaN(numAmount) || numAmount <= 0) {
      setFormError("Please enter a valid amount greater than 0.");
      return;
    }

    if (!addAccountId) {
      setFormError("Please select an account. Add an account first if none exist.");
      return;
    }

    try {
      // 2. Set synchronous lock and UI loading state
      isSubmittingRef.current = true;
      setIsSaving(true);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setFormError("You must be logged in to add a transaction.");
        return;
      }

      // 3. BUG 2 VALIDATION: Account Balance Check for Expenses
      // Before creating an Expense, verify the selected account has sufficient funds.
      // Balance Formula: Opening Balance + Total Income - Total Expenses
      if (addType === "Expense") {
        // Query account details directly from Supabase
        const { data: accData, error: accErr } = await supabase
          .from("accounts")
          .select("id, name, opening_balance")
          .eq("id", addAccountId)
          .eq("user_id", user.id)
          .single();

        if (accErr || !accData) {
          setFormError("Selected account not found or inaccessible.");
          return;
        }

        // Query all existing transactions for this account
        const { data: existingTx, error: txErr } = await supabase
          .from("transactions")
          .select("amount, type")
          .eq("account_id", addAccountId)
          .eq("user_id", user.id);

        if (txErr) {
          setFormError("Failed to verify account balance.");
          return;
        }

        // Compute available balance dynamically
        const totalIncome = (existingTx || [])
          .filter((t) => t.type === "Income")
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const totalExpenses = (existingTx || [])
          .filter((t) => t.type === "Expense")
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);

        const availableBalance = Number(accData.opening_balance || 0) + totalIncome - totalExpenses;

        // Reject if expense amount exceeds available balance
        if (numAmount > availableBalance) {
          setFormError(`Insufficient balance. Your ${accData.name} has ₹${availableBalance.toLocaleString("en-IN")} available.`);
          return;
        }
      }

      // 4. BUG 1 IDEMPOTENCY: Generate client-side UUID
      // Prevents duplicate inserts at the database primary key level
      const newTxId = crypto.randomUUID();

      // Insert directly into Supabase transactions table
      const finalAddDate = parseDMYToISO(addDateDisplay) || addDate || "2026-10-28";
      const { error } = await supabase.from("transactions").insert({
        id: newTxId,
        user_id: user.id,
        account_id: addAccountId,
        name: addName.trim(),
        amount: numAmount,
        type: addType,
        category: addCategory,
        date: finalAddDate,
      });

      if (error) {
        setFormError(error.message);
        return;
      }

      // 5. Success: Refresh data and close modal
      window.dispatchEvent(new Event("arthra_finance_update"));

      setAddName("");
      setAddAmount("");
      setAddType("Expense");
      setAddCategory("Food & Dining");
      setAddDate("2026-10-28");
      setAddDateDisplay("28/10/2026");
      setIsAddModalOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add transaction.";
      setFormError(message);
    } finally {
      // 6. Reset locks and loading indicator
      isSubmittingRef.current = false;
      setIsSaving(false);
    }
  };

  // Handler: Open Edit Modal
  const openEditModal = (tx: UserTransaction) => {
    setEditingTransaction(tx);
    setEditName(tx.name);
    setEditAmount(tx.amount.toString());
    setEditType(tx.type);
    setEditCategory(tx.category);
    setEditAccountId(tx.accountId);
    setEditDate(tx.date);
    setEditDateDisplay(formatDateDMY(tx.date));
    setFormError("");
  };

  // Handler: Save Edit Transaction with Balance Validation (Bug 2) & In-flight Lock (Bug 1)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guard against rapid duplicate clicks
    if (isSubmittingRef.current) return;
    if (!editingTransaction) return;
    setFormError("");

    if (!editName.trim()) {
      setFormError("Please enter a transaction name.");
      return;
    }

    const numAmount = parseFloat(editAmount);
    if (!editAmount || isNaN(numAmount) || numAmount <= 0) {
      setFormError("Please enter a valid amount greater than 0.");
      return;
    }

    if (!editAccountId) {
      setFormError("Please select a valid account.");
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSaving(true);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setFormError("You must be logged in to update a transaction.");
        return;
      }

      // BUG 2 VALIDATION: Account Balance Check when Editing Expenses
      // When editing, account for the original transaction so its original amount
      // is not double-counted as a deduction.
      if (editType === "Expense") {
        // Fetch target account details
        const { data: accData, error: accErr } = await supabase
          .from("accounts")
          .select("id, name, opening_balance")
          .eq("id", editAccountId)
          .eq("user_id", user.id)
          .single();

        if (accErr || !accData) {
          setFormError("Selected account not found or inaccessible.");
          return;
        }

        // Fetch all transactions for this account
        const { data: existingTx, error: txErr } = await supabase
          .from("transactions")
          .select("id, amount, type")
          .eq("account_id", editAccountId)
          .eq("user_id", user.id);

        if (txErr) {
          setFormError("Failed to verify account balance.");
          return;
        }

        // Calculate available balance EXCLUDING the transaction currently being edited
        let availableBalance = Number(accData.opening_balance || 0);

        for (const t of existingTx || []) {
          // Skip the original version of this transaction
          if (t.id === editingTransaction.id) {
            continue;
          }
          if (t.type === "Income") {
            availableBalance += Number(t.amount || 0);
          } else if (t.type === "Expense") {
            availableBalance -= Number(t.amount || 0);
          }
        }

        // Reject if updated expense amount exceeds available balance
        if (numAmount > availableBalance) {
          setFormError(`Insufficient balance. Your ${accData.name} has ₹${availableBalance.toLocaleString("en-IN")} available.`);
          return;
        }
      }

      const finalEditDate = parseDMYToISO(editDateDisplay) || editDate || "2026-10-28";
      const { error } = await supabase
        .from("transactions")
        .update({
          account_id: editAccountId,
          name: editName.trim(),
          amount: numAmount,
          type: editType,
          category: editCategory,
          date: finalEditDate,
        })
        .eq("id", editingTransaction.id);

      if (error) {
        setFormError(error.message);
        return;
      }

      // Refresh list from database and broadcast update
      window.dispatchEvent(new Event("arthra_finance_update"));
      setEditingTransaction(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update transaction.";
      setFormError(message);
    } finally {
      isSubmittingRef.current = false;
      setIsSaving(false);
    }
  };

  // Handler: Delete Transaction
  const handleDeleteTransaction = async (id: string) => {
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (!error) {
        window.dispatchEvent(new Event("arthra_finance_update"));
      }
    } catch {
      // safe fallback
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f3fd] p-3 sm:p-5 lg:p-8 flex items-center justify-center">
      {/* Outer rounded container matching Dashboard and Accounts */}
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

        {/* 1. Left Navigation Sidebar (Transactions highlighted as active) */}
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

          {/* Page Heading & Action Button */}
          <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Transactions
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                View, record, and manage all your income and expenses.
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
              <span>+ Add Transaction</span>
            </button>
          </section>

          {/* Transactions List Table */}
          <section className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">
                All Transactions
              </h2>
              <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-medium">
                {transactions.length} total
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3">Transaction</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Account</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                    <th className="py-3 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Loading transactions...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No transactions recorded yet. Click <strong>+ Add Transaction</strong> to record your first one.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => {
                      const isIncome = tx.type === "Income";

                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Name / Description */}
                          <td className="py-3.5 px-3 font-semibold text-slate-800 max-w-[220px] truncate">
                            {tx.name}
                          </td>

                          {/* Type (Green for Income, Rose for Expense) */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                isIncome
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                  : "bg-rose-50 text-rose-700 border-rose-100"
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-3 text-slate-600 font-medium whitespace-nowrap">
                            {tx.category}
                          </td>

                          {/* Account */}
                          <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                            {tx.accountName}
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                            {formatDateDMY(tx.date)}
                          </td>

                          {/* Amount */}
                          <td
                            className={`py-3.5 px-3 text-right font-bold whitespace-nowrap ${
                              isIncome ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {isIncome ? `+ ₹ ${tx.amount.toLocaleString()}` : `- ₹ ${tx.amount.toLocaleString()}`}
                          </td>

                          {/* Actions (Edit / Delete) */}
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => openEditModal(tx)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 font-medium transition-colors"
                                title="Edit Transaction"
                              >
                                <Edit2 size={13} />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(tx.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50/60 font-medium transition-colors"
                                title="Delete Transaction"
                              >
                                <Trash2 size={13} />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </main>
      </div>

      {/* Modal: Add Transaction */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                Add New Transaction
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

            <form onSubmit={handleAddTransaction} className="space-y-3.5">
              {/* Transaction Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Transaction Name
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Grocery Shopping"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>

              {/* Type: Income / Expense */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(["Expense", "Income"] as TransactionType[]).map((type) => (
                    <label
                      key={type}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs font-semibold transition-all ${
                        addType === type
                          ? type === "Income"
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20"
                            : "border-rose-600 bg-rose-50 text-rose-700 ring-2 ring-rose-500/20"
                          : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="addTxType"
                        value={type}
                        checked={addType === type}
                        onChange={() => setAddType(type)}
                        className="sr-only"
                      />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Category
                </label>
                <select
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                >
                  {defaultCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Account Dropdown (Dynamically populated from user's Supabase accounts) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Account
                </label>
                <select
                  value={addAccountId}
                  onChange={(e) => setAddAccountId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                >
                  {accounts.length === 0 ? (
                    <option value="" disabled>
                      No accounts found. Please add an account first.
                    </option>
                  ) : (
                    accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Date */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Date (d/m/y)
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Day/Month/Year
                  </span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={addDateDisplay}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAddDateDisplay(val);
                      const iso = parseDMYToISO(val);
                      if (iso) setAddDate(iso);
                    }}
                    placeholder="D/M/YYYY (e.g. 4/11/2026)"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all pr-10 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (addDateInputRef.current?.showPicker) {
                        addDateInputRef.current.showPicker();
                      } else {
                        addDateInputRef.current?.focus();
                      }
                    }}
                    className="absolute right-2.5 p-1 text-slate-400 hover:text-blue-600 transition-colors"
                    title="Open calendar picker"
                  >
                    <Calendar size={16} />
                  </button>
                  <input
                    ref={addDateInputRef}
                    type="date"
                    value={addDate}
                    onChange={(e) => {
                      const newIso = e.target.value;
                      setAddDate(newIso);
                      setAddDateDisplay(formatDateDMY(newIso));
                    }}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="sr-only"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Format: D/M/YYYY (e.g. 4/11/2026)
                </p>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={accounts.length === 0 || isSaving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shadow-md shadow-blue-500/20 flex items-center gap-2"
                >
                  {isSaving && (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  <span>{isSaving ? "Saving..." : "Save"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Transaction */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                Edit Transaction
              </h2>
              <button
                onClick={() => setEditingTransaction(null)}
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

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              {/* Transaction Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Transaction Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>

              {/* Type: Income / Expense */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(["Expense", "Income"] as TransactionType[]).map((type) => (
                    <label
                      key={type}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs font-semibold transition-all ${
                        editType === type
                          ? type === "Income"
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20"
                            : "border-rose-600 bg-rose-50 text-rose-700 ring-2 ring-rose-500/20"
                          : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="editTxType"
                        value={type}
                        checked={editType === type}
                        onChange={() => setEditType(type)}
                        className="sr-only"
                      />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                >
                  {defaultCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Account Dropdown */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Account
                </label>
                <select
                  value={editAccountId}
                  onChange={(e) => setEditAccountId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Date (d/m/y)
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Day/Month/Year
                  </span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={editDateDisplay}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditDateDisplay(val);
                      const iso = parseDMYToISO(val);
                      if (iso) setEditDate(iso);
                    }}
                    placeholder="D/M/YYYY (e.g. 4/11/2026)"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all pr-10 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (editDateInputRef.current?.showPicker) {
                        editDateInputRef.current.showPicker();
                      } else {
                        editDateInputRef.current?.focus();
                      }
                    }}
                    className="absolute right-2.5 p-1 text-slate-400 hover:text-blue-600 transition-colors"
                    title="Open calendar picker"
                  >
                    <Calendar size={16} />
                  </button>
                  <input
                    ref={editDateInputRef}
                    type="date"
                    value={editDate}
                    onChange={(e) => {
                      const newIso = e.target.value;
                      setEditDate(newIso);
                      setEditDateDisplay(formatDateDMY(newIso));
                    }}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="sr-only"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Format: D/M/YYYY (e.g. 4/11/2026)
                </p>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors shadow-md shadow-blue-500/20 flex items-center gap-2"
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

    </div>
  );
}
