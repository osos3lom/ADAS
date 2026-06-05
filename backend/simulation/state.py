"""
ADAS-ECU Simulation State
--------------------------
Pydantic v2 models that mirror frontend/types/index.ts exactly.
All models use alias_generator=to_camel so JSON serialization produces
the camelCase keys the TypeScript frontend expects (e.g. aebStatus, ttc).

Timestamps are stored in milliseconds (like JS Date.now()) so the
frontend's  `new Date(ts).toLocaleTimeString()` renders correctly.
"""
from __future__ import annotations

import math
import time
import uuid
from typing import Dict,…(truncated)