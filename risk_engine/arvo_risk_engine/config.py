from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="ARVO_", extra="ignore")
    risk_engine_private_key: str
    backend_url: str
    report_path: str = "/api/risk-report"
    chain_id: int
    verifying_contract: str
    callback_shared_secret: str
    oneinch_api_key: str
    rpc_url: str
    # Token address => Chainlink AggregatorV3 feed address. JSON in .env.
    chainlink_feeds: dict[str, str] = {}
    usdc_address: str
    dexscreener_chain: str = "ethereum"
    max_oracle_age_seconds: int = 60
