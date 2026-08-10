"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const Navbar = () => {
    const pathname = usePathname();

    return (
        <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-md border-b border-borderMain z-50">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <Link 
                    href="/"
                    className="flex items-center gap-3 cursor-pointer"
                >
                    <Image
                        src="/mergepay.png"
                        alt="MergePay"
                        width={36}
                        height={36}
                        className="drop-shadow-[0_0_8px_rgba(204,255,0,0.3)]"
                        priority
                    />
                    <span className="font-bold text-xl tracking-tight text-textMain">Merge<span className="text-neon">Pay</span></span>
                </Link>
                <div className="hidden md:flex items-center gap-8 font-mono text-sm">
                    <Link 
                        href="/dashboard" 
                        className={`uppercase tracking-wider transition-colors ${pathname === '/dashboard' ? 'text-neon' : 'text-textMuted hover:text-textMain'}`}
                    >
                        Dashboard
                    </Link>
                    <Link 
                        href="/create" 
                        className={`uppercase tracking-wider transition-colors ${pathname === '/create' ? 'text-neon' : 'text-textMuted hover:text-textMain'}`}
                    >
                        Create Milestone
                    </Link>
                </div>
                <div>
                    <ConnectButton.Custom>
                        {({
                            account,
                            chain,
                            openAccountModal,
                            openChainModal,
                            openConnectModal,
                            authenticationStatus,
                            mounted,
                        }) => {
                            const ready = mounted && authenticationStatus !== 'loading';
                            const connected =
                                ready &&
                                account &&
                                chain &&
                                (!authenticationStatus || authenticationStatus === 'authenticated');

                            return (
                                <div
                                    {...(!ready && {
                                        'aria-hidden': true,
                                        style: {
                                            opacity: 0,
                                            pointerEvents: 'none',
                                            userSelect: 'none',
                                        },
                                    })}
                                >
                                    {(() => {
                                        if (!connected) {
                                            return (
                                                <button
                                                    onClick={openConnectModal}
                                                    type="button"
                                                    className="border border-borderMain hover:border-neon hover:text-neon text-textMain px-4 py-2 font-mono text-sm uppercase tracking-wider transition-all bg-surface cursor-pointer"
                                                >
                                                    Connect Wallet
                                                </button>
                                            );
                                        }

                                        if (chain.unsupported) {
                                            return (
                                                <button
                                                    onClick={openChainModal}
                                                    type="button"
                                                    className="border border-red-500 text-red-500 hover:bg-red-500/10 px-4 py-2 font-mono text-sm uppercase tracking-wider transition-all bg-surface cursor-pointer"
                                                >
                                                    Wrong Network
                                                </button>
                                            );
                                        }

                                        return (
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={openChainModal}
                                                    type="button"
                                                    className="border border-borderMain hover:border-textMuted text-textMuted px-3 py-2 font-mono text-xs uppercase tracking-wider transition-all bg-surface hidden sm:flex items-center gap-2 cursor-pointer"
                                                >
                                                    {chain.hasIcon && (
                                                        <div className="w-4 h-4 overflow-hidden rounded-full">
                                                            {chain.iconUrl && (
                                                                <img
                                                                    alt={chain.name ?? 'Chain icon'}
                                                                    src={chain.iconUrl}
                                                                    className="w-4 h-4"
                                                                />
                                                            )}
                                                        </div>
                                                    )}
                                                    {chain.name}
                                                </button>

                                                <button
                                                    onClick={openAccountModal}
                                                    type="button"
                                                    className="border border-neon text-neon hover:bg-neon/10 px-4 py-2 font-mono text-sm uppercase tracking-wider transition-all bg-surface flex items-center gap-2 cursor-pointer"
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-neon animate-pulse"></span>
                                                    {account.displayName}
                                                    {account.displayBalance && !account.displayBalance.includes("NaN") ? ` (${account.displayBalance})` : ''}
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        }}
                    </ConnectButton.Custom>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
