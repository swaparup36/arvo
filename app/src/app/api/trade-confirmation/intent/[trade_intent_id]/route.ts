import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTradeConfirmation } from "@/utils/arvoMain";

// GET (fetch trade confirmation by trade intent ID)
export async function GET(req: Request, { params }: { params: Promise<{ trade_intent_id: string }> }) {
    try {
        const { trade_intent_id: tradeIntentId } = await params;
        
        if (!tradeIntentId) {
            return NextResponse.json({ error: "Missing trade intent ID" }, { status: 400 });
        }

        const tradeIntent = await prisma.tradeIntent.findUnique({
            where: { id: tradeIntentId },
        });

        if (!tradeIntent) {
            return NextResponse.json({ error: "Trade intent not found" }, { status: 404 });
        }

        const tradeConfirmation = await prisma.tradeConfirmation.findUnique({
            where: { intentId: tradeIntentId },
        });

        if (!tradeConfirmation) {
            return NextResponse.json({ error: "Trade confirmation not found" }, { status: 404 });
        }

        // check if the trade confirmation exists on chain
        const onChainTradeConfirmation = await getTradeConfirmation(tradeConfirmation.intentId, tradeConfirmation.chainId);

        if (!onChainTradeConfirmation) {
            return NextResponse.json({ error: "Trade confirmation not found on chain" }, { status: 404 });
        }

        return NextResponse.json({ tradeIntent, tradeConfirmation }, { status: 200 });
    } catch (error) {
        console.log("Error fetching trade confirmation:", error);
        return NextResponse.json({ error: "Failed to fetch trade confirmation" }, { status: 500 });
    }
}