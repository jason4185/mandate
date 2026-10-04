import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { isAddress } from "viem";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  ChevronRight,
  CircleDollarSign,
  FileClock,
  Fingerprint,
  Pause,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AppLayout,
  Eyebrow,
  MandatePanel,
  Progress,
  RequestList,
  StatusBadge,
} from "@/components/mandate";
import {
  effectivePeriodSpent,
  formatDuration,
  formatGen,
  getVault,
  getVaultRequests,
  parseGenAmount,
  pauseVaultWrite,
  replaceAgentWrite,
  resumeVaultWrite,
  updateMandateWrite,
  withdrawWrite,
  depositWrite,
  type ContractWrite,
} from "@/lib/genlayer/mandate";
import { normalizeMandateError } from "@/lib/genlayer/errors";
import { TransactionRunner } from "@/lib/genlayer/transaction";
import { useWallet } from "@/lib/genlayer/wallet";

export const Route = createFileRoute("/vault/$id")({
  head: () => ({
    meta: [
      { title: "Vault — MANDATE" },
      {
        name: "description",
        content: "Inspect a live MANDATE vault, policy, controls, and request history.",
      },
      { property: "og:title", content: "Vault — MANDATE" },
      { property: "og:description", content: "Inspect a live policy-controlled agent vault." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VaultDetail,
});

type DialogKind = "deposit" | "update" | "replace" | "withdraw" | "pause" | "resume";

function VaultDetail() {
  const { id } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogKind>();
  const [write, setWrite] = useState<ContractWrite>();
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [newAgent, setNewAgent] = useState("");
  const [mandate, setMandate] = useState("");
  const [max, setMax] = useState("");
  const [budget, setBudget] = useState("");
  const [duration, setDuration] = useState("7");
  const validId = /^\d+$/.test(id) && id !== "0";
  const vaultQuery = useQuery({
    queryKey: ["mandate", "vault", id],
    queryFn: () => getVault(id),
    enabled: validId,
  });
  const vault = vaultQuery.data;
  const requestsQuery = useQuery({
    queryKey: ["mandate", "vault-requests", id, 0, 50],
    queryFn: () => getVaultRequests(id, 0, 50),
    enabled: Boolean(vault),
  });
  if (pathname.endsWith("/request")) return <Outlet />;

  if (vaultQuery.isLoading)
    return (
      <LiveShell>
        <LoadingState />
      </LiveShell>
    );
  if (!vault) {
    const missing =
      vaultQuery.error instanceof Error && /vault does not exist/i.test(vaultQuery.error.message);
    return (
      <LiveShell>
        <NotFoundState missing={missing} error={vaultQuery.error} />
      </LiveShell>
    );
  }
  const currentVault = vault;

  const isOwner =
    wallet.status === "connected" && wallet.address?.toLowerCase() === vault.owner.toLowerCase();
  const periodSpent = effectivePeriodSpent(vault);
  const periodRemaining =
    vault.periodBudgetWei > periodSpent ? vault.periodBudgetWei - periodSpent : 0n;
  const pct = percent(periodSpent, vault.periodBudgetWei);
  const requests = requestsQuery.data?.items ?? [];

  function openDialog(kind: DialogKind) {
    setError("");
    setDialog(kind);
    if (kind === "replace") setNewAgent(currentVault.agent);
    if (kind === "update") {
      setMandate(currentVault.mandate);
      setMax(formatGen(currentVault.maxTransactionWei));
      setBudget(formatGen(currentVault.periodBudgetWei));
      const days = currentVault.periodSeconds / 86400n;
      setDuration(days.toString());
    }
  }

  function openWrite(nextWrite: ContractWrite) {
    setWrite(nextWrite);
    setDialog(undefined);
    setTransactionOpen(true);
  }

  function submitDialog(e?: FormEvent) {
    e?.preventDefault();
    if (!dialog) return;
    setError("");
    try {
      if (dialog === "deposit") {
        const value = parseGenAmount(amount);
        if (value === 0n) throw new Error("Enter a deposit greater than zero GEN.");
        openWrite(depositWrite(id, value));
      } else if (dialog === "withdraw") {
        const value = parseGenAmount(amount);
        if (value === 0n || value > currentVault.balanceWei)
          throw new Error("Enter an amount within the available vault balance.");
        openWrite(withdrawWrite(id, value));
      } else if (dialog === "replace") {
        if (!isAddress(newAgent)) throw new Error("Enter a valid agent address before continuing.");
        openWrite(replaceAgentWrite(id, newAgent));
      } else if (dialog === "update") {
        const maxWei = parseGenAmount(max);
        const budgetWei = parseGenAmount(budget);
        if (maxWei === 0n || budgetWei === 0n)
          throw new Error("Enter amounts greater than zero GEN.");
        openWrite(
          updateMandateWrite({
            vaultId: id,
            mandate,
            maxTransactionWei: maxWei,
            periodBudgetWei: budgetWei,
            periodSeconds: BigInt(duration) * 86400n,
          }),
        );
      } else if (dialog === "pause") openWrite(pauseVaultWrite(id));
      else if (dialog === "resume") openWrite(resumeVaultWrite(id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Check the details and try again.");
    }
  }

  async function refreshAfterWrite() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mandate", "vault", id] }),
      queryClient.invalidateQueries({ queryKey: ["mandate", "vault-requests", id] }),
      queryClient.invalidateQueries({ queryKey: ["mandate", "owner-vaults", currentVault.owner] }),
      queryClient.invalidateQueries({ queryKey: ["mandate", "request-count"] }),
    ]);
  }

  return (
    <AppLayout>
      <div className="breadcrumb">
        <Link to="/dashboard">Dashboard</Link>
        <ChevronRight />
        <span>{vault.name}</span>
      </div>
      <div className="page-head">
        <div>
          <Eyebrow>VAULT / {vault.id.padStart(3, "0")}</Eyebrow>
          <h1>
            {vault.name} <StatusBadge status={vault.status} />
          </h1>
          <p>Policy-controlled funds for your autonomous agent.</p>
        </div>
        <div className="page-actions">
          <Button
            variant="outline"
            disabled={!isOwner}
            onClick={() => {
              setAmount("");
              openDialog("deposit");
            }}
          >
            <Plus /> Add funds
          </Button>
          <Button asChild>
            <Link to="/vault/$id/request" params={{ id }}>
              <span>Agent request</span> <ArrowUpRight />
            </Link>
          </Button>
        </div>
      </div>
      {!isOwner && (
        <div className="info-panel inline-notice">
          {wallet.status === "connected"
            ? "This wallet is not the owner of this vault. Owner actions are disabled."
            : "Connect the owner wallet to manage this vault."}
        </div>
      )}
      {error && (
        <div className="info-panel inline-notice error-notice" role="alert">
          {normalizeMandateError(error, error)}
        </div>
      )}
      <div className="metric-grid">
        <div className="metric">
          <div className="metric-top">
            Balance <Wallet />
          </div>
          <strong className="metric-value">
            {formatGen(vault.balanceWei)} <small>GEN</small>
          </strong>
          <span className="metric-sub">Held in vault</span>
        </div>
        <div className="metric">
          <div className="metric-top">
            Period spent <CircleDollarSign />
          </div>
          <strong className="metric-value">
            {formatGen(periodSpent)} <small>/ {formatGen(vault.periodBudgetWei)} GEN</small>
          </strong>
          <Progress value={pct} max={100} />
        </div>
        <div className="metric">
          <div className="metric-top">
            Max transaction <FileClock />
          </div>
          <strong className="metric-value">
            {formatGen(vault.maxTransactionWei)} <small>GEN</small>
          </strong>
          <span className="metric-sub">Per request</span>
        </div>
        <div className="metric">
          <div className="metric-top">
            Mandate <Fingerprint />
          </div>
          <strong className="metric-value">v{vault.mandateVersion}</strong>
          <span className="metric-sub">Current policy version</span>
        </div>
      </div>
      <div className="detail-grid">
        <div>
          <div className="section-bar" style={{ marginTop: 4 }}>
            <h2>Natural-language mandate</h2>
            <Button
              variant="ghost"
              size="sm"
              disabled={!isOwner}
              onClick={() => openDialog("update")}
            >
              Update <ArrowUpRight />
            </Button>
          </div>
          <MandatePanel vault={vault} />
          <div className="info-panel">
            <h2>Spending this period</h2>
            <div className="detail-budget">
              <strong>
                {formatGen(periodSpent)} <span>/ {formatGen(vault.periodBudgetWei)} GEN</span>
              </strong>
              <span>{formatDuration(vault.periodSeconds)}</span>
            </div>
            <Progress value={pct} max={100} />
            <div className="detail-budget-caption">
              <span>{pct}% used</span>
              <span>{formatGen(periodRemaining)} GEN remaining</span>
            </div>
          </div>
        </div>
        <div>
          <div className="section-bar" style={{ marginTop: 4 }}>
            <h2>Agent access</h2>
          </div>
          <div className="agent-panel">
            <span className="tiny-label">AUTHORIZED AGENT</span>
            <span className="address">{vault.agent}</span>
            <div className="agent-status">
              <span>Request permission</span>
              <StatusBadge status={vault.status} />
            </div>
            <div className="agent-actions">
              <Button
                variant="outline"
                size="sm"
                disabled={!isOwner}
                onClick={() => openDialog(vault.status === "ACTIVE" ? "pause" : "resume")}
              >
                <Pause /> {vault.status === "ACTIVE" ? "Pause" : "Resume"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!isOwner}
                onClick={() => openDialog("replace")}
              >
                <RefreshCw /> Replace
              </Button>
            </div>
          </div>
          <div className="info-panel">
            <h2>Vault details</h2>
            <div className="control-list">
              <div>
                <span>Owner</span>
                <strong className="address">{vault.owner}</strong>
              </div>
              <div>
                <span>Vault ID</span>
                <strong>#{vault.id}</strong>
              </div>
              <div>
                <span>Period duration</span>
                <strong>{formatDuration(vault.periodSeconds)}</strong>
              </div>
              <div>
                <span>Mandate version</span>
                <strong>v{vault.mandateVersion}</strong>
              </div>
            </div>
            <Button
              variant="outline"
              className="button-wide"
              disabled={!isOwner}
              onClick={() => {
                setAmount("");
                openDialog("withdraw");
              }}
            >
              Withdraw funds <ArrowUpRight />
            </Button>
          </div>
        </div>
      </div>
      <div className="section-bar">
        <h2>Request history</h2>
        <span>{requestsQuery.isLoading ? "Loading…" : `${requests.length} shown`}</span>
      </div>
      {requestsQuery.error ? (
        <div className="info-panel empty-state">
          <h2>Request history could not be loaded.</h2>
          <p>{normalizeMandateError(requestsQuery.error)}</p>
        </div>
      ) : requests.length ? (
        <RequestList requests={requests} />
      ) : (
        <div className="info-panel empty-state">
          <h2>No finalized requests yet.</h2>
          <p>Requests recorded by this vault will appear here.</p>
        </div>
      )}
      <ActionDialog
        dialog={dialog}
        onOpenChange={(open) => !open && setDialog(undefined)}
        vault={vault}
        amount={amount}
        setAmount={setAmount}
        newAgent={newAgent}
        setNewAgent={setNewAgent}
        mandate={mandate}
        setMandate={setMandate}
        max={max}
        setMax={setMax}
        budget={budget}
        setBudget={setBudget}
        duration={duration}
        setDuration={setDuration}
        error={error}
        submit={submitDialog}
      />
      {transactionOpen && write && wallet.kit && wallet.connectedClient && (
        <TransactionRunner
          kit={wallet.kit}
          client={wallet.connectedClient}
          write={write}
          label={write.method}
          onDismiss={() => setTransactionOpen(false)}
          onError={(reason) => {
            setError(reason.message);
            setTransactionOpen(false);
          }}
          onSuccess={async () => {
            await refreshAfterWrite();
            setTransactionOpen(false);
          }}
        />
      )}
    </AppLayout>
  );
}

function ActionDialog(props: {
  dialog: DialogKind | undefined;
  onOpenChange: (open: boolean) => void;
  vault: import("@/lib/genlayer/mandate").Vault;
  amount: string;
  setAmount: (value: string) => void;
  newAgent: string;
  setNewAgent: (value: string) => void;
  mandate: string;
  setMandate: (value: string) => void;
  max: string;
  setMax: (value: string) => void;
  budget: string;
  setBudget: (value: string) => void;
  duration: string;
  setDuration: (value: string) => void;
  error: string;
  submit: (event?: FormEvent) => void;
}) {
  const { dialog } = props;
  if (!dialog) return null;
  const title =
    dialog === "deposit"
      ? "Add funds"
      : dialog === "withdraw"
        ? "Withdraw funds"
        : dialog === "replace"
          ? "Replace agent"
          : dialog === "update"
            ? "Update mandate"
            : dialog === "pause"
              ? "Pause vault"
              : "Resume vault";
  return (
    <Dialog open onOpenChange={props.onOpenChange}>
      <DialogContent className="action-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {dialog === "update"
              ? "A live mandate update creates a new version and resets period accounting according to the contract."
              : "Review this live contract action before your wallet signs it."}
          </DialogDescription>
        </DialogHeader>
        {dialog === "pause" || dialog === "resume" ? (
          <div className="dialog-actions">
            <Button onClick={() => props.submit()}>
              {title} <ArrowUpRight />
            </Button>
            <Button variant="outline" onClick={() => props.onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <form onSubmit={props.submit} className="dialog-form">
            {(dialog === "deposit" || dialog === "withdraw") && (
              <label className="field">
                <span>Amount · GEN</span>
                <input
                  required
                  type="number"
                  min="0.000000000000000001"
                  step="any"
                  value={props.amount}
                  onChange={(e) => props.setAmount(e.target.value)}
                  placeholder="0.0"
                />
              </label>
            )}
            {dialog === "replace" && (
              <label className="field">
                <span>New agent address</span>
                <input
                  required
                  value={props.newAgent}
                  onChange={(e) => props.setNewAgent(e.target.value)}
                  placeholder="0x..."
                />
              </label>
            )}
            {dialog === "update" && (
              <>
                <label className="field">
                  <span>Natural-language mandate</span>
                  <textarea
                    required
                    value={props.mandate}
                    onChange={(e) => props.setMandate(e.target.value)}
                  />
                </label>
                <div className="field-grid">
                  <label className="field">
                    <span>Max transaction · GEN</span>
                    <input
                      required
                      type="number"
                      min="0.000000000000000001"
                      step="any"
                      value={props.max}
                      onChange={(e) => props.setMax(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Period budget · GEN</span>
                    <input
                      required
                      type="number"
                      min="0.000000000000000001"
                      step="any"
                      value={props.budget}
                      onChange={(e) => props.setBudget(e.target.value)}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Period duration</span>
                  <select
                    value={props.duration}
                    onChange={(e) => props.setDuration(e.target.value)}
                  >
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                  </select>
                </label>
              </>
            )}
            {props.error && (
              <p className="form-error" role="alert">
                {props.error}
              </p>
            )}
            <div className="dialog-actions">
              <Button type="submit">
                Review transaction <ArrowRight />
              </Button>
              <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
        <p className="review-note">
          <Fingerprint size={15} /> Your wallet will review the Studio Next fee before signing.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function percent(value: bigint, maximum: bigint) {
  if (maximum === 0n) return 0;
  const result = (value * 100n) / maximum;
  return Number(result > 100n ? 100n : result);
}

function LiveShell({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
function LoadingState() {
  return (
    <div className="info-panel empty-state">
      <h2>Loading vault…</h2>
      <p>Reading the latest state from GenLayer Studio Next.</p>
    </div>
  );
}
function NotFoundState({ missing, error }: { missing: boolean; error: unknown }) {
  return (
    <div className="page-head">
      <div>
        <Eyebrow>VAULT / LIVE CONTRACT</Eyebrow>
        <h1>{missing ? "Vault not found" : "Vault could not be loaded"}</h1>
        <p>
          {missing
            ? "This vault does not exist on the deployed MANDATE contract."
            : normalizeMandateError(error)}
        </p>
      </div>
      <Button asChild>
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
