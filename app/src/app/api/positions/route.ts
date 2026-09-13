import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toSerializable } from "@/lib/serialize";
import {
  getInsuranceByTradeIntentId,
  getPositionByTradeIntentId,
  isLiveInsurance,
} from "@/utils/arvoMain";
import { cached } from "@/lib/cache";
import { getQuote } from "@/utils/uniswap";

const QUOTE_TTL_SECONDS = 30;

// GET (fetch all positions by vault address and chain ID)
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
      console.warn("Database unreachable while fetching positions:", dbError);
      return NextResponse.json({ positions: [] }, { status: 200 });
    }

    const rawPositions = [];
    for (const intent of tradeIntents) {
      try {
        const [position, insurance] = await Promise.all([
          getPositionByTradeIntentId(intent.id, parseInt(chainId, 10)),
          getInsuranceByTradeIntentId(intent.id, parseInt(chainId, 10)),
        ]);

        if (!position || (insurance && !isLiveInsurance(insurance))) continue;

        rawPositions.push(toSerializable(position));
      } catch (onchainError) {
        console.warn("On-chain position lookup failed:", onchainError);
      }
    }

    // fetch the current value of each position using the Uniswap API and cache the results
    const positions = await Promise.all(
      rawPositions.map(async (position) => {
        const entry = position as Record<string, string>;

        // fetch the current value of the position using the Uniswap API and cache the result for 30 seconds
        const currentValue = await cached(
          `quote:${chainId}:${entry.tokenOutAddress}:${entry.tokenInAddress}:${entry.amountOut}`,
          async () => {
            const quote = await getQuote({
              chainId: parseInt(chainId, 10),
              tokenIn: entry.tokenOutAddress,
              tokenOut: entry.tokenInAddress,
              amountIn: entry.amountOut,
              vaultAddress: entry.vaultAddress,
            });

            return quote ? String(quote.quote.output.amount) : null;
          },
          { ttl: QUOTE_TTL_SECONDS },
        );

        return { ...entry, currentValue };
      }),
    );

    return NextResponse.json({ positions }, { status: 200 });
  } catch (error) {
    console.error("Error fetching positions:", error);
    return NextResponse.json({ positions: [] }, { status: 200 });
  }
}
