export default function HeroSection() {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white pt-16"
    >
      {/* Subtle background gradient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-blue-100/60 via-violet-100/40 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Decorative SVG curved lines — reference-inspired */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg
          className="absolute bottom-0 left-0 w-full h-full opacity-20"
          viewBox="0 0 1440 700"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="lineGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <path
            d="M -100 500 Q 300 200 600 400 Q 900 600 1200 300 Q 1400 150 1600 350"
            stroke="url(#lineGrad1)"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M -100 550 Q 250 250 550 450 Q 850 650 1150 350 Q 1350 200 1600 400"
            stroke="url(#lineGrad1)"
            strokeWidth="1"
            fill="none"
          />
          <path
            d="M -100 600 Q 200 300 500 500 Q 800 700 1100 400 Q 1300 250 1600 450"
            stroke="url(#lineGrad1)"
            strokeWidth="0.8"
            fill="none"
          />
          <path
            d="M -100 450 Q 350 150 650 350 Q 950 550 1250 250 Q 1450 100 1600 300"
            stroke="url(#lineGrad1)"
            strokeWidth="0.6"
            fill="none"
          />
          <path
            d="M -100 400 Q 400 100 700 300 Q 1000 500 1300 200 Q 1500 50 1600 250"
            stroke="url(#lineGrad1)"
            strokeWidth="0.5"
            fill="none"
          />
        </svg>
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-6">
          <span className="bg-gradient-to-r from-blue-600 via-blue-700 to-violet-600 bg-clip-text text-transparent">
            Take Control of
          </span>
          <br />
          <span className="bg-gradient-to-r from-blue-700 via-violet-600 to-violet-700 bg-clip-text text-transparent">
            Your Finances
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          ArthraFinance is a personal finance management application that helps
          you track your income, manage your expenses, plan your budgets and
          monitor all your accounts — all in one place.
        </p>

        <a
          href="/signup"
          className="inline-flex items-center px-8 py-3.5 rounded-full bg-blue-600 text-white font-semibold text-base hover:bg-blue-700 transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-px"
        >
          Get Started
        </a>
      </div>
    </section>
  );
}

