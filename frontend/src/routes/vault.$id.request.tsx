import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { isAddress } from "viem";
import { ArrowRight, ChevronRight, Fingerprint, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout, Eyebrow, Progress, StatusBadge } from "@/components/mandate";
import {
  effectivePeriodSpent,
  formatGen,
  getVault,
  getVaultRequests,
  periodRemaining,
  requestSpendWrite,
  type ContractWrite,
} from "@/lib/genlayer/mandate";
import { normalizeMandateError } from "@/lib/genlayer/errors";
import { TransactionRunner } from "@/lib/genlayer/transaction";
import { useWallet } from "@/lib/genlayer/wallet";

export const Route = createFileRoute("/vault/$id/request")({
  head: () => ({
    meta: [
      { title: "Agent Payment Request — MANDATE" },
      { name: "description", content: "Submit a live agent payment request to a MANDATE vault." },
      { property: "og:title", content: "Agent Payment Request — MANDATE" },
      { property: "og:description", content: "Submit a policy-controlled payment request." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RequestSpend,
});

const scenarios = [
  {
    label: "Advertising example",
    recipient: "0x820000000000000000000000000000000000A91D",
    amount: "50",
    category: "Advertising",
    purpose: "Purchase a social media advertising campaign promoting the product to new users.",
  },
  {
    label: "Trading example",
    recipient: "0x2D00000000000000000000000000000000007B40",
    amount: "40",
    category: "Trading",
    purpose: "Buy SOL because the agent expects the price to increase.",
  },
  {
    label: "Over-limit example",
    recipient: "0x5C0000000000000000000000000000000000B2E1",
    amount: "150",
    category: "Sponsorship",
    purpose: "Sponsor a community marketing event.",
  },
];

function RequestSpend() {
  const { id } = Route.useParams();
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Advertising");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState("");
  const [write, setWrite] = useState<ContractWrite>();
  const [transactionOpen, setTransactionOpen] = useState(false);
  const vaultQuery = useQuery({
    queryKey: ["mandate", "vault", id],
    queryFn: () => getVault(id),
    enabled: /^\d+$/.test(id) && id !== "0",
  });
  const vault = vaultQuery.data;
  const requestsQuery = useQuery({
    queryKey: ["mandate", "vault-requests", id, 0, 50],
    queryFn: () => getVaultRequests(id, 0, 50),
    enabled: Boolean(vault),
  });

  if (vaultQuery.isLoading)
    return (
      <AppLayout>
        <LoadingState />
      </AppLayout>
    );
  if (!vault)
    return (
      <AppLayout>
        <div className="page-head">
          <div>
            <Eyebrow>VAULT / LIVE CONTRACT</Eyebrow>
            <h1>Vault not found</h1>
            <p>This vault does not exist on the deployed MANDATE contract.</p>
          </div>
          <Button asChild>
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </AppLayout>
    );

  const currentVault = vault;
  const spent = effectivePeriodSpent(vault);
  const remaining = periodRemaining(vault);
  const agentConnected =
    wallet.status === "connected" && wallet.address?.toLowerCase() === vault.agent.toLowerCase();

  function chooseScenario(index: number) {
    const scenario = scenarios[index];
    if (!scenario) return;
    setRecipient(scenario.recipient);
    setAmount(scenario.amount);
    setCategory(scenario.category);
    setPurpose(scenario.purpose);
    setError("");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (wallet.status !== "connected") {
      setError("Connect the authorized agent wallet to submit a request.");
      return;
    }
    if (!agentConnected) {
      setError("This wallet is not the authorized agent for this vault.");
      return;
    }
    if (!isAddress(recipient)) {
      setError("Enter a valid payment recipient address.");
      return;
    }
    let amountWei: bigint;
    try {
      amountWei =
        BigInt(amount.includes(".") ? decimalToAtto(amount) : amount) *
        (amount.includes(".") ? 1n : 1000000000000000000n);
    } catch {
      setError("Enter a GEN amount with no more than 18 decimal places.");
      return;
    }
    if (amountWei === 0n) return setError("Enter an amount greater than 0 GEN.");
    if (amountWei > currentVault.maxTransactionWei)
      return setError(
        `This request exceeds the ${formatGen(currentVault.maxTransactionWei)} transaction limit.`,
      );
    if (amountWei > remaining) return setError("This request exceeds the remaining period budget.");
    if (amountWei > currentVault.balanceWei)
      return setError("The vault does not have enough GEN for this payment.");
    setWrite(requestSpendWrite({ vaultId: id, recipient, amountWei, category, purpose }));
    setTransactionOpen(true);
  }

  async function handleSuccess() {
    const previousIds = new Set(requestsQuery.data?.items.map((item) => item.id) ?? []);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mandate", "vault", id] }),
      queryClient.invalidateQueries({ queryKey: ["mandate", "vault-requests", id] }),
      queryClient.invalidateQueries({ queryKey: ["mandate", "request-count"] }),
    ]);
    const refreshed = await queryClient.fetchQuery({
      queryKey: ["mandate", "vault-requests", id, 0, 50],
      queryFn: () => getVaultRequests(id, 0, 50),
    });
    const created = refreshed.items.find((item) => !previousIds.has(item.id));
    setTransactionOpen(false);
    if (created) window.location.assign(`/request/${created.id}`);
  }

  return (
    <AppLayout>
      <div className="breadcrumb">
        <Link to="/dashboard">Dashboard</Link>
        <ChevronRight />
        <Link to="/vault/$id" params={{ id }}>
          {vault.name}
        </Link>
        <ChevronRight />
        <span>Agent request</span>
      </div>
      <div className="page-head">
        <div>
          <Eyebrow>AGENT REQUEST / LIVE CONTRACT</Eyebrow>
          <h1>Submit a payment request</h1>
          <p>
            The authorized agent can propose a payment. The contract applies hard controls and
            GenLayer policy.
          </p>
        </div>
      </div>
      {wallet.status !== "connected" && (
        <div className="info-panel inline-notice">
          Connect the authorized agent wallet to submit a request.
        </div>
      )}
      {wallet.status === "connected" && !agentConnected && (
        <div className="info-panel inline-notice">
          This wallet is not the authorized agent for this vault.
        </div>
      )}
      {error && (
        <div className="info-panel inline-notice error-notice" role="alert">
          {normalizeMandateError(error, error)}
        </div>
      )}
      <div className="form-layout">
        <form onSubmit={submit} className="form-panel">
          <h2>Payment request</h2>
          <p style={{ color: "var(--muted-foreground)", fontSize: 12, marginTop: -10 }}>
            Choose a starting example or enter the exact payment details.
          </p>
          <div className="scenario-row">
            {scenarios.map((scenario, index) => (
              <Button
                key={scenario.label}
                type="button"
                variant="outline"
                onClick={() => chooseScenario(index)}
              >
                {scenario.label}
              </Button>
            ))}
          </div>
          <label className="field">
            <span>Recipient address</span>
            <input
              required
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
            />
          </label>
          <div className="field-grid">
            <label className="field">
              <span>Amount · GEN</span>
              <input
                required
                type="number"
                min="0.000000000000000001"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50"
              />
            </label>
            <label className="field">
              <span>Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {[
                  "Advertising",
                  "Community Marketing",
                  "Sponsorship",
                  "Design",
                  "Content Creation",
                  "Trading",
                  "Other",
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Purpose</span>
            <textarea
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Describe what this payment is for..."
            />
          </label>
          <Button
            type="submit"
            disabled={transactionOpen || !agentConnected}
            className="button-wide"
          >
            Review live request <ArrowRight />
          </Button>
          <div className="review-note">
            <LockKeyhole size={15} /> The contract is authoritative. No request is recorded until
            the transaction succeeds.
          </div>
        </form>
        <aside>
          <div className="review-panel">
            <h2>Current hard controls</h2>
            <p>Read directly from the live vault.</p>
            <div className="control-list">
              <div>
                <span>Max transaction</span>
                <strong>{formatGen(vault.maxTransactionWei)} GEN</strong>
              </div>
              <div>
                <span>Period remaining</span>
                <strong>{formatGen(remaining)} GEN</strong>
              </div>
              <div>
                <span>Vault balance</span>
                <strong>{formatGen(vault.balanceWei)} GEN</strong>
              </div>
              <div>
                <span>Vault status</span>
                <StatusBadge status={vault.status} />
              </div>
            </div>
          </div>
          <div className="info-panel">
            <h2>Evaluation order</h2>
            <div className="control-list">
              <div>
                <span>01</span>
                <strong>Deterministic controls</strong>
              </div>
              <div>
                <span>02</span>
                <strong>GenLayer mandate</strong>
              </div>
              <div>
                <span>03</span>
                <strong>Contract decision</strong>
              </div>
            </div>
            <Progress value={spent > 0n ? 1 : 0} max={1} />
          </div>
        </aside>
      </div>
      {transactionOpen && write && wallet.kit && wallet.connectedClient && (
        <TransactionRunner
          kit={wallet.kit}
          client={wallet.connectedClient}
          write={write}
          label="Submit request"
          onDismiss={() => setTransactionOpen(false)}
          onError={(reason) => {
            setError(reason.message);
            setTransactionOpen(false);
          }}
          onSuccess={handleSuccess}
        />
      )}
    </AppLayout>
  );
}

function decimalToAtto(value: string) {
  const [whole = "", fraction = ""] = value.trim().split(".");
  if (!/^\d+$/.test(whole) || !/^\d{1,18}$/.test(fraction)) throw new Error("invalid amount");
  return BigInt(whole) * 1000000000000000000n + BigInt(fraction.padEnd(18, "0"));
}

function LoadingState() {
  return (
    <div className="info-panel empty-state">
      <h2>Loading vault…</h2>
      <p>Reading the latest state from GenLayer Studio Next.</p>
    </div>
  );
}
