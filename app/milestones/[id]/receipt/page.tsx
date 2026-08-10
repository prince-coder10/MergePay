"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import BracketCard from "@/components/BracketCard";
import PayoutProcessingTicker from "@/components/PayoutProcessingTicker";
import { useAccount } from "wagmi";
import {
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  GitPullRequest,
  ShieldCheck,
  Loader2,
  Share2,
  ArrowLeft,
  Receipt,
  Cpu,
  Globe,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
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
  workflowId?: string;
  runId?: string;
  txHash?: string;
  lastError?: string;
  failedAt?: string;
  retryCount?: number;
  createdAt: string;
  updatedAt: string;
}

export default function MilestoneReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { address: connectedWallet } = useAccount();

  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [origin, setOrigin] = useState("");

  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

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
        throw new Error(data.error || "Failed to load receipt details");
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
      if (currentStatus === "paid") {
        showBrowserNotification("Payout Completed! 🎉", {
          body: `${milestone.amount} ${milestone.currency} successfully sent on-chain!`,
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

  const handleRetry = async () => {
    if (!milestone) return;
    setIsRetrying(true);
    setRetryError(null);

    try {
      const res = await fetch(`/api/milestones/${milestone._id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: connectedWallet }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRetryError(data.error || "Payout retry failed. Please try again.");
      }

      // Re-fetch milestone details to display updated status
      await fetchMilestone();
    } catch (err: any) {
      setRetryError("Network error while attempting payout retry. Please check your connection.");
    } finally {
      setIsRetrying(false);
    }
  };

  const receiptUrl = `${origin || "http://localhost:3000"}/milestones/${id}/receipt`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2000);
  };

  const getExplorerUrl = (txHash: string) => {
    // Default to Sepolia Etherscan for testnet
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  };

  const formatAddress = (addr?: string) => {
    if (!addr) return "N/A";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  if (loading) {
    return (
      <div className="pt-36 pb-24 px-6 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center font-mono">
        <Loader2 className="w-8 h-8 text-neon animate-spin mb-4" />
        <p className="text-textMuted text-sm">Loading payment receipt...</p>
      </div>
    );
  }

  if (error || !milestone) {
    return (
      <div className="pt-36 pb-24 px-6 max-w-4xl mx-auto text-center font-mono">
        <div className="p-8 bg-red-500/10 border border-red-500/30 text-red-400 mb-6">
          <p className="font-bold text-lg mb-2">Error Loading Receipt</p>
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

  const isPaid = milestone.status === "paid";
  const isFailed = milestone.status === "failed";
  const isProcessing = milestone.status === "processing";

  return (
    <div className="pt-32 pb-24 px-6 max-w-4xl mx-auto animate-fade-in relative z-10 font-mono">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-textMuted hover:text-neon text-xs uppercase tracking-wider mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      {/* Top Settlement Banner */}
      <div
        className={`mb-8 p-6 border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          isPaid
            ? "bg-neon/10 border-neon/40"
            : isFailed
            ? "bg-red-500/10 border-red-500/40"
            : isProcessing
            ? "bg-yellow-500/10 border-yellow-500/40"
            : "bg-surfaceLight/50 border-borderMain"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-full border flex items-center justify-center flex-shrink-0 ${
              isPaid
                ? "bg-neon/20 border-neon text-neon"
                : isFailed
                ? "bg-red-500/20 border-red-500 text-red-400"
                : isProcessing
                ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                : "bg-surfaceLight border-borderMain text-textMuted"
            }`}
          >
            {isPaid && <CheckCircle2 className="w-7 h-7" />}
            {isFailed && <AlertCircle className="w-7 h-7 text-red-400" />}
            {isProcessing && <Loader2 className="w-7 h-7 text-yellow-400 animate-spin" />}
            {!isPaid && !isFailed && !isProcessing && <Receipt className="w-6 h-6" />}
          </div>
          <div>
            <span
              className={`text-xs uppercase tracking-widest block font-bold mb-1 ${
                isFailed
                  ? "text-red-400"
                  : isProcessing
                  ? "text-yellow-400"
                  : "text-neon"
              }`}
            >
              Public Transaction Audit Receipt
            </span>
            <h2 className="text-2xl font-bold uppercase tracking-tight text-textMain">
              {milestone.title}
            </h2>
            <p className="text-textMuted text-xs mt-1">
              Target repo: <span className="text-textMain">{milestone.repo}</span>
            </p>
          </div>
        </div>
        <div className="text-right self-start md:self-auto">
          <span className="text-3xl font-bold text-neon block">
            {milestone.amount} {milestone.currency}
          </span>
          <span
            className={`text-xs uppercase border px-2.5 py-0.5 inline-block mt-1 ${
              isPaid
                ? "text-neon border-neon/40"
                : isFailed
                ? "text-red-400 border-red-500/40"
                : isProcessing
                ? "text-yellow-400 border-yellow-500/40"
                : "text-textMuted border-borderMain"
            }`}
          >
            Status: {milestone.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* 🟢 Live On-Chain Settlement Ticker Component */}
      {isProcessing && (
        <PayoutProcessingTicker
          amount={milestone.amount}
          currency={milestone.currency}
          clientGithub={milestone.clientGithubUsername}
          developerWallet={milestone.developer}
          status={milestone.status}
          txHash={milestone.txHash}
        />
      )}

      {/* 🔴 FAILED PAYOUT ALERT CARD WITH RETRY BUTTON */}
      {isFailed && (
        <div className="border border-red-500/40 bg-red-950/30 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-4">
            <AlertCircle className="text-red-400 mt-1 flex-shrink-0" size={24} />
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="text-red-400 font-bold text-lg uppercase tracking-wide mb-1">
                  Payout Execution Failed
                </h3>
                <p className="text-red-200/90 text-sm leading-relaxed">
                  {milestone.lastError || "The on-chain payout transaction could not be executed."}
                </p>
              </div>

              {milestone.failedAt && (
                <p className="text-red-200/60 text-xs font-mono">
                  Last attempted: {formatDate(milestone.failedAt)}
                  {milestone.retryCount && milestone.retryCount > 0
                    ? ` · ${milestone.retryCount} attempt${milestone.retryCount > 1 ? "s" : ""}`
                    : ""}
                </p>
              )}

              {retryError && (
                <div className="p-3 bg-red-900/40 border border-red-500/50 rounded text-red-300 text-xs font-mono">
                  ⚠️ {retryError}
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-black font-bold uppercase tracking-wider px-5 py-2.5 rounded text-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  {isRetrying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {isRetrying ? "Retrying Payout..." : "Retry Payout"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🟡 PROCESSING PAYOUT CARD */}
      {isProcessing && (
        <div className="border border-yellow-500/40 bg-yellow-950/30 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-4">
            <Loader2 className="text-yellow-400 mt-1 flex-shrink-0 animate-spin" size={24} />
            <div>
              <h3 className="text-yellow-400 font-bold text-lg uppercase tracking-wide mb-1">
                Payout Currently Processing
              </h3>
              <p className="text-yellow-200/90 text-sm leading-relaxed">
                KeeperHub is executing the on-chain payout transaction for this milestone. Please wait a moment while the transaction finalizes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Verification Badge */}
      <div className="mb-8 p-4 bg-surfaceLight/40 border border-borderMain rounded-lg flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-neon mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-textMain font-bold text-sm">Cryptographically Verified Escrow Settlement</p>
          <p className="text-textMuted text-xs mt-1 leading-relaxed">
            This payment was released automatically via the KeeperHub smart contract workflow upon client PR merge verification.
          </p>
        </div>
      </div>

      {/* Blockchain Verification Banner */}
      {milestone.txHash && milestone.status === 'paid' && (
        <a
          href={getExplorerUrl(milestone.txHash)}
          target="_blank"
          rel="noreferrer"
          className="mb-8 p-4 bg-neon/10 border border-neon/40 rounded-lg flex items-center gap-3 hover:bg-neon/20 transition-colors group block"
        >
          <Globe className="w-5 h-5 text-neon flex-shrink-0" />
          <div className="flex-1">
            <p className="text-neon font-bold text-sm">Verified on Sepolia Etherscan</p>
            <p className="text-textMuted text-xs mt-0.5">View this transaction on the blockchain explorer</p>
          </div>
          <ExternalLink className="w-4 h-4 text-neon opacity-60 group-hover:opacity-100 transition-opacity" />
        </a>
      )}

      {/* Transaction Details Card */}
      <BracketCard className="p-8 mb-10 space-y-6">
        <div className="flex items-center justify-between border-b border-borderMain pb-4">
          <h3 className="text-lg font-bold uppercase tracking-wide text-textMain flex items-center gap-2">
            <Receipt className="w-5 h-5 text-neon" /> Audit Details
          </h3>
          <span className="text-xs text-textMuted">ID: {milestone._id}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <span className="text-textMuted text-xs uppercase block mb-1">Client (Funder)</span>
            <p className="text-textMain font-bold">{formatAddress(milestone.client)}</p>
            {milestone.clientGithubUsername && (
              <p className="text-neon text-xs">@{milestone.clientGithubUsername}</p>
            )}
          </div>

          <div>
            <span className="text-textMuted text-xs uppercase block mb-1">Developer (Recipient)</span>
            <p className="text-textMain font-bold">{formatAddress(milestone.developer)}</p>
            {milestone.developerGithubUsername && (
              <p className="text-neon text-xs">@{milestone.developerGithubUsername}</p>
            )}
          </div>

          <div>
            <span className="text-textMuted text-xs uppercase block mb-1">Target Repository</span>
            <a
              href={`https://github.com/${milestone.repo}`}
              target="_blank"
              rel="noreferrer"
              className="text-textMain hover:text-neon font-bold flex items-center gap-1 transition-colors"
            >
              {milestone.repo} <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div>
            <span className="text-textMuted text-xs uppercase block mb-1">Merged Pull Request</span>
            {milestone.prUrl ? (
              <a
                href={milestone.prUrl}
                target="_blank"
                rel="noreferrer"
                className="text-neon font-bold flex items-center gap-1 hover:underline"
              >
                <GitPullRequest className="w-4 h-4" /> PR #{milestone.prNumber} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <span className="text-textMuted font-bold">PR #{milestone.prNumber || "N/A"}</span>
            )}
          </div>

          <div>
            <span className="text-textMuted text-xs uppercase block mb-1">KeeperHub Run ID</span>
            <p className="text-textMain font-bold flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-neon" /> {milestone.runId || "N/A"}
            </p>
          </div>

          <div>
            <span className="text-textMuted text-xs uppercase block mb-1">Blockchain Transaction</span>
            {milestone.txHash ? (
              <a
                href={getExplorerUrl(milestone.txHash)}
                target="_blank"
                rel="noreferrer"
                className="text-neon font-bold flex items-center gap-1 hover:underline"
              >
                {milestone.txHash.substring(0, 10)}...{milestone.txHash.substring(milestone.txHash.length - 6)}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <span className="text-textMuted font-bold">Pending</span>
            )}
          </div>

          <div>
            <span className="text-textMuted text-xs uppercase block mb-1">Settlement Date</span>
            <p className="text-textMain font-bold">{formatDate(milestone.updatedAt)}</p>
          </div>
        </div>

        {/* Shareable Link Box */}
        <div className="pt-6 border-t border-borderMain">
          <div className="p-4 bg-background border border-borderMain space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-textMuted text-xs uppercase flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-neon" /> Shareable Receipt Link
              </span>
              <button
                onClick={() => copyToClipboard(receiptUrl)}
                className="text-xs text-neon hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedReceipt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedReceipt ? "Copied Link!" : "Copy Receipt Link"}
              </button>
            </div>
            <p className="text-xs bg-surface p-2.5 border border-borderMain/50 text-textMain break-all select-all">
              {receiptUrl}
            </p>
          </div>
        </div>
      </BracketCard>
    </div>
  );
}
