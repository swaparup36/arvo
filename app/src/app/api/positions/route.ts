import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPositionByTradeIntentId } from "@/utils/arvoMain";

function toSerializable(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  // ethers v6 Result is an array subclass; JSON.stringify would drop its
  // named fields and serialize it by numeric index only, so convert first.
  if (
    value &&
    typeof value === "object" &&
    "toObject" in value &&
    typeof (value as { toObject: unknown }).toObject === "function"
  ) {
    return toSerializable((value as { toObject: () => unknown }).toObject());
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

    const positions = [];
    for (const intent of tradeIntents) {
      try {
        const position = await getPositionByTradeIntentId(
          intent.id,
          parseInt(chainId, 10),
        );
        if (position) positions.push(toSerializable(position));
      } catch (onchainError) {
        console.warn("On-chain position lookup failed:", onchainError);
      }
    }

    return NextResponse.json({ positions }, { status: 200 });
  } catch (error) {
    console.error("Error fetching positions:", error);
    return NextResponse.json({ positions: [] }, { status: 200 });
  }
}
