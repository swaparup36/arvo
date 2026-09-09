import { redis } from "./redis.js";
import type { TradeIntent } from "./types.js";
import { getApproveCallData, getRouterAddress, getSwapCallData } from "./utils.js";

async function pipeLine(tradeIntent: TradeIntent) {
    // get the call data for the swap from 1inch
    const swapCallData = await getSwapCallData({
        chainId: tradeIntent.chainId,
        tokenIn: tradeIntent.tokenIn,
        tokenOut: tradeIntent.tokenIn,
        amountIn: tradeIntent.amountIn.toString(),
        from: tradeIntent.userAddress,
        origin: tradeIntent.agentAddress,
        minAmountOut: tradeIntent.minAmountOut.toString(),
    });

    // get the router address from 1inch
    const routerAddress = await getRouterAddress(tradeIntent.chainId);

    // TODO: set the allowance to zero for the router address to spend the tokenIn from the vault address

    // get the approve call data for the router address to spend the tokenIn from the vault address
    const approveCallData = await getApproveCallData({
        chainId: tradeIntent.chainId,
        tokenAddress: tradeIntent.tokenIn,
        amount: tradeIntent.amountIn.toString(),
    });

    // TODO: call the execute function on the vault contract for approve

    // TODO: call the execute function on the vault contract for swap

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

main().catch((error) => {
    console.error("Error in trade engine:", error);
});