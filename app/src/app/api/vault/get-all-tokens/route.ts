import { getAllTokensHeldByTheVault } from "@/utils/alchemy";
import { NextResponse } from "next/server";

// GET (fetch all tokens held by the vault)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const vaultAddress = searchParams.get("vaultAddress");
        const chainId = searchParams.get("chainId");

        if (!vaultAddress) {
            return NextResponse.json({ error: "Missing vaultAddress parameter" }, { status: 400 });
        }

        if (!chainId) {
            return NextResponse.json({ error: "Missing chainId parameter" }, { status: 400 });
        }

        const tokenAddresses = await getAllTokensHeldByTheVault(vaultAddress, Number(chainId));

        return NextResponse.json({ tokenAddresses }, { status: 200 });
    } catch (error) {
        console.log("Error fetching token addresses:", error);
        return NextResponse.json({ error: "Failed to fetch token addresses" }, { status: 500 });
    }
}