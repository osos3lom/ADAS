"""
ROS2 Bridge (Phase-3 placeholder)
=================================
In the target architecture the FastAPI backend subscribes to the ROS2 ADAS
state topics published by the CARLA/ROS2 stack and exposes them through
``/api/sim/*``.  That requires ``rclpy`` and a running ROS2 Humble graph, which
only exist on the Linux simulation box — so this is an inert placeholder that is
safe to import on any platform (Windows included) during Phase 0.

Planned production node map (Phase 1–3):
    perception   C++ (rclcpp)   LiDAR clustering + camera detection → /obstacles
    planning     Python (rclpy) ADAS FSM (AEB / LDW / ACC)          → /adas/state
    control      C++ (rclcpp)   Pure Pursuit / PID                  → CARLA control
    ecu_bridge   Python (rclpy) DID registry + DTC store            ↔ vcan0 (UDS)

Until then, the pure-Python simulation in :mod:`simulation` provides the ADAS
state the dashboard renders ("offline / demo mode").
"""
from __future__ import annotations

import os

ROS2_ENABLED = os.environ.get("ROS2_ENABLED", "false").lower() in ("1", "true", "yes")


def is_available() -> bool:
    """Return whether a live ROS2 bridge is active (always False in Phase 0)."""
    return False


class Ros2Bridge:
    """Placeholder ROS2 bridge. Raises until implemented in Phase 3."""

    def start(self):  # pragma: no cover - Phase 3
        raise NotImplementedError(
            "ROS2 bridge support arrives in Phase 3 (rclpy on ROS2 Humble). "
            "The Phase-0 backend uses the pure-Python simulation as its data source."
        )
