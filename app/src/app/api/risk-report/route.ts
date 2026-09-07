import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateRiskReportRequest } from "@/types/schema";

// POST (create risk report)
export async function POST(req: Request) {
    try {
        const createRiskReportRequest: CreateRiskReportRequest = await req.json();

        const { intentId, canBeInsured, tradeAllowed, riskScore, premium, coverageAmount, coverageDuration, signature, assessedAt, expiresAt, assessmentHash } = createRiskReportRequest;
        
        // Validate the request data
        if (!intentId || canBeInsured === undefined || tradeAllowed === undefined || riskScore === undefined || premium === undefined || coverageAmount === undefined || !coverageDuration || !signature || !assessedAt || !expiresAt || !assessmentHash) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const riskReport = await prisma.riskAssessment.create({
            data: {
                intentId,
                canBeInsured,
                tradeAllowed,
                riskScore,
                premium,
                coverageAmount,
                coverageDuration,
                signature,
                assessedAt: new Date(assessedAt),
                expiresAt: new Date(expiresAt),
                assessmentHash,
            }
        });

        return NextResponse.json({ riskReport }, { status: 201 });
    } catch (error) {
        console.log("Error creating risk report:", error);
        return NextResponse.json({ error: "Failed to create risk report" }, { status: 500 });
    }
}