import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  LockKeyhole,
  Send,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout, Eyebrow } from "@/components/mandate";
export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How MANDATE Works — Policy-Controlled Agent Wallet" },
      {
        name: "description",
        content:
          "Learn how owner-defined hard controls and GenLayer semantic policies bound agent spending.",
      },
      { property: "og:title", content: "How MANDATE Works" },
      {
        property: "og:description",
        content:
          "Hard controls first. Natural-language policy second. Owner-controlled spending throughout.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowItWorks,
});
function HowItWorks() {
  return (
    <AppLayout>
      <div className="page-head">
        <div>
          <Eyebrow>THE MODEL</Eyebrow>
          <h1>Permission, not possession.</h1>
          <p>
            An agent requests a payment. The owner-defined vault checks it before funds can move.
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard">
            Open dashboard <ArrowUpRight />
          </Link>
        </Button>
      </div>
      <div className="architecture">
        <div className="architecture-flow">
          <div className="architecture-node">
            <UserRound size={25} />
            <strong>OWNER</strong>
            <small>Defines mandate + limits</small>
          </div>
          <ArrowRight className="architecture-arrow" />
          <div className="architecture-node featured">
            <Wallet size={25} />
            <strong>MANDATE VAULT</strong>
            <small>Checks every request</small>
          </div>
          <ArrowRight className="architecture-arrow" />
          <div className="architecture-node">
            <Send size={25} />
            <strong>RECIPIENT</strong>
            <small>Eligible payments only</small>
          </div>
        </div>
        <div className="architecture-agent">
          <Bot size={20} /> AI AGENT <ArrowRight size={14} /> REQUESTS PERMISSION{" "}
          <ArrowRight size={14} /> MANDATE VAULT
        </div>
      </div>
      <div className="section-bar">
        <h2>Two layers of control</h2>
      </div>
      <div className="layer-grid">
        <div className="layer-card">
          <span className="step-num">LAYER 01 / HARD CONTROLS</span>
          <LockKeyhole size={28} strokeWidth={1.5} />
          <h3>Deterministic controls</h3>
          <p>
            Transaction caps, period budgets, vault status, and self-payment rules are checked
            first. A request that breaks a hard rule stops here.
          </p>
        </div>
        <div className="layer-card">
          <span className="step-num">LAYER 02 / INTENT</span>
          <ShieldCheck size={28} strokeWidth={1.5} />
          <h3>GenLayer semantic policy</h3>
          <p>
            Eligible requests are compared with the owner’s natural-language mandate. A purpose that
            conflicts with the mandate is rejected.
          </p>
        </div>
      </div>
      <div className="final-cta" style={{ marginTop: 85, paddingBottom: 50 }}>
        <Eyebrow>SEE THE DECISIONS</Eyebrow>
        <h2>Boundaries made visible.</h2>
        <p>Explore live vaults, request history, and decision flow.</p>
        <Button asChild>
          <Link to="/dashboard">
            Open dashboard <ArrowUpRight />
          </Link>
        </Button>
      </div>
    </AppLayout>
  );
}
