import { OnChainSubmitRiskAssessmentStruct, OnChainSubmitTradeConfirmationStruct, OnChainSubmitTradeIntentStruct } from "@/types/schema";
import { getArvoMain } from "./onChainConfig";
import { env } from "@/lib/env";


export const CHAIN_TO_ARVO_MAIN_ADDRESS: Record<number, string> = {
  1: env.ARVO_MAIN_ETH_ADDRESS,
  11155111: env.ARVO_MAIN_SEPOLIA_ADDRESS,
};

export async function submitTradeIntent(intent: OnChainSubmitTradeIntentStruct, chainId: number) {
  try {
    const tx = await getArvoMain(chainId).submitTradeIntent({
      id: intent.id,
      userAddress: intent.userAddress,
      agentAddress: intent.agentAddress,
      vaultAddress: intent.vaultAddress,
      tokenIn: intent.tokenIn,
      tokenOut: intent.tokenOut,
      amountIn: intent.amountIn,
      minAmountOut: intent.minAmountOut,
      deadline: intent.deadline,
      maxPremium: intent.maxPremium,
      minCoverage: intent.minCoverage,
      minCoverageDuration: intent.minCoverageDuration,
      signature: intent.signature,
      status: intent.status,
      createdAt: intent.createdAt
    });

    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      receipt
    };
  } catch (error) {
    console.error("Error submitting trade intent:", error);
    return {
      txHash: null,
      receipt: null
    };
  }
}

export async function submitRiskAssessment(assessment: OnChainSubmitRiskAssessmentStruct, chainId: number) {
  try {
    const tx = await getArvoMain(chainId).submitRiskAssessment({
      id: assessment.id,
      intentId: assessment.intentId,
      riskScore: assessment.riskScore,
      premium: assessment.premium,
      coverage: assessment.coverage,
      coverageDuration: assessment.coverageDuration,
      signature: assessment.signature,
      assessedAt: assessment.assessedAt,
      expiresAt: assessment.expiresAt,
      assessmentHash: assessment.assessmentHash
    });

    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      receipt
    };
  } catch (error) {
    console.error("Error submitting risk assessment:", error);
    return {
      txHash: null,
      receipt: null
    };
  }
}

export async function submitTradeConfirmation(confirmation: OnChainSubmitTradeConfirmationStruct, chainId: number) {
  try {
    const tx = await getArvoMain(chainId).submitTradeConfirmation({
      id: confirmation.id,
      intentId: confirmation.intentId,
      transactionHash: confirmation.transactionHash,
      tokenIn: confirmation.tokenIn,
      tokenOut: confirmation.tokenOut,
      amountIn: confirmation.amountIn,
      amountOut: confirmation.amountOut,
      signature: confirmation.signature,
      executedAt: confirmation.executedAt,
      createdAt: confirmation.createdAt
    });

    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      receipt
    };
  } catch (error) {
    console.error("Error submitting trade confirmation:", error);
    return {
      txHash: null,
      receipt: null
    };
  }
}

export async function getTradeIntent(intentId: string, chainId: number) {
  try {
    const intent = await getArvoMain(chainId).getTradeIntent(intentId);

    return intent;
  } catch (error) {
    console.error("Error fetching trade intent:", error);
    return null;
  }
}

export async function getRiskAssessment(intentId: string, chainId: number) {
  try {
    const assessment = await getArvoMain(chainId).getRiskAssessment(intentId);

    return assessment;
  } catch (error) {
    console.error("Error fetching risk assessment:", error);
    return null;
  }
}

export async function getTradeConfirmation(intentId: string, chainId: number) {
  try {
    const confirmation = await getArvoMain(chainId).getTradeConfirmation(intentId);

    return confirmation;
  } catch (error) {
    console.error("Error fetching trade confirmation:", error);
    return null;
  }
}

export async function getInsuranceByTradeIntentId(intentId: string, chainId: number) {
  try {
    const insurance = await getArvoMain(chainId).getInsuranceByTradeIntentId(intentId);

    return insurance;
  } catch (error) {
    console.error("Error fetching insurance by trade intent ID:", error);
    return null;
  }
}

export async function getInsurance(insuranceId: string, chainId: number) {
  try {
    const insurance = await getArvoMain(chainId).getInsurance(insuranceId);

    return insurance;
  } catch (error) {
    console.error("Error fetching insurance:", error);
    return null;
  }
}

export async function getPositionByTradeIntentId(intentId: string, chainId: number) {
  try {
    const position = await getArvoMain(chainId).getPositionByTradeIntentId(intentId);

    return position;
  } catch (error) {
    console.error("Error fetching position by trade intent ID:", error);
    return null;
  }
}

export async function getPosition(insuranceId: string, chainId: number) {
  try {
    const position = await getArvoMain(chainId).getPosition(insuranceId);

    return position;
  } catch (error) {
    console.error("Error fetching position:", error);
    return null;
  }
}

export async function invalidateInsurance(insuranceId: string, chainId: number) {
  try {
    const tx = await getArvoMain(chainId).invalidateInsurance(insuranceId);

    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      receipt
    };
  } catch (error) {
    console.error("Error invalidating insurance:", error);
    return {
      txHash: null,
      receipt: null
    };
  }
}

export async function claimInsurance(insuranceId: string, chainId: number) {
  try {
    const tx = await getArvoMain(chainId).claimInsurance(insuranceId);

    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      receipt
    };
  } catch (error) {
    console.error("Error claiming insurance:", error);
    return {
      txHash: null,
      receipt: null
    };
  }
}