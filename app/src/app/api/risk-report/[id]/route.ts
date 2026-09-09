import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRiskAssessment } from "@/utils/arvoMain";

// GET (fetch risk report by risk report ID)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: riskReportId } = await params;

        if (!riskReportId) {
            return NextResponse.json({ error: "Missing risk report ID" }, { status: 400 });
        }
        
        const riskReport = await prisma.riskAssessment.findUnique({
            where: { id: riskReportId },
        });

        if (!riskReport) {
            return NextResponse.json({ error: "Risk report not found" }, { status: 404 });
        }

        const tradeIntent = await prisma.tradeIntent.findUnique({
            where: { id: riskReport.intentId }
        });

        if (!tradeIntent) {
            return NextResponse.json({ error: "Trade intent not found" }, { status: 404 });
        }

        // check if the risk report exists onchain
        const onChainRiskReport = await getRiskAssessment(riskReport.intentId, tradeIntent.chainId);

        if (!onChainRiskReport) {
            return NextResponse.json({ error: "Risk report not found on chain" }, { status: 404 });
        }

        return NextResponse.json({ riskReport }, { status: 200 });
    } catch (error) {
        console.log("Error fetching risk report:", error);
        return NextResponse.json({ error: "Failed to fetch risk report" }, { status: 500 });
    }
}