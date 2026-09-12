import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { ethers } from "ethers";
import { CreateTradeIntentRequest } from "../../../../types/schema";

function createServer(apiToken: string) {
  const server = new McpServer({
    name: "todo-mcp-server",
    version: "1.0.0",
  });

  // submit trade intent to MCP server
  server.registerTool(
    "post-trade-intent",
    {
      title: "Post Trade Intent",
      description: "Post a trade intent to the MCP server",
      inputSchema: {
        chainId: z.number().describe("Chain ID of the blockchain network"),
        tokenIn: z.string().describe("Address of the input token for swap"),
        tokenOut: z.string().describe("Address of the output token for swap"),
        amountIn: z.number().describe("Amount of input token to swap"),
        minAmountOut: z
          .number()
          .describe("Minimum amount of output token to receive"),
        deadline: z
          .string()
          .describe("Deadline for the trade in ISO 8601 format"),
        maxPremium: z
          .number()
          .describe("Maximum premium to pay for the trade insurance"),
        minCoverage: z
          .number()
          .describe(
            "Minimum coverage required for the trade insurance in percentage (1-100)",
          ),
        minCoverageDuration: z
          .bigint()
          .describe("Minimum duration of the coverage in seconds"),
      },
    },
    async ({
      chainId,
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      deadline,
      maxPremium,
      minCoverage,
      minCoverageDuration,
    }) => {
      try {
        const decoded = verifyToken(apiToken);
        const { userId, agentId } = decoded as {
          userId: string;
          agentId?: string;
        };
        const agent = await prisma.agent.findFirst({
          where: {
            userId: userId,
            id: agentId,
          },
        });

        if (!agent) {
          return {
            content: [
              {
                type: "text",
                text: "Agent not found for the provided userId and agentId",
              },
            ],
            isError: true,
          };
        }

        // sign the trade data with the agent's private key
        const tradeData = {
          chainId,
          tokenIn,
          tokenOut,
          amountIn,
          minAmountOut,
          deadline,
          maxPremium,
          minCoverage,
          minCoverageDuration,
        };

        const agentWallet = new ethers.Wallet(agent.privateKey);
        const signedTradeData = await agentWallet.signMessage(
          JSON.stringify(tradeData),
        );

        const createTradeIntentRequest: CreateTradeIntentRequest = {
          userAddress: agent.address,
          agentAddress: agent.address,
          vaultAddress: agent.vaultAddress,
          chainId,
          tokenIn,
          tokenOut,
          amountIn,
          minAmountOut,
          deadline,
          maxPremium,
          minCoverage,
          minCoverageDuration,
          signature: signedTradeData,
        };

        const res = await fetch(`${env.BASE_URL}/trade-intent`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(createTradeIntentRequest),
        });

        if (!res.ok) {
          return {
            content: [
              {
                type: "text",
                text: `API returned ${res.status} ${res.statusText}`,
              },
            ],
            isError: true,
          };
        }

        const data = await res.json();

        return {
          content: [
            {
              type: "text",
              text: `Trade intent created successfully: ${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to reach trade intent API: ${
                err instanceof Error ? err.message : String(err)
              }`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // get token balance of a particular token in the vault
  server.registerTool(
    "get-token-balance",
    {
      title: "get balance of any paticular token",
      description: "Get the balance of a specific token in the vault",
      inputSchema: {
        chainId: z.number().describe("Chain ID of the blockchain network"),
        tokenAddress: z
          .string()
          .describe("Address of the token to check balance"),
      },
    },
    async ({ chainId, tokenAddress }) => {
      try {
        const decoded = verifyToken(apiToken);
        const { userId, agentId } = decoded as {
          userId: string;
          agentId?: string;
        };
        const agent = await prisma.agent.findFirst({
          where: {
            userId: userId,
            id: agentId,
          },
        });

        if (!agent) {
          return {
            content: [
              {
                type: "text",
                text: "Agent not found for the provided userId and agentId",
              },
            ],
            isError: true,
          };
        }

        // get vault address from agent
        const vaultAddress = agent.vaultAddress;

        // fetch the balance from the vault API
        const res = await fetch(
          `${env.BASE_URL}/vault/get-vault-balance?vaultAddress=${vaultAddress}&chainId=${chainId}&asset=${tokenAddress}`,
          {
            method: "GET",
          },
        );

        if (!res.ok) {
          return {
            content: [
              {
                type: "text",
                text: `API returned ${res.status} ${res.statusText}`,
              },
            ],
            isError: true,
          };
        }

        const data = await res.json();

        return {
          content: [
            {
              type: "text",
              text: `Token balance fetched successfully: ${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get token balance: ${
                err instanceof Error ? err.message : String(err)
              }`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // get all tokens held by the vault
  server.registerTool(
    "get-all-tokens",
    {
      title: "get all tokens held by the vault",
      description: "Get a list of all tokens held by the vault",
      inputSchema: {
        chainId: z.number().describe("Chain ID of the blockchain network"),
        vaultAddress: z.string().describe("Address of the vault to check"),
      },
    },
    async ({ chainId, vaultAddress }) => {
      try {
        const decoded = verifyToken(apiToken);
        const { userId, agentId } = decoded as {
          userId: string;
          agentId?: string;
        };
        const agent = await prisma.agent.findFirst({
          where: {
            userId: userId,
            id: agentId,
          },
        });

        if (!agent) {
          return {
            content: [
              {
                type: "text",
                text: "Agent not found for the provided userId and agentId",
              },
            ],
            isError: true,
          };
        }

        // fetch the token addresses from the vault API
        const res = await fetch(
          `${env.BASE_URL}/vault/get-all-tokens?vaultAddress=${vaultAddress}&chainId=${chainId}`,
          {
            method: "GET",
          },
        );

        if (!res.ok) {
          return {
            content: [
              {
                type: "text",
                text: `API returned ${res.status} ${res.statusText}`,
              },
            ],
            isError: true,
          };
        }

        const data = await res.json();

        return {
          content: [
            {
              type: "text",
              text: `Token addresses fetched successfully: ${JSON.stringify(data, null, 2)}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get all tokens: ${
                err instanceof Error ? err.message : String(err)
              }`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}

export async function POST(req: Request) {
  const token = req.headers.get("x-api-token");

  if (!token) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Missing x-api-token" },
        id: null,
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const server = createServer(token);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    const body = await req.json();
    await server.connect(transport);
    return await transport.handleRequest(req, { parsedBody: body });
  } catch (err) {
    console.error("MCP request error:", err);
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  } finally {
    await server.close();
    await transport.close();
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32601, message: "Method not supported" },
      id: null,
    }),
    {
      status: 405,
      headers: { "Content-Type": "application/json" },
    },
  );
}
