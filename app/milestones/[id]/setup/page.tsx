"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import BracketCard from "@/components/BracketCard";
import {
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Webhook,
  PlayCircle,
  ArrowRight,
  Loader2,
  KeyRound,
  Users,
  Share2,
  AlertCircle,
} from "lucide-react";
import PayoutProcessingTicker from "@/components/PayoutProcessingTicker";
import { useAccount } from "wagmi";
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
  developer: string;
  developerGithubUsername?: string;
  githubWebhookSecret: string;
  status: string;
  lastError?: string;
  createdAt: string;
  depositTxHash?: string;
  txHash?: string;
}

export default function SetupGuidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { address } = useAccount();

  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedTag, setCopiedTag] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedClaim, setCopiedClaim] = useState(false);

  const [origin, setOrigin] = useState("");
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
      requestNotificationPermission();
    }
  }, []);

  const fetchMilestone = async () => {
    try {
      const res = await fetch(`/api/milestones/${id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load milestone details");
      }

      setMilestone(data.milestone);
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
      const devTarget = milestone.developerGithubUsername
        ? `@${milestone.developerGithubUsername}`
        : milestone.developer
          ? `${milestone.developer.slice(0, 6)}...${milestone.developer.slice(-4)}`
          : "developer";

      if (currentStatus === "paid") {
        showBrowserNotification("Payout Completed! 🎉", {
          body: `Successfully sent ${milestone.amount} ${milestone.currency} to ${devTarget}`,
        });
      } else if (currentStatus === "failed") {
        showBrowserNotification("Payout Failed ❌", {
          body: `Payout to ${devTarget} failed: ${milestone.lastError || "An error occurred during on-chain settlement."}`,
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
  const webhookUrl = `${origin || "http://localhost:3000"}/api/webhooks/github`;
  const claimUrl = `${origin || "http://localhost:3000"}/milestones/${id}/claim`;
  const prTag = `MergePay-ID: ${id}`;
  const webhookSecret = milestone?.githubWebhookSecret || "";

  const copyToClipboard = (text: string, type: "url" | "tag" | "secret" | "claim") => {
    navigator.clipboard.writeText(text);
    if (type === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else if (type === "secret") {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else if (type === "claim") {
      setCopiedClaim(true);
      setTimeout(() => setCopiedClaim(false), 2000);
    } else {
      setCopiedTag(true);
      setTimeout(() => setCopiedTag(false), 2000);
    }
  };

  const formatTxHash = (hash?: string) => {
    if (!hash) return "";
    return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
  };

  if (loading) {
    return (
      <div className="pt-36 pb-24 px-6 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center font-mono">
        <Loader2 className="w-8 h-8 text-neon animate-spin mb-4" />
        <p className="text-textMuted text-sm">Loading milestone setup guide...</p>
      </div>
    );
  }

  if (error || !milestone) {
    return (
      <div className="pt-36 pb-24 px-6 max-w-4xl mx-auto text-center font-mono">
        <div className="p-8 bg-red-500/10 border border-red-500/30 text-red-400 mb-6">
          <p className="font-bold text-lg mb-2">Error Loading Guide</p>
          <p className="text-sm">{error || "Milestone not found"}</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-block bg-surface border border-borderMain hover:border-neon px-6 py-3 text-textMain text-sm uppercase tracking-wider transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  // Client Ownership Guard
  if (!address) {
    return (
      <div className="pt-36 pb-24 px-6 max-w-4xl mx-auto text-center font-mono">
        <div className="p-8 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 mb-6 animate-pulse">
          <p className="font-bold text-lg mb-2">Wallet Disconnected</p>
          <p className="text-sm">Please connect your wallet using the top right button to verify milestone ownership.</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-block bg-surface border border-borderMain hover:border-neon px-6 py-3 text-textMain text-sm uppercase tracking-wider transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  if (address.toLowerCase() !== milestone.client.toLowerCase()) {
    return (
      <div className="pt-36 pb-24 px-6 max-w-4xl mx-auto text-center font-mono">
        <div className="p-8 bg-red-500/10 border border-red-500/30 text-red-400 mb-6">
          <p className="font-bold text-lg mb-2">Access Denied</p>
          <p className="text-sm">Only the client who created this milestone can view the setup guide and webhook secrets.</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-block bg-surface border border-borderMain hover:border-neon px-6 py-3 text-textMain text-sm uppercase tracking-wider transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const isFailed = milestone.status === "failed";
  const isPaid = milestone.status === "paid";
  const isProcessing = milestone.status === "processing";

  return (
    <div className="pt-32 pb-24 px-6 max-w-4xl mx-auto animate-fade-in relative z-10">
      {/* Top Banner */}
      <div
        className={`mb-8 p-6 border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          isFailed
            ? "bg-red-500/10 border-red-500/40"
            : isPaid
            ? "bg-neon/15 border-neon/50"
            : "bg-neon/10 border-neon/30"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-full border flex items-center justify-center flex-shrink-0 ${
              isFailed
                ? "bg-red-500/20 border-red-500 text-red-400"
                : "bg-neon/20 border-neon text-neon"
            }`}
          >
            {isFailed ? <AlertCircle className="w-7 h-7" /> : <CheckCircle2 className="w-7 h-7" />}
          </div>
          <div>
            <h2 className="text-2xl font-bold uppercase tracking-tight text-textMain">
              {isFailed
                ? "Payout Execution Failed"
                : isPaid
                ? "Payout Complete & Confirmed On-Chain!"
                : isProcessing
                ? "Payout Processing On-Chain..."
                : "Milestone Created & Escrow Funded!"}
            </h2>
            <p className="text-textMuted font-mono text-sm">
              {isFailed
                ? "An error occurred during on-chain payout. You can review failure details and retry."
                : isPaid
                ? "The pull request was merged by you and the payout tokens have been disbursed on-chain."
                : isProcessing
                ? "PR merge detected! KeeperHub MCP engine is executing the on-chain transfer."
                : "You (the client) hold the repository. Follow these 3 quick steps to automate payouts."}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 self-start md:self-auto">
          <span
            className={`font-mono text-xs uppercase px-3 py-1 font-semibold border ${
              isFailed
                ? "bg-red-500/20 border-red-500 text-red-400"
                : "bg-neon/20 border-neon text-neon"
            }`}
          >
            Status: {milestone.status}
          </span>
          {isPaid && (
            <Link
              href={`/milestones/${milestone._id}/receipt`}
              className="text-xs font-mono text-neon hover:underline flex items-center gap-1 font-bold"
            >
              View Receipt & Proof <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
          {isFailed && (
            <Link
              href={`/milestones/${milestone._id}/receipt`}
              className="text-xs font-mono text-red-400 hover:text-red-300 underline flex items-center gap-1 font-bold"
            >
              View Error / Retry Payout <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* 🟢 Live On-Chain Settlement Ticker Component */}
      {(isProcessing || isPaid) && (
        <PayoutProcessingTicker
          amount={milestone.amount}
          currency={milestone.currency}
          clientGithub={milestone.clientGithubUsername}
          developerWallet={milestone.developer}
          status={milestone.status}
          txHash={milestone.txHash}
        />
      )}

      {/* 🔴 Red Failure Alert Banner */}
      {isFailed && (
        <div className="mb-8 p-4 bg-red-500/10 border border-red-500/40 rounded-lg flex items-center justify-between gap-4 font-mono">
          <div className="flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <span>
              <strong>Payout Failed:</strong> The on-chain payout transaction for this milestone could not be completed.
            </span>
          </div>
          <Link
            href={`/milestones/${milestone._id}/receipt`}
            className="bg-red-500 hover:bg-red-400 text-black font-bold text-xs uppercase tracking-wider px-4 py-2 rounded flex items-center gap-1.5 flex-shrink-0 transition-colors"
          >
            View Error / Retry Payout <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Security Badge */}
      <div className="mb-6 p-4 bg-surfaceLight/50 border border-borderMain rounded-lg flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-neon mt-0.5" />
        <div>
          <p className="text-textMain font-bold font-mono text-sm">Protected by True Escrow</p>
          <p className="text-textMuted font-mono text-xs mt-1 leading-relaxed">
            Because you own the GitHub repository, only you can merge code. Our backend uses the cryptographically secure Webhook Secret to ensure payouts are only triggered when you authorize the merge.
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <BracketCard className="p-6 mb-10 bg-surfaceLight/40 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm font-mono border-b border-borderMain pb-4">
          <div>
            <span className="text-textMuted text-xs uppercase block mb-1">Milestone Title</span>
            <span className="font-bold text-textMain text-base">{milestone.title}</span>
          </div>
          <div>
            <span className="text-textMuted text-xs uppercase block mb-1">Escrow Amount</span>
            <span className="font-bold text-neon text-base">
              {milestone.amount} {milestone.currency}
            </span>
          </div>
          <div>
            <span className="text-textMuted text-xs uppercase block mb-1">Your Repository</span>
            <a
              href={`https://github.com/${milestone.repo}`}
              target="_blank"
              rel="noreferrer"
              className="text-textMain hover:text-neon flex items-center gap-1 font-bold transition-colors"
            >
              {milestone.repo} <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          {milestone.depositTxHash ? (
            <div>
              <span className="text-textMuted text-xs uppercase block mb-1">On-chain Deposit</span>
              <a
                href={`https://sepolia.etherscan.io/tx/${milestone.depositTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-neon hover:underline flex items-center gap-1 font-bold transition-colors"
              >
                {formatTxHash(milestone.depositTxHash)} <ExternalLink className="w-3.5 h-3.5 text-neon" />
              </a>
            </div>
          ) : (
            <div>
              <span className="text-textMuted text-xs uppercase block mb-1">On-chain Deposit</span>
              <span className="text-textMuted italic font-bold">None</span>
            </div>
          )}
        </div>

        {/* Copyable Shortcuts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Webhook URL Box */}
          <div className="p-4 bg-background border border-borderMain space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-textMuted font-mono text-xs uppercase flex items-center gap-1.5">
                <Webhook className="w-4 h-4 text-neon" /> Webhook Payload URL
              </span>
              <button
                onClick={() => copyToClipboard(webhookUrl, "url")}
                className="text-xs font-mono text-neon hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedUrl ? "Copied!" : "Copy URL"}
              </button>
            </div>
            <p className="font-mono text-xs bg-surface p-2.5 border border-borderMain/50 text-textMain break-all select-all">
              {webhookUrl}
            </p>
          </div>

          {/* Webhook Secret Box */}
          <div className="p-4 bg-background border border-borderMain space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-textMuted font-mono text-xs uppercase flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-neon" /> Webhook Secret
              </span>
              <button
                onClick={() => copyToClipboard(webhookSecret, "secret")}
                className="text-xs font-mono text-neon hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedSecret ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSecret ? "Copied!" : "Copy Secret"}
              </button>
            </div>
            <p className="font-mono text-xs bg-surface p-2.5 border border-borderMain/50 text-textMain break-all select-all">
              {webhookSecret.substring(0, 16)}...
            </p>
          </div>

          {/* Shareable Claim Link Box */}
          <div className="p-4 bg-background border border-neon/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-textMuted font-mono text-xs uppercase flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-neon" /> Shareable Claim Link
              </span>
              <button
                onClick={() => copyToClipboard(claimUrl, "claim")}
                className="text-xs font-mono text-neon hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedClaim ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedClaim ? "Copied Link!" : "Copy Link"}
              </button>
            </div>
            <p className="font-mono text-xs bg-surface p-2.5 border border-borderMain/50 text-neon font-bold break-all select-all">
              {claimUrl}
            </p>
          </div>
        </div>
      </BracketCard>

      {/* STEP BY STEP INSTRUCTION GUIDE */}
      <h3 className="text-xl font-bold uppercase tracking-tight mb-6 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-neon" /> Zero-Config Setup Guide
      </h3>

      <div className="space-y-10 mb-12">
        {/* STEP 1: GitHub Webhook Setup */}
        <BracketCard className="p-6 md:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-neon text-background font-mono font-bold flex items-center justify-center flex-shrink-0">
              1
            </div>
            <div>
              <h4 className="font-bold text-lg text-textMain uppercase tracking-wide mb-1">
                Configure Webhook (Your Action)
              </h4>
              <p className="text-textMuted font-mono text-sm leading-relaxed">
                Go to your GitHub repository <strong className="text-textMain">{milestone.repo}</strong> →{" "}
                <span className="text-neon">Settings</span> → <span className="text-neon">Webhooks</span> →{" "}
                <span className="text-neon">Add webhook</span>.
              </p>
              <ul className="mt-3 space-y-1.5 text-xs font-mono text-textMuted list-disc list-inside">
                <li>
                  Payload URL: <code className="text-neon">{webhookUrl}</code>
                </li>
                <li>
                  Content type: <code className="text-textMain">application/json</code>
                </li>
                <li>
                  Secret: Paste your unique <code className="text-neon">Webhook Secret</code> from above.
                </li>
                <li>
                  Which events? Select <code className="text-textMain">Let me select individual events</code> → check{" "}
                  <code className="text-neon">Pull requests</code>.
                </li>
              </ul>
            </div>
          </div>

          {/* VIDEO PLACEHOLDER 1 */}
          <div className="mt-4 border border-borderMain bg-background/80 rounded-lg overflow-hidden relative group">
            <div className="px-4 py-2 bg-surfaceLight border-b border-borderMain flex items-center justify-between">
              <span className="font-mono text-xs text-textMuted flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-neon" /> Instruction Video: Webhook Setup
              </span>
            </div>
            <div className="w-full bg-black rounded-b-lg overflow-hidden">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-auto block"
                src="/videos/webhooks.mp4"
              />
            </div>
          </div>
        </BracketCard>

        {/* STEP 2: Invite Collaborator */}
        <BracketCard className="p-6 md:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-neon text-background font-mono font-bold flex items-center justify-center flex-shrink-0">
              2
            </div>
            <div>
              <h4 className="font-bold text-lg text-textMain uppercase tracking-wide mb-1">
                Invite Developer (Your Action)
              </h4>
              <p className="text-textMuted font-mono text-sm leading-relaxed mb-3">
                Since you own the repository, grant the developer collaborator access so they can push code and open Pull Requests.
              </p>
              <ul className="mt-3 space-y-1.5 text-xs font-mono text-textMuted list-disc list-inside">
                <li>
                  Go to <span className="text-neon">Settings</span> → <span className="text-neon">Collaborators</span>.
                </li>
                <li>Click <code className="text-textMain">Add people</code> and invite the developer.</li>
                <li>Give them <code className="text-neon">Write</code> access.</li>
              </ul>

              <div className="pt-3">
                <a
                  href={`https://github.com/${milestone.repo}/settings/access`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface border border-neon/50 text-neon hover:bg-neon/10 font-mono text-xs uppercase tracking-wider transition-colors"
                >
                  <Users className="w-4 h-4" /> Open GitHub Collaborators Page <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </BracketCard>

        {/* STEP 3: Share Claim Link */}
        <BracketCard className="p-6 md:p-8 space-y-6 border border-neon/40 bg-neon/5">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-neon text-background font-mono font-bold flex items-center justify-center flex-shrink-0">
              3
            </div>
            <div>
              <h4 className="font-bold text-lg text-textMain uppercase tracking-wide mb-1 flex items-center gap-2">
                Send Claim Link to Developer <Share2 className="w-5 h-5 text-neon" />
              </h4>
              <p className="text-textMuted font-mono text-sm leading-relaxed mb-4">
                Send this unique claim link to your developer (via Discord, Telegram, or Email). When they open it, they will connect their wallet and automatically receive all PR submission instructions.
              </p>

              <div className="p-4 bg-background border border-neon/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-sm text-neon">
                <code className="break-all">{claimUrl}</code>
                <button
                  onClick={() => copyToClipboard(claimUrl, "claim")}
                  className="text-xs font-bold text-background bg-neon hover:bg-[#b3e600] px-4 py-2 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                >
                  {copiedClaim ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedClaim ? "Copied Link!" : "Copy Claim Link"}
                </button>
              </div>
            </div>
          </div>
        </BracketCard>
      </div>

      {/* Action Footer Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-borderMain font-mono">
        <a
          href={`https://github.com/${milestone.repo}/settings/hooks`}
          target="_blank"
          rel="noreferrer"
          className="w-full sm:w-auto border border-borderMain hover:border-textMuted text-textMain px-6 py-4 text-sm uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
        >
          Open GitHub Repo Settings <ExternalLink className="w-4 h-4" />
        </a>

        <Link
          href="/dashboard"
          className="w-full sm:w-auto bg-neon text-background px-8 py-4 font-bold text-sm uppercase tracking-wider hover:bg-[#b3e600] transition-colors flex items-center justify-center gap-2"
        >
          Go to Dashboard <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
