import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { env } from "@/lib/env";
import { verifyToken } from "@/lib/jwt";

function riskReportMiddleware(request: NextRequest) {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
        return NextResponse.json(
            { message: "Missing Authorization header" },
            { status: 401 }
        );
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        return NextResponse.json(
            { message: "Invalid Authorization header" },
            { status: 401 }
        );
    }

    if (token !== process.env.RISK_REPORT_SECRET) {
        return NextResponse.json(
            { message: "Wrong Risk Report secret" },
            { status: 401 }
        );
    }

    return NextResponse.next();
}

function tradeConfirmationMiddleware(request: NextRequest) {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
        return NextResponse.json(
            { message: "Missing Authorization header" },
            { status: 401 }
        );
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        return NextResponse.json(
            { message: "Invalid Authorization header" },
            { status: 401 }
        );
    }

    if (token !== process.env.TRADE_CONFIRMATION_SECRET) {
        return NextResponse.json(
            { message: "Wrong Trade Confirmation secret" },
            { status: 401 }
        );
    }

    return NextResponse.next();
}

function tradeIndentMiddleware(request: NextRequest) {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
        return NextResponse.json(
            { message: "Missing Authorization header" },
            { status: 401 }
        );
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        return NextResponse.json(
            { message: "Invalid Authorization header" },
            { status: 401 }
        );
    }

    const decoded = verifyToken(token);

    if (!decoded) {
        return NextResponse.json(
            { message: "Invalid token" },
            { status: 401 }
        );
    }

    return NextResponse.next();
}

// Returns a 401 response with the WWW-Authenticate header set to indicate that the resource is protected and requires a Bearer token for access
function unauthorized() {
    return NextResponse.json(
        { error: "unauthorized" },
        {
            status: 401,
            headers: {
                "WWW-Authenticate": `Bearer resource_metadata="${env.BASE_MCP_URL}/.well-known/oauth-protected-resource"`,
            },
        }
    );
}

async function mcpAuthMiddleware(request: NextRequest) {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return unauthorized();
    }

    const token = authHeader.slice(7).trim();

    const tokenDataJson = token ? await redis.hget("accessTokens", token) : null;
    const tokenData = tokenDataJson ? JSON.parse(tokenDataJson) : null;

    if (!tokenData) {
        return unauthorized();
    }

    if (Date.now() > tokenData.expiresAt) {
        await redis.hdel("accessTokens", token);
        return unauthorized();
    }

    const decoded = verifyToken(tokenData.apiToken);

    if (!decoded) {
        return unauthorized();
    }

    // mutate the request headers to include the API token for the downstream handler
    const headers = new Headers(request.headers);
    headers.set("x-api-token", tokenData.apiToken);

    return NextResponse.next({ request: { headers } });
};

export function proxy(request: NextRequest) {
    const path = request.nextUrl.pathname;

    if (path.startsWith("/api/risk-report")) {
        return riskReportMiddleware(request);
    }

    if (path.startsWith("/api/trade-confirmation")) {
        return tradeConfirmationMiddleware(request);
    }

    if (path === "/api/trade-intent") {
        return tradeIndentMiddleware(request);
    }

    if (path.startsWith("/api/mcp/resources")) {
        return mcpAuthMiddleware(request);
    }

    return NextResponse.next();
}
