from __future__ import annotations

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class ChainProfile(BaseModel):
    rpc_url: str
    verifying_contract: str
    usdc_address: str

    # Token address => Chainlink AggregatorV3 feed address.
    # Keys should be lowercase.
    chainlink_feeds: dict[str, str] = {}

    # DexScreener chain identifier.
    dexscreener_chain: str = "ethereum"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="ARVO_",
        extra="ignore",
    )

    risk_engine_private_key: str
    backend_url: str
    report_path: str = "/api/risk-report"
    callback_shared_secret: str

    # Keyed by chainId; JSON in .env.
    chain_profiles: dict[int, ChainProfile]

    max_oracle_age_seconds: int = 60

    redis_url: str
    redis_stream: str = "arvo:trade-intents"
    redis_consumer_group: str = "arvo-risk-engine"

    # Uniswap Trading API
    uniswap_api_key: str

    def chain_profile(self, chain_id: int) -> ChainProfile:
        try:
            return self.chain_profiles[chain_id]
        except KeyError:
            raise ValueError(
                f"no chain profile configured for chainId {chain_id}"
            )