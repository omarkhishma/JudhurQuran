"""The API's JSON answer, one class for every route: orjson, UTF-8 named, keys that are not strings allowed, and a value
orjson does not know (a Decimal) written as its text. FastAPI's own ORJSONResponse is deprecated."""

from __future__ import annotations

from typing import Any

import orjson
from fastapi.responses import JSONResponse


class ORJSONResponse(JSONResponse):
    media_type = "application/json; charset=utf-8"

    def render(self, content: Any) -> bytes:
        return orjson.dumps(content, option=orjson.OPT_NON_STR_KEYS, default=str)
