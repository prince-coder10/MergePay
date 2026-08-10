"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Cpu, ArrowUpRight } from "lucide-react";

interface PayoutProcessingTickerProps {
  amount: number;
  currency: string;
  clientGithub?: string;
  developerWallet?: string;
  status: string;
  txHash?: string;
}

const DEFAULT_STAGES = [
  "⚡ INITIATING ON-CHAIN SETTLEMENT PIPELINE...",
  "🔒 VERIFYING GITHUB HMAC-SHA256 SIGNATURE...",
  "👤 AUTHORIZING CLIENT MERGE PERMISSIONS...",
  "🔌 CONNECTING TO KEEPERHUB WEBSOCKET & MCP NODE...",
  "💸 PREPARING NATIVE / ERC-20 TOKEN DISPATCH...",
  "⛓️ SUBMITTING TRANSACTION TO ETHEREUM SEPOLIA...",
  "⏳ AWAITING BLOCK RECEIPT & TRANSACTION HASH...",
  "✅ ON-CHAIN FINALITY CONFIRMED & ESCROW RELEASED!"
];

export default function PayoutProcessingTicker({
  amount,
  currency,
  clientGithub,
  developerWallet,
  status,
  txHash,
}: PayoutProcessingTickerProps) {
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [logsHistory, setLogsHistory] = useState<string[]>([]);

  // Format short wallet
  const formatShort = (addr?: string) => {
    if (!addr) return "Pending Developer";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Cycle through log stages smoothly
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStageIndex((prev) => {
        const next = (prev + 1) % DEFAULT_STAGES.length;
        setLogsHistory((logs) => [...logs.slice(-6), DEFAULT_STAGES[prev]]);
        return next;
      });
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="my-6 p-5 bg-surfaceLight/80 border border-neon/40 rounded-lg shadow-[0_0_25px_rgba(0,255,163,0.12)] font-mono relative overflow-hidden">
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-borderMain pb-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-neon"></span>
          </span>
          <span className="text-neon text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-4 h-4" /> KeeperHub On-Chain Settlement Engine
          </span>
        </div>
        <span className="text-[11px] uppercase tracking-widest px-2.5 py-0.5 bg-neon/20 border border-neon/50 text-neon font-semibold rounded">
          {status === "processing" ? "LIVE EXECUTION" : status.toUpperCase()}
        </span>
      </div>

      {/* Target details snippet */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mb-3 p-2.5 bg-black/50 border border-borderMain rounded">
        <div>
          <span className="text-textMuted block text-[10px] uppercase">Payout Value</span>
          <span className="text-neon font-bold">{amount} {currency}</span>
        </div>
        <div>
          <span className="text-textMuted block text-[10px] uppercase">Target Recipient</span>
          <span className="text-textMain font-mono">{formatShort(developerWallet)}</span>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <span className="text-textMuted block text-[10px] uppercase">Client Verifier</span>
          <span className="text-textMain">@{clientGithub || "Client"}</span>
        </div>
      </div>

      {/* Animated Upward-Sliding Rectangular Terminal Box */}
      <div className="relative h-28 bg-black/90 border border-neon/30 rounded p-3 overflow-hidden shadow-inner flex flex-col justify-end">
        {/* Subtle grid background pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00ff9d0a_1px,transparent_1px),linear-gradient(to_bottom,#00ff9d0a_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

        {/* Sliding logs stack animating upwards out of box */}
        <div className="space-y-1.5 relative z-10">
          {logsHistory.slice(-3).map((log, idx) => (
            <div
              key={idx}
              className="text-[11px] text-neon/60 opacity-60 transition-all duration-500 transform translate-y-0 flex items-center gap-2"
            >
              <span className="text-textMuted text-[9px]">&gt;</span>
              <span>{log}</span>
            </div>
          ))}

          {/* Current Active Log Stage */}
          <div className="text-xs font-bold text-neon flex items-center gap-2 bg-neon/10 p-1.5 border-l-2 border-neon rounded-r animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0 text-neon" />
            <span className="truncate">{DEFAULT_STAGES[activeStageIndex]}</span>
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-textMuted">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-neon" />
          Auto-polling status every 3s — no refresh required.
        </span>
        {txHash && (
          <a
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neon hover:underline flex items-center gap-1 font-semibold"
          >
            View Etherscan <ArrowUpRight className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
