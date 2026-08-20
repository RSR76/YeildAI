'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  Sprout,
  Sprout as LeafSmall,
  TrendingUp,
  Calculator,
  Handshake,
  Users,
  Target,
  ShieldCheck,
} from 'lucide-react';
import type React from 'react';

/**
 * Recreates refimage.png as closely as CSS allows: a large illustrated
 * left panel (background image + real HTML text/cards over it) and a
 * floating white card on the right containing the actual login/signup
 * form. Both /login and /signup render this shell and just swap the
 * form content passed as `children`.
 *
 * The background photo is `image1.png` from the upload — it matched the
 * reference's farmer scale/position/crop much more closely than image2.
 * Staged at /public/images/auth-farmer-field.png; move it there if your
 * public folder is laid out differently.
 */
export function AuthShell({
  activeTab,
  children,
}: {
  activeTab: 'login' | 'signup';
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#eef1e6] p-3 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1536px] flex-col overflow-hidden rounded-[28px] bg-[#eef1e6] lg:flex-row">
        {/* ---------------------------------------------------------------- */}
        {/* Left: illustrated marketing panel                                */}
        {/* ---------------------------------------------------------------- */}
        <div className="relative flex flex-1 flex-col overflow-hidden px-8 pb-8 pt-8 sm:px-12 sm:pt-10 lg:px-16">
          {/* Background illustration */}
          <div className="absolute inset-0 -z-0">
            <Image
              src="/images/auth-farmer-field.png"
              alt=""
              fill
              priority
              className="object-cover object-bottom"
            />
          </div>
          <div className="px-30 z-10">

          {/* Logo */}
          <div className="mb-10">
            <div className="flex items-center gap-2">
              <Sprout className="h-7 w-7 text-emerald-600" />
              <span className="font-[var(--font-display)] text-2xl font-bold text-[var(--forest-900)]">
                Yeild<span className="text-emerald-600">AI</span>
              </span>
            </div>
            <p className="mt-0.5 text-xs text-stone-500">Smart Farming. Better Tomorrow.</p>
          </div>

          {/* Heading */}
          <div className="max-w-xl">
            <h1 className="flex items-center gap-2 font-[var(--font-display)] text-[34px] font-bold leading-tight text-[var(--forest-900)] sm:text-[38px]">
              Welcome to YeildAI
              <LeafSmall className="h-6 w-6 text-emerald-600" />
            </h1>
            <p className="mt-2 flex items-center justify-start gap-2 text-lg font-semibold text-emerald-700">
              <span aria-hidden>»</span> Smart farming, better profits <span aria-hidden>«</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              YeildAI helps farmers choose the best crops, check market prices, and increase
              profits with AI-powered predictions.
            </p>
          </div>

          {/* Feature cards */}
          <div className="mt-6 grid max-w-xl grid-cols-2 gap-3">
            <FeatureCard
              icon={<Sprout className="h-5 w-5 text-emerald-700" />}
              title="Best Crop Recommendations"
              description="Get the best crops to grow."
            />
            <FeatureCard
              icon={<TrendingUp className="h-5 w-5 text-emerald-700" />}
              title="Market Prices & Trends"
              description="Track prices and market trends."
            />
            <FeatureCard
              icon={<Calculator className="h-5 w-5 text-emerald-700" />}
              title="Profit Calculator"
              description="Calculate your cost and profit."
            />
            <FeatureCard
              icon={<Handshake className="h-5 w-5 text-emerald-700" />}
              title="Sell with Brokers"
              description="Connect with brokers and sell easily."
            />
          </div>

          {/* Spacer to push the callout down toward the illustration's field */}
          <div className="flex-1" />

          {/* Farmer callout bubble */}
          <div className="mb-2 mt-8 inline-flex max-w-md items-center gap-3 self-start rounded-2xl bg-white/90 px-5 py-3.5 shadow-sm backdrop-blur-sm">
            <Users className="h-5 w-5 shrink-0 text-emerald-700" />
            <p className="text-sm font-medium text-[var(--forest-900)]">
              YeildAI is with farmers to grow better crops and increase profits.
            </p>
          </div>
        </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Right: auth card                                                  */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex items-center justify-center bg-[#eef1e6] px-4 py-8 lg:w-[460px] lg:shrink-0 lg:px-6">
          <div className="w-full max-w-[420px] rounded-3xl bg-white p-8 shadow-[0_8px_40px_rgba(20,49,42,0.08)] sm:p-10">
            <div className="flex flex-col items-center text-center">
              <Sprout className="mb-3 h-7 w-7 text-emerald-600" />
              <h2 className="font-[var(--font-display)] text-2xl font-bold text-[var(--forest-900)]">
                Login / Sign Up
              </h2>
              <p className="mt-1.5 text-sm text-stone-500">
                Create your account and get started with YeildAI
              </p>
            </div>

            {/* Tab toggle */}
            <div className="mt-6 flex gap-2 rounded-xl bg-stone-100 p-1">
              <Link
                href="/login"
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'login'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <UserIcon />
                Login
              </Link>
              <Link
                href="/signup"
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'signup'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                <UserPlusIcon />
                Sign Up
              </Link>
            </div>

            {/* Form content (Login or Signup fields) */}
            <div className="mt-5">{children}</div>

            {/* Tip box */}
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-emerald-50 px-4 py-3.5">
              <LightbulbIcon />
              <p className="text-xs leading-relaxed text-[var(--forest-900)]">
                YeildAI is built to help farmers make smart decisions and grow better.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom trust bar                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="mx-auto mt-3 flex max-w-[1536px] flex-col items-center justify-center gap-3 px-6 py-3 text-xs text-stone-600 sm:flex-row sm:justify-between sm:gap-6">
        <TrustItem icon={<Target className="h-4 w-4 text-emerald-700" />} title="Built for farmers" subtitle="Easy to use" />
        <TrustItem icon={<Sprout className="h-4 w-4 text-emerald-700" />} title="AI helps you make" subtitle="better decisions" />
        <TrustItem icon={<ShieldCheck className="h-4 w-4 text-emerald-700" />} title="Secure and reliable" subtitle="We are here for you" />
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200/80 bg-white/85 p-3.5 backdrop-blur-sm">
      <div className="mb-1.5">{icon}</div>
      <p className="text-[13px] font-semibold leading-tight text-[var(--forest-900)]">{title}</p>
      <p className="mt-0.5 text-xs leading-snug text-stone-500">{description}</p>
    </div>
  );
}

function TrustItem({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span>
        <span className="font-medium text-stone-800">{title}</span> {subtitle}
      </span>
    </div>
  );
}

// Small inline icons matched to the reference's tab-button glyphs
// (person / person-plus) rather than reusing lucide's larger defaults.
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.76-3.58-5-8-5Z" />
    </svg>
  );
}
function UserPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M2 21v-1c0-3.31 3.13-6 7-6s7 2.69 7 6v1" />
      <path strokeLinecap="round" d="M19 8v6M22 11h-6" />
    </svg>
  );
}
function LightbulbIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.5.4.85.98.9 1.6v.1h5.4v-.1c.05-.62.4-1.2.9-1.6A6 6 0 0 0 12 3Z" />
    </svg>
  );
}

/** Icon-prefixed rounded input, styled to match the Mobile Number / Password fields in the reference. */
export function AuthField({
  icon,
  trailing,
  ...inputProps
}: {
  icon: React.ReactNode;
  trailing?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
        {icon}
      </span>
      <input
        {...inputProps}
        className="w-full rounded-xl border border-stone-200 py-3 pl-10 pr-10 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
      />
      {trailing && (
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400">{trailing}</span>
      )}
    </div>
  );
}

/** Full-width green submit button with a trailing arrow, matching the reference's Login button. */
export function AuthSubmitButton({
  children,
  ...buttonProps
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...buttonProps}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7" />
      </svg>
    </button>
  );
}