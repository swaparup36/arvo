export function WalletButton({
  walletAddress,
  isOpen,
  onConnect,
  onDisconnect,
}: {
  walletAddress: string;
  isOpen: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onConnect}
        className="rounded-full border border-[#99e836]/25 bg-[#99e836]/10 px-4 py-2.5 text-sm font-medium text-[#c4f57a] transition hover:border-[#99e836]/55 hover:bg-[#99e836]/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {walletAddress
          ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
          : "Connect wallet"}
      </button>

      {walletAddress && isOpen ? (
        <div className="absolute right-0 z-20 mt-2 min-w-[180px] rounded-2xl border border-[#99e836]/15 bg-[#0f1714] p-2 shadow-2xl">
          <button
            type="button"
            onClick={onConnect}
            className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/5"
          >
            Connect wallet
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-red-300 transition hover:bg-red-500/10"
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}
