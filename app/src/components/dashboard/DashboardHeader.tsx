import { chainOptions } from "@/lib/dashboard-data";
import { WalletButton } from "@/components/dashboard/WalletButton";

export function DashboardHeader({
  selectedChain,
  onChainChange,
  walletAddress,
  isWalletMenuOpen,
  onWalletConnect,
  onWalletDisconnect,
}: {
  selectedChain: string;
  onChainChange: (value: string) => void;
  walletAddress: string;
  isWalletMenuOpen: boolean;
  onWalletConnect: () => void;
  onWalletDisconnect: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 mb-6 rounded-3xl border border-[#99e836]/10 bg-[#0a120d]/60 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-md sm:px-6">
      <nav className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#99e836]/30 bg-[#99e836]/10 text-xs font-semibold text-[#c4f57a]">
            AR
          </div>
          <div>
            <div className="text-[10px] uppercase text-[#99e836]">Arvo</div>
            <div className="text-sm text-slate-300">Protocol</div>
          </div>
        </div>

        <div className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
          <a href="#overview" className="transition hover:text-[#c4f57a]">
            Overview
          </a>
          <a href="#agents" className="transition hover:text-[#c4f57a]">
            Agents
          </a>
          <a href="#intents" className="transition hover:text-[#c4f57a]">
            Intents
          </a>
          <a href="#vaults" className="transition hover:text-[#c4f57a]">
            Vaults
          </a>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedChain}
            onChange={(event) => onChainChange(event.target.value)}
            className="rounded-full border border-[#99e836]/12 bg-[#101915] px-3 py-2.5 pr-8 text-sm text-[#edf5ee] outline-none transition focus:border-[#99e836]/50"
            aria-label="Select chain"
          >
            {chainOptions.map((chain) => (
              <option key={chain} value={chain}>
                {chain}
              </option>
            ))}
          </select>

          <WalletButton
            walletAddress={walletAddress}
            isOpen={isWalletMenuOpen}
            onConnect={onWalletConnect}
            onDisconnect={onWalletDisconnect}
          />
        </div>
      </nav>
    </header>
  );
}
