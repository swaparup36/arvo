import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInsuranceByTradeIntentId } from "@/utils/arvoMain";

// GET (fetch all insurances by vault address and chain ID)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chainId = searchParams.get("chainId");

    if (!chainId) {
      return NextResponse.json({ error: "Missing chain ID" }, { status: 400 });
    }

    const vaultAddress = searchParams.get("vaultAddress");
    if (!vaultAddress) {
      return NextResponse.json(
        { error: "Missing vault address" },
        { status: 400 },
      );
    }

    let tradeIntents: Array<{ id: string; chainId: number }> = [];

    try {
      tradeIntents = await prisma.tradeIntent.findMany({
        where: {
          vaultAddress,
          chainId: parseInt(chainId, 10),
        },
      });
    } catch (dbError) {
      console.warn("Database unreachable while fetching insurances:", dbError);
      return NextResponse.json({ insurances: [] }, { status: 200 });
    }

    const insurances = [];
    for (const intent of tradeIntents) {
      try {
        const insurance = await getInsuranceByTradeIntentId(
          intent.id,
          parseInt(chainId, 10),
        );
        if (insurance) insurances.push(insurance);
      } catch (onchainError) {
        console.warn("On-chain insurance lookup failed:", onchainError);
      }
    }

    return NextResponse.json({ insurances }, { status: 200 });
  } catch (error) {
    console.error("Error fetching insurances:", error);
    return NextResponse.json({ insurances: [] }, { status: 200 });
  }
}
