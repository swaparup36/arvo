import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { ethers } from "ethers";
import { NextResponse } from "next/server";
import { createToken } from "@/lib/jwt";
import { randomBytes } from "crypto";
import { buildSignInMessage } from "@/lib/siwe";


export async function POST(req: Request) {
    try {
        const { key, address, vaultAddress, signature } = await req.json();
        const pendingAuthDataJson = await redis.get(`pendingAuth:${key}`);
        const pendingAuthData = pendingAuthDataJson ? JSON.parse(pendingAuthDataJson) : null;

        if (!pendingAuthData) {
            return NextResponse.json({ error: "Invalid or expired authorization request" }, { status: 400 });
        }

        const clientId = pendingAuthData.clientId;

        let apiToken: string;
        try {
            if (!address || !signature) {
                return NextResponse.json(
                    { message: "Address and signature are required" },
                    { status: 400 }
                );
            }
    
            // Validate wallet address
            if (!ethers.isAddress(address)) {
                return NextResponse.json(
                    { message: "Invalid wallet address" },
                    { status: 400 }
                );
            }
    
            const normalizedAddress = address.toLowerCase();
    
            // get nonce from database
            const nonceEntry = await prisma.nonce.findUnique({
                where: { address: normalizedAddress },
            });
            
            if (!nonceEntry) {
                return NextResponse.json(
                    { message: "Nonce not found for the provided address" },
                    { status: 400 }
                );
            }
    
            if (nonceEntry.expiresAt < new Date()) {
                return NextResponse.json(
                    { message: "Nonce has expired" },
                    { status: 400 }
                );
            }
    
            const message = buildSignInMessage(normalizedAddress, nonceEntry.nonce);
    
            const recoveredAddress = ethers.verifyMessage(
                message,
                signature
            );
    
            // Compare addresses
            if (recoveredAddress.toLowerCase() !== normalizedAddress) {
                return NextResponse.json(
                    { message: "Invalid signature" },
                    { status: 401 }
                );
            }
    
            // Nonce has been consumed
            await prisma.nonce.delete({
                where: { address: normalizedAddress },
            });
    
            // Check if the user already exists
            const existingUser = await prisma.user.findUnique({
                where: { address: normalizedAddress },
            });
    
            if (!existingUser) {
                return NextResponse.json(
                    { message: "User not found" },
                    { status: 404 }
                );
            }

            // generate a new wallet address for the agent
            const agentWallet = ethers.Wallet.createRandom();

            // creat a new agent
            const agent = await prisma.agent.create({
                data: {
                    id: clientId,
                    userId: existingUser.id,
                    address: agentWallet.address,
                    privateKey: agentWallet.privateKey,
                    vaultAddress: vaultAddress,
                },
            });

            if (!agent) {
                return NextResponse.json(
                    { message: "Failed to approve agent" },
                    { status: 500 }
                );
            }

            const token = createToken(existingUser.id, clientId);
    
            apiToken = token;
        } catch {
            return NextResponse.json({ error: "Could not reach the todo API" }, { status: 502 });
        }

        await redis.del(`pendingAuth:${key}`);

        const code = randomBytes(32).toString("hex");

        const authCodeData = {
            client_id: clientId,
            redirect_uri: pendingAuthData.redirectUri,
            code_challenge: pendingAuthData.codeChallenge,
            resource: pendingAuthData.resource,
            apiToken,
            expiresAt: Date.now() + 60_000,
        };

        await redis.hset("authCodes", code, JSON.stringify(authCodeData));

        const url = new URL(pendingAuthData.redirectUri);
        url.searchParams.set("code", code);
        if (pendingAuthData.state) url.searchParams.set("state", pendingAuthData.state);

        return NextResponse.json({ redirectUrl: url.toString() });
    } catch (error) {
        console.error("Error handling approve request:", error);
        return NextResponse.json({ error: "Failed to handle approve request" }, { status: 500 });
    }
}