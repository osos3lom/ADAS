"""Phase 3A — ECU bridge: CARLA sensor events → P1Cxx DTCs via backend REST.

Subscribes:
  /carla/ego_vehicle/collision        (carla_msgs/CarlaCollisionEvent)
  /carla/ego_vehicle/lane_invasion    (carla_msgs/CarlaLaneInvasionEvent)
  /adas/dtc_event                     (std_msgs/String)  internal policy events

Posts to /api/incidents on the ADAS backend (localhost:8000 by default).
Each incident maps to a P1Cxx DTC code per uds/constants.py.
"""
from __future__ import annotations

import json
import time
from typing import Any, Optional

import requests
import rclpy
from carla_msgs.msg import CarlaCollisionEvent, CarlaLaneInvasionEvent
from rclpy.node import Node
from std_msgs.msg import String

_DTC_MAP: dict[str, tuple[str, str]] = {
    "collision": ("P1C01", "collision"),
    "road_excursion": ("P1C02", "road_excursion"),
    "lane_departure": ("P1C03", "lane_departure"),
    "late_brake": ("P1C10", "collision"),
    "comfort_violation": ("P1C20", "collision"),
    "progress_stall": ("P1C30", "collision"),
}


class ECUBridgeNode(Node):
    def __init__(self) -> None:
        super().__init__("ecu_bridge_node")
        self.declare_parameter("backend_url", "http://localhost:8000")
        self.declare_parameter("scenario", "unknown")

        self._backend_url: str = self.get_parameter("backend_url").value
        self._scenario: str = self.get_parameter("scenario").value

        self._collision_sub = self.create_subscription(
            CarlaCollisionEvent,
            "/carla/ego_vehicle/collision",
            self._on_collision,
            10,
        )
        self._lane_sub = self.create_subscription(
            CarlaLaneInvasionEvent,
            "/carla/ego_vehicle/lane_invasion",
            self._on_lane_invasion,
            10,
        )
        self._dtc_sub = self.create_subscription(
            String, "/adas/dtc_event", self._on_dtc_event, 10
        )
        self.get_logger().info(
            f"ECUBridgeNode ready — posting to {self._backend_url}/api/incidents"
        )

    def _post_incident(
        self,
        incident_type: str,
        dtc_code: str,
        freeze_frame: Optional[dict] = None,
        ttc_trace: Optional[list] = None,
    ) -> None:
        payload: dict[str, Any] = {
            "incident_type": incident_type,
            "at_fault": True,
            "scenario": self._scenario,
            "backend_name": "carla",
            "dtc_code": dtc_code,
            "ttc_trace": ttc_trace or [],
            "freeze_frame": freeze_frame or {},
            "timestamp_ms": int(time.time() * 1000),
        }
        try:
            resp = requests.post(
                f"{self._backend_url}/api/incidents",
                json=payload,
                timeout=2.0,
            )
            if resp.status_code != 201:
                self.get_logger().warning(
                    f"incident POST returned {resp.status_code}: {resp.text[:120]}"
                )
        except requests.RequestException as exc:
            self.get_logger().warning(f"incident POST failed: {exc}")

    def _on_collision(self, msg: CarlaCollisionEvent) -> None:
        freeze = {
            "other_actor_id": msg.other_actor_id,
            "normal_impulse": {
                "x": msg.normal_impulse.x,
                "y": msg.normal_impulse.y,
                "z": msg.normal_impulse.z,
            },
        }
        self._post_incident("collision", "P1C01", freeze_frame=freeze)

    def _on_lane_invasion(self, msg: CarlaLaneInvasionEvent) -> None:
        freeze = {"crossed_lane_markings": list(msg.crossed_lane_markings)}
        self._post_incident("lane_departure", "P1C03", freeze_frame=freeze)

    def _on_dtc_event(self, msg: String) -> None:
        event_key = msg.data.strip().lower()
        if event_key not in _DTC_MAP:
            self.get_logger().warning(f"unknown dtc_event key: {event_key!r}")
            return
        dtc_code, incident_type = _DTC_MAP[event_key]
        self._post_incident(incident_type, dtc_code)


def main(args=None) -> None:
    rclpy.init(args=args)
    node = ECUBridgeNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()
