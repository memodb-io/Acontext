from fastapi import APIRouter
from ..schema.pydantic.api.response import BasicResponse
from ..schema.pydantic.promise import Promise, Code
from ..client.db import DB_CLIENT
from ..client.redis import REDIS_CLIENT

V1_CHECK_ROUTER = APIRouter()


@V1_CHECK_ROUTER.get("/ping", tags=["chore"])
async def ping() -> BasicResponse:
    return BasicResponse(data={"message": "pong"})


@V1_CHECK_ROUTER.get("/health", tags=["chore"])
async def health() -> BasicResponse:
    if not await DB_CLIENT.health_check():
        return Promise.error(
            Code.SERVICE_UNAVAILABLE, "Database connection failed"
        ).to_response(BasicResponse)
    if not await REDIS_CLIENT.health_check():
        return Promise.error(
            Code.SERVICE_UNAVAILABLE, "Redis connection failed"
        ).to_response(BasicResponse)
    # if not await CLICKHOUSE_CLIENT.health_check():
    #     return Promise.error(
    #         Code.SERVICE_UNAVAILABLE, "ClickHouse connection failed"
    #     ).to_response(BasicResponse)
    return Promise.ok({"message": "ok"}).to_response(BasicResponse)
