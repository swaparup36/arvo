import { NextResponse } from "next/server";
import { env } from "process";

export async function GET() {
    try {
        return NextResponse.json({
            resource: `${env.BASE_MCP_URL}/resources`,
            authorization_servers: [env.BASE_MCP_URL],
        });
    } catch (error) {
        console.error("Error fetching OAuth protected resource:", error);
        return NextResponse.json({ error: "Failed to fetch OAuth protected resource" }, { status: 500 });
    }
}