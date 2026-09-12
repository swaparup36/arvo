import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTradeIntent } from "@/utils/arvoMain";

function toSerializable(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(toSerializable);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toSerializable(entry)]),
    );
  }

  return value;
}

// GET (fetch trade intents by user address)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ user_address: string }> },
) {
  try {
    const { user_address: userAddress } = await params;

    if (!userAddress) {
      return NextResponse.json(
        { error: "Missing user address" },
        { status: 400 },
      );
    }

    let tradeIntents: Array<{
      id: string;
      chainId: number;
      userAddress: string;
    }> = [];

    try {
      tradeIntents = await prisma.tradeIntent.findMany({
        where: { userAddress },
      });
    } catch (dbError) {
      console.warn(
        "Database unreachable while fetching trade intents:",
        dbError,
      );
      return NextResponse.json({ tradeIntents: [] }, { status: 200 });
    }

    const onChainTradeIntents = [];
    for (const intent of tradeIntents) {
      try {
        const onChainIntent = await getTradeIntent(intent.id, intent.chainId);
        if (onChainIntent) onChainTradeIntents.push(intent);
      } catch (onchainError) {
        console.warn("On-chain trade intent lookup failed:", onchainError);
      }
    }

    return NextResponse.json(
      { tradeIntents: toSerializable(onChainTradeIntents) },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching trade intents:", error);
    return NextResponse.json({ tradeIntents: [] }, { status: 200 });
  }
}
