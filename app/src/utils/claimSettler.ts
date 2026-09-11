import { env } from "@/lib/env";
import { CHAIN_TO_USDC_ADDRESS, getTokenBalance, setTokenAllowance, transferToken } from "./erc20";
import { getSwapCallData, getQuote, CHAIN_TO_UNISWAP_PROXY } from "./uniswap";
import { getSigner } from "./onChainConfig";
import { CHAIN_TO_ARVO_MAIN_ADDRESS } from "./arvoMain";

// this function checks the balance of token for the arvo main contract 
// and if the balance is less than the amount needed to give user as claim 
// then it buys that token from 1inch and sends it to the arvo main contract
export async function claimSettler(token: string, chainId: number, amountNeed: bigint) {
    try {
        // get the balance of token for the arvo main contract
        const balance = await getTokenBalance(token, CHAIN_TO_ARVO_MAIN_ADDRESS[chainId], chainId);

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
        const swapQuote = await getQuote({
            chainId: chainId,
            tokenIn: token,
            tokenOut: usdcAddress,
            amountIn: amountToBuy.toString(),
            vaultAddress: env.OWNER_ADDRESS,
        });

        if (!swapQuote) {
            return {
                success: false,
                message: "Failed to settle claim",
                error: "Failed to get swap quote from Uniswap API",
            };
        }

        const estimatedUSDCAmount = BigInt(swapQuote.quote.output.amount);

        const usdcProxyAddress = CHAIN_TO_UNISWAP_PROXY[chainId];

        // approve the 1inch router to spend USDC on behalf of the owner
        const allowance1 = await setTokenAllowance(usdcAddress, usdcProxyAddress, BigInt(0), chainId);
        if (!allowance1.txHash || !allowance1.receipt || allowance1.receipt.status !== 1) {
            return {
                success: false,
                message: "Failed to settle claim",
                error: "Failed to reset allowance for 1inch router",
            };
        }

        const allowance2 = await setTokenAllowance(usdcAddress, usdcProxyAddress, estimatedUSDCAmount, chainId);
        if (!allowance2.txHash || !allowance2.receipt || allowance2.receipt.status !== 1) {
            return {
                success: false,
                message: "Failed to settle claim",
                error: "Failed to set allowance for 1inch router",
            };
        }

        // get swap call data from 1inch
        const swapCallData = await getSwapCallData(swapQuote.quote);

        if (!swapCallData) {
            return {
                success: false,
                message: "Failed to settle claim",
                error: "Failed to get swap call data from Uniswap API",
            };
        }

        // sign the transaction using the owner private key and send it to the blockchain
        const signer = getSigner(chainId);
        const tx = await signer.sendTransaction({
            to: swapCallData.to,
            data: swapCallData.data,
            value: BigInt(swapCallData.value || "0"),
            gasLimit: BigInt(swapCallData.gasLimit || "0"),
            gasPrice: BigInt(swapCallData.gasPrice || "0"),
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
        const transfer = await transferToken(token, CHAIN_TO_ARVO_MAIN_ADDRESS[chainId], amountToBuy, chainId);
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