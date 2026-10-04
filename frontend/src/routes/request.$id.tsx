import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout, Eyebrow, StatusBadge } from "@/components/mandate";
import { formatGen, formatTimestamp, getRequest, getVault } from "@/lib/genlayer/mandate";
import { normalizeMandateError } from "@/lib/genlayer/errors";

export const Route = createFileRoute("/request/$id")({
  head: () => ({
    meta: [
      { title: "Request Details — MANDATE" },
      {
        name: "description",
        content: "Inspect a finalized MANDATE payment request and its stored decision.",
      },
      { property: "og:title", content: "Request Details — MANDATE" },
      { property: "og:description", content: "Inspect a live agent request and policy decision." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RequestDetail,
});

function RequestDetail() {
  const { id } = Route.useParams();
  const validId = /^\d+$/.test(id) && id !== "0";
  const requestQuery = useQuery({
    queryKey: ["mandate", "request", id],
    queryFn: () => getRequest(id),
    enabled: validId,
  });
  const request = requestQuery.data;
  const vaultQuery = useQuery({
    queryKey: ["mandate", "vault", request?.vaultId],
    queryFn: () => getVault(request!.vaultId),
    enabled: Boolean(request),
  });

  if (requestQuery.isLoading)
    return (
      <AppLayout>
        <LoadingState />
      </AppLayout>
    );
  if (!request)
    return (
      <AppLayout>
        <div className="page-head">
          <div>
            <Eyebrow>REQUEST / LIVE CONTRACT</Eyebrow>
            <h1>Request not found</h1>
            <p>
              {requestQuery.error instanceof Error &&
              /request does not exist/i.test(requestQuery.error.message)
                ? "This request does not exist on the deployed MANDATE contract."
                : normalizeMandateError(requestQuery.error)}
            </p>
          </div>
          <Button asChild>
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </AppLayout>
    );

  return (
    <AppLayout>
      <div className="breadcrumb">
        <Link to="/dashboard">Dashboard</Link>
        <ChevronRight />
        <Link to="/vault/$id" params={{ id: request.vaultId }}>
          {vaultQuery.data?.name ?? `Vault #${request.vaultId}`}
        </Link>
        <ChevronRight />
        <span>Request #{request.id.padStart(3, "0")}</span>
      </div>
      <div className="page-head">
        <div>
          <Eyebrow>REQUEST / {request.id.padStart(3, "0")}</Eyebrow>
          <h1>{request.category} request</h1>
          <p>
            {formatGen(request.amountWei)} GEN requested by {request.requester}
          </p>
        </div>
        <StatusBadge status={request.decision} />
      </div>
      <div className="detail-grid">
        <div className="detail-card">
          <h2>Request details</h2>
          <div className="detail-fields">
            <Detail label="Amount">
              <strong>{formatGen(request.amountWei)} GEN</strong>
            </Detail>
            <Detail label="Recipient">
              <strong className="address">{request.recipient}</strong>
            </Detail>
            <Detail label="Category">
              <strong>{request.category}</strong>
            </Detail>
            <Detail label="Vault">
              <strong>
                {vaultQuery.data?.name ?? `Vault #${request.vaultId}`} · #{request.vaultId}
              </strong>
            </Detail>
            <Detail label="Requester">
              <strong className="address">{request.requester}</strong>
            </Detail>
            <Detail label="Mandate version">
              <strong>v{request.mandateVersion}</strong>
            </Detail>
            <Detail label="Policy digest">
              <strong className="address">{request.mandateDigest}</strong>
            </Detail>
            <Detail label="Result type">
              <strong>{request.resultType}</strong>
            </Detail>
            <Detail label="Decision">
              <StatusBadge status={request.decision} />
            </Detail>
          </div>
          <div className="detail-field">
            <small>Purpose</small>
            <strong>{request.purpose}</strong>
          </div>
        </div>
        <aside className="detail-card">
          <h2>Decision timeline</h2>
          <div className="timeline">
            <div className="timeline-item">
              <strong>Submitted</strong>
              <small>{formatTimestamp(request.createdAt)}</small>
            </div>
            <div className="timeline-item">
              <strong>Hard controls</strong>
              <small>Deterministic controls passed before the stored decision was created.</small>
            </div>
            <div className="timeline-item">
              <strong>GenLayer policy</strong>
              <small>
                The request was evaluated against mandate version {request.mandateVersion}.
              </small>
            </div>
            <div className="timeline-item">
              <strong>
                {request.decision === "APPROVED" ? "Payment finalized" : "Request finalized"}
              </strong>
              <small>
                {formatTimestamp(request.finalizedAt)} ·{" "}
                {request.decision === "APPROVED"
                  ? "The contract recorded the approved payment."
                  : "The contract recorded the rejected request without spending vault funds."}
              </small>
            </div>
          </div>
          <div className="review-note" style={{ marginTop: 28 }}>
            <span>
              Stored on the deployed MANDATE contract. No client-side decision was inferred.
            </span>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="detail-field">
      <small>{label}</small>
      {children}
    </div>
  );
}
function LoadingState() {
  return (
    <div className="info-panel empty-state">
      <h2>Loading request…</h2>
      <p>Reading the finalized request from GenLayer Studio Next.</p>
    </div>
  );
}
