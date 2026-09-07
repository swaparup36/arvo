import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET (fetch trade intents by user address)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userAddress = searchParams.get("user_address");
        
        if (!userAddress) {
            return NextResponse.json({ error: "Missing user address" }, { status: 400 });
        }

        const tradeIntents = await prisma.tradeIntent.findMany({
            where: { userAddress: userAddress },
        });

        return NextResponse.json({ tradeIntents }, { status: 200 });
    } catch (error) {
        console.log("Error fetching trade intents:", error);
        return NextResponse.json({ error: "Failed to fetch trade intents" }, { status: 500 });
    }
}