import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateRiskReportRequest, OnChainSubmitRiskAssessmentStruct } from "../../../types/schema";
import { submitRiskAssessment } from "@/utils/arvoMain";

// POST (create risk report)
export async function POST(req: Request) {
    try {
        const createRiskReportRequest: CreateRiskReportRequest = await req.json();

        const { intentId, riskScore, premium, coverage, coverageDuration, signature, assessedAt, expiresAt, assessmentHash } = createRiskReportRequest;
        
        // Validate the request data
        if (!intentId || riskScore === undefined || premium === undefined || coverage === undefined || !coverageDuration || !signature || !assessedAt || !expiresAt || !assessmentHash) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // get the trade intent from the database
        const tradeIntent = await prisma.tradeIntent.findUnique({
            where: { id: intentId }
        });

        if (!tradeIntent) {
            return NextResponse.json({ error: "Trade intent not found" }, { status: 404 });
        }

        const riskReport = await prisma.riskAssessment.create({
            data: {
                intentId,
                riskScore,
                premium,
                coverage,
                coverageDuration,
                signature,
                assessedAt: new Date(assessedAt),
                expiresAt: new Date(expiresAt),
                assessmentHash,
            }
        });

        // submit risk assessment to the blockchain
        const onChainAssessmentStruct: OnChainSubmitRiskAssessmentStruct = {
            id: riskReport.id,
            intentId: riskReport.intentId,
            riskScore: riskReport.riskScore.toNumber(), // in number (0-100)
            premium: riskReport.premium,
            coverage: riskReport.coverage.toNumber(), // in number (0-100)
            coverageDuration: riskReport.coverageDuration,
            signature: riskReport.signature,
            assessedAt: BigInt(riskReport.assessedAt.getTime()),
            expiresAt: BigInt(riskReport.expiresAt.getTime()),
            assessmentHash: riskReport.assessmentHash
        }

        const { txHash, receipt } = await submitRiskAssessment(onChainAssessmentStruct, tradeIntent.chainId);

         // confirm that the transaction was successful
        if (!txHash || !receipt || receipt.status !== 1) {
            // delete the risk assessment from the database if the transaction failed
            await prisma.riskAssessment.delete({ where: { id: riskReport.id } });
            return NextResponse.json({ error: "Failed to submit risk assessment on-chain" }, { status: 500 });
        }

        return NextResponse.json({ riskReport, txHash }, { status: 201 });
    } catch (error) {
        console.log("Error creating risk report:", error);
        return NextResponse.json({ error: "Failed to create risk report" }, { status: 500 });
    }
}