#!/usr/bin/env python3
"""Phase 2 gate — self-contained, deterministic AEB-approach test.

Sequence:
  1. Clean up any stale gate_lead vehicles.
  2. Teleport the ego to a verified-straight road stretch (steer=0 safe).
  3. Publish a far goal so carla_waypoint_publisher can build a route
     (enables Pure Pursuit lane-following when available; not required).
  4. Wait until the ego reaches cruise (>= 12 m/s).
  5. Spawn a stationary lead ~32 m ahead in-lane (TTC ~ 2.3 s) so AEB must
     fire: warning (TTC < 3.0) then active (TTC <= 1.5), full brake.
  6. Monitor /adas/state, /adas/obstacles, /carla/ego_vehicle/collision.
  7. Write phase2_gate_report.txt (PASS/FAIL + timeline) and clean up.

PASS = ego drove >= 12 m/s, warning seen, active seen, hard deceleration,
perception markers present, and NO collision.
"""
from __future__ import annotations

import json
import math
import time

import carla
import rclpy
from carla_msgs.msg import CarlaCollisionEvent
from geometry_msgs.msg import PoseStamped
from rclpy.node import Node
from std_msgs.msg import String
from visualization_msgs.msg import MarkerArray

REPORT = "/mnt/c/Users/Asus/Documents/GitHub/ADAS/phase2_gate_report.txt"
CRUISE_MPS = 12.0
CRUISE_TIMEOUT_S = 75.0
MONITOR_TIMEOUT_S = 60.0
LEAD_DISTANCE_M = 32.0
STRAIGHT_LEN_M = 140.0
STEP_M = 10.0


# ── CARLA helpers ───────────────────────────────────────────────────────────
def find_ego(world: carla.World) -> carla.Actor | None:
    for actor in world.get_actors().filter("vehicle.*"):
        if actor.attributes.get("role_name") == "ego_vehicle":
            return actor
    return None


def destroy_stale_leads(world: carla.World) -> int:
    n = 0
    for actor in world.get_actors().filter("vehicle.*"):
        if actor.attributes.get("role_name") == "gate_lead":
            actor.destroy()
            n += 1
    return n


def yaw_diff_deg(a: float, b: float) -> float:
    d = (a - b + 180.0) % 360.0 - 180.0
    return abs(d)


def chain_waypoints(wp: carla.Waypoint, length_m: float) -> list[carla.Waypoint]:
    pts = [wp]
    cur = wp
    for _ in range(int(length_m / STEP_M)):
        nxt = cur.next(STEP_M)
        if not nxt:
            break
        cur = nxt[0]
        pts.append(cur)
    return pts


def find_straight_stretch(amap: carla.Map) -> list[carla.Waypoint] | None:
    """First spawn point whose lane runs straight for STRAIGHT_LEN_M."""
    for sp in amap.get_spawn_points():
        wp = amap.get_waypoint(
            sp.location, project_to_road=True, lane_type=carla.LaneType.Driving
        )
        if wp is None or wp.is_junction:
            continue
        pts = chain_waypoints(wp, STRAIGHT_LEN_M)
        if len(pts) < int(STRAIGHT_LEN_M / STEP_M):
            continue
        if any(p.is_junction for p in pts):
            continue
        yaw0 = pts[0].transform.rotation.yaw
        if all(yaw_diff_deg(p.transform.rotation.yaw, yaw0) < 4.0 for p in pts):
            return pts
    return None


# ── ROS2 monitor ────────────────────────────────────────────────────────────
class GateMonitor(Node):
    def __init__(self) -> None:
        super().__init__("phase2_gate")
        self.t0 = time.time()
        self.timeline: list[str] = []
        self.last_status: str | None = None
        self.speed = 0.0
        self.max_speed = 0.0
        self.min_ttc = math.inf
        self.speed_at_active: float | None = None
        self.min_speed_after_active = math.inf
        self.saw_warning = False
        self.saw_active = False
        self.markers_seen = 0
        self.collisions = 0
        self.last_state: dict = {}
        self.create_subscription(String, "/adas/state", self.on_state, 10)
        self.create_subscription(MarkerArray, "/adas/obstacles", self.on_markers, 10)
        self.create_subscription(
            CarlaCollisionEvent, "/carla/ego_vehicle/collision", self.on_collision, 10
        )
        self.goal_pub = self.create_publisher(
            PoseStamped, "/carla/ego_vehicle/goal", 10
        )

    def log(self, msg: str) -> None:
        line = f"[t+{time.time() - self.t0:6.1f}s] {msg}"
        self.timeline.append(line)
        print(line, flush=True)

    def publish_goal(self, wp: carla.Waypoint) -> None:
        tf = wp.transform
        msg = PoseStamped()
        msg.header.frame_id = "map"
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.pose.position.x = tf.location.x
        msg.pose.position.y = -tf.location.y  # CARLA → ROS (right-handed)
        msg.pose.position.z = tf.location.z
        yaw_ros = -math.radians(tf.rotation.yaw)
        msg.pose.orientation.z = math.sin(yaw_ros / 2.0)
        msg.pose.orientation.w = math.cos(yaw_ros / 2.0)
        self.goal_pub.publish(msg)
        self.log("route goal published (waypoint publisher, if running)")

    def on_collision(self, msg: CarlaCollisionEvent) -> None:
        self.collisions += 1
        self.log(f"COLLISION with actor {msg.other_actor_id}")

    def on_markers(self, msg: MarkerArray) -> None:
        n = sum(1 for m in msg.markers if m.action == 0)
        self.markers_seen = max(self.markers_seen, n)

    def on_state(self, msg: String) -> None:
        try:
            s = json.loads(msg.data)
        except json.JSONDecodeError:
            return
        self.last_state = s
        self.speed = float(s.get("egoSpeedMps") or 0.0)
        self.max_speed = max(self.max_speed, self.speed)
        ttc = s.get("ttc")
        if ttc is not None:
            self.min_ttc = min(self.min_ttc, float(ttc))
        if self.saw_active:
            self.min_speed_after_active = min(self.min_speed_after_active, self.speed)
        status = s.get("aebStatus")
        if status != self.last_status:
            self.log(
                f"aebStatus: {self.last_status} -> {status} (speed {self.speed:.1f}"
                f" m/s, ttc {ttc}, range {s.get('obstacleRangeM')})"
            )
            if status == "warning":
                self.saw_warning = True
            if status == "active":
                self.saw_active = True
                self.speed_at_active = self.speed
            self.last_status = status

    def braked_hard(self) -> bool:
        return (
            self.saw_active
            and self.speed_at_active is not None
            and self.min_speed_after_active < max(1.0, 0.4 * self.speed_at_active)
        )

    def write_report(self, aborted: str | None = None) -> bool:
        checks = [
            ("ego drives (max speed >= 12 m/s)", self.max_speed >= CRUISE_MPS,
             f"max speed {self.max_speed:.1f} m/s"),
            ("AEB warning seen (1.5 < TTC < 3.0)", self.saw_warning,
             f"min TTC {self.min_ttc if math.isfinite(self.min_ttc) else 'inf'}"),
            ("AEB active seen (TTC <= 1.5)", self.saw_active,
             f"speed at trigger {self.speed_at_active}"),
            ("ego brakes hard after AEB", self.braked_hard(),
             f"min speed after active "
             f"{self.min_speed_after_active if math.isfinite(self.min_speed_after_active) else 'n/a'}"),
            ("perception markers on obstacle", self.markers_seen > 0,
             f"max markers {self.markers_seen}"),
            ("no collision", self.collisions == 0, f"{self.collisions} collision(s)"),
        ]
        passed = all(ok for _, ok, _ in checks) and aborted is None
        with open(REPORT, "w") as f:
            f.write(f"PHASE 2 GATE: {'PASS' if passed else 'FAIL'}\n")
            f.write(f"run: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            if aborted:
                f.write(f"ABORTED: {aborted}\n")
            f.write("\n")
            for name, ok, detail in checks:
                f.write(f"  [{'x' if ok else ' '}] {name} — {detail}\n")
            f.write(f"\nlast state: {json.dumps(self.last_state)}\n\ntimeline:\n")
            f.writelines(line + "\n" for line in self.timeline)
        return passed


def spin_until(node: GateMonitor, cond, timeout_s: float) -> bool:
    end = time.time() + timeout_s
    while rclpy.ok() and time.time() < end:
        rclpy.spin_once(node, timeout_sec=0.2)
        if cond():
            return True
    return False


# ── main ────────────────────────────────────────────────────────────────────
def main() -> None:
    rclpy.init()
    node = GateMonitor()
    lead = None
    aborted: str | None = None
    try:
        client = carla.Client("localhost", 2000)
        client.set_timeout(10.0)
        world = client.get_world()
        amap = world.get_map()

        n = destroy_stale_leads(world)
        if n:
            node.log(f"cleaned {n} stale gate_lead vehicle(s)")

        ego = None
        for _ in range(15):
            ego = find_ego(world)
            if ego:
                break
            time.sleep(2)
        if not ego:
            aborted = "no ego_vehicle in CARLA — run restart_all.bat first"
            return

        node.log("searching for a straight stretch...")
        pts = find_straight_stretch(amap)
        if not pts:
            aborted = "no straight stretch found in this town"
            return
        start_tf = pts[0].transform
        node.log(
            f"teleporting ego to straight stretch at "
            f"({start_tf.location.x:.0f}, {start_tf.location.y:.0f})"
        )
        spawn_tf = carla.Transform(
            start_tf.location + carla.Location(z=0.3), start_tf.rotation
        )
        ego.set_target_velocity(carla.Vector3D(0.0, 0.0, 0.0))
        ego.set_transform(spawn_tf)
        time.sleep(1.5)
        node.publish_goal(pts[-1])

        node.log(f"waiting for cruise (>= {CRUISE_MPS} m/s)...")
        if not spin_until(node, lambda: node.speed >= CRUISE_MPS, CRUISE_TIMEOUT_S):
            aborted = f"ego never reached cruise (max {node.max_speed:.1f} m/s)"
            return

        # spawn the lead NOW, ~32 m ahead of the ego's current position
        wp = amap.get_waypoint(
            ego.get_location(), project_to_road=True,
            lane_type=carla.LaneType.Driving,
        )
        ahead = wp.next(LEAD_DISTANCE_M)
        if not ahead:
            aborted = "no waypoint ahead for lead spawn"
            return
        bp = world.get_blueprint_library().find("vehicle.audi.tt")
        bp.set_attribute("role_name", "gate_lead")
        lead_tf = ahead[0].transform
        lead_tf.location.z += 0.3
        lead = world.try_spawn_actor(bp, lead_tf)
        if lead is None:
            lead_tf.location.z += 0.5
            lead = world.try_spawn_actor(bp, lead_tf)
        if lead is None:
            aborted = "could not spawn lead vehicle"
            return
        lead.apply_control(carla.VehicleControl(brake=1.0, hand_brake=True))
        d = ego.get_location().distance(lead.get_location())
        node.log(
            f"lead spawned {d:.1f} m ahead at ego speed {node.speed:.1f} m/s "
            f"(TTC ~ {d / max(node.speed, 0.1):.1f} s) — AEB must fire"
        )

        spin_until(node, node.braked_hard, MONITOR_TIMEOUT_S)
    except Exception as exc:  # noqa: BLE001
        aborted = f"exception: {exc}"
    finally:
        if lead is not None:
            try:
                lead.destroy()
                node.log("lead vehicle removed")
            except Exception:  # noqa: BLE001
                pass
        passed = node.write_report(aborted)
        node.log(f"report written — {'PASS' if passed else 'FAIL'}"
                 + (f" ({aborted})" if aborted else ""))
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
