import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { redis } from "@/lib/redis";

export async function POST(req: Request) {
    try {
        const { redirect_uris } = await req.json();
        if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
            return NextResponse.json({ 
                error: "invalid_redirect_uri"
            }, { status: 400 });
        }

        const clientId = randomUUID();

        const redisSaveClient = redis.hset("clients", clientId, JSON.stringify({ redirect_uris }));

        if (!redisSaveClient) {
            return NextResponse.json({ 
                error: "failed_to_save_client"
            }, { status: 500 });
        }

        return NextResponse.json({
            client_id: clientId,
            client_id_issued_at: Math.floor(Date.now() / 1000),
            redirect_uris: redirect_uris,
            token_endpoint_auth_method: "none"
        }, { status: 201 });
    } catch (error) {
        console.error("Error registering client:", error);
        return NextResponse.json({ error: "Failed to register client" }, { status: 500 });
    }
}