import { getInsurance, getPosition, invalidateInsurance } from "@/utils/arvoMain";
import { NextResponse } from "next/server";
import { requireIntentOwner } from "@/lib/insurance-auth";
import { toSerializable } from "@/lib/serialize";

// POST (invalidate the insurance)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: insuranceId } = await params;
        const { searchParams } = new URL(req.url);
        const chainId = searchParams.get("chainId");

        if (!insuranceId || !chainId) {
            return NextResponse.json({ error: "Missing insurance ID or chain ID" }, { status: 400 });
        }

        // get the insurance details from the Arvo main contract
        const insurance = await getInsurance(insuranceId, parseInt(chainId));

        if (!insurance) {
            return NextResponse.json({ error: "Insurance not found" }, { status: 404 });
        }

        const denied = await requireIntentOwner(
            req,
            String(insurance.tradeIntentId),
            parseInt(chainId),
        );

        if (denied) return denied;

        // get the position details from the insurance object
        const postion = await getPosition(insuranceId, parseInt(chainId));

        if (!postion) {
            return NextResponse.json({ error: "Position not found" }, { status: 404 });
        }

        // invalidate the insurance on-chain
        const { txHash, receipt, error } = await invalidateInsurance(insuranceId, parseInt(chainId));

        if (!txHash || !receipt || receipt.status !== 1) {
            return NextResponse.json(
                { error: error ?? "Failed to invalidate insurance" },
                { status: error ? 400 : 500 },
            );
        }

        return NextResponse.json({ message: "Insurance invalidated successfully", txHash, receipt: toSerializable(receipt) }, { status: 200 });
    } catch (error) {
        console.log("Error running insurance invalidate:", error);
        return NextResponse.json({ error: "Failed to invalidate insurance" }, { status: 500 });
    }
}