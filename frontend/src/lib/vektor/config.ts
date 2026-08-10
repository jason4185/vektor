import { testnetBradbury } from "genlayer-js/chains";
import type { Address } from "viem";

export const VEKTOR_CONTRACT_ADDRESS = (import.meta.env["VITE_VEKTOR_CONTRACT_ADDRESS"] ||
  "") as Address;
export const GENLAYER_RPC_ENDPOINT = "https://rpc-bradbury.genlayer.com";
export const GENLAYER_CHAIN = testnetBradbury;
export const MAX_PAGE = 50;
export const MARKET_PAGE_SIZE = 30;
export const CONTRACT_EXPLORER = "https://explorer-bradbury.genlayer.com";

export function requireContractAddress(): Address {
  if (!/^0x[a-fA-F0-9]{40}$/.test(VEKTOR_CONTRACT_ADDRESS)) {
    throw new Error("VITE_VEKTOR_CONTRACT_ADDRESS is not configured.");
  }
  return VEKTOR_CONTRACT_ADDRESS;
}
