import { CreateTradeIntentRequest } from "@/types/schema";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getTokenDecimals } from "@/utils/erc20";

// POST (create trade intent)
export async function POST(req: Request) {
    try {
        const createTradeIntentRequest: CreateTradeIntentRequest = await req.json();

        const { userAddress, agentAddress, vaultAddress, chainId, tokenIn, tokenOut, amountIn, minAmountOut, deadline, maxPremium, maxCoverage, requestedCoverageDuration, signature } = createTradeIntentRequest;
        
        // Validate the request data
        if (!userAddress || !agentAddress || !vaultAddress || !chainId || !tokenIn || !tokenOut || !amountIn || !minAmountOut || !deadline || !maxPremium || !maxCoverage || !requestedCoverageDuration || !signature) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // convert amountIn, minAmountOut, maxPremium to smallest unit (wei)
        const amountInDecimal = await getTokenDecimals(tokenIn, chainId);
        const minAmountOutDecimal = await getTokenDecimals(tokenOut, chainId);
        const maxPremiumDecimal = 6; // always USDC, which has 6 decimals

        const amountInWei = BigInt(amountIn * (10 ** amountInDecimal));
        const minAmountOutWei = BigInt(minAmountOut * (10 ** minAmountOutDecimal));
        const maxPremiumWei = BigInt(maxPremium * (10 ** maxPremiumDecimal));

        const tradeIntent = await prisma.tradeIntent.create({
            data: {
                userAddress,
                agentAddress,
                vaultAddress,
                chainId,
                tokenIn,
                tokenOut,
                amountIn: amountInWei,
                minAmountOut: minAmountOutWei,
                deadline: new Date(deadline),
                maxPremium: maxPremiumWei,
                maxCoverage,
                requestedCoverageDuration,
                signature,
            }
        });

        // Send trade intent to Trade Engine and Risk Assessment queues
        await redis.lpush("trade_execution_queue", JSON.stringify(tradeIntent));
        await redis.lpush("risk_assessment_queue", JSON.stringify(tradeIntent));

        return NextResponse.json({ tradeIntent }, { status: 201 });
    } catch (error) {
        console.log("Error creating trade intent:", error);
        return NextResponse.json({ error: "Failed to create trade intent" }, { status: 500 });
    }
}