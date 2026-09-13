import { TradeIntentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toSerializable } from "@/lib/serialize";
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

type UpdateTradeIntentRequest = {
    intentidhash?: string;
    statustoupdate?: string;
};

export async function POST(req: Request) {
    try {
        const { intentidhash, statustoupdate }: UpdateTradeIntentRequest = await req.json();
        console.log("Received request to update trade intent:", { intentidhash, statustoupdate });
        // Validate request
        if (!intentidhash || !statustoupdate) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // must be exhaustive: anything unrecognised used to fall through to APPROVED
        if (statustoupdate !== "APPROVED" && statustoupdate !== "REJECTED") {
            return NextResponse.json(
                { error: "statustoupdate must be APPROVED or REJECTED" },
                { status: 400 }
            );
        }

        // get the trade intent id from the hash from the redis
        const intentId = await redis.get(`trade_intent_hash:${intentidhash.toLowerCase()}`);
        console.log("Retrieved intent ID from Redis:", { intentidhash, intentId });

        if (!intentId) {
            return NextResponse.json(
                { error: "Trade intent id not found" },
                { status: 404 }
            );
        }

        // get the trade intent from the database
        const tradeIntent = await prisma.tradeIntent.findUnique({
            where: { id: intentId }
        });

        if (!tradeIntent) {
            return NextResponse.json(
                { error: "Trade intent not found" },
                { status: 404 }
            );
        }

        // Update the trade intent
        const updatedTradeIntent = await prisma.tradeIntent.update({
            where: {
                id: tradeIntent.id,
            },
            data: {
                status: statustoupdate === "REJECTED" ? TradeIntentStatus.REJECTED : TradeIntentStatus.APPROVED,
            },
        });

        // only drop the hash once the update landed, otherwise a failed update is unretryable
        // await redis.del(`trade_intent_hash:${intentidhash.toLowerCase()}`);

        return NextResponse.json(
            {
                tradeIntent: toSerializable(updatedTradeIntent),
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error updating trade intent:", error);

        return NextResponse.json(
            { error: "Failed to update trade intent" },
            { status: 500 }
        );
    }
}