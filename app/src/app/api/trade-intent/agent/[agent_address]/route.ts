import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toSerializable } from "@/lib/serialize";
import { getTradeIntent } from "@/utils/arvoMain";

// GET (fetch trade intents by agent address)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ agent_address: string }> },
) {
  try {
    const { agent_address: agentAddress } = await params;
    const { searchParams } = new URL(req.url);
    const chainId = searchParams.get("chainId");

    if (!agentAddress) {
      return NextResponse.json(
        { error: "Missing agent address" },
        { status: 400 },
      );
    }

    const tradeIntents = await prisma.tradeIntent.findMany({
      where: {
        agentAddress: { equals: agentAddress, mode: "insensitive" },
        ...(chainId ? { chainId: Number(chainId) } : {}),
      },
      include: { tradeConfirmation: true, riskAssessments: true },
    });

    // for every trade intent check if is exists onchain or not and only return the ones that are onchain
    const onChainTradeIntents = [];
    for (const intent of tradeIntents) {
      const onChainIntent = await getTradeIntent(intent.id, intent.chainId);
      if (onChainIntent) {
        onChainTradeIntents.push(intent);
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
    console.log("Error fetching trade intents:", error);
    return NextResponse.json(
      { error: "Failed to fetch trade intents" },
      { status: 500 },
    );
  }
}
