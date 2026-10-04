import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ArrowRight, ChevronRight, LockKeyhole } from "lucide-react";
import { isAddress } from "viem";
import { Button } from "@/components/ui/button";
import { AppLayout, Eyebrow } from "@/components/mandate";
import {
  createVaultWrite,
  getOwnerVaults,
  parseGenAmount,
  type ContractWrite,
} from "@/lib/genlayer/mandate";
import { normalizeMandateError } from "@/lib/genlayer/errors";
import { TransactionRunner } from "@/lib/genlayer/transaction";
import { useWallet } from "@/lib/genlayer/wallet";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create Mandate — MANDATE" },
      {
        name: "description",
        content: "Create a live agent vault with hard controls and a natural-language mandate.",
      },
      { property: "og:title", content: "Create Mandate — MANDATE" },
      {
        property: "og:description",
        content: "Create a policy-controlled agent vault on GenLayer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Create,
});

function Create() {
  const wallet = useWallet();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [agent, setAgent] = useState("");
  const [mandate, setMandate] = useState("");
  const [max, setMax] = useState("");
  const [budget, setBudget] = useState("");
  const [duration, setDuration] = useState("7");
  const [write, setWrite] = useState<ContractWrite>();
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [error, setError] = useState("");
  const existingVaults = useQuery({
    queryKey: ["mandate", "owner-vaults", wallet.address],
    queryFn: () => getOwnerVaults(wallet.address!),
    enabled: Boolean(wallet.address && wallet.status === "connected"),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (wallet.status !== "connected" || !wallet.address) {
      setError("Connect the owner wallet before creating a vault.");
      return;
    }
    if (!isAddress(agent)) {
      setError("Enter a valid agent address before continuing.");
      return;
    }
    try {
      const maxWei = parseGenAmount(max);
      const budgetWei = parseGenAmount(budget);
      if (maxWei === 0n || budgetWei === 0n)
        throw new Error("Enter amounts greater than zero GEN.");
      setWrite(
        createVaultWrite({
          name,
          agent,
          mandate,
          maxTransactionWei: maxWei,
          periodBudgetWei: budgetWei,
          periodSeconds: BigInt(duration) * 86400n,
        }),
      );
      setTransactionOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Check the vault details and try again.");
    }
  }

  async function handleSuccess() {
    if (!wallet.address) return;
    const previousIds = new Set(existingVaults.data?.items.map((item) => item.id) ?? []);
    await queryClient.invalidateQueries({ queryKey: ["mandate", "owner-vaults", wallet.address] });
    await queryClient.invalidateQueries({ queryKey: ["mandate", "vault-count"] });
    const refreshed = await queryClient.fetchQuery({
      queryKey: ["mandate", "owner-vaults", wallet.address],
      queryFn: () => getOwnerVaults(wallet.address!),
    });
    const created = refreshed.items.find((item) => !previousIds.has(item.id));
    setTransactionOpen(false);
    if (created) await navigate({ to: "/vault/$id", params: { id: created.id } });
    else await navigate({ to: "/dashboard" });
  }

  return (
    <AppLayout>
      <div className="breadcrumb">
        <Link to="/dashboard">Dashboard</Link>
        <ChevronRight />
        <span>Create mandate</span>
      </div>
      <div className="page-head">
        <div>
          <Eyebrow>NEW VAULT / LIVE CONTRACT</Eyebrow>
          <h1>Create a mandate</h1>
          <p>Define your agent’s spending boundaries before it makes a request.</p>
        </div>
      </div>
      <form onSubmit={submit} className="form-layout">
        <div className="form-panel">
          <section>
            <h2>01 / Vault identity</h2>
            <p>Name the vault and specify which agent may request payments.</p>
            <label className="field">
              <span>Vault name</span>
              <input
                required
                value={name}
                onInvalid={(e) => e.currentTarget.setCustomValidity("Enter a name for this vault.")}
                onChange={(e) => {
                  e.currentTarget.setCustomValidity("");
                  setName(e.target.value);
                }}
                placeholder="e.g. Growth Agent"
              />
            </label>
            <label className="field">
              <span>Agent address</span>
              <input
                required
                value={agent}
                onInvalid={(e) =>
                  e.currentTarget.setCustomValidity(
                    "Enter the address of the agent allowed to request payments.",
                  )
                }
                onChange={(e) => {
                  e.currentTarget.setCustomValidity("");
                  setAgent(e.target.value);
                }}
                placeholder="0x..."
              />
              <small>The authorized agent wallet will be checked by the contract.</small>
            </label>
          </section>
          <section>
            <h2>02 / The mandate</h2>
            <p>Describe what the agent is and is not allowed to pay for.</p>
            <label className="field">
              <span>Natural-language mandate</span>
              <textarea
                required
                value={mandate}
                onInvalid={(e) =>
                  e.currentTarget.setCustomValidity(
                    "Describe what this agent is allowed and not allowed to spend funds on.",
                  )
                }
                onChange={(e) => {
                  e.currentTarget.setCustomValidity("");
                  setMandate(e.target.value);
                }}
                placeholder="Describe permitted purposes and exclusions..."
              />
              <small>Keep the policy clear enough for an independent semantic decision.</small>
            </label>
          </section>
          <section>
            <h2>03 / Hard controls</h2>
            <p>Numerical limits are checked before the mandate is evaluated.</p>
            <div className="field-grid">
              <label className="field">
                <span>Max per transaction · GEN</span>
                <input
                  required
                  type="number"
                  min="0.000000000000000001"
                  step="any"
                  value={max}
                  onInvalid={(e) =>
                    e.currentTarget.setCustomValidity("Enter an amount greater than 0 GEN.")
                  }
                  onChange={(e) => {
                    e.currentTarget.setCustomValidity("");
                    setMax(e.target.value);
                  }}
                  placeholder="100"
                />
              </label>
              <label className="field">
                <span>Period budget · GEN</span>
                <input
                  required
                  type="number"
                  min="0.000000000000000001"
                  step="any"
                  value={budget}
                  onInvalid={(e) =>
                    e.currentTarget.setCustomValidity("Enter an amount greater than 0 GEN.")
                  }
                  onChange={(e) => {
                    e.currentTarget.setCustomValidity("");
                    setBudget(e.target.value);
                  }}
                  placeholder="300"
                />
              </label>
            </div>
            <label className="field">
              <span>Period duration</span>
              <select value={duration} onChange={(e) => setDuration(e.target.value)}>
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
              </select>
            </label>
          </section>
        </div>
        <aside className="review-panel">
          <h2>Review mandate</h2>
          <p>Your controls at a glance.</p>
          <div className="review-line">
            <span>Vault</span>
            <strong>{name || "—"}</strong>
          </div>
          <div className="review-line">
            <span>Agent</span>
            <strong>{agent || "—"}</strong>
          </div>
          <div className="review-line">
            <span>Max transaction</span>
            <strong>{max ? `${max} GEN` : "—"}</strong>
          </div>
          <div className="review-line">
            <span>Period budget</span>
            <strong>{budget ? `${budget} GEN` : "—"}</strong>
          </div>
          <div className="review-line">
            <span>Duration</span>
            <strong>
              {duration} {duration === "1" ? "day" : "days"}
            </strong>
          </div>
          <div className="review-line">
            <span>Owner</span>
            <strong>{wallet.address ?? "Connect wallet"}</strong>
          </div>
          <Button type="submit" className="button-wide" disabled={transactionOpen}>
            Review live transaction <ArrowRight />
          </Button>
          <div className="review-note">
            <LockKeyhole size={15} /> GenLayer fee review appears before your wallet signs.
          </div>
          {error && (
            <p className="form-error" role="alert">
              {normalizeMandateError(error, error)}
            </p>
          )}
        </aside>
      </form>
      {transactionOpen && write && wallet.kit && wallet.connectedClient && (
        <TransactionRunner
          kit={wallet.kit}
          client={wallet.connectedClient}
          write={write}
          label="Create vault"
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
