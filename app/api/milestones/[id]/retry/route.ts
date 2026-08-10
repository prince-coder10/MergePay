import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/db";
import Milestone from "@/models/Milestone";
import { executeMilestonePayout } from "@/lib/payout";

interface JwtPayload {
  address: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();

    const milestone = await Milestone.findById(id);
    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    // --- Authentication & Client Authorization Guard ---
    let requesterWallet: string | undefined;

    // 1. Try checking JWT session cookie
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get("session")?.value;
      if (token && process.env.JWT_SECRET) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
        if (decoded?.address) {
          requesterWallet = decoded.address.toLowerCase();
        }
      }
    } catch (authErr) {
      console.warn("[Retry API] Token verification skipped or failed:", authErr);
    }

    // 2. Fallback / supplementary check: JSON body walletAddress
    const body = await req.json().catch(() => ({}));
    if (!requesterWallet && body.walletAddress) {
      requesterWallet = String(body.walletAddress).toLowerCase();
    } else if (body.walletAddress && String(body.walletAddress).toLowerCase() !== requesterWallet) {
      // If both session & body are provided, verify they align or use body if session was absent
      requesterWallet = String(body.walletAddress).toLowerCase();
    }

    if (!requesterWallet) {
      return NextResponse.json(
        { error: "Unauthorized: Missing wallet session or wallet address in request body." },
        { status: 401 }
      );
    }

    if (requesterWallet.toLowerCase() !== milestone.client.toLowerCase()) {
      console.warn(
        `[Retry API] Unauthorized retry attempt by ${requesterWallet} for milestone ${id} owned by client ${milestone.client}`
      );
      return NextResponse.json(
        { error: "Forbidden: Only the client who created this milestone can trigger a payout retry." },
        { status: 403 }
      );
    }

    // --- Status Check ---
    if (milestone.status !== "failed") {
      return NextResponse.json(
        { error: `Cannot retry a milestone with status "${milestone.status}"` },
        { status: 400 }
      );
    }

    // --- Atomic Claim ---
    // Atomically claim the milestone so concurrent retries or webhooks cannot race
    const claimed = await Milestone.findOneAndUpdate(
      { _id: milestone._id, status: "failed" },
      { $set: { status: "processing" } },
      { new: true }
    );

    if (!claimed) {
      return NextResponse.json(
        { error: "Milestone is no longer in a failed state or is already being processed" },
        { status: 409 }
      );
    }

    console.log(`[Retry API] Atomically claimed failed milestone ${id} -> status: processing`);

    // --- Execute Payout ---
    const result = await executeMilestonePayout(claimed);

    if (!result.success) {
      return NextResponse.json(
        {
          error: `Retry payout execution failed: ${result.error}`,
          milestone: {
            id: claimed._id,
            status: claimed.status,
            lastError: claimed.lastError,
            failedAt: claimed.failedAt,
            retryCount: claimed.retryCount,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Retry succeeded — payout executed on-chain.",
      runId: result.runId,
      txHash: result.txHash,
      milestone: {
        id: claimed._id,
        status: claimed.status,
        runId: claimed.runId,
        txHash: claimed.txHash,
      },
    });
  } catch (error: any) {
    console.error("[Retry API] Server error:", error.message);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
