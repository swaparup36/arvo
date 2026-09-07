import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET (fetch trade confirmation by trade confirmation ID)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tradeConfirmationId = searchParams.get("id");

        if (!tradeConfirmationId) {
            return NextResponse.json({ error: "Missing trade confirmation ID" }, { status: 400 });
        }
        
        const tradeConfirmation = await prisma.tradeConfirmation.findUnique({
            where: { id: tradeConfirmationId },
        });

        if (!tradeConfirmation) {
            return NextResponse.json({ error: "Trade confirmation not found" }, { status: 404 });
        }

        return NextResponse.json({ tradeConfirmation }, { status: 200 });
    } catch (error) {
        console.log("Error fetching trade confirmation:", error);
        return NextResponse.json({ error: "Failed to fetch trade confirmation" }, { status: 500 });
    }
}