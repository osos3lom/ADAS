"""Phase 2B — consolidated ADAS planning node.

Subscribes:
  /adas/nearest_obstacle            (std_msgs/Float32MultiArray)
                                    [range_m, closing_speed_mps, x, y]; range < 0 → none
  /carla/ego_vehicle/odometry       (nav_msgs/Odometry)
  /carla/ego_vehicle/lane_invasion  (carla_msgs/CarlaLaneInvasionEvent)

Publishes (20 Hz):
  /adas/state            (std_msgs/String, JSON)  — consumed by ecu_bridge (Phase 3)
  /adas/aeb_command      (std_msgs/Bool)          — full-brake override for control
  /adas/acc_setpoint_mps (std_msgs/Float32)
  /adas/ldw_alert        (std_msgs/Bool)
  /adas/dtc_event        (std_msgs/String)        — edge-triggered keys for ecu_bridge

Thresholds are the Phase 0 spec (see adas_planning/thresholds.py).

Lane offset note: CARLA's lane_invasion sensor is event-based. Until the
waypoint-based continuous offset lands (Phase 2 follow-up), an invasion event
sets the offset estimate above the 0.5 m warn threshold and decays it at
0.3 m/s, so LDW warn/clear exercises the exact Phase 0 hysteresis.
"""
from __future__ import annotations

import json
import math

import rclpy
from carla_msgs.msg import CarlaLaneInvasionEvent
from nav_msgs.msg import Odometry
from rclpy.node import Node
from std_msgs.msg import Bool, Float32, Float32MultiArray, String

from .fsm import AdasFsm, FsmInput
from . import thresholds as TH

_TICK_HZ = 20.0
_LANE_OFFSET_ON_INVASION_M = 0.6
_LANE_OFFSET_DECAY_MPS = 0.3
_OBSTACLE_STALE_S = 0.5


class PlanningNode(Node):
    def __init__(self) -> None:
        super().__init__("planning_node")
        self.declare_parameter("cruise_setpoint_mps", TH.ACC_DEFAULT_SETPOINT_MPS)
        cruise = float(self.get_parameter("cruise_setpoint_mps").value)
        self._fsm = AdasFsm(cruise_setpoint_mps=cruise)

        self._ego_speed_mps = 0.0
        self._obstacle_range_m: float | None = None
        self._closing_speed_mps: float | None = None
        self._obstacle_stamp_s = -math.inf
        self._lane_offset_m = 0.0

        self.create_subscription(
            Float32MultiArray, "/adas/nearest_obstacle", self._on_obstacle, 10
        )
        self.create_subscription(
            Odometry, "/carla/ego_vehicle/odometry", self._on_odom, 10
        )
        self.create_subscription(
            CarlaLaneInvasionEvent,
            "/carla/ego_vehicle/lane_invasion",
            self._on_lane_invasion,
            10,
        )

        self._state_pub = self.create_publisher(String, "/adas/state", 10)
        self._aeb_pub = self.create_publisher(Bool, "/adas/aeb_command", 10)
        self._acc_pub = self.create_publisher(Float32, "/adas/acc_setpoint_mps", 10)
        self._ldw_pub = self.create_publisher(Bool, "/adas/ldw_alert", 10)
        self._dtc_pub = self.create_publisher(String, "/adas/dtc_event", 10)

        self._dt = 1.0 / _TICK_HZ
        self.create_timer(self._dt, self._tick)
        self.get_logger().info(
            f"PlanningNode ready — cruise {cruise:.1f} m/s, "
            f"AEB warn<{TH.AEB_TTC_WARNING_S}s active<={TH.AEB_TTC_ACTIVE_S}s"
        )

    # ── subscriptions ──────────────────────────────────────────────────────
    def _on_obstacle(self, msg: Float32MultiArray) -> None:
        if len(msg.data) < 2 or msg.data[0] < 0.0:
            self._obstacle_range_m = None
            self._closing_speed_mps = None
            return
        self._obstacle_range_m = float(msg.data[0])
        self._closing_speed_mps = float(msg.data[1])
        self._obstacle_stamp_s = self._now_s()

    def _on_odom(self, msg: Odometry) -> None:
        v = msg.twist.twist.linear
        self._ego_speed_mps = math.sqrt(v.x * v.x + v.y * v.y)

    def _on_lane_invasion(self, msg: CarlaLaneInvasionEvent) -> None:
        _ = msg
        self._lane_offset_m = _LANE_OFFSET_ON_INVASION_M

    # ── tick ───────────────────────────────────────────────────────────────
    def _now_s(self) -> float:
        return self.get_clock().now().nanoseconds * 1e-9

    def _tick(self) -> None:
        # drop stale obstacles (perception silent → assume clear)
        if self._now_s() - self._obstacle_stamp_s > _OBSTACLE_STALE_S:
            self._obstacle_range_m = None
            self._closing_speed_mps = None

        out = self._fsm.step(
            FsmInput(
                ego_speed_mps=self._ego_speed_mps,
                dt=self._dt,
                obstacle_range_m=self._obstacle_range_m,
                closing_speed_mps=self._closing_speed_mps,
                lane_offset_m=self._lane_offset_m,
            )
        )

        # decay the event-based lane-offset estimate
        self._lane_offset_m = max(
            0.0, self._lane_offset_m - _LANE_OFFSET_DECAY_MPS * self._dt
        )

        self._aeb_pub.publish(Bool(data=out.aeb_status == "active"))
        self._acc_pub.publish(Float32(data=float(out.acc_setpoint_mps)))
        self._ldw_pub.publish(Bool(data=out.ldw_status == "warning"))
        for key in out.events:
            self._dtc_pub.publish(String(data=key))
            self.get_logger().warn(f"DTC event: {key}")

        state = {
            "aebStatus": out.aeb_status,
            "ldwStatus": out.ldw_status,
            "accSetpointMps": round(out.acc_setpoint_mps, 2),
            "ttc": None if math.isinf(out.ttc_s) else round(out.ttc_s, 2),
            "egoSpeedMps": round(self._ego_speed_mps, 2),
            "obstacleRangeM": self._obstacle_range_m,
            "closingSpeedMps": self._closing_speed_mps,
            "laneOffsetM": round(self._lane_offset_m, 3),
            "commandedAccelMps2": out.commanded_accel_mps2,
            "brakePct": out.brake_pct,
        }
        self._state_pub.publish(String(data=json.dumps(state)))


def main(args=None) -> None:
    rclpy.init(args=args)
    node = PlanningNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()
