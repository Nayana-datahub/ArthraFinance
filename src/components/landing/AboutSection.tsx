export default function AboutSection() {
  return (
    <section id="about" className="py-24 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
          About{" "}
          <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
            ArthraFinance
          </span>
        </h2>
        <p className="text-slate-600 text-lg leading-relaxed mb-6">
          ArthraFinance is a personal finance management application built to
          make financial organization simple, clear and effective. Managing your
          money should not require complex tools or financial expertise.
        </p>
        <p className="text-slate-600 text-lg leading-relaxed">
          With ArthraFinance, you can track your income sources, monitor your
          daily expenses, plan budgets for different spending categories and
          manage multiple accounts — all in a single organized application. Our
          goal is to give you a clear and accurate picture of your financial
          position so you can make better decisions and work confidently towards
          your financial goals.
        </p>
      </div>
    </section>
  );
}

