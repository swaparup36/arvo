import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInsuranceByTradeIntentId } from "@/utils/arvoMain";

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

// GET (fetch all insurances for a vault or an agent's trade intents, by chain ID)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chainId = searchParams.get("chainId");

    if (!chainId) {
      return NextResponse.json({ error: "Missing chain ID" }, { status: 400 });
    }

    const vaultAddress = searchParams.get("vaultAddress");
    const agentAddress = searchParams.get("agentAddress");

    if (!vaultAddress && !agentAddress) {
      return NextResponse.json(
        { error: "Missing vault address or agent address" },
        { status: 400 },
      );
    }

    let tradeIntents: Array<{ id: string; chainId: number }> = [];

    try {
      tradeIntents = await prisma.tradeIntent.findMany({
        where: {
          ...(agentAddress ? { agentAddress } : { vaultAddress: vaultAddress as string }),
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
        if (insurance) insurances.push(toSerializable(insurance));
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
