import { NextResponse } from "next/server";

// GET (fetch vaults by user address)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userAddress = searchParams.get("userAddress");

        if (!userAddress) {
            return NextResponse.json({ error: "Missing userAddress parameter" }, { status: 400 });
        }

        // TODO
    } catch (error) {
        console.log("Error fetching trade intent:", error);
        return NextResponse.json({ error: "Failed to fetch trade intent" }, { status: 500 });
    }
}