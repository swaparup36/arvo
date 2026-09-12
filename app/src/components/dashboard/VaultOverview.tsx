import { Tooltip } from "@/components/dashboard/Tooltip";
import type { Vault } from "@/types/dashboard";

export function VaultOverview({
  vaults,
  selectedChain,
  onCreateVault,
  isSubmitting,
  totalPages,
  currentPage,
  onPageChange,
  selectedVaultId,
  onVaultSelect,
}: {
  vaults: Vault[];
  selectedChain: string;
  onCreateVault: () => void;
  isSubmitting: boolean;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  selectedVaultId: string | null;
  onVaultSelect: (vaultId: string) => void;
}) {
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#99e836]/5 bg-transparent p-5 shadow-none">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="text-[clamp(1.8rem,2.2vw,2.8rem)] font-medium leading-[0.8] text-[#99e836]">
          Vault overview
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-[#99e836]/20 bg-transparent p-1">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={!canGoPrev}
              className="rounded-full px-2.5 py-1 text-[10px] font-medium text-[#edf5ee] transition hover:bg-[#99e836]/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-2 text-[10px] text-slate-300">
              {currentPage}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                onPageChange(Math.min(totalPages, currentPage + 1))
              }
              disabled={!canGoNext}
              className="rounded-full px-2.5 py-1 text-[10px] font-medium text-[#edf5ee] transition hover:bg-[#99e836]/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
          <button
            type="button"
            onClick={onCreateVault}
            disabled={isSubmitting}
            className="rounded-full bg-[#99e836] px-3 py-2 text-[10px] font-semibold text-[#05110b] shadow-[0_12px_20px_rgba(153,232,54,0.18)] transition hover:bg-[#b5ef64] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Deploying..." : "+ New Vault"}
          </button>
        </div>
      </div>

      {vaults.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#99e836]/15 bg-transparent p-6 text-center text-sm text-slate-400">
          No vaults deployed on {selectedChain} yet. Deploy one to get started.
        </div>
      ) : (
      <div className="grid gap-3 md:grid-cols-2">
        {vaults.map((vault) => {
          const visibleAssets = vault.assets.slice(0, 4);
          const hiddenAssetCount = Math.max(
            0,
            vault.assets.length - visibleAssets.length,
          );
          const isSelected = selectedVaultId === vault.id;

          return (
            <button
              type="button"
              key={vault.id}
              onClick={() => onVaultSelect(vault.id)}
              className={`w-full rounded-2xl border p-4 text-left transition hover:border-[#78f7b8]/20 ${
                vault.chain === selectedChain
                  ? "border-[#99e836]/20 bg-transparent"
                  : "border-[#99e836]/10 bg-transparent"
              } ${isSelected ? "ring-1 ring-[#99e836]/50" : ""}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#edf5ee]">
                    {vault.name}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {vault.chain}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                    vault.health === "Healthy"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : vault.health === "Monitoring"
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-red-500/15 text-red-300"
                  }`}
                >
                  {vault.health}
                </span>
              </div>

              <div className="mt-4 text-2xl font-semibold text-[#edf5ee]">
                {vault.totalValue}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {visibleAssets.map((asset, index) => (
                  <div
                    key={`${vault.id}-${asset.token}-${index}`}
                    className="rounded-xl border border-[#99e836]/10 bg-transparent p-2.5"
                  >
                    <div className="flex items-center justify-between text-[10px] uppercase text-slate-400">
                      <span>{asset.token}</span>
                      <Tooltip
                        label={`${asset.lockedPercent.toFixed(1)}% of this vault's ${asset.token} is locked in active positions`}
                      >
                        <span
                          className={
                            asset.lockedPercent > 0
                              ? "text-amber-300"
                              : "text-slate-500"
                          }
                        >
                          {asset.lockedPercent.toFixed(1)}% locked
                        </span>
                      </Tooltip>
                    </div>
                    <Tooltip
                      label={`Current ${asset.token} held by this vault (available + locked)`}
                    >
                      <div className="mt-2 text-base font-medium text-[#edf5ee]">
                        {asset.totalDeposited}
                      </div>
                    </Tooltip>
                  </div>
                ))}

                {hiddenAssetCount > 0 ? (
                  <div className="rounded-xl border border-dashed border-[#99e836]/15 bg-[#99e836]/5 p-2.5 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-[#c4f57a]">
                    +{hiddenAssetCount} more
                  </div>
                ) : null}
              </div>

              {isSelected ? (
                <div className="mt-3 text-[10px] font-medium uppercase tracking-[0.08em] text-[#99e836]">
                  Holdings preview selected
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      )}
    </div>
  );
}
