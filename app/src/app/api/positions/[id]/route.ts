import { getInsurance, getPosition } from "@/utils/arvoMain";
import { NextResponse } from "next/server";

// GET (fetch position details insuranceId and chain ID)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: insuranceId } = await params;
        const { searchParams } = new URL(req.url);
        const chainId = searchParams.get("chainId");

        if (!insuranceId || !chainId) {
            return NextResponse.json({ error: "Missing insurance ID or chain ID" }, { status: 400 });
        }

        const insurance = await getInsurance(insuranceId, parseInt(chainId));

        if (!insurance) {
            return NextResponse.json({ error: "Insurance not found" }, { status: 404 });
        }

        const position = await getPosition(insurance.positionId, parseInt(chainId));

        if (!position) {
            return NextResponse.json({ error: "Position not found" }, { status: 404 });
        }

        return NextResponse.json({ position }, { status: 200 });
    } catch (error) {
        console.log("Error fetching position details:", error);
        return NextResponse.json({ error: "Failed to fetch position details" }, { status: 500 });
    }
}