import { UserPlus, ArrowLeftRight, BarChart2 } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: UserPlus,
    title: "Create Your Account",
    description:
      "Register and get started with ArthraFinance in minutes. Set up your profile and add your accounts.",
  },
  {
    number: "02",
    icon: ArrowLeftRight,
    title: "Track Your Transactions",
    description:
      "Record and organize your income and expenses as they happen. Categorize each transaction for clarity.",
  },
  {
    number: "03",
    icon: BarChart2,
    title: "Monitor Your Finances",
    description:
      "Review your account balances, budgets and financial reports to understand and improve your financial health.",
  },
];

export default function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="py-24 bg-gradient-to-b from-slate-50 to-white"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Manage Your Finances in{" "}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Three Simple Steps
            </span>
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Getting started is straightforward. Follow these steps and take
            control of your finances today.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line (desktop only) */}
          <div className="hidden md:block absolute top-10 left-[calc(16.66%+1.5rem)] right-[calc(16.66%+1.5rem)] h-px bg-gradient-to-r from-blue-200 via-violet-200 to-blue-200" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="relative flex flex-col items-center text-center gap-4">
                {/* Step bubble */}
                <div className="relative z-10 w-20 h-20 rounded-full bg-white border-2 border-blue-100 shadow-md flex flex-col items-center justify-center">
                  <Icon className="text-blue-600 mb-0.5" size={24} />
                  <span className="text-[10px] font-bold text-violet-500 tracking-widest">
                    {step.number}
                  </span>
                </div>

                <div>
                  <h3 className="text-slate-900 font-semibold text-lg mb-2">
                    {step.title}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
                    {step.description}
                  </p>
                </div>

                {/* Mobile connector */}
                {index < steps.length - 1 && (
                  <div className="md:hidden w-px h-10 bg-gradient-to-b from-blue-200 to-violet-200 mx-auto" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

