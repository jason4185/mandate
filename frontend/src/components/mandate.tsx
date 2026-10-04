import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleDollarSign,
  Fingerprint,
  LockKeyhole,
  X,
  Ban,
  Menu,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  formatGen,
  type MandateRequest,
  type RequestStatus,
  type Vault,
} from "@/lib/genlayer/mandate";
import { shortAddress, useWallet, WalletControl } from "@/lib/genlayer/wallet";

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="MANDATE home">
      <span className="brand-symbol">
        <span />
        <span />
        <span />
      </span>
      <span>MANDATE</span>
    </Link>
  );
}
export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const landing = pathname === "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const wallet = useWallet();
  return (
    <header className={landing ? "site-header landing-header" : "site-header app-header"}>
      <div className="header-inner">
        <Brand />
        <nav
          className={menuOpen ? "header-nav is-open" : "header-nav"}
          aria-label="Main navigation"
        >
          {landing ? (
            <>
              <a href="#product" onClick={() => setMenuOpen(false)}>
                Product
              </a>
              <Link to="/how-it-works" onClick={() => setMenuOpen(false)}>
                How it works
              </Link>
              <a href="#security" onClick={() => setMenuOpen(false)}>
                Security
              </a>
              <Link to="/dashboard" onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/dashboard"
                activeProps={{ className: "nav-active" }}
                onClick={() => setMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/how-it-works"
                activeProps={{ className: "nav-active" }}
                onClick={() => setMenuOpen(false)}
              >
                How it works
              </Link>
            </>
          )}
        </nav>
        <div className="header-actions">
          {!landing && wallet.status === "connected" && wallet.address && (
            <span className="account-chip">
              <span className="online-dot" />
              {shortAddress(wallet.address)}
            </span>
          )}
          <WalletControl />
          <Button asChild variant="outline" size="sm">
            <Link to={landing ? "/dashboard" : "/create"}>
              {landing ? "Open app" : "Create mandate"} <ArrowUpRight />
            </Link>
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="mobile-menu"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Menu />
        </Button>
      </div>
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <Brand />
        <span>Bounded autonomy, by design.</span>
        <span>Connected to GenLayer Studio Next</span>
      </div>
    </footer>
  );
}
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="app-main">{children}</main>
      <SiteFooter />
    </div>
  );
}
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="eyebrow">
      <span className="eyebrow-line" />
      {children}
    </span>
  );
}
export function StatusBadge({
  status,
}: {
  status: RequestStatus | "ACTIVE" | "PAUSED" | "BLOCKED";
}) {
  const Icon =
    status === "APPROVED" || status === "ACTIVE" ? Check : status === "BLOCKED" ? Ban : X;
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      <Icon size={12} strokeWidth={2.2} />
      {status}
    </span>
  );
}
export function Amount({ value, className = "" }: { value: bigint; className?: string }) {
  return <span className={className}>{formatGen(value)}</span>;
}
export function Address({ value }: { value: string }) {
  return <span className="address">{value}</span>;
}
export function Progress({ value, max }: { value: number; max: number }) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <span style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}
export function MandatePanel({ vault, compact = false }: { vault?: Vault; compact?: boolean }) {
  return (
    <div className={compact ? "mandate-panel compact" : "mandate-panel"}>
      <div className="panel-top">
        <div className="panel-icon">
          <Fingerprint size={20} />
        </div>
        <span className="tiny-label">
          {vault
            ? `MANDATE / VERSION ${String(vault.mandateVersion).padStart(2, "0")}`
            : "MANDATE / POLICY"}
        </span>
      </div>
      <p>
        {vault
          ? `“${vault.mandate}”`
          : "Owner-defined natural-language policy is evaluated before eligible funds can move."}
      </p>
      <div className="panel-bottom">
        <span>
          <LockKeyhole size={14} /> Owner-defined policy
        </span>
        <span>{vault ? `v${vault.mandateVersion}` : "Versioned"}</span>
      </div>
    </div>
  );
}
export function RequestRow({ request }: { request: MandateRequest }) {
  const status = request.decision;
  return (
    <Link to="/request/$id" params={{ id: request.id }} className="request-row">
      <div className={`request-icon status-${status.toLowerCase()}`}>
        {status === "APPROVED" ? <Check size={17} /> : <X size={17} />}
      </div>
      <div className="request-name">
        <strong>{request.category} request</strong>
        <small>
          {request.category} · Request #{request.id.padStart(3, "0")}
        </small>
      </div>
      <span className="request-amount">{formatGen(request.amountWei)} GEN</span>
      <StatusBadge status={status} />
      <ArrowUpRight className="row-arrow" size={17} />
    </Link>
  );
}
export function RequestList({ requests, limit }: { requests: MandateRequest[]; limit?: number }) {
  return (
    <div className="request-list">
      {requests.slice(0, limit).map((request) => (
        <RequestRow request={request} key={request.id} />
      ))}
    </div>
  );
}
export function VaultPreview() {
  return (
    <div className="vault-preview">
      <div className="preview-top">
        <div className="preview-brand">
          <span className="brand-symbol">
            <span />
            <span />
            <span />
          </span>{" "}
          MANDATE <span className="preview-divider">/</span> Overview
        </div>
        <span className="preview-live">
          <span className="online-dot" /> Policy preview
        </span>
      </div>
      <div className="preview-body">
        <div className="preview-heading">
          <div>
            <small>MANDATE / POLICY FLOW</small>
            <h3>Agent payment request</h3>
          </div>
          <StatusBadge status="ACTIVE" />
        </div>
        <div className="preview-grid">
          <div className="preview-balance">
            <span className="tiny-label">VAULT BALANCE</span>
            <strong>
              Owner <em>held</em>
            </strong>
            <div className="preview-balance-bottom">
              <CircleDollarSign size={16} /> Funds stay inside the vault
            </div>
          </div>
          <div className="preview-budget">
            <span className="tiny-label">REQUEST REVIEW</span>
            <div>
              <strong>Hard checks</strong> <span>first</span>
            </div>
            <Progress value={2} max={3} />
            <small>Policy evaluation follows deterministic controls</small>
          </div>
        </div>
        <div className="preview-section-title">
          Recent requests{" "}
          <span>
            VIEW ALL <ArrowRight size={12} />
          </span>
        </div>
        <div className="preview-requests">
          <div>
            <span className="preview-request-dot status-approved" />
            <span>Mandate-compliant request</span>
            <strong>PASS</strong>
            <StatusBadge status="APPROVED" />
          </div>
          <div>
            <span className="preview-request-dot status-rejected" />
            <span>Mandate conflict</span>
            <strong>STOP</strong>
            <StatusBadge status="REJECTED" />
          </div>
          <div>
            <span className="preview-request-dot status-blocked" />
            <span>Hard control failure</span>
            <strong>STOP</strong>
            <StatusBadge status="BLOCKED" />
          </div>
        </div>
      </div>
    </div>
  );
}
