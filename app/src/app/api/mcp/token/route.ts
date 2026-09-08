import { redis } from "@/lib/redis";
import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";

export async function POST(req: Request, res: NextResponse) {
    try {
        const { grant_type, code, redirect_uri, client_id, code_verifier } = await req.json() || {};

        res.headers.set("Cache-Control", "no-store");

        if (grant_type !== "authorization_code") {
            return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
        }

        if (!code || !await redis.hget("authCodes", code)) {
            return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
        }

        const storedJson = await redis.hget("authCodes", code);
        const stored = storedJson ? JSON.parse(storedJson) : null;
        await redis.hdel("authCodes", code);

        if (Date.now() > stored.expiresAt) {
            return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
        }

        if (stored.client_id !== client_id || stored.redirect_uri !== redirect_uri) {
            return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
        }

        if (!code_verifier) {
            return NextResponse.json({ error: "invalid_request" }, { status: 400 });
        }

        const hash = createHash("sha256").update(code_verifier).digest("base64url");
        if (hash !== stored.code_challenge) {;
            return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
        }

        const accessToken = randomBytes(32).toString("hex");

        const accessTokenData = {
            apiToken: stored.apiToken,
            client_id: stored.client_id,
            expiresAt: Date.now() + 3600_000,
        }
        await redis.hset("accessTokens", accessToken, JSON.stringify(accessTokenData));

        
        return NextResponse.json({
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: 3600,
        });
    } catch (error) {
        console.error("Error handling token request:", error);
        return NextResponse.json({ error: "Failed to handle token request" }, { status: 500 });
    }
}