import Link from "next/link";
import {
  ArrowRight,
  Users,
  BarChart3,
  Zap,
  Shield,
  MessageSquare,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Spreetail — Split Expenses with Ease",
  description:
    "Track shared expenses, split bills equally or by custom amounts, and settle debts with your friends, roommates, and travel partners. Free forever.",
};

const features = [
  {
    icon: Users,
    title: "Group Expenses",
    description:
      "Create groups for trips, roommates, or any shared expense scenario. Add members and start tracking instantly.",
  },
  {
    icon: BarChart3,
    title: "Smart Balances",
    description:
      "See exactly who owes whom at a glance. Balances are computed in real-time across all your groups.",
  },
  {
    icon: Zap,
    title: "Flexible Splits",
    description:
      "Split equally, by custom amounts, percentages, or shares. Every scenario is covered.",
  },
  {
    icon: MessageSquare,
    title: "Live Comments",
    description:
      "Discuss expenses in real-time with Socket.io powered live comments. No page refresh needed.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description:
      "JWT-based auth with robust password hashing. Your data stays yours.",
  },
  {
    icon: TrendingUp,
    title: "Settlement Tracking",
    description:
      "Record manual payments to settle up. Balances update immediately so everyone stays in sync.",
  },
];

const steps = [
  {
    step: "01",
    title: "Create a Group",
    description: "Invite your friends, roommates, or travel partners.",
  },
  {
    step: "02",
    title: "Add Expenses",
    description: "Log who paid what and choose how to split it.",
  },
  {
    step: "03",
    title: "Settle Up",
    description: "See who owes whom and record payments when done.",
  },
];

export default async function LandingPage() {
  const session = await getSession();
  if (session && session.userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      
      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/20">
              S
            </div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">Spreetail</span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
              Sign in
            </Link>
            <Link 
              href="/register" 
              className="text-sm font-semibold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-600/20 active:scale-95"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
        {/* Subtle background gradients */}
        <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-indigo-50 to-transparent pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 pointer-events-none" />
        <div className="absolute top-32 -left-24 w-72 h-72 bg-violet-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center flex flex-col items-center">
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-indigo-100 text-sm font-medium text-indigo-700 shadow-sm mb-8 animate-fade-in-up">
            <CheckCircle2 className="w-4 h-4" />
            <span>Free forever · No credit card required</span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 max-w-4xl leading-tight">
            Split expenses, <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
              stay friends.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 mb-10 max-w-2xl leading-relaxed">
            Spreetail makes it effortless to track shared bills, split costs any way you like, and settle up — for trips, roommates, dinners, and everything in between.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link 
              href="/register" 
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 hover:-translate-y-0.5 active:translate-y-0"
            >
              Start splitting for free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              href="/login" 
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-slate-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
            >
              Sign in
            </Link>
          </div>

          {/* Clean Dashboard Preview */}
          <div className="mt-20 w-full max-w-5xl bg-white rounded-2xl shadow-2xl shadow-slate-200/50 border border-gray-200 overflow-hidden transform transition-all duration-700 hover:shadow-indigo-100">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="ml-2 text-xs font-medium text-slate-400">spreetail.com</div>
            </div>
            
            <div className="flex h-[400px]">
              {/* Sidebar Mock */}
              <div className="hidden sm:flex flex-col w-64 bg-gray-50/50 border-r border-gray-100 p-4 gap-2">
                <div className="flex items-center gap-2 px-2 py-1 mb-4">
                  <div className="w-6 h-6 rounded bg-indigo-600" />
                  <div className="h-4 w-20 bg-slate-200 rounded" />
                </div>
                <div className="h-8 w-full bg-indigo-100/50 rounded-lg flex items-center px-3">
                  <div className="w-4 h-4 rounded bg-indigo-600/30 mr-2" />
                  <div className="h-3 w-16 bg-indigo-600/40 rounded" />
                </div>
                <div className="h-8 w-full rounded-lg flex items-center px-3">
                  <div className="w-4 h-4 rounded bg-slate-200 mr-2" />
                  <div className="h-3 w-12 bg-slate-200 rounded" />
                </div>
                <div className="h-8 w-full rounded-lg flex items-center px-3">
                  <div className="w-4 h-4 rounded bg-slate-200 mr-2" />
                  <div className="h-3 w-20 bg-slate-200 rounded" />
                </div>
              </div>
              
              {/* Content Mock */}
              <div className="flex-1 p-6 sm:p-8 bg-white flex flex-col gap-6">
                <div className="flex justify-between items-center">
                  <div className="h-6 w-32 bg-slate-100 rounded-md" />
                  <div className="h-9 w-28 bg-indigo-600/10 rounded-lg" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-4 border border-gray-100 rounded-xl bg-gray-50/30">
                      <div className="h-4 w-24 bg-slate-200 rounded mb-4" />
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          <div className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white" />
                          <div className="w-6 h-6 rounded-full bg-slate-300 border-2 border-white -ml-2" />
                        </div>
                        <div className="h-5 w-16 bg-indigo-100 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 bg-white" id="how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">How it works</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Get started in under a minute. No setup, no fuss.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-8 left-[15%] right-[15%] h-0.5 bg-gray-100" />
            
            {steps.map(({ step, title, description }) => (
              <div key={step} className="relative flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center text-xl font-bold text-indigo-600 mb-6 relative z-10">
                  {step}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">{title}</h3>
                <p className="text-slate-600">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 bg-gray-50 border-y border-gray-200" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Everything you need</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Powerful features that make splitting painless.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">{title}</h3>
                <p className="text-slate-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-900 rounded-3xl p-8 md:p-16 text-center relative overflow-hidden shadow-2xl">
            {/* Background elements */}
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-indigo-600 rounded-full blur-3xl opacity-30" />
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-violet-600 rounded-full blur-3xl opacity-30" />
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                Ready to split smarter?
              </h2>
              <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto">
                Join thousands of people who use Spreetail to keep finances fair and friendships intact.
              </p>
              <Link 
                href="/register" 
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-slate-900 bg-white rounded-xl hover:bg-gray-50 transition-all shadow-lg active:scale-95"
              >
                Create your free account
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-50 py-12 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              S
            </div>
            <span className="font-bold text-lg text-slate-900">Spreetail</span>
          </div>
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Spreetail. Built with ❤️ for fair finances.
          </p>
          <div className="flex gap-6">
            <Link href="/login" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Sign in</Link>
            <Link href="/register" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
