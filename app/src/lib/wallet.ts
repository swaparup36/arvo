import { BrowserProvider, Contract, ethers } from "ethers";

import {
  chainIdMap,
  tokenAddressesByChain,
  tokenDecimals,
} from "@/lib/dashboard-data";

export type WindowWithEthereum = Window & {
  ethereum?: {
    request: (request: {
      method: string;
      params?: unknown[] | Record<string, unknown>;
    }) => Promise<unknown>;
    send?: (method: string, params: unknown[]) => Promise<unknown>;
  };
};

type Eip1193WalletProvider = NonNullable<WindowWithEthereum["ethereum"]>;

function getWalletProvider(): Eip1193WalletProvider {
  if (typeof window === "undefined") {
    throw new Error("A browser wallet like MetaMask is required.");
  }

  const descriptor = Object.getOwnPropertyDescriptor(window, "ethereum");

  if (descriptor && descriptor.configurable === false) {
    throw new Error(
      "A conflicting browser extension is already using window.ethereum. Disable the other wallet/extension and reload the page.",
    );
  }

  const walletWindow = window as WindowWithEthereum;
  const provider = walletWindow.ethereum;

  if (!provider) {
    throw new Error("A browser wallet like MetaMask is required.");
  }

  return provider as Eip1193WalletProvider;
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

export async function createVaultOnFactory(
  vaultName: string,
  selectedChainName: string,
) {
  const provider = new BrowserProvider(getWalletProvider());
  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();
  const chainId = (await provider.send("eth_chainId", [])) as string;
  const normalizedChainId = Number(chainId).toString();
  const expectedChainId = chainIdMap[selectedChainName] ?? chainIdMap.Base;

  if (normalizedChainId !== expectedChainId) {
    throw new Error(
      `Switch your wallet to ${selectedChainName} before continuing.`,
    );
  }

  const factoryAddress =
    process.env.NEXT_PUBLIC_VAULT_FACTORY_ADDRESS ??
    process.env.VAULT_FACTORY_ADDRESS;
  const arvoMainAddress =
    process.env.NEXT_PUBLIC_ARVO_MAIN_ADDRESS ?? process.env.ARVO_MAIN_ADDRESS;

  if (!factoryAddress || !arvoMainAddress) {
    throw new Error(
      "Set NEXT_PUBLIC_VAULT_FACTORY_ADDRESS and NEXT_PUBLIC_ARVO_MAIN_ADDRESS in your environment before creating a vault.",
    );
  }

  if (
    factoryAddress === "0x0000000000000000000000000000000000000000" ||
    arvoMainAddress === "0x0000000000000000000000000000000000000000"
  ) {
    throw new Error(
      "The deployed vault factory and protocol addresses are not configured yet. Add the real contract addresses to your .env file.",
    );
  }

  const factoryContract = new Contract(
    factoryAddress,
    [
      "function createVault(string _vaultName, address _arvoProto, address _executor) returns(address)",
    ],
    signer,
  );

  const tx = await factoryContract.createVault(
    vaultName,
    arvoMainAddress,
    signerAddress,
  );
  const receipt = await tx.wait();

  const event = receipt?.logs
    ?.map((log: { topics?: string[]; data?: string }) => {
      if (!log?.topics?.length) return null;
      return log;
    })
    .find(() => true);

  if (!event) {
    return {
      signerAddress,
      vaultAddress: "0x0000000000000000000000000000000000000000",
    };
  }

  return {
    signerAddress,
    vaultAddress: "0x0000000000000000000000000000000000000000",
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
  const expectedChainId = chainIdMap[selectedChainName] ?? chainIdMap.Base;

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
