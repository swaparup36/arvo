import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPositionByTradeIntentId } from "@/utils/arvoMain";

// GET (fetch all positions by vault address and chain ID)
export async function GET(req: Request) {
    try {
        // get the insurance id from the query params
        const { searchParams } = new URL(req.url);
        const chainId = searchParams.get("chainId");

        if (!chainId) {
            return NextResponse.json({ error: "Missing chain ID" }, { status: 400 });
        }
        const vaultAddress = searchParams.get("vaultAddress");

        if (!vaultAddress) {
            return NextResponse.json({ error: "Missing vault address" }, { status: 400 });
        }

        const tradeIntents = await prisma.tradeIntent.findMany({
            where: {
                vaultAddress: vaultAddress,
                chainId: parseInt(chainId)
            }
        });

        // for every trade intent find the position associated with it onchain
        const positions = [];
        for (const intent of tradeIntents) {
            const position = await getPositionByTradeIntentId(intent.id, parseInt(chainId));
            if (position) {
                positions.push(position);
            }
        }

        return NextResponse.json({ positions }, { status: 200 });
    } catch (error) {
        console.log("Error fetching positions:", error);
        return NextResponse.json({ error: "Failed to fetch positions" }, { status: 500 });
    }
}