import type { NextApiRequest, NextApiResponse } from "next";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "../../../../../middleware";
import { ethers } from "ethers";
import { CreateTradeIntentRequest } from "../../../../types/schema";

function createServer(apiToken: string) {
  const server = new McpServer({
    name: "todo-mcp-server",
    version: "1.0.0",
  });


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
          minAmountOut: z.number().describe("Minimum amount of output token to receive"),
          deadline: z.string().describe("Deadline for the trade in ISO 8601 format"),
          maxPremium: z.number().describe("Maximum premium to pay for the trade insurance"),
          minCoverage: z.number().describe("Minimum coverage required for the trade insurance in percentage (1-100)"),
          minCoverageDuration: z.bigint().describe("Minimum duration of the coverage in seconds"),
        }
    },
    async ({ chainId, tokenIn, tokenOut, amountIn, minAmountOut, deadline, maxPremium, minCoverage, minCoverageDuration }) => {
      try {
        const decoded = verifyToken(apiToken);
        const { userId, agentId } = decoded as { userId: string; agentId?: string }; 
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
            minCoverageDuration
        };

        const agentWallet = new ethers.Wallet(agent.privateKey);
        const signedTradeData = await agentWallet.signMessage(JSON.stringify(tradeData));

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
            signature: signedTradeData
        }

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
  )

  return server;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const token = req.headers["x-api-token"];
    if (typeof token !== "string") {
        return res.status(401).json({
            jsonrpc: "2.0",
            error: { code: -32001, message: "Missing x-api-token" },
            id: null,
        });
    }

    const server = createServer(token);
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
    });

    res.on("close", () => {
        transport.close();
        server.close();
    });

    try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } catch (err) {
        console.error("MCP request error:", err);
        if (!res.headersSent) {
        res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
        });
        }
    }
}