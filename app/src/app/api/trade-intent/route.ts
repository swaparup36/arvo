import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toSerializable } from "@/lib/serialize";
import { redis } from "@/lib/redis";
import { CreateTradeIntentRequest, OnChainSubmitTradeIntentStruct } from "../../../types/schema";
import { Address, keccak256, stringToBytes } from "viem";
import { submitTradeIntent } from "@/utils/arvoMain";

// fixed TTL
const INTENT_HASH_TTL_SECONDS = 7 * 24 * 60 * 60;

// POST (create trade intent)
export async function POST(req: Request) {
    try {
        const createTradeIntentRequest: CreateTradeIntentRequest = await req.json();

        const { id, userAddress, agentAddress, vaultAddress, chainId, tokenIn, tokenOut, amountIn, minAmountOut, deadline, maxPremium, minCoverage, minCoverageDuration, signature } = createTradeIntentRequest;
        
        // Validate the request data
        if (!id || !userAddress || !agentAddress || !vaultAddress || !chainId || !tokenIn || !tokenOut || !amountIn || !minAmountOut || !deadline || !maxPremium || !minCoverage || !minCoverageDuration || !signature) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const tradeIntent = await prisma.tradeIntent.create({
            data: {
                id,
                userAddress,
                agentAddress,
                vaultAddress,
                chainId,
                tokenIn,
                tokenOut,
                amountIn: BigInt(amountIn),
                minAmountOut: BigInt(minAmountOut),
                deadline: new Date(Number(deadline) * 1000),
                maxPremium: BigInt(maxPremium),
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
            deadline: BigInt(Math.floor(tradeIntent.deadline.getTime() / 1000)),
            maxPremium: tradeIntent.maxPremium,
            minCoverage: tradeIntent.minCoverage.toNumber(), // in number (1-100)
            minCoverageDuration: tradeIntent.minCoverageDuration,
            signature: tradeIntent.signature,
            status: 0, // 0 means pending
            createdAt: BigInt(tradeIntent.createdAt.getTime()), // timestamp in milliseconds
        };

        const { txHash, receipt } = await submitTradeIntent(onChainIntentStruct, tradeIntent.chainId);
        console.log("Trade intent submitted on-chain with txHash:", txHash);

        // confirm that the transaction was successful
        if (!txHash || !receipt || receipt.status !== 1) {
            // delete the trade intent from the database if the transaction failed
            await prisma.tradeIntent.delete({ where: { id: tradeIntent.id } });
            return NextResponse.json({ error: "Failed to submit trade intent on-chain" }, { status: 500 });
        }

        // Send trade intent to Trade Engine and Risk Assessment queues
        const tradeIntentToSend = {
            ...tradeIntent,
            amountIn: tradeIntent.amountIn.toString(),
            minAmountOut: tradeIntent.minAmountOut.toString(),
            maxPremium: tradeIntent.maxPremium.toString(),
            minCoverageDuration: tradeIntent.minCoverageDuration.toString(),
        }
        const payload = JSON.stringify(toSerializable(tradeIntentToSend));

        // store it in as a pair of indexed string hash and actual intent ID in Redis for future reference
        const intentIdHash = keccak256(stringToBytes(tradeIntent.id)).toLowerCase();
        await redis.set(`trade_intent_hash:${intentIdHash}`, tradeIntent.id, "EX", INTENT_HASH_TTL_SECONDS);
        console.log(`Stored trade intent hash ${intentIdHash} for intent ID ${tradeIntent.id} with TTL of ${INTENT_HASH_TTL_SECONDS} seconds`);

        await redis.lpush("trade_execution_queue", payload);
        // risk engine consumes a stream
        await redis.xadd("arvo:trade-intents", "*", "intent", payload);

        return NextResponse.json(
            { tradeIntentId: tradeIntent.id, txHash, insuranceStatus: tradeIntent.status },
            { status: 201 },
        );
    } catch (error) {
        console.log("Error creating trade intent:", error);
        return NextResponse.json({ error: "Failed to create trade intent" }, { status: 500 });
    }
}