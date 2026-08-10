import crypto from "crypto";

/**
 * Cryptographically verifies GitHub's HMAC-SHA256 signature (x-hub-signature-256 header).
 * Protects against payload tampering and unauthorized webhook spoofing using timing-safe comparison.
 */
export function verifyGithubSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  try {
    const hmac = crypto.createHmac("sha256", secret);
    const digest = `sha256=${hmac.update(rawBody).digest("hex")}`;

    const digestBuffer = Buffer.from(digest);
    const signatureBuffer = Buffer.from(signatureHeader);

    if (digestBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(digestBuffer, signatureBuffer);
  } catch (error) {
    console.error("Error verifying GitHub signature:", error);
    return false;
  }
}

/**
 * Extracts the MergePay Milestone ID from a Pull Request description body.
 * Matches formats:
 *   MergePay-ID: 67a123bc456def
 *   MergePay-ID: [67a123bc456def]
 *   MergePay-ID:67a123bc456def
 */
export function extractMilestoneId(prBody: string | null | undefined): string | null {
  if (!prBody) return null;

  // Regex pattern matching MergePay-ID tag
  const regex = /MergePay-ID:\s*\[?([a-zA-Z0-9_-]+)\]?/i;
  const match = prBody.match(regex);

  return match ? match[1].trim() : null;
}

export interface GithubPullRequestPayload {
  action: string;
  number: number;
  pull_request?: {
    number?: number;
    html_url: string;
    title: string;
    body?: string;
    merged?: boolean;
    merged_by?: {
      login: string;
      id: number;
    };
    user?: {
      login: string;
    };
  };
  repository?: {
    full_name: string;
    name: string;
    owner?: {
      login: string;
    };
  };
}

/**
 * Checks if a GitHub webhook event payload represents a successfully merged Pull Request.
 */
export function isPRMergedEvent(payload: GithubPullRequestPayload): boolean {
  return (
    payload.action === "closed" &&
    Boolean(payload.pull_request?.merged)
  );
}

/**
 * Extracts structured metadata from a Pull Request webhook payload.
 */
export function getPRMergeInfo(payload: GithubPullRequestPayload) {
  const pr = payload.pull_request;
  const repo = payload.repository;

  return {
    prNumber: payload.number || pr?.number || null,
    prTitle: pr?.title || "",
    prUrl: pr?.html_url || "",
    prBody: pr?.body || "",
    mergedBy: pr?.merged_by?.login || null,
    author: pr?.user?.login || null,
    repoFullName: repo?.full_name || "",
  };
}
