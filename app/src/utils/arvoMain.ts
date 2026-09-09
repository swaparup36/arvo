import { OnChainSubmitRiskAssessmentStruct, OnChainSubmitTradeConfirmationStruct, OnChainSubmitTradeIntentStruct } from "@/types/schema";
import { getArvoMain } from "./onChainConfig";


export async function submitTradeIntent(intent: OnChainSubmitTradeIntentStruct, chainId: number) {
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
}

export async function submitRiskAssessment(assessment: OnChainSubmitRiskAssessmentStruct, chainId: number) {
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
}

export async function submitTradeConfirmation(confirmation: OnChainSubmitTradeConfirmationStruct, chainId: number) {
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
}

export async function getTradeIntent(intentId: string, chainId: number) {
  const intent = await getArvoMain(chainId).getTradeIntent(intentId);

  return intent;
}

export async function getRiskAssessment(intentId: string, chainId: number) {
  const assessment = await getArvoMain(chainId).getRiskAssessment(intentId);

  return assessment;
}

export async function getTradeConfirmation(intentId: string, chainId: number) {
  const confirmation =
    await getArvoMain(chainId).getTradeConfirmation(intentId);

  return confirmation;
}

export async function getInsuranceByTradeIntentId(intentId: string, chainId: number) {
  const insurance = await getArvoMain(chainId).getInsuranceByTradeIntentId(intentId);

  return insurance;
}

export async function getInsurance(insuranceId: string, chainId: number) {
  const insurance =
    await getArvoMain(chainId).getInsurance(insuranceId);

  return insurance;   
}

export async function getPositionByTradeIntentId(intentId: string, chainId: number) {
  const position = await getArvoMain(chainId).getPositionByTradeIntentId(intentId);

  return position;
}

export async function getPosition(insuranceId: string, chainId: number) {
  const position =
    await getArvoMain(chainId).getPosition(insuranceId);

  return position;
}

export async function invalidateInsurance(insuranceId: string, chainId: number) {
  const tx = await getArvoMain(chainId).invalidateInsurance(insuranceId);

  const receipt = await tx.wait();

  return {
    txHash: receipt.hash,
    receipt
  };
}