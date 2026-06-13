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
      "JWT-based auth with bcrypt password hashing. Your data stays yours.",
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

import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await getSession();
  if (session && session.userId) {
    redirect("/dashboard");
  }

  return (
    <div className="landing-page">
      {/* ── Navbar ── */}
      <nav className="landing-nav">
        <div className="landing-container landing-nav-inner">
          <div className="landing-logo">
            <div className="landing-logo-icon">S</div>
            <span className="landing-logo-text">Spreetail</span>
          </div>
          <div className="landing-nav-links">
            <Link href="/login" className="landing-nav-link">
              Sign in
            </Link>
            <Link href="/register" className="landing-cta-btn-small" id="nav-get-started">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        {/* Radial glow orbs */}
        <div className="landing-orb landing-orb-1" aria-hidden="true" />
        <div className="landing-orb landing-orb-2" aria-hidden="true" />

        <div className="landing-container landing-hero-inner">
          <div className="landing-badge">
            <CheckCircle2 className="landing-badge-icon" />
            Free forever · No credit card required
          </div>

          <h1 className="landing-hero-title">
            Split expenses,
            <br />
            <span className="landing-gradient-text">stay friends.</span>
          </h1>

          <p className="landing-hero-desc">
            Spreetail makes it effortless to track shared bills, split costs
            any way you like, and settle up — for trips, roommates, dinners,
            and everything in between.
          </p>

          <div className="landing-hero-actions">
            <Link href="/register" className="landing-cta-btn" id="hero-get-started">
              Start splitting for free
              <ArrowRight className="landing-cta-icon" />
            </Link>
            <Link href="/login" className="landing-ghost-btn" id="hero-sign-in">
              Sign in
            </Link>
          </div>

          {/* Fake dashboard preview */}
          <div className="landing-preview">
            <div className="landing-preview-bar">
              <span className="landing-preview-dot" style={{ background: "#ff5f57" }} />
              <span className="landing-preview-dot" style={{ background: "#febc2e" }} />
              <span className="landing-preview-dot" style={{ background: "#28c840" }} />
              <span className="landing-preview-bar-title">Spreetail — Dashboard</span>
            </div>
            <div className="landing-preview-body">
              {/* Mock sidebar */}
              <div className="landing-mock-sidebar">
                <div className="landing-mock-brand">
                  <div className="landing-mock-logo" />
                  <span className="landing-mock-brand-text">Spreetail</span>
                </div>
                {["Dashboard", "Groups", "Balances"].map((item) => (
                  <div
                    key={item}
                    className={`landing-mock-nav-item${item === "Dashboard" ? " active" : ""}`}
                  >
                    <div className="landing-mock-nav-icon" />
                    {item}
                  </div>
                ))}
              </div>
              {/* Mock content */}
              <div className="landing-mock-content">
                <div className="landing-mock-header">
                  <div className="landing-mock-title-block" />
                  <div className="landing-mock-btn" />
                </div>
                <div className="landing-mock-cards">
                  {["Goa Trip 🏖️", "Flat Expenses 🏠", "Dinner Club 🍜"].map((g) => (
                    <div key={g} className="landing-mock-card">
                      <div className="landing-mock-card-title">{g}</div>
                      <div className="landing-mock-card-meta">
                        <div className="landing-mock-meta-pill" />
                        <div className="landing-mock-meta-pill short" />
                      </div>
                      <div className="landing-mock-card-amount" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="landing-section" id="how-it-works">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">How it works</h2>
            <p className="landing-section-desc">
              Get started in under a minute. No setup, no fuss.
            </p>
          </div>
          <div className="landing-steps">
            {steps.map(({ step, title, description }) => (
              <div key={step} className="landing-step">
                <div className="landing-step-number">{step}</div>
                <h3 className="landing-step-title">{title}</h3>
                <p className="landing-step-desc">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-section landing-section-alt" id="features">
        <div className="landing-container">
          <div className="landing-section-header">
            <h2 className="landing-section-title">Everything you need</h2>
            <p className="landing-section-desc">
              Powerful features that make splitting painless.
            </p>
          </div>
          <div className="landing-features-grid">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="landing-feature-card">
                <div className="landing-feature-icon-wrap">
                  <Icon className="landing-feature-icon" />
                </div>
                <h3 className="landing-feature-title">{title}</h3>
                <p className="landing-feature-desc">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="landing-cta-section">
        <div className="landing-cta-orb" aria-hidden="true" />
        <div className="landing-container landing-cta-inner">
          <h2 className="landing-cta-title">
            Ready to split smarter?
          </h2>
          <p className="landing-cta-subtitle">
            Join thousands of people who use Spreetail to keep finances fair
            and friendships intact.
          </p>
          <Link href="/register" className="landing-cta-btn landing-cta-btn-white" id="cta-get-started">
            Create your free account
            <ArrowRight className="landing-cta-icon" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div className="landing-logo">
            <div className="landing-logo-icon">S</div>
            <span className="landing-logo-text landing-logo-text-muted">Spreetail</span>
          </div>
          <p className="landing-footer-copy">
            © {new Date().getFullYear()} Spreetail. Built with ❤️ for fair finances.
          </p>
          <div className="landing-footer-links">
            <Link href="/login" className="landing-footer-link">Sign in</Link>
            <Link href="/register" className="landing-footer-link">Register</Link>
          </div>
        </div>
      </footer>

      <style>{`
        /* ── Reset & base ── */
        .landing-page {
          min-height: 100vh;
          background: #0a0a0f;
          color: #e2e8f0;
          font-family: 'Inter', system-ui, sans-serif;
          overflow-x: hidden;
        }

        .landing-container {
          max-width: 1120px;
          margin: 0 auto;
          padding: 0 1.5rem;
        }

        /* ── Navbar ── */
        .landing-nav {
          position: sticky;
          top: 0;
          z-index: 50;
          backdrop-filter: blur(16px);
          background: rgba(10, 10, 15, 0.8);
          border-bottom: 1px solid rgba(139, 92, 246, 0.15);
        }

        .landing-nav-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 64px;
        }

        .landing-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }

        .landing-logo-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 1rem;
          color: #fff;
          box-shadow: 0 0 20px rgba(124, 58, 237, 0.4);
        }

        .landing-logo-text {
          font-weight: 700;
          font-size: 1.1rem;
          color: #f1f5f9;
        }

        .landing-logo-text-muted {
          color: #94a3b8;
        }

        .landing-nav-links {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .landing-nav-link {
          color: #94a3b8;
          font-size: 0.9rem;
          font-weight: 500;
          text-decoration: none;
          transition: color 0.2s;
        }

        .landing-nav-link:hover {
          color: #f1f5f9;
        }

        .landing-cta-btn-small {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: #fff;
          text-decoration: none;
          transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 0 24px rgba(124, 58, 237, 0.35);
        }

        .landing-cta-btn-small:hover {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 0 32px rgba(124, 58, 237, 0.5);
        }

        /* ── Hero ── */
        .landing-hero {
          position: relative;
          padding: 100px 0 80px;
          overflow: hidden;
        }

        .landing-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.25;
          pointer-events: none;
        }

        .landing-orb-1 {
          width: 600px;
          height: 600px;
          top: -200px;
          left: -100px;
          background: radial-gradient(circle, #7c3aed, transparent 70%);
          animation: orbFloat 8s ease-in-out infinite alternate;
        }

        .landing-orb-2 {
          width: 500px;
          height: 500px;
          top: 100px;
          right: -150px;
          background: radial-gradient(circle, #4f46e5, transparent 70%);
          animation: orbFloat 10s ease-in-out infinite alternate-reverse;
        }

        @keyframes orbFloat {
          from { transform: translateY(0px) scale(1); }
          to   { transform: translateY(30px) scale(1.05); }
        }

        .landing-hero-inner {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 1.5rem;
        }

        .landing-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 16px;
          border-radius: 999px;
          background: rgba(124, 58, 237, 0.15);
          border: 1px solid rgba(124, 58, 237, 0.35);
          font-size: 0.8rem;
          font-weight: 500;
          color: #a78bfa;
        }

        .landing-badge-icon {
          width: 14px;
          height: 14px;
        }

        .landing-hero-title {
          font-size: clamp(2.8rem, 7vw, 5rem);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.03em;
          color: #f8fafc;
          margin: 0;
        }

        .landing-gradient-text {
          background: linear-gradient(135deg, #a78bfa 0%, #818cf8 50%, #60a5fa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .landing-hero-desc {
          max-width: 600px;
          font-size: 1.125rem;
          line-height: 1.7;
          color: #94a3b8;
          margin: 0;
        }

        .landing-hero-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          justify-content: center;
        }

        .landing-cta-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: #fff;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
          box-shadow: 0 0 32px rgba(124, 58, 237, 0.45);
        }

        .landing-cta-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 48px rgba(124, 58, 237, 0.65);
        }

        .landing-cta-btn-white {
          background: #f8fafc;
          color: #1e1b4b;
          box-shadow: 0 4px 32px rgba(0,0,0,0.3);
        }

        .landing-cta-btn-white:hover {
          background: #fff;
          box-shadow: 0 8px 40px rgba(0,0,0,0.4);
        }

        .landing-cta-icon {
          width: 18px;
          height: 18px;
        }

        .landing-ghost-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          border: 1px solid rgba(148, 163, 184, 0.25);
          color: #94a3b8;
          text-decoration: none;
          transition: border-color 0.2s, color 0.2s, background 0.2s;
        }

        .landing-ghost-btn:hover {
          border-color: rgba(148, 163, 184, 0.5);
          color: #f1f5f9;
          background: rgba(255,255,255,0.04);
        }

        /* ── Dashboard Preview ── */
        .landing-preview {
          width: 100%;
          max-width: 900px;
          margin-top: 2rem;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(139, 92, 246, 0.2);
          box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6), 0 0 60px rgba(124, 58, 237, 0.15);
          background: #12121a;
          animation: previewRise 0.8s ease-out both;
        }

        @keyframes previewRise {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .landing-preview-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          background: #1a1a28;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .landing-preview-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }

        .landing-preview-bar-title {
          font-size: 0.75rem;
          color: #475569;
          margin-left: auto;
          margin-right: auto;
        }

        .landing-preview-body {
          display: flex;
          height: 320px;
        }

        /* Mock sidebar */
        .landing-mock-sidebar {
          width: 200px;
          border-right: 1px solid rgba(255,255,255,0.06);
          padding: 16px 12px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .landing-mock-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          margin-bottom: 8px;
        }

        .landing-mock-logo {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
        }

        .landing-mock-brand-text {
          font-size: 0.8rem;
          font-weight: 700;
          color: #e2e8f0;
        }

        .landing-mock-nav-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 8px;
          font-size: 0.75rem;
          color: #64748b;
          cursor: default;
        }

        .landing-mock-nav-item.active {
          background: rgba(124, 58, 237, 0.15);
          color: #a78bfa;
        }

        .landing-mock-nav-icon {
          width: 14px;
          height: 14px;
          border-radius: 3px;
          background: currentColor;
          opacity: 0.4;
          flex-shrink: 0;
        }

        /* Mock content */
        .landing-mock-content {
          flex: 1;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .landing-mock-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .landing-mock-title-block {
          height: 20px;
          width: 140px;
          border-radius: 6px;
          background: rgba(255,255,255,0.1);
        }

        .landing-mock-btn {
          height: 28px;
          width: 90px;
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(124,58,237,0.5), rgba(109,40,217,0.5));
        }

        .landing-mock-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .landing-mock-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .landing-mock-card-title {
          font-size: 0.72rem;
          font-weight: 600;
          color: #cbd5e1;
        }

        .landing-mock-card-meta {
          display: flex;
          gap: 6px;
        }

        .landing-mock-meta-pill {
          height: 10px;
          width: 48px;
          border-radius: 99px;
          background: rgba(255,255,255,0.08);
        }

        .landing-mock-meta-pill.short {
          width: 32px;
        }

        .landing-mock-card-amount {
          height: 12px;
          width: 70px;
          border-radius: 4px;
          background: rgba(167, 139, 250, 0.3);
          margin-top: 4px;
        }

        /* ── Sections ── */
        .landing-section {
          padding: 80px 0;
        }

        .landing-section-alt {
          background: rgba(255, 255, 255, 0.02);
          border-top: 1px solid rgba(255,255,255,0.06);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .landing-section-header {
          text-align: center;
          margin-bottom: 3rem;
        }

        .landing-section-title {
          font-size: clamp(1.8rem, 4vw, 2.5rem);
          font-weight: 800;
          color: #f1f5f9;
          margin: 0 0 0.75rem;
          letter-spacing: -0.02em;
        }

        .landing-section-desc {
          font-size: 1.05rem;
          color: #64748b;
          max-width: 500px;
          margin: 0 auto;
          line-height: 1.6;
        }

        /* ── Steps ── */
        .landing-steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 2rem;
        }

        .landing-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.75rem;
        }

        .landing-step-number {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(124,58,237,0.3), rgba(79,70,229,0.3));
          border: 1px solid rgba(124,58,237,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          font-weight: 800;
          color: #a78bfa;
        }

        .landing-step-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #e2e8f0;
          margin: 0;
        }

        .landing-step-desc {
          font-size: 0.9rem;
          color: #64748b;
          line-height: 1.6;
          margin: 0;
        }

        /* ── Features ── */
        .landing-features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .landing-feature-card {
          padding: 1.75rem;
          border-radius: 16px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          transition: border-color 0.25s, background 0.25s, transform 0.25s;
        }

        .landing-feature-card:hover {
          border-color: rgba(124, 58, 237, 0.4);
          background: rgba(124, 58, 237, 0.05);
          transform: translateY(-3px);
        }

        .landing-feature-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(124,58,237,0.25), rgba(79,70,229,0.25));
          border: 1px solid rgba(124,58,237,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
        }

        .landing-feature-icon {
          width: 20px;
          height: 20px;
          color: #a78bfa;
        }

        .landing-feature-title {
          font-size: 1rem;
          font-weight: 700;
          color: #e2e8f0;
          margin: 0 0 0.5rem;
        }

        .landing-feature-desc {
          font-size: 0.875rem;
          color: #64748b;
          line-height: 1.65;
          margin: 0;
        }

        /* ── CTA Section ── */
        .landing-cta-section {
          position: relative;
          padding: 100px 0;
          text-align: center;
          overflow: hidden;
        }

        .landing-cta-orb {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 50% 50%, rgba(124,58,237,0.2) 0%, transparent 70%);
          pointer-events: none;
        }

        .landing-cta-inner {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.25rem;
        }

        .landing-cta-title {
          font-size: clamp(2rem, 5vw, 3.5rem);
          font-weight: 800;
          color: #f8fafc;
          margin: 0;
          letter-spacing: -0.02em;
        }

        .landing-cta-subtitle {
          font-size: 1.05rem;
          color: #64748b;
          max-width: 480px;
          line-height: 1.65;
          margin: 0;
        }

        /* ── Footer ── */
        .landing-footer {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 2rem 0;
        }

        .landing-footer-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .landing-footer-copy {
          font-size: 0.8rem;
          color: #475569;
          margin: 0;
        }

        .landing-footer-links {
          display: flex;
          gap: 1.25rem;
        }

        .landing-footer-link {
          font-size: 0.8rem;
          color: #475569;
          text-decoration: none;
          transition: color 0.2s;
        }

        .landing-footer-link:hover {
          color: #94a3b8;
        }

        /* ── Responsive ── */
        @media (max-width: 640px) {
          .landing-mock-sidebar { display: none; }
          .landing-mock-cards { grid-template-columns: 1fr 1fr; }
          .landing-preview-body { height: 240px; }
          .landing-footer-inner { flex-direction: column; text-align: center; }
          .landing-footer-links { justify-content: center; }
        }
      `}</style>
    </div>
  );
}
