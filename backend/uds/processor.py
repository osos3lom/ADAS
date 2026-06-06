"""
UDS Request Processor
=====================
Entry point: :func:`process_uds` ``(hex_input, state) -> UDSCommandResult dict``.

Parses raw hex input, dispatches to the correct service handler, logs the
request/response pair, and returns a structured result (camelCase keys) that the
frontend renders directly in the UDS Console.

Ported from ``processUDS`` in ``frontend/lib/uds-processor.ts``.
"""
from __future__ import annotations

from typing import Dict, List

from simulation.state import SimulationState, add_log, now_ms
from uds import services
from uds.constants import SERVICE_NAMES, to_hex

_DISPATCH = {
    0x10: services.handle_session,
    0x11: services.handle_reset,
    0x14: services.handle_clear_dtc,
    0x19: services.handle_read_dtc,
    0x22: services.handle_read_did,
    0x27: services.handle_security_access,
    0x2E: services.handle_write_did,
}


def _parse_bytes(hex_input: str) -> List[int] | None:
    """Parse a space/whitespace separated hex string into byte values.

    Returns ``None`` if any token is not a valid 0..255 hex byte.
    """
    parts = [p for p in hex_input.strip().split() if p]
    out: List[int] = []
    for p in parts:
        try:
            b = int(p, 16)
        except ValueError:
            return None
        if b < 0 or b > 255:
            return None
        out.append(b)
    return out


def process_uds(hex_input: str, state: SimulationState) -> Dict[str, object]:
    byte_list = _parse_bytes(hex_input)

    if not byte_list:
        res = services.negative_response(0x00, 0x13, "Invalid hex input")
        res["requestHex"] = hex_input
        res["timestamp"] = now_ms()
        return res

    svc_id = byte_list[0]
    req_hex = to_hex(byte_list)
    svc_name = SERVICE_NAMES.get(svc_id, f"UnknownService_0x{svc_id:X}")

    add_log(state, "info", "UDS", f"REQ → {req_hex}  [{svc_name}]")

    handler = _DISPATCH.get(svc_id)
    if handler is None:
        result = services.negative_response(svc_id, 0x11, "Service not implemented")
    else:
        result = handler(byte_list, state)

    result["requestHex"] = req_hex
    add_log(
        state,
        "info" if result["positive"] else "warn",
        "UDS",
        f"RES ← {result['responseHex']}  [{result['interpretation']}]",
    )

    result["timestamp"] = now_ms()
    return result
