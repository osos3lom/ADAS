#!/usr/bin/env bash
REPO=/mnt/c/Users/Asus/Documents/GitHub/ADAS
exec > "$REPO/probe_output.txt" 2>&1
source "$REPO/scripts/wsl_env.sh" >/dev/null
echo "=== run $(date +%T) RMW=$RMW_IMPLEMENTATION LOCALHOST=$ROS_LOCALHOST_ONLY ==="
for t in /carla/status /carla/ego_vehicle/odometry /adas/state /adas/acc_setpoint_mps /carla/ego_vehicle/vehicle_control_cmd; do
  echo "=== hz $t (6s) ==="
  timeout 6 ros2 topic hz "$t" 2>&1 | head -3
done
echo "=== done ==="
