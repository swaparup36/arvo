import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VerifyWalletRequest } from "@/types/schema";
import { createToken } from "../../../../../middleware";
import { ethers } from "ethers";

export async function POST(req: Request) {
    try {
        const userCreationRequest: VerifyWalletRequest = await req.json();
        const { address, signature } = userCreationRequest;

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

        const message = `Sign in to Arvo

        Wallet: ${normalizedAddress}
        Nonce: ${nonceEntry.nonce}`;

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

        if (existingUser) {
            // generate a token for the existing user
            const token = createToken(existingUser.id);

            return NextResponse.json({ token }, { status: 201 });
        }

        // Create a new user
        const newUser = await prisma.user.create({
            data: {
                address: normalizedAddress,
            },
        });

        // generate a token for the new user
        const token = createToken(newUser.id);

        return NextResponse.json({ token }, { status: 201 });
    } catch (error) {
        console.log("Error user signup:", error);
        return NextResponse.json({ error: "Failed to signup user" }, { status: 500 });
    }
}