import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

const accounts = [
  { name: "Main Bank Account", balance: "₹1,24,500.00", type: "Bank" },
  { name: "Savings Account", balance: "₹85,200.00", type: "Savings" },
  { name: "Cash Wallet", balance: "₹3,450.00", type: "Cash" },
];

const recentTransactions = [
  {
    label: "Salary Credit",
    category: "Income",
    amount: "+₹65,000",
    positive: true,
  },
  {
    label: "Monthly Groceries",
    category: "Food",
    amount: "-₹4,200",
    positive: false,
  },
  {
    label: "Freelance Payment",
    category: "Income",
    amount: "+₹12,000",
    positive: true,
  },
  {
    label: "Electricity Bill",
    category: "Utilities",
    amount: "-₹1,850",
    positive: false,
  },
];

const budgets = [
  { category: "Food & Dining", spent: 4200, total: 8000, pct: 52 },
  { category: "Transport", spent: 1800, total: 4000, pct: 45 },
  { category: "Utilities", spent: 1850, total: 3000, pct: 62 },
];

export default function DashboardPreviewSection() {
  return (
    <section id="preview" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Your Finances,{" "}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              All in One Place
            </span>
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            A clean, organized dashboard that gives you a complete view of your
            financial life at a glance.
          </p>
        </div>

        {/* Dashboard Preview Card */}
        <div className="rounded-3xl border border-slate-200 shadow-2xl shadow-blue-100/50 overflow-hidden bg-slate-50">
          {/* Dashboard Header Bar */}
          <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center">
                <span className="text-white text-xs font-bold">AF</span>
              </div>
              <span className="text-white font-semibold text-sm">
                ArthraFinance — Dashboard
              </span>
            </div>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-white/30" />
              <div className="w-3 h-3 rounded-full bg-white/30" />
              <div className="w-3 h-3 rounded-full bg-white/30" />
            </div>
          </div>

          {/* Dashboard Body */}
          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Summary Cards */}
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Wallet className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">
                    Total Balance
                  </p>
                  <p className="text-lg font-bold text-slate-900">
                    ₹2,13,150
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <TrendingUp className="text-emerald-500" size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">
                    Total Income
                  </p>
                  <p className="text-lg font-bold text-slate-900">₹77,000</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <TrendingDown className="text-rose-500" size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">
                    Total Expenses
                  </p>
                  <p className="text-lg font-bold text-slate-900">₹7,850</p>
                </div>
              </div>
            </div>

            {/* Accounts */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Wallet size={16} className="text-blue-600" />
                <h4 className="text-sm font-semibold text-slate-800">
                  My Accounts
                </h4>
              </div>
              <ul className="flex flex-col gap-3">
                {accounts.map((acc) => (
                  <li
                    key={acc.name}
                    className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {acc.name}
                      </p>
                      <p className="text-xs text-slate-400">{acc.type}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">
                      {acc.balance}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <ArrowUpRight size={16} className="text-blue-600" />
                <h4 className="text-sm font-semibold text-slate-800">
                  Recent Transactions
                </h4>
              </div>
              <ul className="flex flex-col gap-3">
                {recentTransactions.map((tx) => (
                  <li
                    key={tx.label}
                    className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center ${
                          tx.positive ? "bg-emerald-50" : "bg-rose-50"
                        }`}
                      >
                        {tx.positive ? (
                          <ArrowUpRight
                            size={14}
                            className="text-emerald-500"
                          />
                        ) : (
                          <ArrowDownRight
                            size={14}
                            className="text-rose-400"
                          />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-800">
                          {tx.label}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {tx.category}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        tx.positive ? "text-emerald-500" : "text-rose-400"
                      }`}
                    >
                      {tx.amount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Budget Overview */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <PieChart size={16} className="text-violet-600" />
                <h4 className="text-sm font-semibold text-slate-800">
                  Budget Overview
                </h4>
              </div>
              <ul className="flex flex-col gap-4">
                {budgets.map((b) => (
                  <li key={b.category}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-700 font-medium">
                        {b.category}
                      </span>
                      <span className="text-slate-400">
                        ₹{b.spent.toLocaleString()} / ₹
                        {b.total.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                        style={{ width: `${b.pct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 text-right">
                      {b.pct}% used
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

