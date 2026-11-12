import React from "react";
import Link from "next/link";

interface AuthLayoutProps {
  children: React.ReactNode;
  welcomeTitle: string;
  welcomeSubtitle: string;
}

export default function AuthLayout({
  children,
  welcomeTitle,
  welcomeSubtitle,
}: AuthLayoutProps) {
  return (
    <main className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#edf1fd] overflow-hidden">
      {/* Decorative organic shapes inspired by reference screenshot */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-purple-300/40 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-28 -right-28 w-96 h-96 rounded-full bg-violet-300/40 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/3 -right-20 w-72 h-72 rounded-full bg-blue-200/40 blur-3xl"
        aria-hidden="true"
      />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-5xl rounded-[32px] bg-white/95 shadow-2xl shadow-indigo-200/50 border border-white/80 overflow-hidden flex flex-col lg:flex-row min-h-[580px]">
        {/* Soft diffused gradient accent inside main card */}
        <div
          className="pointer-events-none absolute top-0 left-0 w-3/4 h-80 bg-gradient-to-br from-purple-200/50 via-indigo-100/40 to-transparent blur-2xl"
          aria-hidden="true"
        />

        {/* Left Side: Brand and Welcome Text */}
        <div className="relative z-10 flex-1 p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
          <div>
            {/* ArthraFinance Logo */}
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 group select-none"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <span className="text-white font-bold text-sm">AF</span>
              </div>
              <span className="text-slate-900 font-bold text-xl tracking-tight">
                ArthraFinance
              </span>
            </Link>
          </div>

          <div className="my-8 lg:my-0 max-w-md">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-[1.15] mb-4">
              {welcomeTitle}
            </h1>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              {welcomeSubtitle}
            </p>
          </div>

          <div className="hidden lg:block text-xs text-slate-400">
            &copy; 2026 ArthraFinance. All rights reserved.
          </div>
        </div>

        {/* Right Side: Form Card */}
        <div className="relative z-10 w-full lg:w-[480px] p-6 sm:p-10 lg:p-12 flex items-center justify-center bg-slate-50/50 lg:bg-transparent">
          <div className="w-full bg-white rounded-2xl p-6 sm:p-8 shadow-lg shadow-slate-200/70 border border-slate-100">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

