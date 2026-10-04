import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  CircleDollarSign,
  FileClock,
  Plus,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout, Eyebrow, Progress, RequestList, StatusBadge } from "@/components/mandate";
import {
  effectivePeriodSpent,
  formatGen,
  getOwnerVaults,
  getRequestCount,
  getVaultCount,
  getVaultRequests,
  type Vault,
} from "@/lib/genlayer/mandate";
import { normalizeMandateError } from "@/lib/genlayer/errors";
import { useWallet } from "@/lib/genlayer/wallet";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MANDATE" },
      {
        name: "description",
        content: "Review your live agent treasuries, budgets, and request decisions.",
      },
      { property: "og:title", content: "Dashboard — MANDATE" },
      { property: "og:description", content: "Review live policy-controlled agent vaults." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const wallet = useWallet();
  const vaultCountQuery = useQuery({
    queryKey: ["mandate", "vault-count"],
    queryFn: () => getVaultCount(),
  });
  const requestCountQuery = useQuery({
    queryKey: ["mandate", "request-count"],
    queryFn: () => getRequestCount(),
  });
  const ownerVaultsQuery = useQuery({
    queryKey: ["mandate", "owner-vaults", wallet.address],
    queryFn: () => getOwnerVaults(wallet.address!),
    enabled: Boolean(wallet.address && wallet.status === "connected"),
  });
  const ownedVaults = ownerVaultsQuery.data?.items ?? [];
  const requestQueries = useQueries({
    queries: ownedVaults.map((item) => ({
      queryKey: ["mandate", "vault-requests", item.id, 0, 50],
      queryFn: () => getVaultRequests(item.id, 0, 50),
    })),
  });
  const recentRequests = requestQueries
    .flatMap((query) => query.data?.items ?? [])
    .sort((left, right) => Number(right.createdAt - left.createdAt))
    .slice(0, 10);
  const readError = ownerVaultsQuery.error ?? requestQueries.find((query) => query.error)?.error;
  const totalBalance = ownedVaults.reduce((total, item) => total + item.balanceWei, 0n);
  const totalSpent = ownedVaults.reduce((total, item) => total + effectivePeriodSpent(item), 0n);
  const totalBudget = ownedVaults.reduce((total, item) => total + item.periodBudgetWei, 0n);
  const activeAgents = ownedVaults.filter((item) => item.status === "ACTIVE").length;
  const requestTotal = ownedVaults.reduce((total, item) => total + item.requestCount, 0);
  const loading = wallet.status === "connected" && ownerVaultsQuery.isLoading;

  return (
    <AppLayout>
      <div className="page-head">
        <div>
          <Eyebrow>OVERVIEW / LIVE CONTRACT</Eyebrow>
          <h1>Agent treasuries</h1>
          <p>One view of the funds you control and the requests your agent makes.</p>
        </div>
        <Button asChild>
          <Link to="/create">
            <Plus /> Create mandate
          </Link>
        </Button>
      </div>
      {wallet.status !== "connected" ? (
        <div className="info-panel empty-state">
          <h2>Connect your wallet to view your vaults.</h2>
          <p>
            Public protocol counts remain available, while owner-specific data needs your wallet.
          </p>
        </div>
      ) : loading ? (
        <LoadingState label="Loading your live vaults…" />
      ) : readError ? (
        <div className="info-panel empty-state">
          <h2>Live vault data could not be loaded.</h2>
          <p>{normalizeMandateError(readError)}</p>
        </div>
      ) : (
        <>
          <div className="metric-grid">
            <Metric
              label="Total controlled"
              icon={<Wallet />}
              value={ownedVaults.length ? formatGen(totalBalance) : "—"}
              sub={`Across ${ownedVaults.length} vault${ownedVaults.length === 1 ? "" : "s"}`}
            />
            <div className="metric">
              <div className="metric-top">
                Period spent <CircleDollarSign />
              </div>
              <strong className="metric-value">
                {ownedVaults.length ? formatGen(totalSpent) : "—"}
                {ownedVaults.length > 0 && <small> / {formatGen(totalBudget)}</small>}
              </strong>
              {ownedVaults.length > 0 && (
                <Progress value={percent(totalSpent, totalBudget)} max={100} />
              )}
            </div>
            <Metric
              label="Active agents"
              icon={<Bot />}
              value={String(activeAgents)}
              sub="Across owned vaults"
            />
            <Metric
              label="Requests"
              icon={<FileClock />}
              value={String(requestTotal)}
              sub={`Live network total: ${requestCountQuery.data ?? "—"}`}
            />
          </div>
          <div className="section-bar">
            <h2>Your vaults</h2>
            <span>
              {ownedVaults.length} vault{ownedVaults.length === 1 ? "" : "s"}
            </span>
          </div>
          {ownedVaults.length === 0 ? (
            <EmptyState />
          ) : (
            ownedVaults.map((item) => <VaultCard key={item.id} vault={item} />)
          )}
          <div className="section-bar">
            <h2>Recent requests</h2>
            <span>
              {recentRequests.length ? `${recentRequests.length} shown` : "No requests yet"}
            </span>
          </div>
          {recentRequests.length ? (
            <RequestList requests={recentRequests} />
          ) : (
            <div className="info-panel empty-state">
              <h2>No requests have been recorded yet.</h2>
              <p>
                Your agent’s finalized requests will appear here after the contract records them.
              </p>
            </div>
          )}
        </>
      )}
      <div className="section-bar" style={{ marginTop: 28 }}>
        <h2>Protocol counts</h2>
        <span>Public reads</span>
      </div>
      <div className="info-panel protocol-counts">
        <span>{vaultCountQuery.data ?? "—"} total vaults on MANDATE</span>
        <span>{requestCountQuery.data ?? "—"} finalized requests on MANDATE</span>
      </div>
    </AppLayout>
  );
}

function Metric({
  label,
  icon,
  value,
  sub,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  sub: string;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        {label} {icon}
      </div>
      <strong className="metric-value">{value}</strong>
      <span className="metric-sub">{sub}</span>
    </div>
  );
}

function VaultCard({ vault }: { vault: Vault }) {
  const periodSpent = effectivePeriodSpent(vault);
  return (
    <div className="vault-card">
      <div>
        <div className="vault-card-top">
          <div className="vault-avatar">
            <Bot size={20} />
          </div>
          <div>
            <h3>{vault.name}</h3>
            <small>
              Vault #{vault.id} · Mandate v{vault.mandateVersion}
            </small>
          </div>
          <StatusBadge status={vault.status} />
        </div>
        <p className="vault-card-balance">
          {formatGen(vault.balanceWei)} <small>GEN</small>
        </p>
        <div className="vault-meta">
          <div>
            <span>AGENT</span>
            <strong>{vault.agent}</strong>
          </div>
          <div>
            <span>MAX / REQUEST</span>
            <strong>{formatGen(vault.maxTransactionWei)} GEN</strong>
          </div>
        </div>
      </div>
      <div className="vault-card-right">
        <div>
          <span className="vault-side-label">PERIOD SPENDING</span>
          <div className="budget-numbers">
            <strong>{formatGen(periodSpent)} GEN spent</strong>
            <span>{formatGen(vault.periodBudgetWei)} GEN limit</span>
          </div>
          <Progress value={percent(periodSpent, vault.periodBudgetWei)} max={100} />
          <p>
            {formatGen(
              vault.periodBudgetWei > periodSpent ? vault.periodBudgetWei - periodSpent : 0n,
            )}{" "}
            GEN remaining
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/vault/$id" params={{ id: vault.id }}>
            View vault <ArrowUpRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="info-panel empty-state">
      <h2>You haven’t created a mandate yet.</h2>
      <p>Create a vault to define an agent, hard limits, and a natural-language mandate.</p>
      <Button asChild>
        <Link to="/create">
          Create mandate <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="info-panel empty-state">
      <h2>{label}</h2>
      <p>Reading the latest state from GenLayer Studio Next.</p>
    </div>
  );
}

function percent(value: bigint, maximum: bigint) {
  if (maximum <= 0n) return 0;
  const result = (value * 100n) / maximum;
  return Number(result > 100n ? 100n : result);
}
