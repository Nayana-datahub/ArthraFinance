import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs">AF</span>
              </div>
              <span className="text-white font-semibold text-base tracking-tight">
                ArthraFinance
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              A personal finance management application to help you track
              income, expenses, budgets and accounts in one place.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
              Navigation
            </h4>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "Home", href: "#home" },
                { label: "Features", href: "#features" },
                { label: "About", href: "#about" },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-blue-400 transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">
              Account
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link
                  href="/login"
                  className="text-sm hover:text-blue-400 transition-colors duration-200"
                >
                  Login
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider & Copyright */}
        <div className="mt-12 pt-6 border-t border-slate-800 text-center text-sm">
          <p>
            &copy; 2026 ArthraFinance. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

