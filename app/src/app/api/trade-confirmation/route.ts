import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateTradeConfirmationRequest, OnChainSubmitTradeConfirmationStruct } from "../../../types/schema";
import { Address } from "viem";
import { submitTradeConfirmation } from "@/utils/arvoMain";
import { toSerializable } from "@/lib/serialize";

// POST (create trade confirmation)
export async function POST(req: Request) {
    try {
        const createTradeConfirmationRequest: CreateTradeConfirmationRequest = await req.json();

        const { id, intentId, transactionHash, chainId, tokenIn, tokenOut, amountIn, amountOut, signature, executedAt } = createTradeConfirmationRequest;
        
        // Validate the request data
        if (!id || !intentId || !transactionHash || !chainId || !tokenIn || !tokenOut || !amountIn || !amountOut || !signature || !executedAt) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // get the trade intent from the database
        const tradeIntent = await prisma.tradeIntent.findUnique({
            where: { id: intentId }
        });

        if (!tradeIntent) {
            return NextResponse.json({ error: "Trade intent not found" }, { status: 404 });
        }

        const tradeConfirmation = await prisma.tradeConfirmation.create({
            data: {
                id,
                intentId,
                transactionHash,
                chainId,
                tokenIn,
                tokenOut,
                amountIn: BigInt(amountIn),
                amountOut: BigInt(amountOut),
                signature,
                executedAt: new Date(executedAt),
            }
        });

        // submit trade intent to the blockchain
        const onChainConfirmationStruct: OnChainSubmitTradeConfirmationStruct = {
            id: tradeConfirmation.id,
            intentId: tradeConfirmation.intentId,
            transactionHash: tradeConfirmation.transactionHash,
            tokenIn: tradeConfirmation.tokenIn as Address,
            tokenOut: tradeConfirmation.tokenOut as Address,
            amountIn: tradeConfirmation.amountIn,
            amountOut: tradeConfirmation.amountOut,
            signature: tradeConfirmation.signature,
            executedAt: BigInt(Math.floor(tradeConfirmation.executedAt.getTime() / 1000)),
            createdAt: BigInt(tradeConfirmation.createdAt.getTime())
        }

        const { txHash, receipt } = await submitTradeConfirmation(onChainConfirmationStruct, tradeConfirmation.chainId);

        // confirm that the transaction was successful
        if (!txHash || !receipt || receipt.status !== 1) {
            // delete the trade confirmation from the database if the transaction failed
            await prisma.tradeConfirmation.delete({ where: { id: tradeConfirmation.id } });
            return NextResponse.json({ error: "Failed to submit trade confirmation on-chain" }, { status: 500 });
        }

        return NextResponse.json({ tradeConfirmation: toSerializable(tradeConfirmation), txHash }, { status: 201 });
    } catch (error) {
        console.log("Error creating trade confirmation:", error);
        return NextResponse.json({ error: "Failed to create trade confirmation" }, { status: 500 });
    }
}