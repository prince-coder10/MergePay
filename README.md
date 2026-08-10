# MergePay

**Merge code. Release funds.**

MergePay is a GitHub-merge-triggered escrow and payment agent for freelance milestones. A client deposits funds when creating a milestone; the moment they merge the developer's pull request on GitHub, payment is released automatically onchain — no invoicing, no manual transfer, no chasing payment.

Built on [KeeperHub](https://keeperhub.com) as the onchain execution layer.

---

## The problem

Freelance milestone payments run on manual follow-up: a developer finishes work, the client reviews it, and payment happens as a separate, disconnected step days or weeks later. That gap is where disputes, delays, and awkward "hey, did you get a chance to send that over?" messages live.

## The idea

**Approval is payment.** A developer's work lives in a GitHub pull request. The client reviews it natively, in GitHub, the way they already review code. The instant they click Merge, funds move — deterministically, onchain, with no separate action required.

---

## How it works

1. **Client creates a milestone** — title, amount, currency, and their own GitHub repository. No developer wallet address needed upfront.
2. **Client funds escrow** — signs a transaction depositing the milestone amount into KeeperHub's agentic wallet. Funds are locked before any work begins.
3. **Client shares two things:**
   - A webhook URL + secret, pasted into their repo's GitHub settings (15-second setup, no branch protection rules required).
   - A unique claim link, sent to the developer through whatever channel they already use.
4. **Developer claims the milestone** — opens the claim link, connects their own wallet, and enters their GitHub username. The page immediately shows them a ready-to-paste `MergePay-ID` tag and instructions for using it.
5. **Developer does the work** — opens a pull request against the client's repo with the milestone tag pasted into the PR description.
6. **Client reviews and merges** — entirely inside GitHub, no context-switching to a payment dashboard.
7. **Payout executes automatically** — the merge fires a signed webhook, MergePay verifies it, and KeeperHub releases the escrowed funds directly to the developer's wallet onchain.
8. **Both parties get a public receipt** — a shareable audit page with the transaction hash, verifiable on Etherscan.

If a payout attempt fails for any reason, the client sees the failure with the underlying error and can trigger a one-click retry — no need to wait for another GitHub event.

---

## Security model

MergePay is fund-custody software, so every trust boundary is enforced server-side, not assumed:

- **Client-owned repositories.** The client always creates the milestone and owns the GitHub repo. A developer never holds repository control, so a self-merge can never be the client's approval.
- **Per-milestone webhook signatures.** Each milestone gets a unique HMAC-SHA256 secret. Every incoming webhook is verified against the raw request body with a timing-safe comparison before anything else happens.
- **Merger identity verification.** Beyond signature validity, the handler confirms the GitHub user who performed the merge matches the milestone's registered client — a collaborator with write access merging their own PR does not release funds.
- **Claim-identity guards.** A developer cannot claim a milestone using the client's wallet address or GitHub username, blocking a client from posing as their own developer to bypass the merger check.
- **Atomic, idempotent payouts.** Milestone status transitions are claimed atomically at the database level before a payout is triggered, closing the race window created by GitHub's webhook retry behavior — a merge event can never trigger two payouts.
- **Fail-closed execution.** A payout is only ever marked complete after a real, verified onchain transaction hash is returned. Any execution failure leaves the milestone in a visible `failed` state with the retry safely available — never silently marked as paid.
- **Role-gated pages.** Setup instructions and webhook secrets are visible only to the client; PR-tagging instructions are visible only to the claimed developer. Each page independently verifies the connected wallet against the milestone record.

---

## Tech stack

| Layer             | Technology                                                          |
| ----------------- | ------------------------------------------------------------------- |
| Framework         | Next.js (App Router)                                                |
| Language          | TypeScript                                                          |
| Styling           | Tailwind CSS                                                        |
| Database          | MongoDB via Mongoose                                                |
| Wallet / Web3     | wagmi, viem, RainbowKit                                             |
| Auth              | Wallet-signature (SIWE-style) sessions, JWT in an `httpOnly` cookie |
| Onchain execution | KeeperHub, via the official MCP SDK                                 |
| Network           | Ethereum Sepolia (testnet)                                          |

---

## Project structure

```
app/
  page.tsx                        # Landing page
  dashboard/                      # Client's milestone overview
  create/                         # Milestone creation form
  milestones/[id]/setup/          # Client-only: webhook config, claim link, deposit proof
  milestones/[id]/claim/          # Developer-only: wallet connect, PR-tagging instructions
  milestones/[id]/receipt/        # Public: onchain proof of payment
  api/
    auth/                         # Nonce, login, logout, session
    milestones/                   # CRUD, claim, retry
    webhooks/github/              # Signature-verified merge event handler
lib/
  keeperhub.ts                    # KeeperHub MCP client and payout execution
  github.ts                       # Webhook signature verification, PR parsing
  payout.ts                       # Shared payout execution logic (webhook + retry)
models/
  User.ts
  Milestone.ts
```

---

## Getting started

### Prerequisites

- Node.js and pnpm
- A MongoDB connection string
- A KeeperHub API key
- A WalletConnect / Reown project ID
- A funded Sepolia testnet wallet

### Environment variables

```
NEXT_MONGO_URI=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
KEEPERHUB_API_KEY=
JWT_SECRET=
```

### Install and run

```bash
pnpm install
pnpm dev
```

Visit `http://localhost:3000`.

---

## Why KeeperHub

MergePay uses KeeperHub as its entire onchain execution layer: agentic wallet custody for escrowed funds, direct onchain transfers on payout, and an execution audit trail (run ID and transaction hash) surfaced back to both parties as proof of payment. MergePay's backend never holds a private key or signs a transaction itself — it decides _when_ a payout should happen; KeeperHub is solely responsible for _how_ it happens onchain.

---

## Status

Fully functional end-to-end on Sepolia testnet: escrow deposit, milestone claim, PR-tagged merge, signature-verified webhook, onchain payout, and public receipt have all been exercised with real, verifiable transactions.

<!-- **Out of scope for this build:** dispute resolution, multi-milestone/multi-currency portfolios, mainnet deployment. -->
