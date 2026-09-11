

// this function checks the balance of token for the arvo main contract 
// and if the balance is less than the amount needed to give user as claim 

import { env } from "@/lib/env";
import { CHAIN_TO_USDC_ADDRESS, getTokenBalance, setTokenAllowance, transferToken } from "./erc20";
import { getSwapCallData, getSwapQuote } from "./1inch";
import { getSigner } from "./onChainConfig";

// then it buys that token from 1inch and sends it to the arvo main contract
export async function claimSettler(token: string, chainId: number, amountNeed: bigint) {
    try {
        // get the balance of token for the arvo main contract
        const balance = await getTokenBalance(token, env.ARVO_MAIN_ADDRESS, chainId);

        if (!balance) {
            return {
                success: false,
                message: "Failed to settle claim",
                error: "Failed to get token balance",
            };
        }

        const tokenBalance = BigInt(balance);

        // if token balance is greater than or equal to the amount needed, return success
        if (tokenBalance >= amountNeed) {
            return {
                success: true,
                message: "Claim settled successfully",
            };
        }

        // token balance is less than the amount needed
        const amountToBuy = amountNeed - tokenBalance;

        // usdc address for the given chain id
        const usdcAddress = CHAIN_TO_USDC_ADDRESS[chainId];

        // get quote for swap from 1inch - this is to determine how much USDC we should spend to get the amount of token needed
        const swapQuote = await getSwapQuote({
            chainId: chainId,
            tokenIn: token,
            tokenOut: usdcAddress,
            amountIn: amountToBuy.toString(),
        });

        const estimatedUSDCAmount = BigInt(swapQuote.dstAmount);

        // get swap call data from 1inch
        const swapCallData = await getSwapCallData({
            chainId: chainId,
            tokenIn: usdcAddress,
            tokenOut: token,
            amountIn: (estimatedUSDCAmount + BigInt(1000000000000000)).toString(), // slightly more than estimated to account for slippage
            from: env.OWNER_ADDRESS,
            origin: env.OWNER_ADDRESS,
            minAmountOut: amountToBuy.toString(),
        });

        // approve the 1inch router to spend USDC on behalf of the owner
        const allowance1 = await setTokenAllowance(usdcAddress, swapCallData.tx.to, BigInt(0), chainId);
        if (!allowance1.txHash || !allowance1.receipt || allowance1.receipt.status !== 1) {
            return {
                success: false,
                message: "Failed to settle claim",
                error: "Failed to reset allowance for 1inch router",
            };
        }

        const allowance2 = await setTokenAllowance(usdcAddress, swapCallData.tx.to, estimatedUSDCAmount + BigInt(1000000000000000), chainId);
        if (!allowance2.txHash || !allowance2.receipt || allowance2.receipt.status !== 1) {
            return {
                success: false,
                message: "Failed to settle claim",
                error: "Failed to set allowance for 1inch router",
            };
        }

        // sign the transaction using the owner private key and send it to the blockchain
        const txData = swapCallData.tx;

        const signer = getSigner(chainId);
        const tx = await signer.sendTransaction({
            to: txData.to,
            data: txData.data,
            value: BigInt(txData.value || "0"),
            gasLimit: BigInt(txData.gas),
            gasPrice: BigInt(txData.gasPrice),
        });

        console.log("Swap tx:", tx.hash);

        const receipt = await tx.wait();

        if (receipt && receipt.status !== 1) {
            return {
                success: false,
                message: "Failed to settle claim",
                error: "Swap transaction failed",
            };
        }

        console.log("Swap successful:", tx.hash);

        // send the bought token to the arvo main contract
        const transfer = await transferToken(token, env.ARVO_MAIN_ADDRESS, amountToBuy, chainId);
        if (!transfer.txHash || !transfer.receipt || transfer.receipt.status !== 1) {
            return {
                success: false,
                message: "Failed to settle claim",
                error: "Failed to transfer token to Arvo main contract",
            };
        }

        console.log("Transfer successful:", transfer.txHash);

        return {
            success: true,
            message: "Claim settled successfully",
            txHash: transfer.txHash,
        };
    } catch (error) {
        console.error("Error in claimSettler:", error);
        return {
            success: false,
            message: "Failed to settle claim",
            error: error instanceof Error ? error.message : String(error),
        };
    }
}