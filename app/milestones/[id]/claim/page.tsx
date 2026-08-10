"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import BracketCard from "@/components/BracketCard";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import {
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  GitPullRequest,
  PlayCircle,
  Loader2,
  AlertCircle,
  UserCheck,
  Lock,
} from "lucide-react";

import PayoutProcessingTicker from "@/components/PayoutProcessingTicker";
import { showBrowserNotification, requestNotificationPermission } from "@/lib/notifications";

interface Milestone {
  _id: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  repo: string;
  client: string;
  clientGithubUsername?: string;
  developer?: string;
  developerGithubUsername?: string;
  status: "awaiting_claim" | "active" | "in_review" | "processing" | "failed" | "paid";
  prNumber?: number;
  prUrl?: string;
  txHash?: string;
  lastError?: string;
  createdAt: string;
}

export default function ClaimMilestonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { address } = useAccount();

  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [devAddress, setDevAddress] = useState("");
  const [devGithub, setDevGithub] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [copiedTag, setCopiedTag] = useState(false);

  const prevStatusRef = useRef<string | null>(null);

  // Request browser notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      requestNotificationPermission();
    }
  }, []);

  // Prefill wallet address when Wagmi connects
  useEffect(() => {
    if (address) {
      setDevAddress(address);
    }
  }, [address]);

  const fetchMilestone = async () => {
    try {
      const res = await fetch(`/api/milestones/${id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load milestone details");
      }

      setMilestone(data.milestone);
      if (data.milestone.developer) {
        setDevAddress(data.milestone.developer);
      }
      if (data.milestone.developerGithubUsername) {
        setDevGithub(data.milestone.developerGithubUsername);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMilestone();
  }, [id]);

  // Handle status transition notifications
  useEffect(() => {
    if (!milestone) return;

    const currentStatus = milestone.status;
    const prevStatus = prevStatusRef.current;

    if (prevStatus && prevStatus !== currentStatus) {
      if (currentStatus === "paid") {
        showBrowserNotification("Payout Completed! 🎉", {
          body: `${milestone.amount} ${milestone.currency} sent to your wallet!`,
        });
      } else if (currentStatus === "failed") {
        showBrowserNotification("Payout Failed ❌", {
          body: milestone.lastError || "An error occurred during on-chain settlement.",
        });
      }
    }

    prevStatusRef.current = currentStatus;
  }, [milestone?.status]);

  // Real-Time Auto-Polling: poll API every 3s while milestone is active or processing
  useEffect(() => {
    if (!milestone) return;
    if (milestone.status === "paid" || milestone.status === "failed") return;

    const interval = setInterval(() => {
      fetchMilestone();
    }, 3000);

    return () => clearInterval(interval);
  }, [id, milestone?.status]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!devAddress) {
      setError("Please connect your wallet or enter your wallet address.");
      return;
    }

    if (!devAddress.startsWith("0x") || devAddress.length !== 42) {
      setError("Please enter a valid Ethereum wallet address (0x...)");
      return;
    }

    if (milestone?.client && devAddress.toLowerCase() === milestone.client.toLowerCase()) {
      setError("Client wallet address cannot claim their own milestone as a developer.");
      return;
    }

    if (
      devGithub &&
      milestone?.clientGithubUsername &&
      devGithub.trim().toLowerCase() === milestone.clientGithubUsername.trim().toLowerCase()
    ) {
      setError(`Developer GitHub username cannot be the same as the client's GitHub username (@${milestone.clientGithubUsername}).`);
      return;
    }

    setClaiming(true);

    try {
      const res = await fetch(`/api/milestones/${id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developerAddress: devAddress,
          developerGithubUsername: devGithub,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to claim milestone");
      }

      setMilestone(data.milestone);
    } catch (err: any) {
      setError(err.message || "An error occurred while claiming");
    } finally {
      setClaiming(false);
    }
  };

  const prTag = `MergePay-ID: ${id}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTag(true);
    setTimeout(() => setCopiedTag(false), 2000);
  };

  if (loading) {
    return (
      <div className="pt-36 pb-24 px-6 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center font-mono">
        <Loader2 className="w-8 h-8 text-neon animate-spin mb-4" />
        <p className="text-textMuted text-sm">Loading milestone offer...</p>
      </div>
    );
  }

  if (error && !milestone) {
    return (
      <div className="pt-36 pb-24 px-6 max-w-4xl mx-auto text-center font-mono">
        <div className="p-8 bg-red-500/10 border border-red-500/30 text-red-400 mb-6">
          <p className="font-bold text-lg mb-2">Error Loading Milestone</p>
          <p className="text-sm">{error || "Milestone not found"}</p>
        </div>
        <Link
          href="/"
          className="inline-block bg-surface border border-borderMain hover:border-neon px-6 py-3 text-textMain text-sm uppercase tracking-wider transition-colors"
        >
          Go to MergePay Home
        </Link>
      </div>
    );
  }

  if (!milestone) return null;

  const isClaimed = milestone.status === "active" || milestone.status === "paid" || milestone.status === "in_review";

  return (
    <div className="pt-32 pb-24 px-6 max-w-4xl mx-auto animate-fade-in relative z-10 font-mono">
      {/* ⚠️ Payout Rules Warning — first thing the developer sees */}
      <div className="mb-8 border border-yellow-500/40 bg-yellow-500/5 overflow-hidden">
        {/* Alert Header */}
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
          </div>
          <span className="text-yellow-400 text-sm font-bold uppercase tracking-wider">
            Important — Payout Rules
          </span>
        </div>
        {/* Alert Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-textMain text-sm leading-relaxed">
            Payouts are <strong className="text-yellow-400">only</strong> triggered when{" "}
            <strong className="text-neon">
              {milestone.clientGithubUsername
                ? `@${milestone.clientGithubUsername}`
                : "the client"}
            </strong>{" "}
            merges your Pull Request on GitHub.
          </p>
          <div className="pl-4 border-l-2 border-yellow-500/40 space-y-2">
            <p className="text-textMuted text-xs leading-relaxed flex items-start gap-2">
              <span className="text-red-400 mt-0.5">✕</span>
              <span>
                <strong className="text-red-400">Self-merging</strong> your own PR — even if you have write access — will{" "}
                <strong className="text-red-400">not</strong> trigger a payout.
              </span>
            </p>
            <p className="text-textMuted text-xs leading-relaxed flex items-start gap-2">
              <span className="text-red-400 mt-0.5">✕</span>
              <span>
                Merges by <strong className="text-red-400">any user other than</strong>{" "}
                <strong className="text-neon">
                  {milestone.clientGithubUsername
                    ? `@${milestone.clientGithubUsername}`
                    : "the designated client"}
                </strong>{" "}
                will <strong className="text-red-400">not</strong> release funds.
              </span>
            </p>
            <p className="text-textMuted text-xs leading-relaxed flex items-start gap-2">
              <span className="text-neon mt-0.5">✓</span>
              <span>
                Only a merge performed by{" "}
                <strong className="text-neon">
                  {milestone.clientGithubUsername
                    ? `@${milestone.clientGithubUsername}`
                    : "the client"}
                </strong>{" "}
                on the linked repository will execute the on-chain payout of{" "}
                <strong className="text-neon">
                  {milestone.amount} {milestone.currency}
                </strong>{" "}
                to your wallet.
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* 🟢 Live On-Chain Settlement Ticker Component */}
      {(milestone.status === "processing" || milestone.status === "paid") && (
        <PayoutProcessingTicker
          amount={milestone.amount}
          currency={milestone.currency}
          clientGithub={milestone.clientGithubUsername}
          developerWallet={milestone.developer}
          status={milestone.status}
          txHash={milestone.txHash}
        />
      )}

      {/* 🟢 Paid Confirmation Card for Developer */}
      {milestone.status === "paid" && (
        <div className="mb-10 p-6 bg-neon/15 border border-neon/50 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-neon flex-shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-neon uppercase">Payout Complete & Disbursed!</h3>
              <p className="text-xs text-textMuted mt-0.5">
                The client merged your pull request and {milestone.amount} {milestone.currency} was transferred to your wallet on-chain.
              </p>
            </div>
          </div>
          <Link
            href={`/milestones/${milestone._id}/receipt`}
            className="bg-neon hover:bg-neon/90 text-black font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded flex items-center gap-1.5 flex-shrink-0 transition-colors"
          >
            View On-Chain Receipt <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      <div className="mb-10 p-6 bg-neon/10 border border-neon/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-neon/20 border border-neon flex items-center justify-center text-neon flex-shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs uppercase text-neon tracking-widest block font-bold mb-1">
              Escrow Milestone Invitation
            </span>
            <h2 className="text-2xl font-bold uppercase tracking-tight text-textMain">
              {milestone.title}
            </h2>
            <p className="text-textMuted text-xs mt-1">
              Created by client {milestone.clientGithubUsername ? `@${milestone.clientGithubUsername}` : "Repo Owner"}
            </p>
          </div>
        </div>
        <div className="text-right self-start md:self-auto">
          <span className="text-2xl font-bold text-neon block">
            {milestone.amount} {milestone.currency}
          </span>
          <span className="text-xs text-textMuted uppercase border border-neon/40 px-2.5 py-0.5 inline-block mt-1">
            Status: {milestone.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Escrow Details Card */}
      <BracketCard className="p-6 mb-10 bg-surfaceLight/40 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm border-b border-borderMain pb-4">
          <div>
            <span className="text-textMuted text-xs uppercase block mb-1">Escrow Payout</span>
            <span className="font-bold text-neon text-base">
              {milestone.amount} {milestone.currency}
            </span>
          </div>
          <div>
            <span className="text-textMuted text-xs uppercase block mb-1">Target Repository</span>
            <a
              href={`https://github.com/${milestone.repo}`}
              target="_blank"
              rel="noreferrer"
              className="text-textMain hover:text-neon flex items-center gap-1 font-bold transition-colors"
            >
              {milestone.repo} <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <div>
            <span className="text-textMuted text-xs uppercase block mb-1">Client GitHub</span>
            <span className="font-bold text-textMain">
              {milestone.clientGithubUsername ? `@${milestone.clientGithubUsername}` : "Verified Client"}
            </span>
          </div>
        </div>

        {milestone.description && (
          <div className="pt-2">
            <span className="text-textMuted text-xs uppercase block mb-1">Description</span>
            <p className="text-textMain text-xs leading-relaxed">{milestone.description}</p>
          </div>
        )}
      </BracketCard>

      {/* Form Error Banner if any */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STATE A: UNCLAIMED STATE - CLAIM FORM */}
      {!isClaimed ? (
        <BracketCard className="p-8 space-y-6 border border-neon/40 bg-surfaceLight/50">
          <div className="flex items-center gap-3 border-b border-borderMain pb-4">
            <UserCheck className="w-6 h-6 text-neon" />
            <div>
              <h3 className="text-xl font-bold uppercase tracking-tight text-textMain">
                Claim Escrow & Start Work
              </h3>
              <p className="text-textMuted text-xs mt-0.5">
                Connect your wallet to register as the assigned developer for this milestone.
              </p>
            </div>
          </div>

          <form onSubmit={handleClaim} className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-textMuted text-xs uppercase tracking-wider">
                  Your Wallet Address (Receives Payout)
                </label>
                <div className="scale-90 origin-right">
                  <ConnectButton />
                </div>
              </div>
              <input
                type="text"
                value={devAddress}
                onChange={(e) => setDevAddress(e.target.value)}
                placeholder="0x..."
                required
                className="w-full bg-background border border-borderMain p-4 text-textMain text-sm focus:outline-none focus:border-neon transition-colors"
              />
            </div>

            <div>
              <label className="block text-textMuted text-xs uppercase tracking-wider mb-2">
                Your GitHub Username
              </label>
              <input
                type="text"
                value={devGithub}
                onChange={(e) => setDevGithub(e.target.value)}
                placeholder="e.g. DevDan"
                required
                className="w-full bg-background border border-borderMain p-4 text-textMain text-sm focus:outline-none focus:border-neon transition-colors"
              />
              <p className="text-[#666] text-xs mt-2">
                Must match the GitHub account you will use to submit your Pull Request.
              </p>
            </div>

            <button
              type="submit"
              disabled={claiming}
              className="w-full bg-neon text-background font-bold px-6 py-4 text-sm uppercase tracking-wider hover:bg-[#b3e600] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {claiming && <Loader2 className="w-4 h-4 animate-spin" />}
              {claiming ? "Claiming Escrow..." : "Accept Escrow & Claim Milestone"}
            </button>
          </form>
        </BracketCard>
      ) : (
        /* STATE B: CLAIMED STATE - DEVELOPER WORK & PR TAGGING INSTRUCTIONS */
        <div className="space-y-8">
          <div className="p-6 bg-neon/10 border border-neon/40 flex items-center gap-4">
            <CheckCircle2 className="w-8 h-8 text-neon flex-shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-textMain uppercase tracking-wide">
                Milestone Claimed & Active!
              </h3>
              <p className="text-textMuted text-xs mt-0.5">
                Assigned Developer: <span className="text-neon font-bold">{milestone.developer}</span>{" "}
                {milestone.developerGithubUsername && `(@${milestone.developerGithubUsername})`}
              </p>
            </div>
          </div>

          {/* PR TAGGING INSTRUCTIONS CARD */}
          <BracketCard className="p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-neon text-background font-mono font-bold flex items-center justify-center flex-shrink-0">
                <GitPullRequest className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-lg text-textMain uppercase tracking-wide mb-1">
                  How to Submit Your Work & Get Paid
                </h4>
                <p className="text-textMuted text-sm leading-relaxed mb-4">
                  When you complete your work and open a Pull Request against{" "}
                  <strong className="text-textMain">{milestone.repo}</strong>, paste the unique Milestone Tag anywhere inside your PR description body:
                </p>

                {/* 1-CLICK COPYABLE PR TAG BOX */}
                <div className="p-4 bg-background border border-neon/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-neon mb-4">
                  <code className="text-base font-bold select-all">{prTag}</code>
                  <button
                    onClick={() => copyToClipboard(prTag)}
                    className="text-xs font-bold text-background bg-neon hover:bg-[#b3e600] px-4 py-2 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                  >
                    {copiedTag ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedTag ? "Copied Tag!" : "Copy Tag"}
                  </button>
                </div>

                <p className="text-xs text-textMuted leading-relaxed">
                  As soon as client {milestone.clientGithubUsername ? `@${milestone.clientGithubUsername}` : "Repo Owner"} reviews and merges your PR on GitHub, the KeeperHub smart contract workflow will automatically release your <span className="text-neon">{milestone.amount} {milestone.currency}</span> payout to your wallet!
                </p>
              </div>
            </div>

            {/* UNCROPPED PR TAGGING VIDEO DEMO */}
            <div className="mt-4 border border-borderMain bg-background/80 rounded-lg overflow-hidden relative group">
              <div className="px-4 py-2 bg-surfaceLight border-b border-borderMain flex items-center justify-between">
                <span className="text-xs text-textMuted flex items-center gap-2">
                  <PlayCircle className="w-4 h-4 text-neon" /> Instruction Video: PR Body Tagging Demo
                </span>
              </div>
              <div className="w-full bg-black rounded-b-lg overflow-hidden">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-auto block"
                  src="/videos/pull-req.mp4"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-borderMain flex justify-end">
              <a
                href={`https://github.com/${milestone.repo}`}
                target="_blank"
                rel="noreferrer"
                className="bg-neon text-background font-bold px-6 py-3 text-sm uppercase tracking-wider hover:bg-[#b3e600] transition-colors inline-flex items-center gap-2"
              >
                Open GitHub Repo <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </BracketCard>
        </div>
      )}
    </div>
  );
}
