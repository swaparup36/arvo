import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET (fetch trade confirmation by trade intent ID)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tradeIntentId = searchParams.get("trade_intent_id");
        
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

        return NextResponse.json({ tradeIntent, tradeConfirmation }, { status: 200 });
    } catch (error) {
        console.log("Error fetching trade confirmation:", error);
        return NextResponse.json({ error: "Failed to fetch trade confirmation" }, { status: 500 });
    }
}