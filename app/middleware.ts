import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { redis } from "@/lib/redis";
import { env } from "@/lib/env";

const JWT_SECRET = process.env.JWT_SECRET!;

export function createToken(userId: string, agentId?: string) {
  return jwt.sign(
    { userId, agentId },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

export function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (typeof decoded === "string") {
      return null;
    }

    return decoded as { userId: string; agentId?: string };
  } catch {
    return null;
  }
}

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

export function middleware(request: NextRequest, response: NextResponse) {
    const path = request.nextUrl.pathname;

    if (path.startsWith("/api/risk-report")) {
        return riskReportMiddleware(request);
    }

    if (path.startsWith("/api/trade-confirmation")) {
        return tradeConfirmationMiddleware(request);
    }

    if (path.startsWith("/api/trade-indent")) {
        return tradeIndentMiddleware(request);
    }

    return NextResponse.next();
}