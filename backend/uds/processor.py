"""
UDS Request Processor
----------------------
Entry point: process_uds(hex_input, state) → UDSResult dict

Parses raw hex input, dispatches to the correct service handler,
and returns a structured result that the frontend renders in the UDS Console.
"""
from __future__ import annotations

import time

from simulation.state import SimulationState, add_log
from uds.constants import NRC_NAMES, SERVICE_NAMES
from uds import services


def _to_hex(b: list[int]) -> str:
    return " ".join(f"{x:02X…(truncated)