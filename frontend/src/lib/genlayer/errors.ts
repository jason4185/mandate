export function normalizeMandateError(reason: unknown, fallback?: string) {
  const detail = reason instanceof Error ? reason.message : String(reason);
  const normalized = detail.toLowerCase();

  if (!normalized || normalized === "undefined" || normalized === "null") {
    return fallback ?? "MANDATE could not complete that request. Check the current vault state.";
  }
  if (/user rejected|user denied|user cancel|rejected by (?:the )?user|\b4001\b/.test(normalized)) {
    return "You cancelled the wallet request.";
  }
  if (
    /wrong network|wrong chain|chain mismatch|unsupported chain|unknown chain|\b4902\b|chain id/.test(
      normalized,
    )
  ) {
    return "Switch your wallet to GenLayer Studio Next to continue.";
  }
  if (/vault owner only|only.*owner/.test(normalized)) {
    return "This wallet is not the owner of this vault.";
  }
  if (/authorized agent only|agent.*only|not.*authorized agent/.test(normalized)) {
    return "This wallet is not the authorized agent for this vault.";
  }
  if (/vault is paused|already paused/.test(normalized)) {
    return "The vault is currently paused.";
  }
  if (/already active/.test(normalized)) {
    return "The vault is already active.";
  }
  if (/amount exceeds transaction limit/.test(normalized)) {
    return "This request exceeds the vault's transaction limit.";
  }
  if (/period budget exceeded/.test(normalized)) {
    return "This request exceeds the remaining period budget.";
  }
  if (/insufficient vault balance/.test(normalized)) {
    return "The vault does not have enough GEN for this payment.";
  }
  if (/agent cannot receive payment/.test(normalized)) {
    return "The agent cannot send vault funds to itself.";
  }
  if (/deposit must be greater|withdrawal amount is invalid/.test(normalized)) {
    return "Enter a GEN amount greater than zero and within the available balance.";
  }
  if (
    /execution.*(?:error|failed)|failed to execute|execution reverted|finished_with_error/.test(
      normalized,
    )
  ) {
    return "The transaction was finalized with an execution error.";
  }
  if (
    /insufficient funds|insufficient balance|not enough (?:gen|funds)|fee.*(?:balance|funds)/.test(
      normalized,
    )
  ) {
    return "Your wallet does not have enough GEN to cover this transaction.";
  }
  if (
    /fee estimate|failed to estimate|gas estimate|estimate.*fee|external.message fee/.test(
      normalized,
    )
  ) {
    return "MANDATE could not prepare the network fee estimate. Try again shortly.";
  }
  if (
    /failed to fetch|fetch failed|network error|connection error|transport|rpc|unavailable/.test(
      normalized,
    )
  ) {
    return "MANDATE could not reach Studio Next. Check your connection and try again.";
  }

  return fallback ?? "MANDATE could not complete that request. Check the current vault state.";
}
