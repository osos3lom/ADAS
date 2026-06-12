#!/usr/bin/env bash
# ADAS Phase 2 diagnostic — writes everything to diag_output.txt in the repo.
OUT=/mnt/c/Users/Asus/Documents/GitHub/ADAS/diag_output.txt
exec > "$OUT" 2>&1
echo "=== diag run: $(date) user=$(whoami) ==="

echo "=== 1. env (proxy vars poison ros2 daemon XMLRPC) ==="
env | grep -i -E "proxy|RMW|ROS_" || echo "(none)"

echo "=== 2. sourcing wsl_env.sh ==="
source /mnt/c/Users/Asus/Documents/GitHub/ADAS/scripts/wsl_env.sh
echo "RMW=$RMW_IMPLEMENTATION DOMAIN=$ROS_DOMAIN_ID"

echo "=== 3. node list (no daemon) ==="
timeout 20 ros2 node list --no-daemon

echo "=== 4. adas/carla topics (no daemon) ==="
timeout 20 ros2 topic list --no-daemon | grep -E "adas|carla" | head -30

echo "=== 5. one /adas/state message ==="
timeout 15 ros2 topic echo /adas/state --once

echo "=== 6. one /adas/nearest_obstacle message ==="
timeout 15 ros2 topic echo /adas/nearest_obstacle --once

echo "=== 7. odometry once (is ego publishing?) ==="
timeout 15 ros2 topic echo /carla/ego_vehicle/odometry --once --no-arr | head -25

echo "=== done ==="
