import Milestone from "@/models/Milestone";
import { executeDirectTransfer, triggerPayoutWorkflow } from "@/lib/keeperhub";

export interface PayoutExecutionResult {
  success: boolean;
  error?: string;
  runId?: string;
  txHash?: string;
  milestone?: any;
  keeperHubData?: any;
}

export interface PayoutOptions {
  isRetry?: boolean;
}

/**
 * Shared function to execute a milestone payout on-chain via KeeperHub.
 *
 * Security & Execution Logic:
 *  1. Developer check: Requires a valid claimed developer address (0x...).
 *  2. Amount check: Requires a valid positive payout amount.
 *  3. Workflow Execution: Attempts KeeperHub workflow via `triggerPayoutWorkflow` if workflowId exists.
 *  4. Direct Transfer Fallback ONLY ON RETRY:
 *     - If this is a normal initial transaction (isRetry = false) and the workflow fails to produce an on-chain txHash,
 *       the milestone strictly transitions to the "failed" state without direct transfer.
 *     - If this is a RETRY attempt (isRetry = true, i.e. milestone was in "failed" state) and the workflow fails / returns no txHash,
 *       it falls back to `executeDirectTransfer` to disburse funds directly on-chain.
 *  5. Persistence: Updates DB status to "paid" on verified txHash, or "failed" with lastError if execution fails.
 */
export async function executeMilestonePayout(
  milestone: any,
  options: PayoutOptions = {}
): Promise<PayoutExecutionResult> {
  const developer = milestone.developer;
  const amount = milestone.amount;
  const currency = milestone.currency || "ETH";
  const chain = "sepolia";
  const workflowId = milestone.workflowId || milestone.workflowSlug;
  const isRetry = options.isRetry || Boolean(milestone.retryCount && milestone.retryCount > 0);

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

  // ── Execution Path A: Workflow Execution ────────────────────────────
  if (workflowId) {
    console.log(
      `[Payout] Triggering KeeperHub workflow "${workflowId}" for milestone ${milestone._id}...`
    );

    const workflowRes = await triggerPayoutWorkflow(
      workflowId,
      {},
      {
        recipient: developer,
        amount,
        currency,
        chain,
      }
    );

    if (workflowRes.success && workflowRes.txHash) {
      // Workflow Execution Succeeded!
      milestone.status = "paid";
      milestone.runId = workflowRes.runId || `wf-${Date.now()}`;
      milestone.txHash = workflowRes.txHash;
      milestone.lastError = undefined;
      await milestone.save();

      console.log(
        `[Payout] ✅ Workflow payout successfully completed on-chain for ${milestone._id} (txHash: ${milestone.txHash})`
      );

      return {
        success: true,
        runId: milestone.runId,
        txHash: milestone.txHash,
        milestone,
        keeperHubData: workflowRes.data,
      };
    }

    const workflowError = workflowRes.error || `Workflow "${workflowId}" execution failed or did not return a verified on-chain txHash.`;
    console.warn(`[Payout] ⚠️ Workflow execution failed for milestone ${milestone._id}: ${workflowError}`);

    // If this is NOT a retry attempt (normal initial transaction), DO NOT use direct transfer.
    // Transition strictly to "failed" state so client/developer sees the failure and can retry.
    if (!isRetry) {
      console.error(`[Payout] ❌ Initial workflow execution failed. Transitioning milestone ${milestone._id} to "failed" state.`);
      milestone.status = "failed";
      milestone.lastError = workflowError;
      milestone.failedAt = new Date();
      milestone.retryCount = (milestone.retryCount || 0) + 1;
      await milestone.save();

      return {
        success: false,
        error: workflowError,
        milestone,
        keeperHubData: workflowRes.data,
      };
    }

    console.log(`[Payout] 🔄 Milestone ${milestone._id} is in FAILED / RETRY state. Falling back to direct transfer execution...`);
  }

  // ── Execution Path B: Direct Transfer (fallback for retries or when no workflow exists) ─
  console.log(
    `[Payout] Executing direct transfer fallback → ${amount} ${currency} on ${chain} to developer ${developer} for milestone ${milestone._id}...`
  );

  const transferRes = await executeDirectTransfer(
    developer,
    amount,
    currency,
    chain
  );

  if (!transferRes.success || !transferRes.txHash) {
    const errorMessage = transferRes.error || "No on-chain transaction hash returned from direct transfer execution.";
    console.error(`[Payout] ❌ Direct transfer fallback failed for milestone ${milestone._id}: ${errorMessage}`);

    milestone.status = "failed";
    milestone.lastError = errorMessage;
    milestone.failedAt = new Date();
    milestone.retryCount = (milestone.retryCount || 0) + 1;
    await milestone.save();

    return {
      success: false,
      error: errorMessage,
      milestone,
      keeperHubData: transferRes.data,
    };
  }

  // Direct Transfer Succeeded
  milestone.status = "paid";
  milestone.runId = transferRes.runId || `transfer-${Date.now()}`;
  milestone.txHash = transferRes.txHash;
  milestone.lastError = undefined;
  await milestone.save();

  console.log(
    `[Payout] ✅ Direct transfer payout successfully completed on-chain for ${milestone._id} (txHash: ${milestone.txHash})`
  );

  return {
    success: true,
    runId: milestone.runId,
    txHash: milestone.txHash,
    milestone,
    keeperHubData: transferRes.data,
  };
}
