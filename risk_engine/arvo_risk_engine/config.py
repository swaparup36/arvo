from __future__ import annotations

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class ChainProfile(BaseModel):
    rpc_url: str
    verifying_contract: str
    usdc_address: str
    uniswap_quoter_v2_address: str
    uniswap_factory_v3_address: str
    # Token address => Chainlink AggregatorV3 feed address. Lowercase keys.
    chainlink_feeds: dict[str, str] = {}
    uniswap_fee_tiers: list[int] = [500, 3000, 10000]
    # Extra intermediate hop candidates for multi-hop quoting (e.g. WETH). usdc_address is
    # always tried as a bridge too, so this can stay empty on chains where USDC-hub routing
    # (token -> USDC -> token) covers your pairs.
    uniswap_bridge_tokens: list[str] = []
    dexscreener_chain: str = "ethereum"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="ARVO_", extra="ignore")
    risk_engine_private_key: str
    backend_url: str
    report_path: str = "/api/risk-report"
    callback_shared_secret: str
    # Keyed by chainId; JSON in .env. Every intent's chainId selects its profile.
    chain_profiles: dict[int, ChainProfile]
    max_oracle_age_seconds: int = 60
    redis_url: str
    redis_stream: str = "arvo:trade-intents"
    redis_consumer_group: str = "arvo-risk-engine"

    def chain_profile(self, chain_id: int) -> ChainProfile:
        try:
            return self.chain_profiles[chain_id]
        except KeyError:
            raise ValueError(f"no chain profile configured for chainId {chain_id}")
