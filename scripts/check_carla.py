import sys
import carla

try:
    client = carla.Client("localhost", 2000)
    client.set_timeout(10.0)
    world = client.get_world()
    print(f"CARLA connected, map: {world.get_map().name}")
    print(f"CARLA version: {client.get_server_version()}")
    sys.exit(0)
except Exception as exc:
    print(f"CARLA connection failed: {exc}", file=sys.stderr)
    sys.exit(1)
