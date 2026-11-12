"use client";

// Types for the ArthraFinance application
export type TransactionType = "Income" | "Expense";

export interface Transaction {
  id: string;
  name: string;
  amount: number;
  type: TransactionType;
  category: string;
  account: string;
  date: string;
  createdAt?: string;
}

export interface Account {
  id: string;
  name: string;
  openingBalance?: number;
  type?: "Income" | "Expense";
  balance: number;
  totalIncome: number;
  totalExpenses: number;
}

export interface Budget {
  amount: number;
  isSet: boolean;
}

// Storage keys for browser persistence
const BUDGET_KEY = "arthra_overall_budget";
const TRANSACTIONS_KEY = "arthra_transactions";
const ACCOUNTS_KEY = "arthra_accounts";

// Helper: Read Budget
export function getStoredBudget(): Budget {
  if (typeof window === "undefined") {
    return { amount: 0, isSet: false };
  }
  try {
    const data = localStorage.getItem(BUDGET_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return {
        amount: Number(parsed.amount) || 0,
        isSet: Boolean(parsed.isSet),
      };
    }
  } catch {
    // fallback if parse fails
  }
  return { amount: 0, isSet: false };
}

// Helper: Save Budget
export function setStoredBudget(amount: number): Budget {
  const budget: Budget = {
    amount: Math.max(0, amount),
    isSet: true,
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
    window.dispatchEvent(new Event("arthra_finance_update"));
  }
  return budget;
}

// Helper: Read Transactions
export function getStoredTransactions(): Transaction[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const data = localStorage.getItem(TRANSACTIONS_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // fallback if parse fails
  }
  return [];
}

// Helper: Save Transactions
export function setStoredTransactions(transactions: Transaction[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
    window.dispatchEvent(new Event("arthra_finance_update"));
  }
}

// Helper: Read Accounts
export function getStoredAccounts(): Account[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const data = localStorage.getItem(ACCOUNTS_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // fallback if parse fails
  }
  return [];
}

// Helper: Save Accounts
export function setStoredAccounts(accounts: Account[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    window.dispatchEvent(new Event("arthra_finance_update"));
  }
}

// Core Budget Calculation Logic
export function calculateBudgetStats(budget: Budget, transactions: Transaction[]) {
  // 1. Include all EXPENSE transactions across all accounts
  // 2. Exclude all INCOME transactions
  // 3. No date-based filtering is applied
  const totalExpenses = transactions
    .filter((tx) => tx.type === "Expense")
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const budgetAmount = budget.amount;
  const isExceeded = budget.isSet && totalExpenses > budgetAmount;
  const remainingBudget = isExceeded ? 0 : Math.max(0, budgetAmount - totalExpenses);
  const exceededAmount = isExceeded ? totalExpenses - budgetAmount : 0;
  const percentUsed = budgetAmount > 0 ? (totalExpenses / budgetAmount) * 100 : 0;

  // Status Indicator:
  // - Green (< 75%): Spending is comfortably within budget
  // - Yellow (75% - 99.9%): Spending is approaching the budget limit
  // - Red (>= 100%): Total expenses have exceeded the budget
  let statusColor: "green" | "yellow" | "red" = "green";
  if (isExceeded || percentUsed >= 100) {
    statusColor = "red";
  } else if (percentUsed >= 75) {
    statusColor = "yellow";
  }

  return {
    overallBudget: budgetAmount,
    isBudgetSet: budget.isSet,
    totalExpenses,
    remainingBudget,
    exceededAmount,
    isExceeded,
    percentUsed: Math.min(100, Math.round(percentUsed)),
    actualPercent: percentUsed,
    statusColor,
  };
}

