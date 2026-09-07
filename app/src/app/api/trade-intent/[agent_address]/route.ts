import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET (fetch trade intents by agent address)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const agentAddress = searchParams.get("agent_address");
        
        if (!agentAddress) {
            return NextResponse.json({ error: "Missing agent address" }, { status: 400 });
        }

        const tradeIntents = await prisma.tradeIntent.findMany({
            where: { agentAddress: agentAddress },
        });

        return NextResponse.json({ tradeIntents }, { status: 200 });
    } catch (error) {
        console.log("Error fetching trade intents:", error);
        return NextResponse.json({ error: "Failed to fetch trade intents" }, { status: 500 });
    }
}