import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  walletConnectWallet,
  rainbowWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";

// Explicitly list only the wallets we need.
// Using connectorsForWallets (instead of getDefaultConfig) lets us skip the
// Coinbase/Base wallet connector, which transitively imports @coinbase/cdp-sdk
// and its @x402 payment packages — none of which are used in MergePay.
const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [injectedWallet, walletConnectWallet, rainbowWallet],
    },
  ],
  {
    appName: "MergePay",
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  }
);

export const config = createConfig({
  connectors,
  chains: [sepolia],
  transports: { [sepolia.id]: http() },
  ssr: true,
});