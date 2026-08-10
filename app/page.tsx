"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Zap, AlertTriangle, Shield, Terminal } from "lucide-react";
import Image from 'next/image';
import BracketCard from "@/components/BracketCard";

export default function Home() {
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('reveal-active');
                }
            });
        }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

        const elements = document.querySelectorAll('.reveal-on-scroll');
        elements.forEach(el => observer.observe(el));

        return () => observer.disconnect();
    }, []);

    return (
        <div className="animate-fade-in relative z-10 pt-16">
            {/* Hero Section */}
            <section className="pt-24 pb-32 px-6 max-w-5xl mx-auto text-center border-b border-borderMain reveal-on-scroll">
                <div className="inline-flex items-center gap-2 text-neon font-mono text-xs mb-8 border border-neon/30 bg-neonDim px-3 py-1 uppercase tracking-widest">
                    <span className="w-2 h-2 rounded-full bg-neon animate-pulse-slow"></span>
                    A Github-Merge-Triggered Payment Agent
                </div>
                
                <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-8 text-textMain uppercase leading-none">
                    Merge Code. <br/>
                    <span className="text-neon text-glow">Release Funds.</span>
                </h1>
                
                <p className="text-xl md:text-2xl text-textMuted mb-12 max-w-3xl mx-auto font-light">
                    Freelance milestone payments run on trust and manual follow-up. 
                    We collapse approval and payment into a single, deterministic action.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <Link 
                        href="/dashboard"
                        className="w-full sm:w-auto bg-neon text-background px-8 py-4 font-bold font-mono uppercase tracking-wider hover:bg-[#b3e600] transition-colors flex items-center justify-center gap-2"
                    >
                        Enter Dashboard <ArrowRight className="w-4 h-4" />
                    </Link>
                    <button className="w-full sm:w-auto border border-borderMain hover:border-textMuted text-textMain px-8 py-4 font-mono uppercase tracking-wider transition-colors flex items-center justify-center gap-2 bg-surfaceLight">
                        <Image src="/github.svg" alt="Github" width={20} height={20} className="w-5 h-5" /> View Source
                    </button>
                </div>
            </section>

            {/* The Problem / The Idea Section */}
            <section className="py-24 px-6 max-w-7xl mx-auto border-b border-borderMain">
                <div className="grid md:grid-cols-2 gap-12 lg:gap-24">
                    <div className="space-y-6 reveal-on-scroll" style={{ transitionDelay: '100ms' }}>
                        <h3 className="font-mono text-neon text-sm uppercase tracking-widest flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" /> The Problem
                        </h3>
                        <h4 className="text-3xl font-bold uppercase tracking-tight">The gap between approval & payout.</h4>
                        <p className="text-textMuted leading-relaxed text-lg">
                            Freelance payments today require manual follow-up: a freelancer finishes work, asks the client to review it, and then has to separately invoice and chase payment. Approval and payment are two disconnected steps, and the gap between them is where disputes, delays, and friction live.
                        </p>
                    </div>
                    <div className="space-y-6 reveal-on-scroll" style={{ transitionDelay: '300ms' }}>
                        <h3 className="font-mono text-neon text-sm uppercase tracking-widest flex items-center gap-2">
                            <Zap className="w-5 h-5" /> The Idea
                        </h3>
                        <h4 className="text-3xl font-bold uppercase tracking-tight">Approval IS Payment.</h4>
                        <p className="text-textMuted leading-relaxed text-lg">
                            MergePay collapses approval and payment into a single action. A freelancer's work lives in a GitHub PR. The client reviews it natively. The moment the client merges that PR, payment is released automatically, onchain. No invoice, no manual transfer. 
                        </p>
                    </div>
                </div>
            </section>

            {/* Pipeline Section */}
            <section className="py-32 px-6 max-w-7xl mx-auto border-b border-borderMain">
                <div className="grid md:grid-cols-2 gap-16 lg:gap-32 items-start relative">
                    
                    {/* Sticky Left Column */}
                    <div className="md:sticky md:top-32 space-y-8 reveal-on-scroll">
                        <div className="inline-flex items-center gap-2 text-neon font-mono text-xs border border-neon/30 bg-neonDim px-3 py-1 uppercase tracking-widest mb-4">
                            <Zap className="w-4 h-4" /> The Pipeline
                        </div>
                        <h2 className="text-4xl md:text-6xl font-bold tracking-tight uppercase leading-none">
                            Four Steps.<br/>
                            One Settled<br/>
                            Transaction.
                        </h2>
                        <p className="text-xl text-textMuted max-w-md">
                            A deterministic pipeline built on KeeperHub. We don't use open-ended reasoning loops. We use GitHub's verified merge events to trigger instant on-chain execution.
                        </p>
                    </div>

                    {/* Scrolling Right Column */}
                    <div className="space-y-8 mt-12 md:mt-0">
                        {[
                            { num: '01', title: 'AGREE ON TERMS', desc: 'Client and freelancer agree on milestone amount and scope upfront. The financial invariant is established before work begins.' },
                            { num: '02', title: 'OPEN PULL REQUEST', desc: 'Freelancer commits code and opens a pull request in the designated GitHub repository for the completed milestone.' },
                            { num: '03', title: 'CLIENT REVIEWS', desc: 'Client reviews the code natively in GitHub as the required reviewer. No context switching to a payment dashboard needed.' },
                            { num: '04', title: 'INSTANT PAYOUT', desc: 'Client clicks Merge. The GitHub webhook triggers KeeperHub, and funds are automatically released on-chain the exact second the PR closes.' }
                        ].map((step, i) => (
                            <BracketCard key={i} className="flex flex-col justify-center p-10 min-h-[300px] bg-surfaceLight/50 backdrop-blur-sm reveal-on-scroll" style={{ transitionDelay: `${i * 100}ms` }}>
                                <span className="font-mono text-neon text-3xl mb-6 block opacity-50">[{step.num}]</span>
                                <h4 className="font-bold text-2xl tracking-tight mb-4 uppercase">{step.title}</h4>
                                <p className="text-textMuted text-base leading-relaxed">{step.desc}</p>
                            </BracketCard>
                        ))}
                    </div>
                </div>
            </section>

            {/* Trust & Architecture Section */}
            <section className="py-24 px-6 max-w-7xl mx-auto border-b border-borderMain">
                <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
                    
                    {/* Left Column: Text */}
                    <div className="space-y-16 reveal-on-scroll">
                        {/* Trust Mechanism */}
                        <div className="space-y-6">
                            <h3 className="font-mono text-neon text-sm uppercase tracking-widest flex items-center gap-3">
                                <Shield className="w-5 h-5" /> Trust Mechanism
                            </h3>
                            <div className="space-y-4">
                                <p className="text-textMuted leading-relaxed text-lg font-light">
                                    Security through verifiable delegation, not blind trust. MergePay leverages native GitHub branch protection policies to enforce accountability. By mandating the client as a designated required reviewer, we ensure a merge event acts as an immutable guarantee of approval.
                                </p>
                                <p className="text-textMuted leading-relaxed text-lg font-light">
                                    The system does not arbitrarily parse webhooks; it verifies the strict audit trail of the pull request before initiating any execution layer sequence.
                                </p>
                            </div>
                        </div>

                        {/* Architecture */}
                        <div className="space-y-6">
                            <h3 className="font-mono text-neon text-sm uppercase tracking-widest flex items-center gap-3">
                                <Terminal className="w-5 h-5" /> Architecture
                            </h3>
                            <ul className="space-y-5 font-mono text-sm">
                                <li className="flex gap-4">
                                    <span className="text-neon opacity-50">-</span>
                                    <div>
                                        <strong className="text-textMain font-bold">Backend:</strong> <span className="text-textMuted">Node.js / Express, securely ingesting and validating GitHub webhook signatures.</span>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <span className="text-neon opacity-50">-</span>
                                    <div>
                                        <strong className="text-textMain font-bold">Database:</strong> <span className="text-textMuted">MongoDB, providing resilient state tracking for milestone invariants.</span>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <span className="text-neon opacity-50">-</span>
                                    <div>
                                        <strong className="text-textMain font-bold">Execution:</strong> <span className="text-textMuted">KeeperHub, invoked natively via the official MCP SDK. MergePay abstracts state execution and securely hands the operation to KeeperHub.</span>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Right Column: Terminal UI */}
                    <div className="reveal-on-scroll" style={{ transitionDelay: '200ms' }}>
                        <div className="bracket-box bg-surface/80 backdrop-blur-sm rounded-lg overflow-hidden shadow-2xl border border-borderMain">
                            {/* Terminal Header */}
                            <div className="flex items-center px-4 py-3 bg-surfaceLight border-b border-borderMain">
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                                    <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                                </div>
                                <div className="ml-4 text-xs font-mono text-textMuted/70">mergepay_agent_v1.sh</div>
                            </div>
                            {/* Terminal Body */}
                            <div className="p-6 md:p-8 font-mono text-xs md:text-sm space-y-4 text-textMuted overflow-x-auto">
                                <div className="flex"><span className="text-neon mr-4 w-4 shrink-0">$</span> <span className="whitespace-nowrap">waiting for github webhook event...</span></div>
                                
                                <div className="flex"><span className="text-textMuted/40 mr-4 w-4 shrink-0">&gt;</span> <span className="whitespace-nowrap"><span className="text-blue-400">EVENT_RECEIVED:</span> pull_request.merged</span></div>
                                <div className="flex"><span className="text-textMuted/40 mr-4 w-4 shrink-0">&gt;</span> <span className="whitespace-nowrap">repo: vercel/next.js | pr: #4521</span></div>
                                
                                <div className="flex"><span className="text-textMuted/40 mr-4 w-4 shrink-0">&gt;</span> <span className="whitespace-nowrap">verifying required reviewer approval... <span className="text-neon">[OK]</span></span></div>
                                <div className="flex"><span className="text-textMuted/40 mr-4 w-4 shrink-0">&gt;</span> <span className="whitespace-nowrap">mapping to milestone #891... <span className="text-neon">amount: 1500 USDC</span></span></div>
                                
                                <div className="flex mt-8"><span className="text-neon mr-4 w-4 shrink-0">$</span> <span className="whitespace-nowrap">initiating KeeperHub MCP execution</span></div>
                                
                                <div className="flex"><span className="text-textMuted/40 mr-4 w-4 shrink-0">&gt;</span> <span className="whitespace-nowrap">executing direct on-chain transfer...</span></div>
                                <div className="flex"><span className="text-textMuted/40 mr-4 w-4 shrink-0">&gt;</span> <span className="whitespace-nowrap">transaction submitted: 0x8f2a...c9d1</span></div>
                                
                                <div className="flex text-neon mt-8">
                                    <span className="mr-4 w-4 shrink-0">✓</span> 
                                    <span className="whitespace-nowrap font-bold">PAYOUT_COMPLETE</span>
                                    <span className="animate-pulse bg-neon inline-block w-2.5 h-4 align-middle ml-2"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 text-center text-textMuted font-mono text-sm flex flex-col md:flex-row justify-between items-center max-w-7xl mx-auto reveal-on-scroll">
                <p>© 2026 MergePay. Built for developers.</p>
                <p className="mt-4 md:mt-0 flex items-center gap-2">Powered by <span className="text-neon">KeeperHub</span></p>
            </footer>
        </div>
    );
}
