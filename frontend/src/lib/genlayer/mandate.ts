import type { Address } from "viem";
import { getReadClient, type GenLayerClient } from "./client";
import { MANDATE_CONTRACT_ADDRESS } from "./network";

type ContractRecord = {
  [key: string]: unknown;
  accounting?: unknown;
  agent?: unknown;
  amount?: unknown;
  balance?: unknown;
  category?: unknown;
  created_at?: unknown;
  decision?: unknown;
  decisions?: unknown;
  finalized_at?: unknown;
  has_more?: unknown;
  limits?: unknown;
  mandate?: unknown;
  mandate_digest?: unknown;
  mandate_version?: unknown;
  max_config_amount?: unknown;
  max_page_size?: unknown;
  max_period_seconds?: unknown;
  max_requests?: unknown;
  max_requests_per_vault?: unknown;
  max_transaction_amount?: unknown;
  max_vault_balance?: unknown;
  max_vaults?: unknown;
  min_period_seconds?: unknown;
  name?: unknown;
  native_precision?: unknown;
  native_token?: unknown;
  next_offset?: unknown;
  offset?: unknown;
  owner?: unknown;
  period_budget?: unknown;
  period_seconds?: unknown;
  period_spent?: unknown;
  period_start?: unknown;
  protocol?: unknown;
  purpose?: unknown;
  recipient?: unknown;
  request_count?: unknown;
  request_id?: unknown;
  requester?: unknown;
  requests?: unknown;
  result_type?: unknown;
  status?: unknown;
  timezone?: unknown;
  total?: unknown;
  updated_at?: unknown;
  vault_id?: unknown;
  vaults?: unknown;
};

export type VaultStatus = "ACTIVE" | "PAUSED";
export type RequestDecision = "APPROVED" | "REJECTED";
export type RequestStatus = RequestDecision | "BLOCKED";

export type MandateConfig = {
  protocol: string;
  nativeToken: string;
  nativePrecision: number;
  maxPageSize: number;
  maxVaults: number;
  maxRequests: number;
  maxRequestsPerVault: number;
  minPeriodSeconds: bigint;
  maxPeriodSeconds: bigint;
  maxVaultBalance: bigint;
  maxConfigAmount: bigint;
  limits: Record<string, number>;
  decisions: string[];
  timezone: string;
  accounting: string;
};

export type Vault = {
  id: string;
  owner: Address;
  agent: Address;
  name: string;
  mandate: string;
  mandateVersion: number;
  status: VaultStatus;
  balanceWei: bigint;
  maxTransactionWei: bigint;
  periodBudgetWei: bigint;
  periodSeconds: bigint;
  periodStart: bigint;
  periodSpentWei: bigint;
  createdAt: bigint;
  updatedAt: bigint;
  requestCount: number;
  mandateDigest: string;
};

export type MandateRequest = {
  id: string;
  vaultId: string;
  mandateVersion: number;
  requester: Address;
  recipient: Address;
  amountWei: bigint;
  category: string;
  purpose: string;
  decision: RequestDecision;
  resultType: string;
  createdAt: bigint;
  finalizedAt: bigint;
  mandateDigest: string;
};

export type ContractWrite = {
  kind: "write";
  address: Address;
  method: string;
  args: unknown[];
  value?: bigint;
};

function integer(value: unknown, field: string) {
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
    if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  } catch {
    // Fall through to the stable error below.
  }
  throw new Error(`Contract returned an invalid ${field}.`);
}

function numberValue(value: unknown, field: string) {
  const result = integer(value, field);
  const number = Number(result);
  if (!Number.isSafeInteger(number)) throw new Error(`Contract returned an unsafe ${field}.`);
  return number;
}

function stringValue(value: unknown, field: string) {
  if (typeof value !== "string") throw new Error(`Contract returned an invalid ${field}.`);
  return value;
}

function addressValue(value: unknown, field: string): Address {
  const address = stringValue(value, field);
  if (!/^0x[0-9a-fA-F]{40}$/.test(address))
    throw new Error(`Contract returned an invalid ${field}.`);
  return address as Address;
}

function record(value: unknown, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Contract returned an invalid ${field}.`);
  }
  return value as ContractRecord;
}

async function read(client: GenLayerClient, method: string, args: unknown[] = []) {
  return await client.readContract({
    address: MANDATE_CONTRACT_ADDRESS,
    functionName: method,
    args: args as never[],
    transactionHashVariant: "latest-nonfinal" as never,
  });
}

function page(value: unknown, field: string) {
  return record(value, `${field} page`);
}

function mapVault(raw: unknown): Vault {
  const value = record(raw, "vault");
  return {
    id: String(numberValue(value.vault_id, "vault id")),
    owner: addressValue(value.owner, "vault owner"),
    agent: addressValue(value.agent, "vault agent"),
    name: stringValue(value.name, "vault name"),
    mandate: stringValue(value.mandate, "mandate"),
    mandateVersion: numberValue(value.mandate_version, "mandate version"),
    status: stringValue(value.status, "vault status") as VaultStatus,
    balanceWei: integer(value.balance, "vault balance"),
    maxTransactionWei: integer(value.max_transaction_amount, "transaction limit"),
    periodBudgetWei: integer(value.period_budget, "period budget"),
    periodSeconds: integer(value.period_seconds, "period duration"),
    periodStart: integer(value.period_start, "period start"),
    periodSpentWei: integer(value.period_spent, "period spent"),
    createdAt: integer(value.created_at, "vault creation time"),
    updatedAt: integer(value.updated_at, "vault update time"),
    requestCount: numberValue(value.request_count, "vault request count"),
    mandateDigest: stringValue(value.mandate_digest, "mandate digest"),
  };
}

function mapRequest(raw: unknown): MandateRequest {
  const value = record(raw, "request");
  return {
    id: String(numberValue(value.request_id, "request id")),
    vaultId: String(numberValue(value.vault_id, "request vault id")),
    mandateVersion: numberValue(value.mandate_version, "request mandate version"),
    requester: addressValue(value.requester, "requester"),
    recipient: addressValue(value.recipient, "recipient"),
    amountWei: integer(value.amount, "request amount"),
    category: stringValue(value.category, "request category"),
    purpose: stringValue(value.purpose, "request purpose"),
    decision: stringValue(value.decision, "request decision") as RequestDecision,
    resultType: stringValue(value.result_type, "request result type"),
    createdAt: integer(value.created_at, "request creation time"),
    finalizedAt: integer(value.finalized_at, "request finalization time"),
    mandateDigest: stringValue(value.mandate_digest, "request mandate digest"),
  };
}

export function formatGen(valueWei: bigint) {
  const negative = valueWei < 0n;
  const value = negative ? -valueWei : valueWei;
  const whole = value / 1000000000000000000n;
  const fraction = (value % 1000000000000000000n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function parseGenAmount(value: string) {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,18})?$/.test(normalized)) {
    throw new Error("Enter a GEN amount with no more than 18 decimal places.");
  }
  const [whole = "0", fraction = ""] = normalized.split(".");
  return BigInt(whole) * 1000000000000000000n + BigInt(fraction.padEnd(18, "0") || "0");
}

export function formatDuration(seconds: bigint) {
  const days = seconds / 86400n;
  return days === 1n ? "1 day" : `${days} days`;
}

export function effectivePeriodSpent(vault: Vault, now = BigInt(Math.floor(Date.now() / 1000))) {
  return now >= vault.periodStart && now - vault.periodStart >= vault.periodSeconds
    ? 0n
    : vault.periodSpentWei;
}

export function periodRemaining(vault: Vault) {
  const spent = effectivePeriodSpent(vault);
  return vault.periodBudgetWei > spent ? vault.periodBudgetWei - spent : 0n;
}

export function formatTimestamp(seconds: bigint) {
  if (seconds === 0n) return "—";
  return new Date(Number(seconds) * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export async function getConfig(client = getReadClient()): Promise<MandateConfig> {
  const value = record(await read(client, "get_config"), "configuration");
  const limits = record(value.limits, "configuration limits");
  return {
    protocol: stringValue(value.protocol, "protocol"),
    nativeToken: stringValue(value.native_token, "native token"),
    nativePrecision: numberValue(value.native_precision, "native precision"),
    maxPageSize: numberValue(value.max_page_size, "maximum page size"),
    maxVaults: numberValue(value.max_vaults, "maximum vaults"),
    maxRequests: numberValue(value.max_requests, "maximum requests"),
    maxRequestsPerVault: numberValue(value.max_requests_per_vault, "maximum requests per vault"),
    minPeriodSeconds: integer(value.min_period_seconds, "minimum period"),
    maxPeriodSeconds: integer(value.max_period_seconds, "maximum period"),
    maxVaultBalance: integer(value.max_vault_balance, "maximum vault balance"),
    maxConfigAmount: integer(value.max_config_amount, "maximum configuration amount"),
    limits: Object.fromEntries(
      Object.entries(limits).map(([key, item]) => [key, numberValue(item, `limit ${key}`)]),
    ),
    decisions: Array.isArray(value.decisions)
      ? value.decisions.map((item) => stringValue(item, "decision"))
      : [],
    timezone: stringValue(value.timezone, "timezone"),
    accounting: stringValue(value.accounting, "accounting policy"),
  };
}

export async function getVaultCount(client = getReadClient()) {
  return numberValue(await read(client, "get_vault_count"), "vault count");
}

export async function getRequestCount(client = getReadClient()) {
  return numberValue(await read(client, "get_request_count"), "request count");
}

export async function getVault(vaultId: string, client = getReadClient()) {
  return mapVault(await read(client, "get_vault", [BigInt(vaultId)]));
}

export async function getRequest(requestId: string, client = getReadClient()) {
  return mapRequest(await read(client, "get_request", [BigInt(requestId)]));
}

function mapVaultPage(value: unknown) {
  const result = page(value, "vault");
  const items = Array.isArray(result.vaults) ? result.vaults.map(mapVault) : [];
  return {
    offset: numberValue(result.offset, "vault offset"),
    nextOffset: numberValue(result.next_offset, "vault next offset"),
    total: numberValue(result.total, "vault total"),
    hasMore: Boolean(result.has_more),
    items,
  };
}

export async function getVaults(offset = 0, limit = 50, client = getReadClient()) {
  return mapVaultPage(await read(client, "get_vaults", [BigInt(offset), BigInt(limit)]));
}

export async function getOwnerVaults(
  owner: string,
  offset = 0,
  limit = 50,
  client = getReadClient(),
) {
  return mapVaultPage(
    await read(client, "get_owner_vaults", [owner, BigInt(offset), BigInt(limit)]),
  );
}

export async function getVaultRequests(
  vaultId: string,
  offset = 0,
  limit = 50,
  client = getReadClient(),
) {
  const result = page(
    await read(client, "get_vault_requests", [BigInt(vaultId), BigInt(offset), BigInt(limit)]),
    "request",
  );
  const items = Array.isArray(result.requests) ? result.requests.map(mapRequest) : [];
  return {
    offset: numberValue(result.offset, "request offset"),
    nextOffset: numberValue(result.next_offset, "request next offset"),
    total: numberValue(result.total, "request total"),
    hasMore: Boolean(result.has_more),
    items,
  };
}

export function createVaultWrite(input: {
  name: string;
  agent: string;
  mandate: string;
  maxTransactionWei: bigint;
  periodBudgetWei: bigint;
  periodSeconds: bigint;
}): ContractWrite {
  return {
    kind: "write",
    address: MANDATE_CONTRACT_ADDRESS,
    method: "create_vault",
    args: [
      input.name,
      input.agent,
      input.mandate,
      input.maxTransactionWei,
      input.periodBudgetWei,
      input.periodSeconds,
    ],
  };
}

export function depositWrite(vaultId: string, value: bigint): ContractWrite {
  return {
    kind: "write",
    address: MANDATE_CONTRACT_ADDRESS,
    method: "deposit",
    args: [BigInt(vaultId)],
    value,
  };
}

export function requestSpendWrite(input: {
  vaultId: string;
  recipient: string;
  amountWei: bigint;
  category: string;
  purpose: string;
}): ContractWrite {
  return {
    kind: "write",
    address: MANDATE_CONTRACT_ADDRESS,
    method: "request_spend",
    args: [BigInt(input.vaultId), input.recipient, input.amountWei, input.category, input.purpose],
  };
}

export function pauseVaultWrite(vaultId: string): ContractWrite {
  return {
    kind: "write",
    address: MANDATE_CONTRACT_ADDRESS,
    method: "pause_vault",
    args: [BigInt(vaultId)],
  };
}

export function resumeVaultWrite(vaultId: string): ContractWrite {
  return {
    kind: "write",
    address: MANDATE_CONTRACT_ADDRESS,
    method: "resume_vault",
    args: [BigInt(vaultId)],
  };
}

export function replaceAgentWrite(vaultId: string, agent: string): ContractWrite {
  return {
    kind: "write",
    address: MANDATE_CONTRACT_ADDRESS,
    method: "replace_agent",
    args: [BigInt(vaultId), agent],
  };
}

export function updateMandateWrite(input: {
  vaultId: string;
  mandate: string;
  maxTransactionWei: bigint;
  periodBudgetWei: bigint;
  periodSeconds: bigint;
}): ContractWrite {
  return {
    kind: "write",
    address: MANDATE_CONTRACT_ADDRESS,
    method: "update_mandate",
    args: [
      BigInt(input.vaultId),
      input.mandate,
      input.maxTransactionWei,
      input.periodBudgetWei,
      input.periodSeconds,
    ],
  };
}

export function withdrawWrite(vaultId: string, amountWei: bigint): ContractWrite {
  return {
    kind: "write",
    address: MANDATE_CONTRACT_ADDRESS,
    method: "withdraw",
    args: [BigInt(vaultId), amountWei],
  };
}
