import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInsuranceByTradeIntentId } from "@/utils/arvoMain";

// GET (fetch all insurances by vault address and chain ID)
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

        // for every trade intent find the insurance associated with it onchain
        const insurances = [];
        for (const intent of tradeIntents) {
            const insurance = await getInsuranceByTradeIntentId(intent.id, parseInt(chainId));
            if (insurance) {
                insurances.push(insurance);
            }
        }

        return NextResponse.json({ insurances }, { status: 200 });
    } catch (error) {
        console.log("Error fetching insurances:", error);
        return NextResponse.json({ error: "Failed to fetch insurances" }, { status: 500 });
    }
}