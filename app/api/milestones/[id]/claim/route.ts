import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Milestone from "@/models/Milestone";
import User from "@/models/User";
import { updatePayoutWorkflowRecipient } from "@/lib/keeperhub";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Milestone ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { developerAddress, developerGithubUsername } = body;

    if (!developerAddress) {
      return NextResponse.json(
        { error: "Developer wallet address is required to claim escrow" },
        { status: 400 }
      );
    }

    if (!developerAddress.startsWith("0x") || developerAddress.length !== 42) {
      return NextResponse.json(
        { error: "Please enter a valid Ethereum wallet address (0x...)" },
        { status: 400 }
      );
    }

    const normalizedDevAddress = developerAddress.toLowerCase();

    await dbConnect();

    const milestone = await Milestone.findById(id);
    if (!milestone) {
      return NextResponse.json(
        { error: "Milestone not found" },
        { status: 404 }
      );
    }

    if (milestone.status === "paid") {
      return NextResponse.json(
        { error: "This milestone has already been settled and paid." },
        { status: 400 }
      );
    }

    // Guard 1: Prevent client from claiming their own milestone using their client wallet address
    if (milestone.client && normalizedDevAddress === milestone.client.toLowerCase()) {
      return NextResponse.json(
        { error: "Client wallet address cannot claim their own milestone as a developer." },
        { status: 400 }
      );
    }

    // Guard 2: Prevent developer from using the client's GitHub username
    if (
      developerGithubUsername &&
      milestone.clientGithubUsername &&
      developerGithubUsername.trim().toLowerCase() === milestone.clientGithubUsername.trim().toLowerCase()
    ) {
      return NextResponse.json(
        { error: `Developer GitHub username cannot be the same as the client's GitHub username (@${milestone.clientGithubUsername}).` },
        { status: 400 }
      );
    }

    // Ensure developer user document exists
    let devUser = await User.findById(normalizedDevAddress);
    if (!devUser) {
      devUser = await User.create({ _id: normalizedDevAddress });
    }

    // Update milestone with developer details and set status to active
    milestone.developer = normalizedDevAddress;
    if (developerGithubUsername) {
      milestone.developerGithubUsername = developerGithubUsername.trim();
    }
    milestone.status = "active";
    await milestone.save();

    console.log(
      `Milestone ${id} claimed by developer ${normalizedDevAddress} (@${developerGithubUsername || "N/A"})`
    );

    // Update KeeperHub workflow recipient address
    if (milestone.workflowId) {
      try {
        await updatePayoutWorkflowRecipient(
          milestone.workflowId,
          normalizedDevAddress,
          milestone.amount,
          milestone.currency
        );
      } catch (khErr) {
        console.warn("[Claim API] Failed to update KeeperHub workflow recipient:", khErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Milestone claimed successfully! Status updated to active.",
      milestone,
    });
  } catch (error: any) {
    console.error("Claim milestone error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
