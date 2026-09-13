import { BrowserProvider, Contract, ethers } from "ethers";

import {
  chainIdMap,
  tokenAddressesByChain,
  tokenDecimals,
} from "@/lib/dashboard-data";

// Chains missing from these maps
export const CHAIN_TO_VAULT_FACTORY_PUBLIC_ADDRESS: Record<number, string | undefined> = {
  1: process.env.NEXT_PUBLIC_VAULT_FACTORY_ETH_ADDRESS,
  11155111: process.env.NEXT_PUBLIC_VAULT_FACTORY_SEPOLIA_ADDRESS,
};

export const CHAIN_TO_ARVO_MAIN_PUBLIC_ADDRESS: Record<number, string | undefined> = {
  1: process.env.NEXT_PUBLIC_ARVO_MAIN_ADDRESS,
  11155111: process.env.NEXT_PUBLIC_ARVO_MAIN_SEPOLIA_ADDRESS,
};

export type WindowWithEthereum = Window & {
  ethereum?: {
    providers?: Array<{
      request: (request: {
        method: string;
        params?: unknown[] | Record<string, unknown>;
      }) => Promise<unknown>;
      send?: (method: string, params: unknown[]) => Promise<unknown>;
      isMetaMask?: boolean;
      isPhantom?: boolean;
      isBackpack?: boolean;
    }>;
    request: (request: {
      method: string;
      params?: unknown[] | Record<string, unknown>;
    }) => Promise<unknown>;
    send?: (method: string, params: unknown[]) => Promise<unknown>;
    isMetaMask?: boolean;
    isPhantom?: boolean;
    isBackpack?: boolean;
  };
  phantom?: {
    ethereum?: {
      request: (request: {
        method: string;
        params?: unknown[] | Record<string, unknown>;
      }) => Promise<unknown>;
      send?: (method: string, params: unknown[]) => Promise<unknown>;
      isPhantom?: boolean;
    };
  };
  backpack?: {
    ethereum?: {
      request: (request: {
        method: string;
        params?: unknown[] | Record<string, unknown>;
      }) => Promise<unknown>;
      send?: (method: string, params: unknown[]) => Promise<unknown>;
      isBackpack?: boolean;
    };
  };
};

type Eip1193WalletProvider = NonNullable<WindowWithEthereum["ethereum"]>;

export function getWalletProvider(): Eip1193WalletProvider {
  if (typeof window === "undefined") {
    throw new Error("A browser wallet like MetaMask is required.");
  }

  const walletWindow = window as WindowWithEthereum;
  const providerCandidates = [
    ...(Array.isArray(walletWindow.ethereum?.providers)
      ? walletWindow.ethereum.providers
      : []),
    walletWindow.ethereum,
    walletWindow.phantom?.ethereum,
    walletWindow.backpack?.ethereum,
  ].filter(Boolean) as Eip1193WalletProvider[];

  const preferredProvider =
    providerCandidates.find((provider) => provider.isMetaMask) ??
    providerCandidates.find((provider) => provider.isPhantom) ??
    providerCandidates.find((provider) => provider.isBackpack) ??
    providerCandidates[0];

  if (!preferredProvider) {
    throw new Error("A browser wallet like MetaMask is required.");
  }

  return preferredProvider;
}

export async function connectWallet() {
  const provider = getWalletProvider();
  const browserProvider = new BrowserProvider(provider);
  const accounts = (await browserProvider.send(
    "eth_requestAccounts",
    [],
  )) as string[];

  return { provider: browserProvider, accounts };
}

export async function ensureWalletOnChain(selectedChainName: string) {
  const provider = getWalletProvider();
  const browserProvider = new BrowserProvider(provider);
  const chainId = (await browserProvider.send("eth_chainId", [])) as string;
  const expectedChainId = chainIdMap[selectedChainName];

  if (Number(chainId).toString() === expectedChainId) {
    return;
  }

  const chainHex = `0x${Number(expectedChainId).toString(16)}`;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainHex }],
    });
  } catch (error) {
    const switchError = error as { code?: number; message?: string };

    if (switchError.code === 4902) {
      throw new Error(
        `Add or switch your wallet to ${selectedChainName} before continuing.`,
      );
    }

    throw new Error(
      `Unable to switch your wallet to ${selectedChainName}. ${switchError.message ?? ""}`.trim(),
    );
  }
}

export async function getUserVaultsForChain(
  selectedChainName: string,
  userAddress?: string,
): Promise<string[]> {
  if (!userAddress) {
    return [];
  }

  const provider = new BrowserProvider(getWalletProvider());
  const signerAddress =
    userAddress || (await provider.getSigner()).getAddress();
  const chainId = (await provider.send("eth_chainId", [])) as string;
  const expectedChainId = chainIdMap[selectedChainName];

  if (Number(chainId).toString() !== expectedChainId) {
    await ensureWalletOnChain(selectedChainName);
  }

  const factoryAddress = CHAIN_TO_VAULT_FACTORY_PUBLIC_ADDRESS[Number(expectedChainId)];

  if (!factoryAddress) {
    return [];
  }

  const factoryContract = new Contract(
    factoryAddress,
    ["function getUserVaults(address user) view returns(address[])"],
    provider,
  );

  const userVaults = await factoryContract.getUserVaults(signerAddress);
  return userVaults.filter((vaultAddress: string) => Boolean(vaultAddress));
}

export async function createVaultOnFactory(
  vaultName: string,
  selectedChainName: string,
) {
  const provider = new BrowserProvider(getWalletProvider());
  await ensureWalletOnChain(selectedChainName);
  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();
  const chainId = (await provider.send("eth_chainId", [])) as string;
  const normalizedChainId = Number(chainId).toString();
  const expectedChainId = chainIdMap[selectedChainName];

  if (normalizedChainId !== expectedChainId) {
    throw new Error(
      `Switch your wallet to ${selectedChainName} before continuing.`,
    );
  }

  const factoryAddress = CHAIN_TO_VAULT_FACTORY_PUBLIC_ADDRESS[Number(expectedChainId)];
  const arvoMainAddress = CHAIN_TO_ARVO_MAIN_PUBLIC_ADDRESS[Number(expectedChainId)];

  if (!factoryAddress || !arvoMainAddress) {
    throw new Error(
      `Arvo is not deployed on ${selectedChainName} (chain ${expectedChainId}) yet.`,
    );
  }

  // Same executor on every chain
  const executorAddress = process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS;

  if (!executorAddress) {
    throw new Error(
      "Set NEXT_PUBLIC_EXECUTOR_ADDRESS in your environment before creating a vault.",
    );
  }

  const factoryContract = new Contract(
    factoryAddress,
    [
      "event VaultCreatedSuccessfully(address indexed user, address indexed vaultAddress)",
      "function createVault(string _vaultName, address _arvoProto, address _executor) returns(address)",
      "function getUserVaults(address user) view returns(address[])",
    ],
    signer,
  );

  const tx = await factoryContract.createVault(
    vaultName,
    arvoMainAddress,
    executorAddress,
  );

  await tx.wait();

  const userVaults = await factoryContract.getUserVaults(signerAddress);
  const createdVault = userVaults[userVaults.length - 1];

  if (!createdVault) {
    throw new Error(
      "Vault was submitted but no address was returned from the factory.",
    );
  }

  return {
    signerAddress,
    vaultAddress: createdVault,
  };
}

export async function executeVaultAction(
  action: "deposit" | "withdraw",
  token: string,
  amount: string,
  vaultAddress: string,
  selectedChainName: string,
) {
  if (!amount || Number(amount) <= 0) {
    throw new Error("Enter a valid amount.");
  }

  const provider = new BrowserProvider(getWalletProvider());
  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();
  const chainId = (await provider.send("eth_chainId", [])) as string;
  const normalizedChainId = Number(chainId).toString();
  const expectedChainId = chainIdMap[selectedChainName];

  if (normalizedChainId !== expectedChainId) {
    throw new Error(
      `Switch your wallet to ${selectedChainName} before continuing.`,
    );
  }

  const tokenAddress =
    token === "ETH"
      ? "0x0000000000000000000000000000000000000000"
      : tokenAddressesByChain[selectedChainName][token];
  const decimals = tokenDecimals[token] ?? 18;
  const parsedAmount = ethers.parseUnits(amount, decimals);

  const vaultContract = new Contract(
    vaultAddress,
    [
      "function depositETH() payable",
      "function depositToken(address token, uint256 amount)",
      "function withdrawETH(uint256 amount)",
      "function withdrawToken(address token, uint256 amount)",
    ],
    signer,
  );

  if (token === "ETH") {
    if (action === "deposit") {
      const tx = await vaultContract.depositETH({ value: parsedAmount });
      await tx.wait();
    } else {
      const tx = await vaultContract.withdrawETH(parsedAmount);
      await tx.wait();
    }

    return { signerAddress, hash: "eth_tx" };
  }

  const erc20 = new Contract(
    tokenAddress,
    [
      "function approve(address spender, uint256 amount) returns(bool)",
      "function balanceOf(address) view returns(uint256)",
    ],
    signer,
  );

  if (action === "deposit") {
    const approvalTx = await erc20.approve(vaultAddress, parsedAmount);
    await approvalTx.wait();
    const tx = await vaultContract.depositToken(tokenAddress, parsedAmount);
    await tx.wait();
  } else {
    const tx = await vaultContract.withdrawToken(tokenAddress, parsedAmount);
    await tx.wait();
  }

  return { signerAddress, hash: "erc20_tx" };
}
