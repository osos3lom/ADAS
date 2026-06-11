"""
CAN Bus Interface (Phase-3 placeholder)
=======================================
This module will wrap ``python-can`` so the rest of the backend stays
interface-agnostic.  In Phase 0 the backend runs a *pure-Python* simulation and
does not touch CAN at all, so this is an intentionally inert placeholder that is
still safe to import.

Planned (Phase 3):
    - Open a SocketCAN bus (``vcan0`` by default) via ``python-can``.
    - Layer ISO-TP (``can-isotp``) for multi-frame UDS payloads.
    - Bridge the FastAPI backend to a real ISO 14229 UDS server over CAN.

Environment (Phase 3):
    CAN_INTERFACE   socketcan | virtual | kvaser | pcan   (default: virtual)
    CAN_CHANNEL     vcan0, can0, PCAN_USBBUS1, ...         (default: vcan0)

Linux setup for a virtual CAN bus:
    sudo modprobe vcan
    sudo ip link add dev vcan0 type vcan
    sudo ip link set vcan0 up
"""
from __future__ import annotations

import os

CAN_INTERFACE = os.environ.get("CAN_INTERFACE", "virtual")
CAN_CHANNEL = os.environ.get("CAN_CHANNEL", "vcan0")

#: Whether a real CAN backend is wired up yet. Flipped on in Phase 3.
CAN_ENABLED = False


class CanInterface:
    """Placeholder CAN interface. Raises until implemented in Phase 3."""

    def __init__(self, interface: str = CAN_INTERFACE, channel: str = CAN_CHANNEL) -> None:
        self.interface = interface
        self.channel = channel

    def connect(self):  # pragma: no cover - Phase 3
        raise NotImplementedError(
            "CAN bus support arrives in Phase 3 (python-can + ISO-TP over vcan0). "
            "The Phase-0 backend runs a pure-Python simulation with no CAN dependency."
        )


def is_available() -> bool:
    """Return whether a real CAN backend is active (always False in Phase 0)."""
    return CAN_ENABLED
