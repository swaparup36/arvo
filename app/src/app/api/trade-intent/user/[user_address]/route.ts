import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toSerializable } from "@/lib/serialize";
import { getTradeIntent } from "@/utils/arvoMain";

// GET (fetch trade intents by user address, chainId, vaultAddress)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ user_address: string }> },
) {
  try {
    const { user_address: userAddress } = await params;
    const { searchParams } = new URL(req.url);
    const chainId = searchParams.get("chainId");
    const vaultAddress = searchParams.get("vaultAddress");

    if (!userAddress || !chainId || !vaultAddress || !Number.isFinite(Number(chainId))) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 },
      );
    }

    let tradeIntents: Array<
      Prisma.TradeIntentGetPayload<{
        include: { tradeConfirmation: true; riskAssessments: true };
      }>
    > = [];

    try {
      const user = await prisma.user.findUnique({
        where: { address: userAddress.toLowerCase() },
        select: { agents: { select: { address: true } } },
      });

      tradeIntents = await prisma.tradeIntent.findMany({
        where: {
          vaultAddress: { equals: vaultAddress, mode: "insensitive" },
          chainId: Number(chainId),
          OR: [
            { userAddress: { equals: userAddress, mode: "insensitive" } },
            {
              agentAddress: {
                in: (user?.agents ?? []).map((agent) => agent.address),
              },
            },
          ],
        },
        include: { tradeConfirmation: true, riskAssessments: true },
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
      console.log("Checking on-chain trade intent for:", intent.id, "on chainId:", intent.chainId);
      try {
        const onChainIntent = await getTradeIntent(intent.id, intent.chainId);
        if (onChainIntent) onChainTradeIntents.push(intent);
      } catch (onchainError) {
        console.warn("On-chain trade intent lookup failed:", onchainError);
      }
    }


    // the relations are pulled in with the intents above, so this is just a shape change
    const enrichedTradeIntents = onChainTradeIntents.map(
      ({ tradeConfirmation, riskAssessments, ...intent }) => ({
        ...intent,
        tradeConfirmed: Boolean(tradeConfirmation),
        risk: riskAssessments ? Number(riskAssessments.riskScore) : null,
        confirmation: tradeConfirmation,
        assessment: riskAssessments,
      }),
    );

    return NextResponse.json(
      { tradeIntents: toSerializable(enrichedTradeIntents) },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching trade intents:", error);
    return NextResponse.json({ tradeIntents: [] }, { status: 200 });
  }
}
