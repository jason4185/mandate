import { studioDevnet } from "genlayer-js/chains";
import type { GenLayerChain } from "@genlayer/transaction-kit";
import { isAddress, type Address } from "viem";

export const MANDATE_CONTRACT_ADDRESS = "0x85824bc12E7CA306A4671C9A5a102aEBacC7E109" as Address;
export const STUDIO_NEXT_CHAIN_ID = 61997;
export const STUDIO_NEXT_RPC_URL = "https://studio-next.genlayer.com/api";
export const STUDIO_NEXT_EXPLORER_URL = "https://explorer-studio-dev.genlayer.com";

export const studioNext = {
  ...studioDevnet,
  id: STUDIO_NEXT_CHAIN_ID,
  name: "GenLayer Studio Next",
  rpcUrls: {
    default: {
      http: [STUDIO_NEXT_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "GenLayer Studio Explorer",
      url: STUDIO_NEXT_EXPLORER_URL,
    },
  },
} satisfies GenLayerChain;

export const studioNextChainIdHex = `0x${STUDIO_NEXT_CHAIN_ID.toString(16)}`;

export function explorerTransactionUrl(txId: string) {
  return `${STUDIO_NEXT_EXPLORER_URL}/tx/${txId}`;
}

export function explorerAddressUrl(address: string) {
  return `${STUDIO_NEXT_EXPLORER_URL}/address/${address}`;
}

export function isConfiguredAddress(value: string) {
  return isAddress(value);
}
