import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET (fetch trade intent by Id)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tradeIntentId = searchParams.get("id");
        
        if (!tradeIntentId) {
            return NextResponse.json({ error: "Missing trade intent ID" }, { status: 400 });
        }

        const tradeIntent = await prisma.tradeIntent.findUnique({
            where: { id: tradeIntentId },
        });

        if (!tradeIntent) {
            return NextResponse.json({ error: "Trade intent not found" }, { status: 404 });
        }

        return NextResponse.json({ tradeIntent }, { status: 200 });
    } catch (error) {
        console.log("Error fetching trade intent:", error);
        return NextResponse.json({ error: "Failed to fetch trade intent" }, { status: 500 });
    }
}