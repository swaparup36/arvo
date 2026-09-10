"""Run with: python -m arvo_risk_engine.worker"""
from __future__ import annotations

import asyncio
import json
import logging
import socket

from redis.asyncio import Redis
from redis.exceptions import ResponseError

from .assessment import assess_and_submit
from .config import Settings
from .models import TradeIntent

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


class IntentWorker:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.redis: Redis = Redis.from_url(settings.redis_url, decode_responses=True)
        self.consumer = f"{socket.gethostname()}-{__import__('os').getpid()}"

    async def ensure_group(self) -> None:
        try:
            await self.redis.xgroup_create(self.settings.redis_stream, self.settings.redis_consumer_group, id="0", mkstream=True)
        except ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise

    async def process(self, message_id: str, fields: dict[str, str]) -> None:
        try:
            intent = TradeIntent.model_validate_json(fields["intent"])
            # Durable report cache prevents a redelivered, completed intent from recalculating a quote.
            cache_key = f"arvo:risk-report:{intent.intentId}"
            if not await self.redis.get(cache_key):
                report = await assess_and_submit(intent, self.settings)
                ttl = max(86_400, int(report.expiresAt.timestamp() - report.assessedAt.timestamp()) + 86_400)
                await self.redis.set(cache_key, report.model_dump_json(), ex=ttl)
            await self.redis.xack(self.settings.redis_stream, self.settings.redis_consumer_group, message_id)
        except Exception:
            # Leave unacknowledged: another worker can reclaim it after the idle timeout.
            log.exception("risk assessment failed for stream message %s", message_id)

    async def run(self) -> None:
        await self.ensure_group()
        while True:
            # Recover work stranded by a stopped worker before taking fresh work.
            claimed = await self.redis.xautoclaim(self.settings.redis_stream, self.settings.redis_consumer_group,
                                                   self.consumer, min_idle_time=60_000, start_id="0-0", count=10)
            for message_id, fields in claimed[1]:
                await self.process(message_id, fields)
            messages = await self.redis.xreadgroup(self.settings.redis_consumer_group, self.consumer,
                                                    {self.settings.redis_stream: ">"}, count=10, block=5_000)
            for _, entries in messages:
                for message_id, fields in entries:
                    await self.process(message_id, fields)


async def main() -> None:
    worker = IntentWorker(Settings())
    try:
        await worker.run()
    finally:
        await worker.redis.aclose()


if __name__ == "__main__":
    asyncio.run(main())
