import mongoose, { Schema, Document } from "mongoose";

export interface IMilestone extends Document {
  title: string;
  description?: string;
  amount: number;
  currency: "USDC" | "ETH";
  status: "awaiting_claim" | "active" | "in_review" | "processing" | "failed" | "paid";
  repo: string; // Format: owner/repo
  githubWebhookSecret: string; // Secret for verifying webhook payload
  clientGithubUsername?: string; // Client's GitHub username for merge authorization
  client: string; // Wallet address referencing User (the funder)
  developer?: string; // Wallet address referencing User (set when developer claims)
  developerGithubUsername?: string; // Developer's GitHub handle
  prNumber?: number; // Added once PR is tagged
  prUrl?: string;
  workflowId?: string; // KeeperHub workflow ID
  workflowSlug?: string; // KeeperHub workflow slug
  runId?: string; // KeeperHub execution run ID
  txHash?: string; // Blockchain transaction hash for on-chain proof
  depositTxHash?: string; // Client deposit transaction hash
  lastError?: string; // Last error message if payout failed
  failedAt?: Date; // Timestamp of last payout failure
  retryCount?: number; // Number of failed payout retry attempts
  createdAt: Date;
  updatedAt: Date;
}

const MilestoneSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    amount: { type: Number, required: true },
    currency: {
      type: String,
      required: true,
      enum: ["USDC", "ETH"],
      default: "USDC",
    },
    status: {
      type: String,
      required: true,
      enum: ["awaiting_claim", "active", "in_review", "processing", "failed", "paid"],
      default: "awaiting_claim",
    },
    repo: { type: String, required: true },
    githubWebhookSecret: { type: String, required: true },
    clientGithubUsername: { type: String },
    client: { type: String, ref: "User", required: true },
    developer: { type: String, ref: "User" },
    developerGithubUsername: { type: String },
    prNumber: { type: Number },
    prUrl: { type: String },
    workflowId: { type: String },
    workflowSlug: { type: String },
    runId: { type: String },
    txHash: { type: String },
    depositTxHash: { type: String },
    lastError: { type: String },
    failedAt: { type: Date },
    retryCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Reset cached model in Next.js hot reload if schema fields/enums changed
if (process.env.NODE_ENV === "development" && mongoose.models.Milestone) {
  delete (mongoose.models as any).Milestone;
}

export default mongoose.models.Milestone ||
  mongoose.model<IMilestone>("Milestone", MilestoneSchema);
