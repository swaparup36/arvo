import { NextResponse } from "next/server";
import { env } from "process";

export async function GET() {
    try {
        return NextResponse.json({
            issuer: env.BASE_MCP_URL,
            authorization_endpoint: `${env.BASE_MCP_URL}/authorize`,
            token_endpoint: `${env.BASE_MCP_URL}/token`,
            registration_endpoint: `${env.BASE_MCP_URL}/register`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            code_challenge_methods_supported: ["S256"],
            token_endpoint_auth_methods_supported: ["none"]
        });
    } catch (error) {
        console.error("Error fetching OAuth authorization server:", error);
        return NextResponse.json({ error: "Failed to fetch OAuth authorization server" }, { status: 500 });
    }
}