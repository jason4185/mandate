import {
  CapsShield,
  FeeReceipt,
  HoldToSign,
  PresetSelector,
  Timeline,
  VerifyBadge,
  useTransactionFlow,
} from "@genlayer/transaction-kit-react";
import type {
  PolicyQuote,
  SubmitInput,
  TrackedStatus,
  TransactionKit,
} from "@genlayer/transaction-kit";
import { isSuccessful } from "genlayer-js";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GenLayerClient } from "./client";
import { normalizeMandateError } from "./errors";
import type { ContractWrite } from "./mandate";
import { explorerTransactionUrl } from "./network";

export async function verifySuccessfulTransaction(status: TrackedStatus, client: GenLayerClient) {
  if (!status.genlayerTxId) throw new Error("Studio Next did not return a transaction ID.");
  if (status.successful === true) return status.genlayerTxId;
  if (status.successful === false) {
    throw new Error(
      `Transaction execution failed: ${status.executionResultName ?? status.statusName ?? "unknown outcome"}.`,
    );
  }
  const transaction = await client.getTransaction({ hash: status.genlayerTxId as never });
  if (!isSuccessful(transaction)) {
    throw new Error(
      `Transaction execution failed: ${transaction.txExecutionResultName ?? transaction.statusName ?? "unknown outcome"}.`,
    );
  }
  return status.genlayerTxId;
}

function leaderRounds(distribution: PolicyQuote["distribution"]) {
  return distribution.rotations.reduce((total, rotations) => total + rotations + 1n, 1n);
}

function withExternalMessageFees(baseKit: TransactionKit, client: GenLayerClient): TransactionKit {
  const externalTransfers = new Set(["request_spend", "withdraw"]);
  const isExternalTransfer = (
    tx: SubmitInput | undefined,
  ): tx is Extract<SubmitInput, { kind: "write" }> =>
    tx?.kind === "write" && externalTransfers.has(tx.method);

  return {
    ...(baseKit.allowUnverified ? { allowUnverified: true } : {}),
    estimate: async (input, tx) => {
      const baseQuote = await baseKit.estimate(input, tx);
      if (!isExternalTransfer(tx)) return baseQuote;
      const distribution = baseQuote.distribution;
      const measured = await client.estimateTransactionFeesForWrite({
        address: tx.address,
        functionName: tx.method,
        ...(tx.args === undefined ? {} : { args: tx.args as never[] }),
        value: baseQuote.userValue,
        leaderTimeunitsAllocation: distribution.leaderTimeunitsAllocation,
        validatorTimeunitsAllocation: distribution.validatorTimeunitsAllocation,
        appealRounds: distribution.appealRounds,
        executionBudgetPerRound: distribution.executionBudgetPerRound,
        totalMessageFees: distribution.totalMessageFees,
        rotations: distribution.rotations,
        maxPriceGenPerTimeUnit: distribution.maxPriceGenPerTimeUnit,
        storageFeeMaxGasPrice: distribution.storageFeeMaxGasPrice,
        receiptFeeMaxGasPrice: distribution.receiptFeeMaxGasPrice,
      });
      if (!measured.messageAllocations?.length) {
        throw new Error(`No external-message fee allocation was returned for ${tx.method}.`);
      }
      const executionBudget =
        measured.distribution.executionBudgetPerRound * leaderRounds(measured.distribution);
      const messageFees = measured.distribution.totalMessageFees;
      return {
        ...baseQuote,
        distribution: measured.distribution,
        feeValue: measured.feeValue,
        total: measured.feeValue + baseQuote.userValue,
        breakdown: {
          timeUnitFees:
            measured.feeValue - messageFees - executionBudget > 0n
              ? measured.feeValue - messageFees - executionBudget
              : 0n,
          executionBudget,
          messageFees,
        },
        caps: {
          genPerTimeUnit: measured.distribution.maxPriceGenPerTimeUnit,
          storagePrice: measured.distribution.storageFeeMaxGasPrice,
          receiptPrice: measured.distribution.receiptFeeMaxGasPrice,
        },
        messageAllocations: measured.messageAllocations,
      } as PolicyQuote & { messageAllocations: unknown[] };
    },
    submit: async (quote, tx) => {
      if (!isExternalTransfer(tx)) return baseKit.submit(quote, tx);
      const messageAllocations = (quote as PolicyQuote & { messageAllocations?: unknown[] })
        .messageAllocations;
      if (!messageAllocations?.length) {
        throw new Error(`No external-message fee allocation is available for ${tx.method}.`);
      }
      const result = await client.writeContract({
        address: tx.address,
        functionName: tx.method,
        ...(tx.args === undefined ? {} : { args: tx.args as never[] }),
        value: quote.userValue,
        fees: {
          distribution: quote.distribution,
          messageAllocations: messageAllocations as never[],
          feeValue: quote.feeValue,
        },
      });
      return { genlayerTxId: result };
    },
    cancel: baseKit.cancel,
    topUp: baseKit.topUp,
    track: baseKit.track,
    verification: baseKit.verification,
  };
}

function TransactionViewport({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div
      className="transaction-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="MANDATE transaction"
    >
      <div className="transaction-backdrop" aria-hidden="true" />
      <div className="transaction-dialog">{children}</div>
    </div>,
    document.body,
  );
}

export function ExplorerLink({ txId }: { txId: string }) {
  return (
    <a className="text-link" href={explorerTransactionUrl(txId)} target="_blank" rel="noreferrer">
      View transaction <span aria-hidden="true">↗</span>
    </a>
  );
}

export function TransactionRunner({
  kit,
  client,
  write,
  onSuccess,
  onError,
  onDismiss,
  intro,
  label = "Continue",
  onFinalized,
}: {
  kit: TransactionKit;
  client: GenLayerClient;
  write: ContractWrite;
  onSuccess: (txId: string) => void | Promise<void>;
  onError: (error: Error) => void;
  onDismiss?: () => void;
  intro?: ReactNode;
  label?: string;
  onFinalized?: (status: TrackedStatus) => void | Promise<void>;
}) {
  const argsKey = write.args.map(String).join("|");
  const argsRef = useRef({ key: argsKey, args: write.args });
  if (argsRef.current.key !== argsKey) argsRef.current = { key: argsKey, args: write.args };
  const stableArgs = argsRef.current.args;
  const transactionKit = useMemo(() => withExternalMessageFees(kit, client), [client, kit]);
  const flow = useTransactionFlow({
    kit: transactionKit,
    tx: useMemo(
      () => ({
        kind: "write" as const,
        address: write.address,
        method: write.method,
        args: stableArgs,
      }),
      [write.address, write.method, stableArgs],
    ),
    trackUntil: "decided",
    ...(write.value === undefined ? {} : { userValue: write.value }),
  });
  const [txId, setTxId] = useState<string>();
  const [verificationError, setVerificationError] = useState<string>();
  const handled = useRef("");
  const reported = useRef("");
  const state = flow.state;

  useEffect(() => {
    if (state.step === "error") {
      if (reported.current !== state.message) {
        reported.current = state.message;
        onError(new Error(normalizeMandateError(state.message)));
        onDismiss?.();
      }
      return;
    }
    reported.current = "";
    if (
      state.step !== "done" ||
      !state.status.genlayerTxId ||
      handled.current === state.status.genlayerTxId
    )
      return;
    handled.current = state.status.genlayerTxId;
    setTxId(state.status.genlayerTxId);
    void verifySuccessfulTransaction(state.status, client)
      .then(async (id) => {
        void transactionKit
          .track(
            id as `0x${string}`,
            (status) => {
              if (status.phase === "finalized") void onFinalized?.(status);
            },
            { until: "finalized" },
          )
          .catch(() => undefined);
        await onSuccess(id);
      })
      .catch((reason) => {
        const message = normalizeMandateError(reason);
        setVerificationError(message);
        onError(new Error(message));
      });
  }, [client, onDismiss, onError, onFinalized, onSuccess, state, transactionKit]);

  const retry = () => {
    setVerificationError(undefined);
    handled.current = "";
    flow.reset();
  };
  const showError = state.step === "error" || Boolean(verificationError);
  const content = (
    <div className="transaction-content">
      {intro && <div className="transaction-intro">{intro}</div>}
      <div className="gltk-root" data-theme="dark">
        <div className="gltk-panel mandate-gltk-panel">
          <div className="gltk-head">
            <span className="gltk-head-title">MANDATE TRANSACTION</span>
            <span className="gltk-head-network">Studio Next</span>
          </div>
          <div className="gltk-target">
            <span className="gltk-target-kind">Write</span>
            <span className="gltk-target-what">{formatMethodLabel(write.method)}</span>
          </div>
          <div className="gltk-receipt" aria-label="Vault value">
            <div className="gltk-row">
              <span className="gltk-row-label">Vault value</span>
              <span className="gltk-row-value">
                {formatGen(write.value ?? 0n)} <span className="gltk-unit">GEN</span>
              </span>
            </div>
          </div>
          {state.step === "estimating" && (
            <div className="gltk-outcome" data-tone="warn">
              <p className="gltk-outcome-title">Preparing transaction</p>
              <p className="gltk-outcome-detail">Preparing the live Studio Next fee estimate…</p>
            </div>
          )}
          {(state.step === "review" || state.step === "blocked") && (
            <>
              {!flow.quote?.gasless && (
                <PresetSelector value={flow.preset} onChange={flow.setPreset} />
              )}
              {flow.quote && <FeeReceipt quote={flow.quote} />}
              {flow.quote && !flow.quote.gasless && <CapsShield quote={flow.quote} />}
              {flow.quote && (
                <VerifyBadge
                  status={flow.quote.verification.status}
                  {...(flow.verification?.feeConfigHash
                    ? { feeConfigHash: flow.verification.feeConfigHash }
                    : {})}
                />
              )}
              {state.step === "blocked" && (
                <div className="gltk-outcome" data-tone="error">
                  <p className="gltk-outcome-title">The fee estimate needs review.</p>
                  <p className="gltk-outcome-detail">{normalizeMandateError(state.message)}</p>
                </div>
              )}
              <div className="gltk-actions">
                {state.step === "blocked" ? (
                  <button type="button" onClick={retry}>
                    Re-estimate
                  </button>
                ) : (
                  <HoldToSign
                    onConfirm={() => void flow.approve()}
                    disabled={!flow.quote}
                    label="Approve & sign"
                  />
                )}
              </div>
              {onDismiss && (
                <div className="gltk-link-row">
                  <button type="button" onClick={onDismiss}>
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
          {state.step === "estimating" && onDismiss && (
            <div className="gltk-link-row">
              <button type="button" onClick={onDismiss}>
                Cancel
              </button>
            </div>
          )}
          {state.step === "signing" && (
            <div className="gltk-outcome" data-tone="warn">
              <p className="gltk-outcome-title">Waiting for your wallet</p>
              <p className="gltk-outcome-detail">Waiting for wallet approval…</p>
            </div>
          )}
          {state.step === "tracking" && (
            <>
              <Timeline status={state.status} />
              <div className="gltk-actions">
                {flow.canTopUp && (
                  <button type="button" onClick={() => void flow.topUp()}>
                    Top up fees
                  </button>
                )}
                {flow.canCancel && (
                  <button type="button" onClick={() => void flow.cancel()}>
                    Cancel transaction
                  </button>
                )}
              </div>
            </>
          )}
          {state.step === "done" && !verificationError && (
            <>
              <Timeline status={state.status} />
              <div className="gltk-outcome" data-tone="success">
                <p className="gltk-outcome-title">
                  {state.status.phase === "finalized"
                    ? "Transaction finalized"
                    : "Transaction accepted"}
                </p>
                <p className="gltk-outcome-detail">
                  {state.status.phase === "finalized"
                    ? "MANDATE state is up to date."
                    : "Updating MANDATE…"}
                </p>
              </div>
            </>
          )}
          {showError && (
            <>
              <div className="gltk-outcome" data-tone="error">
                <p className="gltk-outcome-title">The transaction was not completed.</p>
                <p className="gltk-outcome-detail">
                  {verificationError ??
                    (state.step === "error"
                      ? normalizeMandateError(state.message)
                      : "The transaction was finalized with an execution error.")}
                </p>
              </div>
              <div className="gltk-actions">
                {state.step === "error" && (
                  <button type="button" onClick={retry}>
                    Re-estimate and retry
                  </button>
                )}
                <button type="button" onClick={() => onDismiss?.()}>
                  Dismiss
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {txId && <ExplorerLink txId={txId} />}
      <p className="transaction-footnote">
        {label} uses the connected wallet and Studio Next fee flow. Protocol value and network fees
        are shown separately.
      </p>
    </div>
  );
  return <TransactionViewport>{content}</TransactionViewport>;
}

function formatMethodLabel(method: string) {
  return method.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatGen(value: bigint) {
  const whole = value / 1000000000000000000n;
  const fraction = (value % 1000000000000000000n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
}
