import { env } from "@/lib/env";
import { redis } from "@/lib/redis";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    try {
        const queryParams = new URL(req.url).searchParams;
        const clientId = queryParams.get("client_id");
        const redirectUri = queryParams.get("redirect_uri");
        const responseType = queryParams.get("response_type");
        const state = queryParams.get("state");
        const codeChallenge = queryParams.get("code_challenge");
        const codeChallengeMethod = queryParams.get("code_challenge_method");
        const resource = queryParams.get("resource");

        if (!clientId || !await redis.hget("clients", clientId)) {
            return NextResponse.json({ error: "invalid_client" }, { status: 400 });
        }

        const redirectUrisJson = await redis.hget("clients", clientId);
        const redirectUris = JSON.parse(redirectUrisJson as string);
        if (!redirectUri || !redirectUris.includes(redirectUri as string)) {
            return NextResponse.json({ error: "invalid_redirect_uri" }, { status: 400 });
        }

        if (responseType !== "code") {
            return NextResponse.json({ error: "unsupported_response_type" }, { status: 400 });
        }

        if (!codeChallenge) {
            return NextResponse.json({ error: "missing_code_challenge" }, { status: 400 });
        }

        if (codeChallengeMethod !== "S256") {
            return NextResponse.json({ error: "unsupported_code_challenge_method" }, { status: 400 });
    }

        const pendingReqKey = randomUUID();
        const pendingAuthData = { clientId, redirectUri, state, codeChallenge, codeChallengeMethod, resource };
        
        // 10 min TTL
        await redis.set(`pendingAuth:${pendingReqKey}`, JSON.stringify(pendingAuthData), "EX", 600);
        console.log("Pending auth request stored with key:", pendingReqKey);

        // redirect to a consent page with the pendingReqKey as a query parameter
        return NextResponse.redirect(`${(env.BASE_URL)}/consent?key=${pendingReqKey}`);
    } catch (error) {
        console.error("Error handling authorize request:", error);
        return NextResponse.json({ error: "Failed to handle authorize request" }, { status: 500 });
    }
}