import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Milestone from "@/models/Milestone";
import {
  verifyGithubSignature,
  extractMilestoneId,
  isPRMergedEvent,
  getPRMergeInfo,
} from "@/lib/github";
import { triggerPayoutWorkflow, updatePayoutWorkflowRecipient } from "@/lib/keeperhub";

import { executeMilestonePayout } from "@/lib/payout";

export async function POST(req: Request) {
  try {
    // 1. Extract raw request data and headers
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature-256");
    const eventType = req.headers.get("x-github-event");
    const deliveryId = req.headers.get("x-github-delivery");

    // 2. Parse payload
    if (!rawBody) {
      console.warn("[Webhook] Rejected: empty payload body");
      return NextResponse.json(
        { error: "Empty payload body" },
        { status: 400 }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.warn("[Webhook] Rejected: invalid JSON payload");
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    console.log(`[Webhook] Received ${eventType} from ${payload.repository?.full_name} (delivery: ${deliveryId})`);

    // Handle GitHub ping event
    if (eventType === "ping") {
      console.log("[Webhook] Ping received, responding with pong");
      return NextResponse.json({ success: true, message: "PONG! MergePay webhook active." });
    }

    // 3. Check if this is a merged PR event
    if (!isPRMergedEvent(payload)) {
      console.log(`[Webhook] Ignored: action="${payload.action}", merged=${payload.pull_request?.merged}`);
      return NextResponse.json(
        { ignored: true, reason: "Event is not a merged pull request" },
        { status: 200 }
      );
    }

    const prInfo = getPRMergeInfo(payload);
    const prNumber = prInfo.prNumber;
    const mergedBy = prInfo.mergedBy || payload.pull_request?.merged_by?.login;
    console.log(`[Webhook] PR #${prNumber} merged by @${mergedBy}`);

    // 4. Extract MergePay-ID from PR body
    const milestoneId = extractMilestoneId(prInfo.prBody);
    if (!milestoneId) {
      console.log("[Webhook] Ignored: no MergePay-ID tag in PR body");
      return NextResponse.json(
        { ignored: true, reason: "No MergePay-ID tag found in PR body" },
        { status: 200 }
      );
    }
    console.log(`[Webhook] MergePay-ID: ${milestoneId}`);

    // 5. Look up milestone in database
    await dbConnect();
    const milestone = await Milestone.findById(milestoneId);

    if (!milestone) {
      console.warn(`[Webhook] Milestone not found: ${milestoneId}`);
      return NextResponse.json(
        { error: `Milestone not found for ID: ${milestoneId}` },
        { status: 404 }
      );
    }
    console.log(`[Webhook] Milestone found: ${milestone.title} (${milestone.status})`);

    // 6. Verify GitHub HMAC-SHA256 signature
    const isValidSignature = verifyGithubSignature(
      rawBody,
      signatureHeader,
      milestone.githubWebhookSecret
    );

    if (!isValidSignature) {
      console.warn(`[Webhook] Signature verification failed for milestone ${milestoneId}`);
      return NextResponse.json(
        { error: "Invalid cryptographic signature. Webhook rejected." },
        { status: 401 }
      );
    }
    console.log("[Webhook] Signature verified ✓");

    // 7. Verify the merger is the authorized client
    const requiredClientGithub = milestone.clientGithubUsername;

    if (requiredClientGithub && mergedBy) {
      if (mergedBy.toLowerCase() !== requiredClientGithub.toLowerCase()) {
        console.warn(`[Webhook] Unauthorized merger @${mergedBy}, expected @${requiredClientGithub}`);
        return NextResponse.json(
          {
            error: `Unauthorized merger. Only @${requiredClientGithub} can authorize payouts by merging the PR.`,
          },
          { status: 403 }
        );
      }
    }

    // 8. Atomically claim this milestone for processing.
    // If another request already claimed it (status is "processing" or "paid"), this returns null and we bail.
    const claimedMilestone = await Milestone.findOneAndUpdate(
      { _id: milestoneId, status: { $nin: ["processing", "paid"] } },
      {
        $set: {
          status: "processing",
          prNumber: prInfo.prNumber || milestone.prNumber,
          prUrl: prInfo.prUrl || milestone.prUrl,
        },
      },
      { new: true }
    );

    if (!claimedMilestone) {
      console.log(`[Webhook] Skipped: milestone ${milestoneId} already processing or paid`);
      return NextResponse.json(
        {
          success: true,
          message: "Milestone is already being processed or has been paid.",
        },
        { status: 200 }
      );
    }

    console.log(`[Webhook] Atomically claimed milestone ${milestoneId} -> status: processing`);

    // 9. Execute payout via shared executeMilestonePayout helper
    const payoutResult = await executeMilestonePayout(claimedMilestone);

    if (!payoutResult.success) {
      return NextResponse.json(
        {
          error: `Payout execution failed on-chain: ${payoutResult.error}`,
          milestone: {
            id: claimedMilestone._id,
            status: claimedMilestone.status,
            lastError: claimedMilestone.lastError,
            retryCount: claimedMilestone.retryCount,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "PR merge confirmed. Payout workflow executed via KeeperHub.",
      milestone: {
        id: claimedMilestone._id,
        status: claimedMilestone.status,
        amount: claimedMilestone.amount,
        currency: claimedMilestone.currency,
        developer: claimedMilestone.developer,
        prNumber: claimedMilestone.prNumber,
        prUrl: claimedMilestone.prUrl,
        runId: claimedMilestone.runId,
        txHash: claimedMilestone.txHash,
      },
      keeperHubResponse: payoutResult.keeperHubData,
    });
  } catch (error: any) {
    console.error("[Webhook] Processing error:", error.message);
    console.error("[Webhook] Stack:", error.stack);

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
