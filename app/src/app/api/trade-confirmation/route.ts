import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateTradeConfirmationRequest } from "@/types/schema";

// POST (create trade confirmation)
export async function POST(req: Request) {
    try {
        const createTradeConfirmationRequest: CreateTradeConfirmationRequest = await req.json();

        const { intentId, transactionHash, chainId, tokenIn, tokenOut, amountIn, amountOut, signature, executedAt } = createTradeConfirmationRequest;
        
        // Validate the request data
        if (!intentId || !transactionHash || !chainId || !tokenIn || !tokenOut || !amountIn || !amountOut || !signature || !executedAt) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const tradeConfirmation = await prisma.tradeConfirmation.create({
            data: {
                intentId,
                transactionHash,
                chainId,
                tokenIn,
                tokenOut,
                amountIn,
                amountOut,
                signature,
                executedAt: new Date(executedAt),
            }
        });

        return NextResponse.json({ tradeConfirmation }, { status: 201 });
    } catch (error) {
        console.log("Error creating trade confirmation:", error);
        return NextResponse.json({ error: "Failed to create trade confirmation" }, { status: 500 });
    }
}