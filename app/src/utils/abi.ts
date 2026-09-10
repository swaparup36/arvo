export const ARVO_MAIN_ABI = [
  {
    inputs: [
      {
        internalType: "struct TradeIntent",
        name: "intent",
        type: "tuple",
        components: [
          { internalType: "string", name: "id", type: "string" },
          { internalType: "address", name: "userAddress", type: "address" },
          { internalType: "address", name: "agentAddress", type: "address" },
          { internalType: "address", name: "vaultAddress", type: "address" },
          { internalType: "address", name: "tokenIn", type: "address" },
          { internalType: "address", name: "tokenOut", type: "address" },
          { internalType: "uint256", name: "amountIn", type: "uint256" },
          { internalType: "uint256", name: "minAmountOut", type: "uint256" },
          { internalType: "uint256", name: "deadline", type: "uint256" },
          { internalType: "uint256", name: "maxPremium", type: "uint256" },
          { internalType: "uint32", name: "minCoverage", type: "uint32" },
          { internalType: "uint256", name: "minCoverageDuration", type: "uint256" },
          { internalType: "bytes", name: "signature", type: "bytes" },
          { internalType: "enum TradeIntentStatus", name: "status", type: "uint8" },
          { internalType: "uint256", name: "createdAt", type: "uint256" }
        ]
      }
    ],
    name: "submitTradeIntent",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "struct RiskAssessment",
        name: "assessment",
        type: "tuple",
        components: [
          {
            internalType: "string",
            name: "id",
            type: "string"
          },
          {
            internalType: "string",
            name: "intentId",
            type: "string"
          },
          {
            internalType: "uint256",
            name: "riskScore",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "premium",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "coverage",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "coverageDuration",
            type: "uint256"
          },
          {
            internalType: "bytes",
            name: "signature",
            type: "bytes"
          },
          {
            internalType: "uint256",
            name: "assessedAt",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "expiresAt",
            type: "uint256"
          },
          {
            internalType: "string",
            name: "assessmentHash",
            type: "string"
          }
        ]
      }
    ],
    name: "submitRiskAssessment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "struct TradeConfirmation",
        name: "confirmation",
        type: "tuple",
        components: [
          {
            internalType: "string",
            name: "id",
            type: "string"
          },
          {
            internalType: "string",
            name: "intentId",
            type: "string"
          },
          {
            internalType: "string",
            name: "transactionHash",
            type: "string"
          },
          {
            internalType: "address",
            name: "tokenIn",
            type: "address"
          },
          {
            internalType: "address",
            name: "tokenOut",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "amountIn",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "amountOut",
            type: "uint256"
          },
          {
            internalType: "bytes",
            name: "signature",
            type: "bytes"
          },
          {
            internalType: "uint256",
            name: "executedAt",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "createdAt",
            type: "uint256"
          }
        ]
      }
    ],
    name: "submitTradeConfirmation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "intentId",
        type: "string"
      }
    ],
    name: "getTradeIntent",
    outputs: [
      {
        internalType: "struct TradeIntent",
        name: "",
        type: "tuple",
        components: [
          {
            internalType: "string",
            name: "id",
            type: "string"
          },
          {
            internalType: "address",
            name: "userAddress",
            type: "address"
          },
          {
            internalType: "address",
            name: "agentAddress",
            type: "address"
          },
          {
            internalType: "address",
            name: "vaultAddress",
            type: "address"
          },
          {
            internalType: "address",
            name: "tokenIn",
            type: "address"
          },
          {
            internalType: "address",
            name: "tokenOut",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "amountIn",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "minAmountOut",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "maxPremium",
            type: "uint256"
          },
          {
            internalType: "uint32",
            name: "minCoverage",
            type: "uint32"
          },
          {
            internalType: "uint256",
            name: "minCoverageDuration",
            type: "uint256"
          },
          {
            internalType: "bytes",
            name: "signature",
            type: "bytes"
          },
          {
            internalType: "enum TradeIntentStatus",
            name: "status",
            type: "uint8"
          },
          {
            internalType: "uint256",
            name: "createdAt",
            type: "uint256"
          }
        ]
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "intentId",
        type: "string"
      }
    ],
    name: "getRiskAssessment",
    outputs: [
      {
        internalType: "struct RiskAssessment",
        name: "",
        type: "tuple",
        components: [
          {
            internalType: "string",
            name: "id",
            type: "string"
          },
          {
            internalType: "string",
            name: "intentId",
            type: "string"
          },
          {
            internalType: "uint256",
            name: "riskScore",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "premium",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "coverage",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "coverageDuration",
            type: "uint256"
          },
          {
            internalType: "bytes",
            name: "signature",
            type: "bytes"
          },
          {
            internalType: "uint256",
            name: "assessedAt",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "expiresAt",
            type: "uint256"
          },
          {
            internalType: "string",
            name: "assessmentHash",
            type: "string"
          }
        ]
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "intentId",
        type: "string"
      }
    ],
    name: "getTradeConfirmation",
    outputs: [
      {
        internalType: "struct TradeConfirmation",
        name: "",
        type: "tuple",
        components: [
          {
            internalType: "string",
            name: "id",
            type: "string"
          },
          {
            internalType: "string",
            name: "intentId",
            type: "string"
          },
          {
            internalType: "string",
            name: "transactionHash",
            type: "string"
          },
          {
            internalType: "address",
            name: "tokenIn",
            type: "address"
          },
          {
            internalType: "address",
            name: "tokenOut",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "amountIn",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "amountOut",
            type: "uint256"
          },
          {
            internalType: "bytes",
            name: "signature",
            type: "bytes"
          },
          {
            internalType: "uint256",
            name: "executedAt",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "createdAt",
            type: "uint256"
          }
        ]
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "intentId",
        type: "string"
      }
    ],
    name: "getInsuranceByTradeIntentId",
    outputs: [
      {
        internalType: "struct Insurance",
        name: "",
        type: "tuple",
        components: [
          {
            internalType: "string",
            name: "id",
            type: "string"
          },
          {
            internalType: "string",
            name: "tradeIntentId",
            type: "string"
          },
          {
            internalType: "string",
            name: "riskAssessmentId",
            type: "string"
          },
          {
            internalType: "string",
            name: "tradeConfirmationId",
            type: "string"
          },
          {
            internalType: "uint256",
            name: "premium",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "coverage",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "coverageDuration",
            type: "uint256"
          },
          {
            internalType: "bool",
            name: "valid",
            type: "bool"
          },
          {
            internalType: "uint256",
            name: "createdAt",
            type: "uint256"
          }
        ]
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "insuranceId",
        type: "string"
      }
    ],
    name: "getInsurance",
    outputs: [
      {
        internalType: "struct Insurance",
        name: "",
        type: "tuple",
        components: [
          {
            internalType: "string",
            name: "id",
            type: "string"
          },
          {
            internalType: "string",
            name: "tradeIntentId",
            type: "string"
          },
          {
            internalType: "string",
            name: "riskAssessmentId",
            type: "string"
          },
          {
            internalType: "string",
            name: "tradeConfirmationId",
            type: "string"
          },
          {
            internalType: "uint256",
            name: "premium",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "coverage",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "coverageDuration",
            type: "uint256"
          },
          {
            internalType: "bool",
            name: "valid",
            type: "bool"
          },
          {
            internalType: "uint256",
            name: "createdAt",
            type: "uint256"
          }
        ]
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "intentId",
        type: "string"
      }
    ],
    name: "getPositionByTradeIntentId",
    outputs: [
      {
        internalType: "struct Position",
        name: "",
        type: "tuple",
        components: [
          {
            internalType: "string",
            name: "id",
            type: "string"
          },
          {
            internalType: "string",
            name: "insuranceId",
            type: "string"
          },
          {
            internalType: "address",
            name: "vaultAddress",
            type: "address"
          },
          {
            internalType: "address",
            name: "tokenOutAddress",
            type: "address"
          },
          {
            internalType: "address",
            name: "tokenInAddress",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "amountOut",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "amountIn",
            type: "uint256"
          },
          {
            internalType: "bool",
            name: "isActive",
            type: "bool"
          },
          {
            internalType: "uint256",
            name: "createdAt",
            type: "uint256"
          }
        ]
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "insuranceId",
        type: "string"
      }
    ],
    name: "getPosition",
    outputs: [
      {
        internalType: "struct Position",
        name: "",
        type: "tuple",
        components: [
          {
            internalType: "string",
            name: "id",
            type: "string"
          },
          {
            internalType: "string",
            name: "insuranceId",
            type: "string"
          },
          {
            internalType: "address",
            name: "vaultAddress",
            type: "address"
          },
          {
            internalType: "address",
            name: "tokenOutAddress",
            type: "address"
          },
          {
            internalType: "address",
            name: "tokenInAddress",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "amountOut",
            type: "uint256"
          },
          {
            internalType: "uint256",
            name: "amountIn",
            type: "uint256"
          },
          {
            internalType: "bool",
            name: "isActive",
            type: "bool"
          },
          {
            internalType: "uint256",
            name: "createdAt",
            type: "uint256"
          }
        ]
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "insuranceId",
        type: "string"
      }
    ],
    name: "invalidateInsurance",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    type: "function",
    name: "claimInsurance",
    inputs: [
      {
        name: "insuranceId",
        type: "string",
        internalType: "string"
      }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  }
];

export const ERC20_ABI = [
  "function decimals() view returns (uint8)"
];

export const VAULT_CONTRACT_ABI = [
  {
    type: "function",
    name: "availableBalance",
    inputs: [
      {
        name: "asset",
        type: "address",
        internalType: "address"
      }
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view"
  }
]