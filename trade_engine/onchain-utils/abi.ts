export const VAULT_ABI = [
    {
    type: "function",
    name: "approveToken",
    inputs: [
      {
        name: "token",
        type: "address",
        internalType: "address"
      },
      {
        name: "spender",
        type: "address",
        internalType: "address"
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "execute",
    inputs: [
      {
        name: "target",
        type: "address",
        internalType: "address"
      },
      {
        name: "value",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "data",
        type: "bytes",
        internalType: "bytes"
      }
    ],
    outputs: [
      {
        name: "result",
        type: "bytes",
        internalType: "bytes"
      }
    ],
    stateMutability: "nonpayable"
  }
]