#!/usr/bin/env python3
"""Chase-cam: pins CARLA's spectator camera behind the ego vehicle.

Resilient daemon mode — waits forever for an ego to appear, and re-attaches
automatically when the ego is destroyed/respawned (bridge restarts), so it can
be launched once per pipeline start (run_all.sh does this). Prints a live
speed readout only when run in a terminal (follow_ego.bat).

Ctrl+C to stop. To free-fly the camera again, stop this script
(WSL: pkill -f follow_ego).
"""
from __future__ import annotations

import math
import sys
import time

import carla


def find_ego(world: carla.World) -> carla.Actor | None:
    for actor in world.get_actors().filter("vehicle.*"):
        if actor.attributes.get("role_name") == "ego_vehicle":
            return actor
    return None


def follow(world: carla.World, ego: carla.Actor, interactive: bool) -> None:
    spectator = world.get_spectator()
    while True:
        if not ego.is_alive:
            raise RuntimeError("ego destroyed")
        tf = ego.get_transform()
        yaw = math.radians(tf.rotation.yaw)
        loc = tf.location + carla.Location(
            x=-8.0 * math.cos(yaw), y=-8.0 * math.sin(yaw), z=5.0
        )
        spectator.set_transform(
            carla.Transform(loc, carla.Rotation(pitch=-15.0, yaw=tf.rotation.yaw))
        )
        if interactive:
            v = ego.get_velocity()
            speed = 3.6 * math.hypot(v.x, v.y)
            print(f"\rego speed: {speed:5.1f} km/h", end="", flush=True)
        time.sleep(0.05)


def main() -> None:
    interactive = sys.stdout.isatty()
    while True:
        try:
            client = carla.Client("localhost", 2000)
            client.set_timeout(5.0)
            world = client.get_world()
            ego = find_ego(world)
            if ego is None:
                time.sleep(2)
                continue
            if interactive:
                print(f"following ego id={ego.id} — Ctrl+C to stop")
            follow(world, ego, interactive)
        except KeyboardInterrupt:
            return
        except Exception:  # noqa: BLE001 — CARLA restart / respawn / RPC blip
            time.sleep(2)


if __name__ == "__main__":
    main()
