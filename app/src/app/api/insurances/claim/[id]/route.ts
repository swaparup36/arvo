import { getSwapQuote } from "@/utils/1inch";
import { claimInsurance, getInsurance, getPosition } from "@/utils/arvoMain";
import { NextResponse } from "next/server";

// GET (claim the insurance)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: insuranceId } = await params;
        const { searchParams } = new URL(req.url);
        const chainId = searchParams.get("chainId");

        if (!insuranceId || !chainId) {
            return NextResponse.json({ error: "Missing insurance ID or chain ID" }, { status: 400 });
        }

        // get the insurance details from the Arvo main contract
        const insurance = await getInsurance(insuranceId, parseInt(chainId));

        if (!insurance) {
            return NextResponse.json({ error: "Insurance not found" }, { status: 404 });
        }

        // get the position details from the insurance object
        const postion = await getPosition(insuranceId, parseInt(chainId));

        if (!postion) {
            return NextResponse.json({ error: "Position not found" }, { status: 404 });
        }

        // get the position details
        const tokenOutAddress = postion.tokenOutAddress;
        const tokenInAddress = postion.tokenInAddress;
        const amountOut = postion.amountOut;
        const amountIn = postion.amountIn;

        // get the current value of the position based on the token addresses and amounts
        const swapQuoteRequest = {
            chainId: parseInt(chainId),
            tokenIn: tokenInAddress,
            tokenOut: tokenOutAddress,
            amountIn: amountIn,
        }

        const swapQuote = await getSwapQuote(swapQuoteRequest);

        if (!swapQuote) {
            return NextResponse.json({ error: "Swap quote not found" }, { status: 404 });
        }

        const currentValue = swapQuote.dstAmount;

        // check if profit or loss
        const profitOrLoss = currentValue - amountOut;

        if (profitOrLoss > 0) { // profit
            // if a postion is in profit, the insurance can not be claimed, return an error
            return NextResponse.json({ error: "Insurance can not be claimed, position is in profit" }, { status: 400 });
        }

        // call the on chain claimInsurance function
        const { txHash, receipt } = await claimInsurance(insuranceId, parseInt(chainId));

        if (!txHash || !receipt || receipt.status !== 1) {
            return NextResponse.json({ error: "Failed to claim insurance" }, { status: 500 });
        }

        return NextResponse.json({ message: "Insurance claimed successfully", txHash, receipt }, { status: 200 });
    } catch (error) {
        console.log("Error fetching insurance details:", error);
        return NextResponse.json({ error: "Failed to fetch insurance details" }, { status: 500 });
    }
}