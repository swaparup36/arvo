import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { ethers } from "ethers";
import { CreateTradeIntentRequest } from "../../../../types/schema";
import { getQuote } from "@/utils/uniswap";
import { CHAIN_TO_ARVO_MAIN_ADDRESS } from "@/utils/arvoMain";
import { getTokenDecimals } from "@/utils/erc20";

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
        amountIn: z.number().describe("Amount of input token to swap in human readable format"),
        minAmountOut: z
          .number()
          .describe("Minimum amount of output token to receive in human readable format"),
        deadline: z
          .string()
          .describe("Deadline for the trade in ISO 8601 format"),
        maxPremium: z
          .number()
          .describe("Maximum premium to pay for the trade insurance in USDC in human readable format"),
        minCoverage: z
          .number()
          .describe(
            "Minimum coverage required for the trade insurance in percentage (1-100)",
          ),
        minCoverageDuration: z
          .number()
          .int()
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
        const id = crypto.randomUUID();

        const agentWallet = new ethers.Wallet(agent.privateKey);

        // EIP-712 domain
        const domain = {
          name: "ArvoMain",
          version: "1",
          chainId,
          verifyingContract: CHAIN_TO_ARVO_MAIN_ADDRESS[chainId],
        };

        // EIP-712 types
        const types = {
          TradeIntent: [
            { name: "id", type: "string" },
            { name: "userAddress", type: "address" },
            { name: "agentAddress", type: "address" },
            { name: "vaultAddress", type: "address" },
            { name: "tokenIn", type: "address" },
            { name: "tokenOut", type: "address" },
            { name: "amountIn", type: "uint256" },
            { name: "minAmountOut", type: "uint256" },
            { name: "deadline", type: "uint256" },
            { name: "maxPremium", type: "uint256" },
            { name: "minCoverage", type: "uint32" },
            { name: "minCoverageDuration", type: "uint256" },
          ],
        };

        const tokenInDecimals = await getTokenDecimals(tokenIn, chainId);
        const tokenOutDecimals = await getTokenDecimals(tokenOut, chainId);

        const amountInWei = ethers.parseUnits(
          amountIn.toString(),
          tokenInDecimals
        );

        const minAmountOutWei = ethers.parseUnits(
          minAmountOut.toString(),
          tokenOutDecimals
        );

        const maxPremiumWei = ethers.parseUnits(
          maxPremium.toString(),
          6
        );

        const deadlineTimestamp = Math.floor(
          new Date(deadline).getTime() / 1000
        );

        // must contain the exact values that will be submitted on-chain
        const value = {
          id,
          userAddress: agent.address,
          agentAddress: agent.address,
          vaultAddress: agent.vaultAddress,
          tokenIn,
          tokenOut,
          amountIn: amountInWei,
          minAmountOut: minAmountOutWei,
          deadline: deadlineTimestamp,
          maxPremium: maxPremiumWei,
          minCoverage,
          minCoverageDuration,
        };

        // sign using EIP-712
        const signedTradeData = await agentWallet.signTypedData(
          domain,
          types,
          value,
        );

        const createTradeIntentRequest: CreateTradeIntentRequest = {
          id,
          userAddress: agent.address,
          agentAddress: agent.address,
          vaultAddress: agent.vaultAddress,
          chainId,
          tokenIn,
          tokenOut,
          amountIn: amountInWei.toString(),
          minAmountOut: minAmountOutWei.toString(),
          deadline: deadlineTimestamp,
          maxPremium: maxPremiumWei.toString(),
          minCoverage,
          minCoverageDuration,
          signature: signedTradeData,
        };

        const res = await fetch(`${env.BASE_URL}/api/trade-intent`, {
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
        console.error("Error posting trade intent:", err);
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
          `${env.BASE_URL}/api/vault/get-vault-balance?vaultAddress=${vaultAddress}&chainId=${chainId}&asset=${tokenAddress}`,
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
          `${env.BASE_URL}/api/vault/get-all-tokens?vaultAddress=${vaultAddress}&chainId=${chainId}`,
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

  // get quote for a pair of tokens
  server.registerTool(
    "get-quote",
    {
      title: "Get Quote for Token Pair",
      description: "Get a quote for swapping a pair of tokens",
      inputSchema: {
        chainId: z.number().describe("Chain ID of the blockchain network"),
        tokenIn: z.string().describe("Address of the input token"),
        tokenOut: z.string().describe("Address of the output token"),
        amountIn: z.number().describe("Amount of input token to swap in wei"),
      },
    },
    async ({ chainId, tokenIn, tokenOut, amountIn }) => {
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

        const quoteResponse = await getQuote({
          chainId: chainId,
          tokenIn: tokenIn,
          tokenOut: tokenOut,
          amountIn: amountIn.toString(),
          vaultAddress: agent.vaultAddress,
        });

        return {
          content: [
            {
              type: "text",
              text: `Quote fetched successfully: ${JSON.stringify(quoteResponse, null, 2)}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get quote: ${
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

  const close = async () => {
    await server.close();
    await transport.close();
  };

  try {
    const body = await req.json();
    await server.connect(transport);
    const response = await transport.handleRequest(req, { parsedBody: body });

    if (!response.body) {
      await close();
      return response;
    }

    req.signal.addEventListener("abort", () => void close());

    return new Response(
      response.body.pipeThrough(new TransformStream({ flush: close })),
      {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      },
    );
  } catch (err) {
    console.error("MCP request error:", err);
    await close();
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
