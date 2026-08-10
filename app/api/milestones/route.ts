import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/db";
import Milestone from "@/models/Milestone";
import User from "@/models/User";
import { createPayoutWorkflow } from "@/lib/keeperhub";

interface JwtPayload {
  address: string;
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: Please connect wallet and log in" },
        { status: 401 }
      );
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    } catch {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or expired session" },
        { status: 401 }
      );
    }

    const clientAddress = decoded.address.toLowerCase();

    const body = await req.json();
    const { title, description, amount, currency, repo, clientGithubUsername, developer, depositTxHash } = body;

    if (!title || !amount || !repo) {
      return NextResponse.json(
        { error: "Missing required fields: title, amount, repo" },
        { status: 400 }
      );
    }

    if (!depositTxHash) {
      return NextResponse.json(
        { error: "Missing required deposit transaction hash (depositTxHash)" },
        { status: 400 }
      );
    }

    const txHashRegex = /^0x[a-fA-F0-9]{64}$/;
    if (!txHashRegex.test(depositTxHash)) {
      return NextResponse.json(
        { error: "Invalid deposit transaction hash format" },
        { status: 400 }
      );
    }

    const developerAddress = developer ? developer.toLowerCase() : undefined;

    await dbConnect();

    // Ensure client user exists
    let clientUser = await User.findById(clientAddress);
    if (!clientUser) {
      clientUser = await User.create({ _id: clientAddress });
    }

    // Ensure developer user exists if provided
    if (developerAddress) {
      let devUser = await User.findById(developerAddress);
      if (!devUser) {
        await User.create({ _id: developerAddress });
      }
    }

    // Generate 256-bit webhook secret
    const githubWebhookSecret = crypto.randomBytes(32).toString("hex");

    // Create the milestone
    const milestone = await Milestone.create({
      title,
      description: description || "",
      amount: Number(amount),
      currency: currency || "USDC",
      repo: repo.trim(),
      githubWebhookSecret,
      clientGithubUsername: clientGithubUsername ? clientGithubUsername.trim() : undefined,
      client: clientAddress,
      developer: developerAddress,
      status: developerAddress ? "active" : "awaiting_claim",
      depositTxHash,
    });

    // Register dormant payout workflow on KeeperHub
    try {
      const keeperRes = await createPayoutWorkflow({
        milestoneId: milestone._id.toString(),
        freelancerWallet: developerAddress || "pending_claim",
        amount: Number(amount),
        currency: currency || "USDC",
      });

      if (keeperRes.success) {
        if (keeperRes.workflowId) {
          milestone.workflowId = keeperRes.workflowId;
        }
        if (keeperRes.workflowSlug) {
          milestone.workflowSlug = keeperRes.workflowSlug;
        }
        await milestone.save();
        console.log(`[Milestone API] Saved milestone ${milestone._id} -> workflowId: "${milestone.workflowId}", workflowSlug: "${milestone.workflowSlug}"`);
      }
    } catch (khErr) {
      console.warn("Could not register KeeperHub workflow during creation:", khErr);
    }

    return NextResponse.json({ success: true, milestone });
  } catch (error: any) {
    console.error("❌ Create milestone server error:", error);
    if (error.name === "ValidationError") {
      console.error("Mongoose Validation Error details:", error.errors);
      return NextResponse.json(
        { error: `Validation error: ${error.message}`, details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Internal server error", stack: error.stack },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    } catch {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userAddress = decoded.address.toLowerCase();

    await dbConnect();

    // Fetch milestones where user is client or developer
    const milestones = await Milestone.find({
      $or: [{ client: userAddress }, { developer: userAddress }],
    })
      .sort({ createdAt: -1 })
      .lean();

    // Calculate analytics stats
    const totalMilestones = milestones.length;

    let pendingUsdc = 0;
    let pendingEth = 0;
    let paidUsdc = 0;
    let paidEth = 0;
    let monthUsdc = 0;
    let monthEth = 0;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    milestones.forEach((m: any) => {
      const amt = Number(m.amount) || 0;
      const isPaid = m.status === "paid";
      const isPending = m.status === "pending" || m.status === "in_progress";

      if (isPending) {
        if (m.currency === "ETH") pendingEth += amt;
        else pendingUsdc += amt;
      }

      if (isPaid) {
        if (m.currency === "ETH") paidEth += amt;
        else paidUsdc += amt;

        const updatedDate = new Date(m.updatedAt || m.createdAt);
        if (
          updatedDate.getFullYear() === currentYear &&
          updatedDate.getMonth() === currentMonth
        ) {
          if (m.currency === "ETH") monthEth += amt;
          else monthUsdc += amt;
        }
      }
    });

    const formatStatCurrency = (usdc: number, eth: number) => {
      const parts = [];
      if (usdc > 0 || (usdc === 0 && eth === 0)) {
        parts.push(
          `${usdc.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} USDC`
        );
      }
      if (eth > 0) {
        parts.push(`${eth.toFixed(4)} ETH`);
      }
      return parts.join(" + ");
    };

    const stats = {
      totalMilestones,
      pendingAmount: formatStatCurrency(pendingUsdc, pendingEth),
      totalPaid: formatStatCurrency(paidUsdc, paidEth),
      paidThisMonth: formatStatCurrency(monthUsdc, monthEth),
    };

    return NextResponse.json({ success: true, milestones, stats });
  } catch (error) {
    console.error("Get milestones error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
