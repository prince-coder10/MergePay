"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import BracketCard from "@/components/BracketCard";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  CheckCircle,
  Clock,
  Plus,
  Loader2,
  Inbox,
  ArrowRight,
  GitPullRequest,
  AlertCircle,
  KeyRound,
  ExternalLink,
} from "lucide-react";
import { useAccount } from "wagmi";

interface Milestone {
  _id: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  repo: string;
  client: string;
  developer?: string;
  status: "awaiting_claim" | "active" | "in_review" | "processing" | "failed" | "paid";
  prNumber?: number;
  prUrl?: string;
  lastError?: string;
  failedAt?: string;
  retryCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  totalMilestones: number;
  pendingAmount: string;
  totalPaid: string;
  paidThisMonth: string;
}

type TabType = "All" | "Awaiting Claim" | "Active" | "Failed" | "Paid";

export default function Dashboard() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalMilestones: 0,
    pendingAmount: "0.00 USDC",
    totalPaid: "0.00 USDC",
    paidThisMonth: "0.00 USDC",
  });

  const [activeTab, setActiveTab] = useState<TabType>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  const { address, status: accountStatus } = useAccount();
  const isConnected = accountStatus === "connected";

  // Ref to track polling interval for auth session detection
  const authPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDashboardData = useCallback(async () => {
    // Clear stale error/unauthorized state before re-fetching
    setError(null);
    setIsUnauthorized(false);
    setLoading(true);

    try {
      const res = await fetch("/api/milestones");
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401 || (data.error && data.error.includes("Unauthorized"))) {
          setIsUnauthorized(true);
          throw new Error(
            "Session expired or wallet disconnected. Please connect your wallet to access your milestones."
          );
        }
        throw new Error(data.error || "Failed to load dashboard data");
      }

      setMilestones(data.milestones || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + re-fetch when address changes (e.g. wallet switch)
  useEffect(() => {
    fetchDashboardData();
  }, [address, fetchDashboardData]);

  // When wallet is connected but we're in an unauthorized state (SIWE not yet
  // complete), poll /api/auth/me to detect when the session cookie is set.
  // This handles the timing gap where address changes before SIWE completes.
  useEffect(() => {
    if (isConnected && isUnauthorized) {
      // Start polling for auth session
      authPollRef.current = setInterval(async () => {
        try {
          const res = await fetch("/api/auth/me");
          if (res.ok) {
            // Session is now active — stop polling and re-fetch dashboard data
            if (authPollRef.current) clearInterval(authPollRef.current);
            authPollRef.current = null;
            fetchDashboardData();
          }
        } catch {
          // Ignore network errors during polling
        }
      }, 1000); // Check every second
    }

    return () => {
      if (authPollRef.current) {
        clearInterval(authPollRef.current);
        authPollRef.current = null;
      }
    };
  }, [isConnected, isUnauthorized, fetchDashboardData]);

  // Filter milestones based on active tab
  const filteredMilestones = milestones.filter((item) => {
    if (activeTab === "All") return true;
    if (activeTab === "Awaiting Claim") return item.status === "awaiting_claim";
    if (activeTab === "Active")
      return item.status === "active" || item.status === "in_review" || item.status === "processing";
    if (activeTab === "Failed") return item.status === "failed";
    if (activeTab === "Paid") return item.status === "paid";
    return true;
  });

  // Shorten Ethereum address (0x1234...5678)
  const formatAddress = (addr?: string) => {
    if (!addr) return "N/A";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Format ISO date string
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="pt-36 pb-24 px-6 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center font-mono">
        <Loader2 className="w-8 h-8 text-neon animate-spin mb-4" />
        <p className="text-textMuted text-sm">Loading your dashboard & milestones...</p>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 px-6 max-w-7xl mx-auto animate-fade-in relative z-10">
      {/* Dashboard Title & Create Action */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
        <div>
          <h2 className="text-3xl font-bold uppercase tracking-tight mb-2">Milestones</h2>
          <p className="text-textMuted font-mono text-sm">Manage and track your milestone payments</p>
        </div>
        <Link
          href="/create"
          className="bg-neon text-background font-mono text-sm font-bold uppercase tracking-wider px-6 py-3 hover:bg-[#b3e600] transition-colors inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Milestone
        </Link>
      </div>

      {/* Enhanced Session / Error Banner */}
      {error && (
        <div className="mb-8 p-6 bg-red-500/10 border border-red-500/40 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono">
          <div className="flex items-center gap-3 text-red-400 text-sm">
            {isUnauthorized ? (
              <KeyRound className="w-5 h-5 flex-shrink-0 text-yellow-400" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            )}
            <span>{error}</span>
          </div>
          {isUnauthorized && (
            <div className="flex-shrink-0">
              <ConnectButton label="Connect Wallet & Sign In" />
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-12">
        {[
          { label: "Total Milestones", value: stats.totalMilestones.toString(), color: "textMain" },
          { label: "Pending Amount", value: stats.pendingAmount, color: "neon" },
          { label: "Total Paid", value: stats.totalPaid, color: "neon" },
          { label: "Paid This Month", value: stats.paidThisMonth, color: "textMuted" },
        ].map((stat, i) => (
          <BracketCard key={i}>
            <p className="text-textMuted font-mono text-xs uppercase tracking-wider mb-4">
              {stat.label}
            </p>
            <p
              className={`text-2xl font-bold tracking-tight ${
                stat.color === "neon" ? "text-neon" : "text-textMain"
              }`}
            >
              {stat.value}
            </p>
          </BracketCard>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-4 mb-8 border-b border-borderMain pb-4 overflow-x-auto">
        {(["All", "Awaiting Claim", "Active", "Failed", "Paid"] as TabType[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`font-mono text-sm uppercase tracking-wider px-4 py-2 transition-all cursor-pointer ${
                isActive
                  ? "bg-surfaceLight border border-borderMain text-textMain font-bold border-b-2 border-b-neon"
                  : "text-textMuted hover:text-textMain"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Milestones List */}
      <div className="space-y-4">
        {filteredMilestones.length > 0 ? (
          filteredMilestones.map((item) => {
            const isPaid = item.status === "paid";
            const isFailed = item.status === "failed";
            const isProcessing = item.status === "processing";
            const isInReview = item.status === "in_review";
            const isPending = item.status === "awaiting_claim" || item.status === "active";

            return (
              <BracketCard
                key={item._id}
                className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:border-borderMain transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-bold text-lg text-textMain">{item.title}</h4>
                    {address && item.client && address.toLowerCase() === item.client.toLowerCase() && (
                      <Link
                        href={`/milestones/${item._id}/setup`}
                        className="text-xs font-mono text-neon hover:underline flex items-center gap-1"
                      >
                        Setup Guide <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                    {isPaid || isFailed ? (
                      <Link
                        href={`/milestones/${item._id}/receipt`}
                        className={`text-xs font-mono underline flex items-center gap-1 ml-2 ${
                          isFailed ? "text-red-400 hover:text-red-300" : "text-textMuted hover:text-neon"
                        }`}
                      >
                        {isFailed ? "View Error / Retry Payout" : "Receipt Proof"} <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : (
                      (!address || !item.client || address.toLowerCase() !== item.client.toLowerCase()) && (
                        <Link
                          href={`/milestones/${item._id}/claim`}
                          className="text-xs font-mono text-yellow-400 hover:underline flex items-center gap-1 ml-2"
                        >
                          Claim Page <ExternalLink className="w-3 h-3" />
                        </Link>
                      )
                    )}
                  </div>

                  <p className="text-textMuted font-mono text-xs mb-3 flex items-center gap-2">
                    <span>{item.repo}</span>
                    <span>•</span>
                    {item.prNumber ? (
                      <span className="flex items-center gap-1 text-neon font-semibold">
                        <GitPullRequest className="w-3 h-3" /> PR #{item.prNumber}
                      </span>
                    ) : (
                      <span className="text-textMuted">No PR Linked Yet</span>
                    )}
                  </p>

                  <div className="flex flex-wrap gap-6 text-sm">
                    <div>
                      <span className="text-textMuted text-xs block mb-1">Amount</span>
                      <span className="font-mono text-neon font-bold">
                        {item.amount} {item.currency}
                      </span>
                    </div>
                    <div>
                      <span className="text-textMuted text-xs block mb-1">Created</span>
                      <span className="font-mono">{formatDate(item.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-textMuted text-xs block mb-1">Developer</span>
                      <span className="font-mono">{formatAddress(item.developer)}</span>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-borderMain pt-4 md:pt-0">
                  <span
                    className={`font-mono text-sm uppercase tracking-wider flex items-center gap-2 ${
                      isPaid
                        ? "text-neon"
                        : isFailed
                        ? "text-red-400 font-bold"
                        : isProcessing
                        ? "text-yellow-400 font-bold"
                        : isInReview
                        ? "text-blue-400"
                        : "text-yellow-500"
                    }`}
                  >
                    {isPaid && <CheckCircle className="w-5 h-5" />}
                    {isFailed && <AlertCircle className="w-5 h-5 text-red-400" />}
                    {isProcessing && <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />}
                    {isInReview && <Clock className="w-5 h-5 animate-pulse" />}
                    {isPending && <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse"></span>}
                    {item.status.replace("_", " ")}
                  </span>
                </div>
              </BracketCard>
            );
          })
        ) : (
          /* Empty State */
          <BracketCard className="p-12 text-center font-mono space-y-4 bg-surfaceLight/30">
            <div className="w-12 h-12 rounded-full bg-surfaceLight border border-borderMain flex items-center justify-center mx-auto text-textMuted mb-2">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-textMain uppercase tracking-wider">
              No Milestones Found
            </h3>
            <p className="text-textMuted text-xs max-w-md mx-auto leading-relaxed">
              {activeTab === "All"
                ? "You haven't created any payment milestones yet. Get started by creating your first milestone."
                : `There are currently no milestones in the "${activeTab}" state.`}
            </p>
            <div className="pt-2">
              <Link
                href="/create"
                className="inline-flex items-center gap-2 bg-neon text-background font-mono text-xs font-bold uppercase tracking-wider px-6 py-3 hover:bg-[#b3e600] transition-colors"
              >
                <Plus className="w-4 h-4" /> Create Milestone
              </Link>
            </div>
          </BracketCard>
        )}
      </div>
    </div>
  );
}