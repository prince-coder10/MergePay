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

/**
 * Shared function to execute a milestone payout on-chain via KeeperHub.
 *
 * Security & Execution Logic:
 *  1. Developer check: Requires a valid claimed developer address (0x...).
 *  2. Amount check: Requires a valid positive payout amount.
 *  3. Workflow Execution: If milestone.workflowId or workflowSlug exists, executes KeeperHub workflow via `triggerPayoutWorkflow`.
 *     If the workflow fails or is invalid (e.g. 404 / tampered workflow ID), transitions milestone to "failed" state strictly.
 *  4. Direct Transfer Execution: If no workflow ID exists, attempts direct transfer via `executeDirectTransfer`.
 *  5. Persistence: Updates DB status to "paid" on verified txHash, or "failed" with lastError if execution fails.
 */
export async function executeMilestonePayout(
  milestone: any,
): Promise<PayoutExecutionResult> {
  const developer = milestone.developer;
  const amount = milestone.amount;
  const currency = milestone.currency || "ETH";
  const chain = "sepolia";
  const workflowId = milestone.workflowId || milestone.workflowSlug;

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

    if (!workflowRes.success || !workflowRes.txHash) {
      const errorMessage = workflowRes.error || `Workflow "${workflowId}" execution failed or did not return a verified on-chain txHash.`;
      console.error(`[Payout] ❌ Workflow execution failed for milestone ${milestone._id}: ${errorMessage}`);

      milestone.status = "failed";
      milestone.lastError = errorMessage;
      milestone.failedAt = new Date();
      milestone.retryCount = (milestone.retryCount || 0) + 1;
      await milestone.save();

      return {
        success: false,
        error: errorMessage,
        milestone,
        keeperHubData: workflowRes.data,
      };
    }

    // Workflow Execution Succeeded
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

  // ── Execution Path B: Direct Transfer (fallback when no workflow exists) ─
  console.log(
    `[Payout] Executing direct transfer → ${amount} ${currency} on ${chain} to developer ${developer} for milestone ${milestone._id}...`
  );

  const transferRes = await executeDirectTransfer(
    developer,
    amount,
    currency,
    chain
  );

  if (!transferRes.success || !transferRes.txHash) {
    const errorMessage = transferRes.error || "No on-chain transaction hash returned from transfer execution.";
    console.error(`[Payout] ❌ Direct payout transfer failed for milestone ${milestone._id}: ${errorMessage}`);

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
