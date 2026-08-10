"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BracketCard from "@/components/BracketCard";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { useAccount, useSendTransaction, useWriteContract, usePublicClient } from "wagmi";
import { parseEther, parseUnits } from "viem";

export default function CreateMilestone() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USDC" | "ETH">("USDC");
  const [title, setTitle] = useState("");
  const [repo, setRepo] = useState("");
  const [clientGithubUsername, setClientGithubUsername] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const { isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);

    if (!amount || !title || !repo) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!isConnected) {
      setError("Please connect your wallet using the 'Connect Wallet' button in the top right before creating a milestone.");
      return;
    }

    setLoading(true);

    try {
      let txHash = "";

      if (currency === "ETH") {
        setStatusMessage("Please sign the transaction to deposit ETH to the KeeperHub Agent wallet...");
        txHash = await sendTransactionAsync({
          to: "0xB3eB84f77Ba784161f74Cb622608B3268d8A796f",
          value: parseEther(amount),
        });
      } else {
        setStatusMessage("Please sign the transaction to deposit USDC to the KeeperHub Agent wallet...");
        const usdcAbi = [
          {
            inputs: [
              { name: "to", type: "address" },
              { name: "value", type: "uint256" },
            ],
            name: "transfer",
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
            type: "function",
          },
        ] as const;

        txHash = await writeContractAsync({
          address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
          abi: usdcAbi,
          functionName: "transfer",
          args: ["0xB3eB84f77Ba784161f74Cb622608B3268d8A796f", parseUnits(amount, 6)],
        });
      }

      setStatusMessage("Confirming deposit transaction on the Sepolia network...");
      if (publicClient) {
        console.log(`Waiting for receipt of transaction ${txHash}...`);
        await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
      } else {
        console.log("No public client configured. Waiting 5 seconds fallback...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      setStatusMessage("Creating milestone and registering payout workflow...");

      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          currency,
          title,
          repo,
          clientGithubUsername,
          depositTxHash: txHash,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create milestone");
      }

      // Redirect to the post-creation GitHub Webhook setup guide page
      router.push(`/milestones/${data.milestone._id}/setup`);
    } catch (err: any) {
      console.error("Deposit/Creation error:", err);
      setError(err.message || "An error occurred during payment signature or milestone creation");
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  return (
    <div className="pt-32 pb-24 px-6 max-w-2xl mx-auto animate-fade-in relative z-10">
      <Link
        href="/dashboard"
        className="text-textMuted hover:text-textMain font-mono text-sm uppercase tracking-wider mb-8 flex items-center gap-2 transition-colors inline-flex"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <h2 className="text-3xl font-bold uppercase tracking-tight mb-2">Create Milestone</h2>
      <p className="text-textMuted font-mono text-sm mb-8">
        Set up a new payment milestone for your work
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 text-red-400 font-mono text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <BracketCard className="p-8 bg-surfaceLight/50">
        <form onSubmit={handleSubmit} className="space-y-8">


          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-textMuted font-mono text-xs uppercase tracking-wider mb-2">
                Amount
              </label>
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
                required
                className="w-full bg-background border border-borderMain p-4 text-textMain font-mono text-sm focus:outline-none focus:border-neon transition-colors"
              />
            </div>
            <div>
              <label className="block text-textMuted font-mono text-xs uppercase tracking-wider mb-2">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "USDC" | "ETH")}
                className="w-full bg-background border border-borderMain p-4 text-textMain font-mono text-sm focus:outline-none focus:border-neon transition-colors appearance-none cursor-pointer"
              >
                <option value="USDC">USDC</option>
                <option value="ETH">ETH</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-textMuted font-mono text-xs uppercase tracking-wider mb-2">
              Milestone Title / Description
            </label>
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Design new dashboard UI components"
              rows={3}
              required
              className="w-full bg-background border border-borderMain p-4 text-textMain font-mono text-sm focus:outline-none focus:border-neon transition-colors resize-none"
            ></textarea>
          </div>

          <div className="pt-6 border-t border-borderMain space-y-6">
            <div>
              <label className="block text-textMuted font-mono text-xs uppercase tracking-wider mb-2">
                Your GitHub Repository
              </label>
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="StartupSteve/ecommerce-cart"
                required
                className="w-full bg-background border border-borderMain p-4 text-textMain font-mono text-sm focus:outline-none focus:border-neon transition-colors"
              />
              <p className="text-[#555] text-xs font-mono mt-2">Format: owner/repo</p>
            </div>

            <div>
              <label className="block text-textMuted font-mono text-xs uppercase tracking-wider mb-2">
                Your GitHub Username (Client / Repo Owner)
              </label>
              <input
                type="text"
                value={clientGithubUsername}
                onChange={(e) => setClientGithubUsername(e.target.value)}
                placeholder="StartupSteve"
                className="w-full bg-background border border-borderMain p-4 text-textMain font-mono text-sm focus:outline-none focus:border-neon transition-colors"
              />
              <p className="text-[#555] text-xs font-mono mt-2">Used by Backend Guard to verify PR merger identity</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-4">
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-neon text-background px-6 py-4 font-bold font-mono text-sm uppercase tracking-wider hover:bg-[#b3e600] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Processing..." : "Create Milestone"}
              </button>
              <Link
                href="/dashboard"
                className="flex-1 border border-borderMain hover:border-textMuted text-textMain px-6 py-4 font-mono text-sm uppercase tracking-wider transition-colors text-center inline-block"
              >
                Cancel
              </Link>
            </div>

            {statusMessage && (
              <div className="p-3 bg-neon/10 border border-neon/30 text-neon font-mono text-xs text-center animate-pulse">
                {statusMessage}
              </div>
            )}
          </div>
        </form>
      </BracketCard>
    </div>
  );
}
