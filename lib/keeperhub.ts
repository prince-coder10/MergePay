import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateWorkflowParams {
  milestoneId: string;
  freelancerWallet: string;
  amount: string | number;
  currency?: string;
  chain?: string;
}

export interface PayoutDetailsParams {
  recipient: string;
  amount: string | number;
  currency?: string;
  chain?: string;
}

export interface KeeperHubToolInfo {
  name: string;
  description?: string;
}

export interface KeeperHubResult<T = unknown> {
  success: boolean;
  data?: T;
  workflowId?: string;
  workflowSlug?: string;
  runId?: string;
  txHash?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Cached client singleton
// ---------------------------------------------------------------------------

let cachedClient: Client | null = null;

/**
 * Reset cached client if connection experiences fatal failure or timeout
 */
export function resetKeeperHubClient(): void {
  console.log("[KeeperHub] Resetting cached client instance.");
  cachedClient = null;
}

// ---------------------------------------------------------------------------
// Helper: Parse MCP Tool Response
// ---------------------------------------------------------------------------

/**
 * Helper to safely extract JSON payload and error state from MCP SDK callTool response
 */
function parseMCPToolResponse(response: any): { isError: boolean; data: any; errorMessage?: string } {
  if (!response) {
    return { isError: true, data: null, errorMessage: "No response from KeeperHub MCP server" };
  }

  if (response.isError) {
    const text = response.content?.[0]?.text || "KeeperHub MCP tool returned an error";
    return { isError: true, data: response, errorMessage: text };
  }

  const text = response.content?.[0]?.text;
  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.error) {
        return { isError: true, data: parsed, errorMessage: typeof parsed.error === "string" ? parsed.error : JSON.stringify(parsed.error) };
      }
      return { isError: false, data: parsed };
    } catch {
      if (text.includes("error") || text.includes("404 Not Found") || text.includes("Failed")) {
        return { isError: true, data: text, errorMessage: text };
      }
      return { isError: false, data: text };
    }
  }

  return { isError: false, data: response };
}

// ---------------------------------------------------------------------------
// Tool Discovery (diagnostics)
// ---------------------------------------------------------------------------

/**
 * Calls `client.listTools()` and logs every available tool name + description.
 */
async function discoverTools(client: Client): Promise<KeeperHubToolInfo[]> {
  try {
    const result = await client.listTools();
    const tools: KeeperHubToolInfo[] = (result.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
    }));
    return tools;
  } catch (err) {
    console.error("[KeeperHub] discoverTools() → failed to list tools:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// MCP Connection
// ---------------------------------------------------------------------------

/**
 * Connects to the KeeperHub MCP server using StreamableHTTP with fallback to SSE.
 */
async function getKeeperHubClient(): Promise<Client> {
  if (cachedClient) {
    console.log("[KeeperHub] getKeeperHubClient() → returning cached client.");
    return cachedClient;
  }

  const apiKey = process.env.KEEPERHUB_API_KEY;
  const endpointUrl = process.env.KEEPERHUB_MCP_URL || "https://app.keeperhub.com/mcp";

  console.log(`[KeeperHub] getKeeperHubClient() → endpoint: ${endpointUrl}`);

  if (!apiKey || apiKey === "mock") {
    console.error("[KeeperHub] KEEPERHUB_API_KEY is not configured in .env.local.");
    throw new Error("KEEPERHUB_API_KEY_MISSING");
  }

  const url = new URL(endpointUrl);
  const client = new Client(
    { name: "mergepay", version: "1.0.0" },
    { capabilities: {} },
  );

  // --- Primary: Streamable HTTP Transport ---
  try {
    console.log("[KeeperHub] Attempting StreamableHTTP connection...");
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    });
    await client.connect(transport);
    console.log("[KeeperHub] StreamableHTTP connection established ✓");

    // Run tool discovery once on fresh connection
    await discoverTools(client);

    cachedClient = client;
    return cachedClient;
  } catch (httpErr) {
    console.warn("[KeeperHub] StreamableHTTP connection failed:", httpErr);
  }

  // --- Fallback: SSE Client Transport ---
  try {
    const sseUrl = new URL(process.env.KEEPERHUB_SSE_URL || "https://app.keeperhub.com/sse");
    console.log(`[KeeperHub] Attempting SSE fallback connection → ${sseUrl.toString()}`);
    const sseTransport = new SSEClientTransport(sseUrl, {
      requestInit: {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    });
    await client.connect(sseTransport);
    console.log("[KeeperHub] SSE connection established ✓");

    // Run tool discovery once on fresh connection
    await discoverTools(client);

    cachedClient = client;
    return cachedClient;
  } catch (sseErr) {
    console.error("[KeeperHub] All MCP connection transports failed:", sseErr);
    throw new Error(`Failed to connect to KeeperHub MCP server: ${(sseErr as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Tool wrappers
// ---------------------------------------------------------------------------

/**
 * 1. Creates a payout workflow on KeeperHub using the `create_workflow` tool.
 *    Builds an enabled workflow with a Manual trigger node and a Web3 send/transfer node.
 */
export async function createPayoutWorkflow(
  params: CreateWorkflowParams,
): Promise<KeeperHubResult> {
  const {
    milestoneId,
    freelancerWallet,
    amount,
    currency = "USDC",
    chain = "sepolia",
  } = params;

  const workflowName = `mergepay-payout-${milestoneId}`;
  const workflowDescription = `MergePay automated payout for milestone ${milestoneId} — ${amount} ${currency} on ${chain} → ${freelancerWallet}`;

  const nodes = [
    {
      id: "trigger-manual",
      type: "trigger",
      data: {
        type: "trigger",
        label: "Manual Trigger",
        config: {},
      },
    },
    {
      id: "web3-send",
      type: "action",
      data: {
        type: "action",
        label: "Send Payment",
        config: {
          chain: chain.toLowerCase(),
          amount: amount.toString(),
          currency: currency.toUpperCase(),
          recipient: freelancerWallet,
        },
      },
    },
  ];

  const edges = [
    {
      source: "trigger-manual",
      target: "web3-send",
    },
  ];

  const toolArgs = {
    name: workflowName,
    description: workflowDescription,
    enabled: true,
    nodes,
    edges,
  };

  try {
    const client = await getKeeperHubClient();

    const response = await client.callTool({
      name: "create_workflow",
      arguments: toolArgs,
    });

    const parsed = parseMCPToolResponse(response);
    if (parsed.isError) {
      console.error("[KeeperHub] createPayoutWorkflow() → MCP Error:", parsed.errorMessage);
      return {
        success: false,
        error: parsed.errorMessage,
        data: response,
      };
    }

    const workflowId = parsed.data?.id || parsed.data?.workflowId || parsed.data?.data?.id || parsed.data?.data?.workflowId;
    const workflowSlug = parsed.data?.slug || parsed.data?.data?.slug || parsed.data?.name || workflowName;

    console.log(`[KeeperHub] createPayoutWorkflow() → Parsed SUCCESS! workflowId: "${workflowId}", workflowSlug: "${workflowSlug}"`);

    return {
      success: true,
      workflowId,
      workflowSlug,
      data: parsed.data,
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[KeeperHub] createPayoutWorkflow() → ERROR:", err);
    resetKeeperHubClient();
    return {
      success: false,
      error: err.message || "Failed to create workflow on KeeperHub",
    };
  }
}

/**
 * Updates an existing workflow's recipient wallet address and enables it when a developer claims the milestone.
 */
export async function updatePayoutWorkflowRecipient(
  workflowId: string,
  recipientAddress: string,
  amount: string | number,
  currency = "USDC",
  chain = "sepolia",
): Promise<KeeperHubResult> {
  console.log(`[KeeperHub] updatePayoutWorkflowRecipient() → workflowId: ${workflowId}, recipient: ${recipientAddress}`);

  const nodes = [
    {
      id: "trigger-manual",
      type: "trigger",
      data: {
        type: "trigger",
        label: "Manual Trigger",
        config: {},
      },
    },
    {
      id: "web3-send",
      type: "action",
      data: {
        type: "action",
        label: "Send Payment",
        config: {
          chain: chain.toLowerCase(),
          amount: amount.toString(),
          currency: currency.toUpperCase(),
          recipient: recipientAddress,
        },
      },
    },
  ];

  const edges = [
    {
      source: "trigger-manual",
      target: "web3-send",
    },
  ];

  try {
    const client = await getKeeperHubClient();
    const response = await client.callTool({
      name: "update_workflow",
      arguments: {
        workflowId,
        enabled: true,
        nodes,
        edges,
      },
    });

    console.log("[KeeperHub] updatePayoutWorkflowRecipient() response:", JSON.stringify(response, null, 2));
    const parsed = parseMCPToolResponse(response);
    return {
      success: !parsed.isError,
      data: parsed.data,
      error: parsed.errorMessage,
    };
  } catch (err: any) {
    console.error("[KeeperHub] updatePayoutWorkflowRecipient() ERROR:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Direct transfer helper using `execute_transfer` tool.
 * Directly transfers ETH or ERC20 tokens on-chain from KeeperHub's connected wallet.
 */
export async function executeDirectTransfer(
  recipient: string,
  amount: string | number,
  currency = "ETH",
  chain = "sepolia",
): Promise<KeeperHubResult> {
  console.log(`[KeeperHub] executeDirectTransfer() → recipient: ${recipient}, amount: ${amount} ${currency} on ${chain}`);

  try {
    // Map chain names to chain IDs
    const chainIdMap: Record<string, string> = {
      sepolia: "11155111",
      mainnet: "1",
      ethereum: "1",
      polygon: "137",
      arbitrum: "42161",
      optimism: "10",
      base: "8453",
    };
    const chainId = chainIdMap[chain.toLowerCase()] || chain;

    const client = await getKeeperHubClient();
    console.log(`[KeeperHub] executeDirectTransfer() → calling execute_transfer with: { to_address: "${recipient}", amount: "${amount.toString()}", token: "${currency.toUpperCase()}", chain_id: "${chainId}" }`);
    const response = await client.callTool({
      name: "execute_transfer",
      arguments: {
        to_address: recipient,
        amount: amount.toString(),
        token: currency.toUpperCase(),
        chain_id: chainId,
      },
    });

    const parsed = parseMCPToolResponse(response);

    if (parsed.isError) {
      console.error("[KeeperHub] executeDirectTransfer() MCP Error:", parsed.errorMessage);
      return { success: false, error: parsed.errorMessage, data: response };
    }

    let txHash = parsed.data?.txHash || parsed.data?.hash || parsed.data?.transactionHash || undefined;
    const runId = parsed.data?.executionId || parsed.data?.id || `transfer-${Date.now()}`;

    // execute_transfer may be async — poll get_direct_execution_status if we have an executionId but no txHash
    if (!txHash && runId && runId !== `transfer-${Date.now()}`) {
      console.log(`[KeeperHub] executeDirectTransfer() → No immediate txHash. Polling get_direct_execution_status (executionId: ${runId})...`);
      for (let attempt = 1; attempt <= 6; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        try {
          const statusRes = await client.callTool({
            name: "get_direct_execution_status",
            arguments: { executionId: runId },
          });
          const statusParsed = parseMCPToolResponse(statusRes);
          if (statusParsed.data?.transactionHash || statusParsed.data?.txHash || statusParsed.data?.hash) {
            txHash = statusParsed.data.transactionHash || statusParsed.data.txHash || statusParsed.data.hash;
            console.log(`[KeeperHub] executeDirectTransfer() → txHash retrieved from polling: ${txHash}`);
            break;
          }
          if (statusParsed.data?.status === "failed" || statusParsed.data?.status === "error") {
            console.error(`[KeeperHub] executeDirectTransfer() → Execution failed:`, statusParsed.data);
            return { success: false, error: `Direct transfer execution failed: ${statusParsed.data?.error || "unknown error"}`, data: statusParsed.data };
          }
        } catch (pollErr) {
          console.warn(`[KeeperHub] get_direct_execution_status poll attempt ${attempt} error:`, pollErr);
        }
      }
    }

    if (!txHash) {
      return { success: false, error: "execute_transfer completed without returning an on-chain txHash", data: parsed.data };
    }

    console.log(`[KeeperHub] executeDirectTransfer() SUCCESS! txHash: ${txHash}, runId: ${runId}`);

    return {
      success: true,
      runId,
      txHash,
      data: parsed.data,
    };
  } catch (err: any) {
    console.error("[KeeperHub] executeDirectTransfer() ERROR:", err);
    return { success: false, error: err.message };
  }
}

/**
 * 2. Triggers execution of a workflow via `execute_workflow` (or `execute_transfer` fallback).
 *    Strictly requires an on-chain transaction hash (`txHash`) to return `success: true`.
 */
export async function triggerPayoutWorkflow(
  workflowIdentifier: string,
  inputs: Record<string, unknown> = {},
  payoutDetails?: PayoutDetailsParams,
): Promise<KeeperHubResult> {
  console.log("[KeeperHub] triggerPayoutWorkflow() → target identifier:", workflowIdentifier);

  const tryExecute = async (isRetry = false): Promise<KeeperHubResult> => {
    try {
      if (isRetry) {
        console.log("[KeeperHub] Connection retry triggered. Resetting cached client and reconnecting...");
        resetKeeperHubClient();
      }

      const client = await getKeeperHubClient();

      // 1. Ensure workflow is enabled before execution
      if (workflowIdentifier.length > 10) {
        try {
          if (payoutDetails?.recipient && payoutDetails.recipient.startsWith("0x")) {
            console.log(`[KeeperHub] Pre-enabling and updating recipient for workflow ${workflowIdentifier}...`);
            await updatePayoutWorkflowRecipient(
              workflowIdentifier,
              payoutDetails.recipient,
              payoutDetails.amount,
              payoutDetails.currency || "ETH",
              payoutDetails.chain || "sepolia",
            );
          }
        } catch (e) {
          console.warn("[KeeperHub] Could not pre-enable workflow:", e);
        }
      }

      // 2. Primary Tool for private workflows created by ID: execute_workflow
      console.log(`[KeeperHub] Calling execute_workflow with workflowId: "${workflowIdentifier}"...`);
      let response = await client.callTool({
        name: "execute_workflow",
        arguments: { workflowId: workflowIdentifier },
      });

      let parsed = parseMCPToolResponse(response);

      // 3. Fallback Tool for marketplace / slug workflows: call_workflow
      if (parsed.isError && (parsed.errorMessage?.includes("404") || parsed.errorMessage?.includes("not found"))) {
        console.log("[KeeperHub] execute_workflow returned 404/not found. Trying call_workflow with slug...");
        response = await client.callTool({
          name: "call_workflow",
          arguments: { slug: workflowIdentifier, inputs },
        });
        parsed = parseMCPToolResponse(response);
      }

      let executionId = parsed.data?.executionId || parsed.data?.runId || parsed.data?.id;
      let txHash = parsed.data?.txHash || parsed.data?.transactionHash || parsed.data?.hash || undefined;

      // 4. Poll get_execution to fetch verified on-chain transaction hashes
      if (executionId && !txHash) {
        console.log(`[KeeperHub] Polling get_execution for verified on-chain receipts (executionId: ${executionId})...`);
        for (let attempt = 1; attempt <= 10; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          const execRes = await getExecution(executionId);
          const execData = execRes.data as any;
          // Safely stringify status for logging (it may be an object)
          const statusStr = typeof execData?.status === "object" && execData?.status !== null
            ? JSON.stringify(execData.status)
            : String(execData?.status ?? "unknown");
          console.log(`[KeeperHub] get_execution poll attempt ${attempt}: status=${statusStr}, txHash=${execRes.txHash || "none"}`);
          if (execRes.txHash) {
            txHash = execRes.txHash;
            console.log(`[KeeperHub] Verified on-chain txHash retrieved from workflow execution: ${txHash}`);
            break;
          }
          // Normalize status for comparison — handle both string and object {status: "..."}  forms
          const normalizedStatus = typeof execData?.status === "string"
            ? execData.status
            : typeof execData?.status === "object" && execData?.status?.status
              ? execData.status.status
              : null;
          // Stop polling early if execution completed/failed without txHash
          if (normalizedStatus === "success" || normalizedStatus === "completed" || normalizedStatus === "failed" || normalizedStatus === "error") {
            console.log(`[KeeperHub] Execution finalized with status: ${normalizedStatus} (no txHash)`);
            break;
          }
        }
      }

      // 5. STRICT ON-CHAIN VERIFICATION CHECK:
      // If workflow execution did not produce a verified on-chain txHash, fail strictly.
      // Do NOT execute silent direct transfer fallbacks which bypass workflow validation.
      if (!txHash) {
        const errorMsg = parsed.errorMessage || "Workflow execution failed or did not return a verified on-chain transaction hash.";
        console.error(`[KeeperHub] ❌ Workflow execution failed: ${errorMsg}`);
        return {
          success: false,
          error: errorMsg,
          runId: executionId,
          data: parsed.data,
        };
      }

      return {
        success: true,
        runId: executionId,
        txHash,
        data: parsed.data,
      };
    } catch (error: unknown) {
      const err = error as Error;

      // Auto-retry once on connection timeout
      if (!isRetry && (err.message.includes("fetch failed") || err.message.includes("Timeout") || err.message.includes("connection"))) {
        console.warn("[KeeperHub] Transport timeout detected. Retrying once with a fresh MCP connection...");
        return await tryExecute(true);
      }

      console.error("[KeeperHub] triggerPayoutWorkflow() → ERROR:", err);
      resetKeeperHubClient();
      return {
        success: false,
        error: err.message || "Failed to trigger workflow on KeeperHub",
      };
    }
  };

  return await tryExecute(false);
}

/**
 * Fetches execution logs and status using the `get_execution` tool.
 * Deeply searches the response for txHash across all known paths.
 */
export async function getExecution(executionId: string): Promise<KeeperHubResult> {
  console.log(`[KeeperHub] getExecution() → executionId: ${executionId}`);

  try {
    const client = await getKeeperHubClient();
    const response = await client.callTool({
      name: "get_execution",
      arguments: { executionId },
    });

    const parsed = parseMCPToolResponse(response);
    if (parsed.isError) {
      return { success: false, error: parsed.errorMessage, data: response };
    }

    let txHash: string | undefined = undefined;

    // Deep search helper: recursively find txHash-like fields in any object
    function deepFindTxHash(obj: any, depth = 0): string | undefined {
      if (!obj || typeof obj !== "object" || depth > 5) return undefined;
      // Direct field checks
      if (typeof obj.txHash === "string" && obj.txHash.startsWith("0x")) return obj.txHash;
      if (typeof obj.transactionHash === "string" && obj.transactionHash.startsWith("0x")) return obj.transactionHash;
      if (typeof obj.hash === "string" && obj.hash.startsWith("0x")) return obj.hash;
      if (typeof obj.tx_hash === "string" && obj.tx_hash.startsWith("0x")) return obj.tx_hash;
      // Check transactionHashes array
      if (Array.isArray(obj.transactionHashes)) {
        for (const th of obj.transactionHashes) {
          if (typeof th === "string" && th.startsWith("0x")) return th;
          if (typeof th?.hash === "string" && th.hash.startsWith("0x")) return th.hash;
          if (typeof th?.txHash === "string" && th.txHash.startsWith("0x")) return th.txHash;
        }
      }
      // Recurse into arrays and objects
      if (Array.isArray(obj)) {
        for (const item of obj) {
          const found = deepFindTxHash(item, depth + 1);
          if (found) return found;
        }
      } else {
        for (const key of Object.keys(obj)) {
          const found = deepFindTxHash(obj[key], depth + 1);
          if (found) return found;
        }
      }
      return undefined;
    }

    // Search the entire parsed data for a txHash
    txHash = deepFindTxHash(parsed.data);

    if (txHash) {
      console.log(`[KeeperHub] getExecution() → found txHash via deep search: ${txHash}`);
    } else {
      console.log(`[KeeperHub] getExecution() → no txHash found in response data`);
    }

    return {
      success: true,
      data: parsed.data,
      runId: executionId,
      txHash,
    };
  } catch (err: any) {
    console.error("[KeeperHub] getExecution() ERROR:", err);
    return { success: false, error: err.message };
  }
}

/**
 * 3. Fetches details / status for a specific workflow via the `get_workflow` tool.
 */
export async function getWorkflow(
  workflowId: string,
): Promise<KeeperHubResult> {
  const toolArgs = { workflowId };

  console.log("[KeeperHub] getWorkflow() → workflowId:", workflowId);

  try {
    const client = await getKeeperHubClient();

    const response = await client.callTool({
      name: "get_workflow",
      arguments: toolArgs,
    });

    const parsed = parseMCPToolResponse(response);
    if (parsed.isError) {
      return { success: false, error: parsed.errorMessage, data: response };
    }

    return {
      success: true,
      data: parsed.data,
    };
  } catch (error: unknown) {
    const err = error as Error;
    resetKeeperHubClient();
    return {
      success: false,
      error: err.message || "Failed to fetch workflow from KeeperHub",
    };
  }
}

/**
 * 4. Lists all workflows registered under the API key via `list_workflows`.
 */
export async function listWorkflows(): Promise<KeeperHubResult> {
  console.log("[KeeperHub] listWorkflows() → calling list_workflows...");

  try {
    const client = await getKeeperHubClient();

    const response = await client.callTool({
      name: "list_workflows",
      arguments: {},
    });

    const parsed = parseMCPToolResponse(response);
    if (parsed.isError) {
      return { success: false, error: parsed.errorMessage, data: response };
    }

    return {
      success: true,
      data: parsed.data,
    };
  } catch (error: unknown) {
    const err = error as Error;
    resetKeeperHubClient();
    return {
      success: false,
      error: err.message || "Failed to list workflows",
    };
  }
}
