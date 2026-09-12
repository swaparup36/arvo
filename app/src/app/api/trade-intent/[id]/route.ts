import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTradeIntent } from "@/utils/arvoMain";
import { toSerializable } from "@/lib/serialize";

// GET (fetch trade intent by Id)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: tradeIntentId } = await params;
        
        if (!tradeIntentId) {
            return NextResponse.json({ error: "Missing trade intent ID" }, { status: 400 });
        }

        const tradeIntent = await prisma.tradeIntent.findUnique({
            where: { id: tradeIntentId },
        });

        if (!tradeIntent) {
            return NextResponse.json({ error: "Trade intent not found" }, { status: 404 });
        }

        // check if the trade intent exists onchain
        const onChainIntent = await getTradeIntent(tradeIntent.id, tradeIntent.chainId);
        if (!onChainIntent) {
            return NextResponse.json({ error: "Trade intent not found onchain" }, { status: 404 });
        }

        return NextResponse.json({ tradeIntent: toSerializable(tradeIntent) }, { status: 200 });
    } catch (error) {
        console.log("Error fetching trade intent:", error);
        return NextResponse.json({ error: "Failed to fetch trade intent" }, { status: 500 });
    }
}