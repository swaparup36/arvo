import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getTokenDecimals } from "@/utils/erc20";
import { CreateTradeIntentRequest, OnChainSubmitTradeIntentStruct } from "../../../types/schema";
import { Address } from "viem";
import { submitTradeIntent } from "@/utils/arvoMain";

// POST (create trade intent)
export async function POST(req: Request) {
    try {
        const createTradeIntentRequest: CreateTradeIntentRequest = await req.json();

        const { userAddress, agentAddress, vaultAddress, chainId, tokenIn, tokenOut, amountIn, minAmountOut, deadline, maxPremium, minCoverage, minCoverageDuration, signature } = createTradeIntentRequest;
        
        // Validate the request data
        if (!userAddress || !agentAddress || !vaultAddress || !chainId || !tokenIn || !tokenOut || !amountIn || !minAmountOut || !deadline || !maxPremium || !minCoverage || !minCoverageDuration || !signature) {
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
                minCoverage,
                minCoverageDuration,
                signature,
            }
        });

        // submit trade intent to the blockchain
        const onChainIntentStruct: OnChainSubmitTradeIntentStruct = {
            id: tradeIntent.id,
            userAddress: tradeIntent.userAddress as Address,
            agentAddress: tradeIntent.agentAddress as Address,
            vaultAddress: tradeIntent.vaultAddress as Address,
            tokenIn: tradeIntent.tokenIn as Address,
            tokenOut: tradeIntent.tokenOut as Address,
            amountIn: tradeIntent.amountIn,
            minAmountOut: tradeIntent.minAmountOut,
            deadline: BigInt(tradeIntent.deadline.getTime()),
            maxPremium: tradeIntent.maxPremium,
            minCoverage: tradeIntent.minCoverage.toNumber(), // in number (1-100)
            minCoverageDuration: tradeIntent.minCoverageDuration,
            signature: tradeIntent.signature,
            status: 0, // 0 means pending
            createdAt: BigInt(tradeIntent.createdAt.getTime()), // timestamp in milliseconds
        };

        const { txHash, receipt } = await submitTradeIntent(onChainIntentStruct, tradeIntent.chainId);

        // confirm that the transaction was successful
        if (receipt.status !== 1) {
            // delete the trade intent from the database if the transaction failed
            await prisma.tradeIntent.delete({ where: { id: tradeIntent.id } });
            return NextResponse.json({ error: "Failed to submit trade intent on-chain" }, { status: 500 });
        }

        // Send trade intent to Trade Engine and Risk Assessment queues
        await redis.lpush("trade_execution_queue", JSON.stringify(tradeIntent));
        await redis.lpush("risk_assessment_queue", JSON.stringify(tradeIntent));

        return NextResponse.json({ tradeIntent, txHash }, { status: 201 });
    } catch (error) {
        console.log("Error creating trade intent:", error);
        return NextResponse.json({ error: "Failed to create trade intent" }, { status: 500 });
    }
}