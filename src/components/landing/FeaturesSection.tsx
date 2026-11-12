import {
  CreditCard,
  TrendingUp,
  PieChart,
  Landmark,
} from "lucide-react";

const features = [
  {
    icon: TrendingUp,
    title: "Expense Tracking",
    description:
      "Record and categorize every expense with ease. Stay on top of where your money goes every day, week and month.",
  },
  {
    icon: CreditCard,
    title: "Income Management",
    description:
      "Track all your income sources in one place. Understand your total earnings and plan your finances with clarity.",
  },
  {
    icon: PieChart,
    title: "Budget Planning",
    description:
      "Set monthly budgets for different categories and monitor your spending against them in real time.",
  },
  {
    icon: Landmark,
    title: "Multiple Account Management",
    description:
      "Manage all your bank accounts, wallets and cash accounts together and always know your total financial position.",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Everything You Need to{" "}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Manage Your Money
            </span>
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Simple, focused tools built to give you a complete picture of your
            personal finances.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col gap-4"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-50 to-violet-50 border border-blue-100 flex items-center justify-center">
                  <Icon className="text-blue-600" size={22} />
                </div>
                <div>
                  <h3 className="text-slate-900 font-semibold text-base mb-1.5">
                    {feature.title}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

