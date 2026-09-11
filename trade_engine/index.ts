import { ARVO_BACKEND_URL, TRADE_CONFIRMATION_SECRET } from "./constants.js";
import { approveTokenOnVault, executeOnVault } from "./onchain-utils/vault.js";
import { resetNonce } from "./onchain-utils/onChainConfig.js";
import { redis } from "./redis.js";
import type { CreateTradeConfirmationRequest, TradeIntent } from "./types.js";
import { CHAIN_TO_UNISWAP_PROXY, getQuote, getSwapCallData } from "./utils.js";

export async function pipeLine(tradeIntent: TradeIntent) {
    const vaultAddress = tradeIntent.vaultAddress;
    const chainId = tradeIntent.chainId;
    const proxyContractAddress = CHAIN_TO_UNISWAP_PROXY[chainId]!;

    const approveZeroTx = await approveTokenOnVault(vaultAddress, tradeIntent.tokenIn, proxyContractAddress, 0n, chainId);

    if (!approveZeroTx.txHash) {
        console.error("Failed to set allowance to zero on vault");
        return;
    }

    console.log("Allowance set to zero on vault with hash:", approveZeroTx.txHash, ". Proceeding with approval...");

    const approveTx = await approveTokenOnVault(vaultAddress, tradeIntent.tokenIn, proxyContractAddress, tradeIntent.amountIn, chainId);

    if (!approveTx.txHash) {
        console.error("Failed to approve token on vault");
        return;
    }

    console.log("Token approved on vault with hash:", approveTx.txHash, ". Proceeding with swap...");

    const swapQuote = await getQuote({
        chainId: tradeIntent.chainId,
        tokenIn: tradeIntent.tokenIn,
        tokenOut: tradeIntent.tokenOut,
        amountIn: tradeIntent.amountIn.toString(),
        vaultAddress: tradeIntent.vaultAddress,
    });

    if (!swapQuote) {
        console.error("Failed to get swap quote from Uniswap API");
        return;
    }

    // get the amount out from the quote and convert it to bigint
    const amountOut = BigInt(swapQuote.quote.output.amount);

    console.log("minAmountOut: ", tradeIntent.minAmountOut.toString());
    console.log("amountOut: ", amountOut.toString());

    if (amountOut < tradeIntent.minAmountOut) {
        console.error("Swap quote amount out is less than the minimum amount out specified in the trade intent");
        return;
    }

    const swapCallData = await getSwapCallData(swapQuote.quote);

    if (!swapCallData) {
        console.error("Failed to get swap call data from Uniswap API");
        return;
    }

    const swapTx = await executeOnVault(vaultAddress, proxyContractAddress, 0n, swapCallData.data, chainId);

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
        amountOut: amountOut,
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
            resetNonce(tradeIntent.chainId);
        }
    }
}

if (import.meta.main) {
    main().catch((error) => {
        console.error("Error in trade engine:", error);
    });
}