import { ARVO_BACKEND_URL, TRADE_CONFIRMATION_SECRET } from "./constants.js";
import { approveTokenOnVault, executeOnVault } from "./onchain-utils/vault.js";
import { redis } from "./redis.js";
import type { CreateTradeConfirmationRequest, TradeIntent } from "./types.js";
import { getSwapCallData } from "./utils.js";

export async function pipeLine(tradeIntent: TradeIntent) {
    // get the call data for the swap from 1inch
    const swapCallData = await getSwapCallData({
        chainId: tradeIntent.chainId,
        tokenIn: tradeIntent.tokenIn,
        tokenOut: tradeIntent.tokenOut,
        amountIn: tradeIntent.amountIn.toString(),
        from: tradeIntent.userAddress,
        origin: tradeIntent.agentAddress,
        minAmountOut: tradeIntent.minAmountOut.toString(),
    });

    const vaultAddress = tradeIntent.vaultAddress;
    const chainId = tradeIntent.chainId;
    const routerAddress = swapCallData.tx.to;

    const approveZeroTx = await approveTokenOnVault(vaultAddress, tradeIntent.tokenIn, routerAddress, 0n, chainId);

    if (!approveZeroTx.txHash) {
        console.error("Failed to set allowance to zero on vault");
        return;
    }

    console.log("Allowance set to zero on vault with hash:", approveZeroTx.txHash, ". Proceeding with approval...");

    const approveTx = await approveTokenOnVault(vaultAddress, tradeIntent.tokenIn, routerAddress, tradeIntent.amountIn, chainId);

    if (!approveTx.txHash) {
        console.error("Failed to approve token on vault");
        return;
    }

    console.log("Token approved on vault with hash:", approveTx.txHash, ". Proceeding with swap...");

    const swapTx = await executeOnVault(vaultAddress, routerAddress, 0n, swapCallData.tx.data, chainId);

    if (!swapTx.txHash) {
        console.error("Failed to execute swap on vault");
        return;
    }

    console.log("Swap executed on vault with hash:", swapTx.txHash);

    // send the trade confirmation to backend
    const tradeConfirmationRequest: CreateTradeConfirmationRequest = {
        intentId: tradeIntent.id,
        transactionHash: swapTx.txHash,
        chainId: tradeIntent.chainId,
        tokenIn: tradeIntent.tokenIn,
        tokenOut: tradeIntent.tokenOut,
        amountIn: tradeIntent.amountIn,
        amountOut: BigInt(swapCallData.dstAmount),
        signature: tradeIntent.signature,
        executedAt: new Date(),
    };

    const response = await fetch(`${ARVO_BACKEND_URL}/api/trade-intent/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${TRADE_CONFIRMATION_SECRET}`,
        },
        // bigint has no JSON representation; send amounts as decimal strings
        body: JSON.stringify(tradeConfirmationRequest, (_, v) => typeof v === "bigint" ? v.toString() : v),
    });

    if (!response.ok) {
        console.error("Failed to send trade confirmation to backend");
        return;
    }

    console.log("Trade confirmation sent to backend successfully");
}


async function main() {
    while (true) {
        // dequeue trade intent form trade_execution_queue
        const tradeIntentString = await redis.rpop("trade_execution_queue");
        const tradeIntent: TradeIntent = tradeIntentString ? JSON.parse(tradeIntentString) : null;
        if (!tradeIntent) {
            console.log("No trade intent found in the queue. Waiting for new trade intents...");
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before checking again
            continue;
        }

        console.log("Processing trade intent:", tradeIntent.id);

        // run the pipeline for the trade intent
        try {
            await pipeLine(tradeIntent);
            console.log("Trade intent processed successfully:", tradeIntent.id);
        } catch (error) {
            console.error("Error processing trade intent:", tradeIntent.id, error);
        }
    }
}

if (import.meta.main) {
    main().catch((error) => {
        console.error("Error in trade engine:", error);
    });
}