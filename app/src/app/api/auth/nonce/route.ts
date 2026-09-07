import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { address } = await req.json();

    if (!address) {
      return NextResponse.json(
        { message: "Wallet address is required" },
        { status: 400 }
      );
    }

    // Validate Ethereum address
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { message: "Invalid wallet address" },
        { status: 400 }
      );
    }

    // Generate cryptographically secure nonce
    const nonce = crypto.randomBytes(32).toString("hex");

    // save nonce to database
    const nonceEntry = await prisma.nonce.create({
      data: {
        address,
        nonce,
      },
    });

    return NextResponse.json({ nonce: nonceEntry.nonce }, { status: 200 });
  } catch (error) {
    console.error("Nonce generation error:", error);

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}