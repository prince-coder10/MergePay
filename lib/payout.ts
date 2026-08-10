import Milestone from "@/models/Milestone";
import { executeDirectTransfer } from "@/lib/keeperhub";

export interface PayoutExecutionResult {
  success: boolean;
  error?: string;
  runId?: string;
  txHash?: string;
  milestone?: any;
  keeperHubData?: any;
}

/**
 * Shared function to execute a milestone payout on-chain via KeeperHub.
 *
 * Security & Validation Guards:
 *  1. Developer check: Requires a valid claimed developer address (0x...).
 *  2. Amount check: Requires a valid positive payout amount.
 *  3. Direct Execution: Uses KeeperHub's `execute_transfer` tool with strict on-chain txHash verification.
 *  4. Atomic Persistence: Updates DB status to "paid" on verified txHash, or "failed" with error details.
 */
export async function executeMilestonePayout(
  milestone: any,
): Promise<PayoutExecutionResult> {
  const developer = milestone.developer;
  const amount = milestone.amount;
  const currency = milestone.currency || "ETH";
  const chain = "sepolia";

  // ── Guard 1: Validate Developer Wallet Address ──────────────────────
  if (!developer || typeof developer !== "string" || !developer.startsWith("0x")) {
    const errorMsg = "Cannot execute payout: Developer wallet address is missing or invalid.";
    console.error(`[Payout] ❌ Validation failed for milestone ${milestone._id}: ${errorMsg}`);

    milestone.status = "failed";
    milestone.lastError = errorMsg;
    milestone.failedAt = new Date();
    milestone.retryCount = (milestone.retryCount || 0) + 1;
    await milestone.save();

    return {
      success: false,
      error: errorMsg,
      milestone,
    };
  }

  // ── Guard 2: Validate Payout Amount ──────────────────────────────────
  if (!amount || Number(amount) <= 0) {
    const errorMsg = "Cannot execute payout: Milestone amount must be greater than 0.";
    console.error(`[Payout] ❌ Validation failed for milestone ${milestone._id}: ${errorMsg}`);

    milestone.status = "failed";
    milestone.lastError = errorMsg;
    milestone.failedAt = new Date();
    milestone.retryCount = (milestone.retryCount || 0) + 1;
    await milestone.save();

    return {
      success: false,
      error: errorMsg,
      milestone,
    };
  }

  // ── Execute Direct On-Chain Transfer ────────────────────────────────
  console.log(
    `[Payout] Executing transfer → ${amount} ${currency} on ${chain} to developer ${developer} for milestone ${milestone._id}...`
  );

  const transferRes = await executeDirectTransfer(
    developer,
    amount,
    currency,
    chain
  );
  console.log(
    `[Payout] execute_transfer result:`,
    JSON.stringify(transferRes, null, 2)
  );

  if (!transferRes.success || !transferRes.txHash) {
    const errorMessage = transferRes.error || "No on-chain transaction hash returned from transfer execution.";
    console.error(`[Payout] ❌ Payout failed for milestone ${milestone._id}: ${errorMessage}`);

    milestone.status = "failed";
    milestone.lastError = errorMessage;
    milestone.failedAt = new Date();
    milestone.retryCount = (milestone.retryCount || 0) + 1;
    await milestone.save();

    return {
      success: false,
      error: errorMessage,
      milestone,
    };
  }

  // ── Payout Success ──────────────────────────────────────────────────
  milestone.status = "paid";
  milestone.runId = transferRes.runId || `transfer-${Date.now()}`;
  milestone.txHash = transferRes.txHash;
  milestone.lastError = undefined;
  await milestone.save();

  console.log(
    `[Payout] ✅ Payout successfully completed on-chain for ${milestone._id} (txHash: ${milestone.txHash})`
  );

  return {
    success: true,
    runId: milestone.runId,
    txHash: milestone.txHash,
    milestone,
    keeperHubData: transferRes.data,
  };
}
