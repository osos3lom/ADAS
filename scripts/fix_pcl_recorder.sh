#!/usr/bin/env bash
# Fix pcl_recorder build failure (missing ros-humble-tf2-eigen) and rebuild.
# Run inside WSL2.
set -eo pipefail

WS="/mnt/c/Users/Asus/Documents/GitHub/ADAS/ros2_ws"

echo "=== Installing missing tf2_eigen dependency ==="
sudo apt-get install -y ros-humble-tf2-eigen

echo "=== Sourcing ROS2 Humble ==="
set +u && source /opt/ros/humble/setup.bash

echo "=== Rebuilding pcl_recorder ==="
cd "$WS"
colcon build --symlink-install --packages-select pcl_recorder 2>&1

echo "=== Done. Source workspace: source $WS/install/setup.bash ==="
