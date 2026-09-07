import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET (fetch risk report by risk report ID)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const riskReportId = searchParams.get("id");

        if (!riskReportId) {
            return NextResponse.json({ error: "Missing risk report ID" }, { status: 400 });
        }
        
        const riskReport = await prisma.riskAssessment.findUnique({
            where: { id: riskReportId },
        });

        if (!riskReport) {
            return NextResponse.json({ error: "Risk report not found" }, { status: 404 });
        }

        return NextResponse.json({ riskReport }, { status: 200 });
    } catch (error) {
        console.log("Error fetching risk report:", error);
        return NextResponse.json({ error: "Failed to fetch risk report" }, { status: 500 });
    }
}