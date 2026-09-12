import { ARVO_BACKEND_URL, EXECUTOR_PRIVATE_KEY, TRADE_CONFIRMATION_SECRET } from "./constants.js";
import { approveTokenOnVault, executeOnVault } from "./onchain-utils/vault.js";
import { getBlockTimestamp, resetNonce } from "./onchain-utils/onChainConfig.js";
import { redis } from "./redis.js";
import type { CreateTradeConfirmationRequest, TradeIntent } from "./types.js";
import { CHAIN_TO_UNISWAP_PROXY, getQuote, getSwapCallData } from "./utils.js";
import { CHAIN_TO_ARVO_MAIN_ADDRESS } from "./onchain-utils/arvoMain.js";
import { ethers } from "ethers";

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

    // generate an id for the trade confirmation
    const id = crypto.randomUUID();
    // get the block timestamp for the executed transaction
    const executedAt = await getBlockTimestamp(chainId);

    // create the trade confirmation struct to be signed
    const confirmation = {
        id,
        intentId: tradeIntent.id,
        transactionHash: swapTx.txHash,
        tokenIn: tradeIntent.tokenIn,
        tokenOut: tradeIntent.tokenOut,
        amountIn: tradeIntent.amountIn,
        amountOut: amountOut,
        executedAt,
    };

    // sign the trade confirmation struct with the executor's private key
    const domain = {
        name: "ArvoMain",
        version: "1",
        chainId: tradeIntent.chainId,
        verifyingContract: CHAIN_TO_ARVO_MAIN_ADDRESS[tradeIntent.chainId]!,
    };

    // define the types for the trade confirmation struct
    const types = {
        TradeConfirmation: [
            { name: "id", type: "string" },
            { name: "intentId", type: "string" },
            { name: "transactionHash", type: "string" },
            { name: "tokenIn", type: "address" },
            { name: "tokenOut", type: "address" },
            { name: "amountIn", type: "uint256" },
            { name: "amountOut", type: "uint256" },
            { name: "executedAt", type: "uint256" },
        ],
    };

    const executorWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY);

    // sign the trade confirmation struct with the executor's private key
    const signature = await executorWallet.signTypedData(
        domain,
        types,
        confirmation
    );

    // send the trade confirmation to backend
    const tradeConfirmationRequest: CreateTradeConfirmationRequest = {
        id,
        intentId: tradeIntent.id,
        transactionHash: swapTx.txHash,
        chainId: tradeIntent.chainId,
        tokenIn: tradeIntent.tokenIn,
        tokenOut: tradeIntent.tokenOut,
        amountIn: tradeIntent.amountIn.toString(),
        amountOut: amountOut.toString(),
        signature: signature,
        executedAt: new Date(executedAt * 1000),
    };

    console.log("trade executed at: ", tradeConfirmationRequest.executedAt.toISOString());
    console.log("trade deadline at: ", tradeIntent.deadline.toISOString());

    const response = await fetch(`${ARVO_BACKEND_URL}/api/trade-confirmation/`, {
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
        console.log("Dequeued trade intent:", tradeIntentString);
        const tradeIntent: TradeIntent | null = tradeIntentString
        ? (() => {
            const data = JSON.parse(tradeIntentString);

            return {
                ...data,
                amountIn: BigInt(data.amountIn),
                minAmountOut: BigInt(data.minAmountOut),
                maxPremium: BigInt(data.maxPremium),
                minCoverageDuration: BigInt(data.minCoverageDuration),
                deadline: new Date(data.deadline),
                createdAt: new Date(data.createdAt),
                updatedAt: new Date(data.updatedAt),
            };
            })()
        : null;
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