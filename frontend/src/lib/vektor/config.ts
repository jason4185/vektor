import { testnetBradbury } from "genlayer-js/chains";
import { getAddress, type Address } from "viem";

export const EXPECTED_VEKTOR_CONTRACT_ADDRESS =
  "0x10a27a4e2B62AE20410365e7a861106E551ADd33" as Address;
const configuredAddress = String(import.meta.env["VITE_VEKTOR_CONTRACT_ADDRESS"] ?? "").trim();
export const VEKTOR_CONTRACT_ADDRESS = configuredAddress as Address;
export const GENLAYER_RPC_ENDPOINT = "https://rpc-bradbury.genlayer.com";
export const GENLAYER_CHAIN = testnetBradbury;
export const MAX_PAGE = 50;
export const MARKET_PAGE_SIZE = 30;
export const CONTRACT_EXPLORER = "https://explorer-bradbury.genlayer.com";

export function requireContractAddress(): Address {
  if (!/^0x[a-fA-F0-9]{40}$/.test(configuredAddress)) {
    throw new Error("VITE_VEKTOR_CONTRACT_ADDRESS is missing or malformed.");
  }
  const normalized = getAddress(configuredAddress);
  if (normalized.toLowerCase() !== EXPECTED_VEKTOR_CONTRACT_ADDRESS.toLowerCase()) {
    throw new Error("VITE_VEKTOR_CONTRACT_ADDRESS is not the Vektor Bradbury deployment.");
  }
  return normalized;
}
