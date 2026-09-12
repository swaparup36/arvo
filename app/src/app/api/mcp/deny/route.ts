import { redis } from "@/lib/redis";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { key } = await req.json();
        const pendingAuthDataJson = await redis.get(`pendingAuth:${key}`);
        const pendingAuthData = pendingAuthDataJson ? JSON.parse(pendingAuthDataJson) : null;

        if (!pendingAuthData) {
            return NextResponse.json({ error: "Invalid or expired authorization request" }, { status: 400 });
        }

        await redis.del(`pendingAuth:${key}`);

        const url = new URL(pendingAuthData.redirectUri);
        url.searchParams.set("error", "access_denied");
        if (pendingAuthData.state) url.searchParams.set("state", pendingAuthData.state);

        return NextResponse.json({ redirectUrl: url.toString() });
    } catch (error) {
        console.error("Error handling deny request:", error);
        return NextResponse.json({ error: "Failed to handle deny request" }, { status: 500 });
    }
}
