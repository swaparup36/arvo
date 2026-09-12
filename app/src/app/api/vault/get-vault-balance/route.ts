import { availableBalance, lockedBalance } from "@/utils/vault";
import { NextResponse } from "next/server";

// GET (fetch vault balance by vault address)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const vaultAddress = searchParams.get("vaultAddress");
        const asset = searchParams.get("asset");
        const chainId = searchParams.get("chainId");

        if (!vaultAddress) {
            return NextResponse.json({ error: "Missing vaultAddress parameter" }, { status: 400 });
        }

        if (!asset) {
            return NextResponse.json({ error: "Missing asset parameter" }, { status: 400 });
        }

        if (!chainId) {
            return NextResponse.json({ error: "Missing chainId parameter" }, { status: 400 });
        }

        const [available, locked] = await Promise.all([
            availableBalance(vaultAddress, asset, Number(chainId)),
            lockedBalance(vaultAddress, asset, Number(chainId)),
        ]);

        return NextResponse.json(
            { available: available.toString(), locked: locked.toString() },
            { status: 200 },
        );
    } catch (error) {
        console.log("Error fetching vault balance:", error);
        return NextResponse.json({ error: "Failed to fetch vault balance" }, { status: 500 });
    }
}