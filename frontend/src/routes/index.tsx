import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Ban,
  CircleDollarSign,
  FileClock,
  Fingerprint,
  LockKeyhole,
  Pause,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Eyebrow,
  MandatePanel,
  SiteFooter,
  SiteHeader,
  StatusBadge,
  VaultPreview,
} from "@/components/mandate";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MANDATE — Give your agent a budget. Not your wallet." },
      {
        name: "description",
        content:
          "A policy-controlled wallet for autonomous AI agents. Give agents bounded spending power with hard limits and natural-language mandates.",
      },
      { property: "og:title", content: "MANDATE — Give your agent a budget. Not your wallet." },
      {
        property: "og:description",
        content:
          "Give agents bounded spending power with hard limits and natural-language mandates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});
const features = [
  {
    icon: CircleDollarSign,
    title: "Max transaction",
    detail: "Cap the size of any single request before policy evaluation.",
  },
  {
    icon: SlidersHorizontal,
    title: "Period budget",
    detail: "Set a spending ceiling that resets on your chosen schedule.",
  },
  {
    icon: Pause,
    title: "Pause / resume",
    detail: "Keep control of whether your agent can make new requests.",
  },
  {
    icon: RefreshCw,
    title: "Replace agent",
    detail: "Change which agent can request funds without changing the vault.",
  },
  {
    icon: Fingerprint,
    title: "Versioned mandate",
    detail: "Keep policy changes explicit and tied to a clear version.",
  },
  {
    icon: FileClock,
    title: "Audit trail",
    detail: "See what was requested, what was checked, and the outcome.",
  },
];
function Home() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main>
        <section className="hero">
          <Eyebrow>POLICY-CONTROLLED AGENT WALLET</Eyebrow>
          <h1>
            Give your agent a budget.
            <br />
            <span>Not your wallet.</span>
          </h1>
          <p className="hero-copy">
            Agents propose transactions. MANDATE decides whether funds can leave. Lock GEN behind
            hard spending limits and a natural-language policy your agent cannot bypass.
          </p>
          <div className="hero-actions">
            <Button asChild>
              <Link to="/dashboard">
                Open dashboard <ArrowUpRight />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/how-it-works">
                See how it works <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="value-points">
            <span>
              <ShieldCheck /> Hard spending limits
            </span>
            <span>
              <Fingerprint /> GenLayer policy checks
            </span>
            <span>
              <LockKeyhole /> Funds stay in the vault
            </span>
          </div>
        </section>
        <section className="landing-section" id="product">
          <div className="section-heading">
            <Eyebrow>THE PRODUCT</Eyebrow>
            <h2>
              A financial firewall for <em>autonomous agents.</em>
            </h2>
            <p>
              One controlled place for funds, policy, and every request. Give an agent room to act
              without handing over unrestricted access.
            </p>
          </div>
          <VaultPreview />
        </section>
        <section className="landing-section split-feature" id="security">
          <div className="split-copy">
            <Eyebrow>OWNER-DEFINED CONTROL</Eyebrow>
            <h2>Rules your agent cannot rewrite.</h2>
            <p>
              Write the boundaries in plain language, then set hard numbers around them. Your agent
              can request a payment, but it cannot change the mandate that decides it.
            </p>
            <Link to="/dashboard" className="text-link">
              Explore live vaults <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="gold-panel">
            <MandatePanel compact />
            <div className="hard-controls">
              <div>
                <small>MAX TRANSACTION</small>
                <strong>100 GEN</strong>
              </div>
              <div>
                <small>PERIOD BUDGET</small>
                <strong>300 GEN / 7 days</strong>
              </div>
            </div>
          </div>
        </section>
        <section className="landing-section split-feature reverse">
          <div className="decision-visual">
            <div className="decision-visual-header">
              <span>REQUEST DECISIONS</span>
              <ShieldCheck size={18} />
            </div>
            <div className="decision-item">
              <div>
                <strong>Social media advertising</strong>
                <small>50 GEN · Advertising</small>
              </div>
              <StatusBadge status="APPROVED" />
            </div>
            <div className="decision-item">
              <div>
                <strong>SOL speculative purchase</strong>
                <small>40 GEN · Trading</small>
              </div>
              <StatusBadge status="REJECTED" />
            </div>
            <div className="decision-item">
              <div>
                <strong>Marketing event</strong>
                <small>150 GEN · Over the transaction limit</small>
              </div>
              <StatusBadge status="BLOCKED" />
            </div>
          </div>
          <div className="split-copy">
            <Eyebrow>BEFORE FUNDS MOVE</Eyebrow>
            <h2>Every request gets checked first.</h2>
            <p>
              Hard controls stop invalid requests immediately. Eligible requests then face the
              natural-language mandate. The outcome stays visible, not hidden in a black box.
            </p>
            <Link to="/dashboard" className="text-link">
              Open the live dashboard <ArrowUpRight size={15} />
            </Link>
          </div>
        </section>
        <section className="landing-section">
          <div className="section-heading">
            <Eyebrow>BUILT FOR CONTROL</Eyebrow>
            <h2>
              Designed for <em>bounded autonomy.</em>
            </h2>
            <p>Set the boundaries once. Keep the ability to intervene whenever you need to.</p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, detail }) => (
              <div className="feature-card" key={title}>
                <Icon strokeWidth={1.6} />
                <h3>{title}</h3>
                <p>{detail}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="final-cta">
          <Eyebrow>YOUR RULES. THEIR RANGE.</Eyebrow>
          <h2>
            Let your agent act.
            <br />
            <em>Keep the mandate.</em>
          </h2>
          <p>Open the live dashboard and see policy-controlled spending in action.</p>
          <Button asChild>
            <Link to="/dashboard">
              Open dashboard <ArrowUpRight />
            </Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
