export default function CTASection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-violet-700 px-8 py-16 text-center">
          {/* Subtle inner glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-white/10 rounded-full blur-3xl" />
          </div>

          {/* Decorative curved lines */}
          <svg
            className="absolute inset-0 w-full h-full opacity-10"
            viewBox="0 0 800 300"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M -50 200 Q 200 50 400 150 Q 600 250 850 100"
              stroke="white"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M -50 240 Q 200 90 400 190 Q 600 290 850 140"
              stroke="white"
              strokeWidth="1"
              fill="none"
            />
            <path
              d="M -50 160 Q 200 10 400 110 Q 600 210 850 60"
              stroke="white"
              strokeWidth="0.8"
              fill="none"
            />
          </svg>

          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to Take Control of Your Money?
            </h2>
            <p className="text-blue-100 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
              Join ArthraFinance and start organizing your income, expenses,
              budgets and accounts in one simple application.
            </p>
            <a
              href="/signup"
              className="inline-flex items-center px-8 py-3.5 rounded-full bg-white text-blue-700 font-semibold text-base hover:bg-blue-50 transition-all duration-200 shadow-lg shadow-black/10 hover:-translate-y-px"
            >
              Get Started
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

