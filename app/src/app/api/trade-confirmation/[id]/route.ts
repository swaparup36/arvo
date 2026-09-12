import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTradeConfirmation } from "@/utils/arvoMain";
import { toSerializable } from "@/lib/serialize";

// GET (fetch trade confirmation by trade confirmation ID)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: tradeConfirmationId } = await params;

        if (!tradeConfirmationId) {
            return NextResponse.json({ error: "Missing trade confirmation ID" }, { status: 400 });
        }
        
        const tradeConfirmation = await prisma.tradeConfirmation.findUnique({
            where: { id: tradeConfirmationId },
        });

        if (!tradeConfirmation) {
            return NextResponse.json({ error: "Trade confirmation not found" }, { status: 404 });
        }

        // check if the trade intent exists
        const tradeIntent = await prisma.tradeIntent.findUnique({
            where: { id: tradeConfirmation.intentId },
        });

        if (!tradeIntent) {
            return NextResponse.json({ error: "Trade intent not found" }, { status: 404 });
        }

        // check if the trade confirmation exists on chain
        const onChainTradeConfirmation = await getTradeConfirmation(tradeConfirmation.intentId, tradeConfirmation.chainId);

        if (!onChainTradeConfirmation) {
            return NextResponse.json({ error: "Trade confirmation not found on chain" }, { status: 404 });
        }

        return NextResponse.json({ tradeConfirmation: toSerializable(tradeConfirmation) }, { status: 200 });
    } catch (error) {
        console.log("Error fetching trade confirmation:", error);
        return NextResponse.json({ error: "Failed to fetch trade confirmation" }, { status: 500 });
    }
}