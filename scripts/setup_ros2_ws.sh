#!/usr/bin/env bash
# Phase 1A — set up carla-ros-bridge workspace
set -eo pipefail   # no -u: ROS2 setup.bash uses unbound vars intentionally

WS="/mnt/c/Users/Asus/Documents/GitHub/ADAS/ros2_ws"

echo "=== Creating ros2_ws at $WS ==="
mkdir -p "$WS/src"

echo "=== Cloning carla-ros-bridge (leaderboard-2.0) ==="
cd "$WS/src"
if [ ! -d ros-bridge ]; then
    git clone --depth 1 --branch leaderboard-2.0 \
        https://github.com/carla-simulator/ros-bridge.git ros-bridge
else
    echo "ros-bridge already present"
fi

echo "=== Cloning carla_msgs ==="
if [ ! -d carla_msgs ]; then
    git clone --depth 1 --branch leaderboard-2.0 \
        https://github.com/carla-simulator/ros-carla-msgs.git carla_msgs
else
    echo "carla_msgs already present"
fi

echo "=== Installing rosdep dependencies ==="
set +u && source /opt/ros/humble/setup.bash && set -u || true
cd "$WS"
rosdep install --from-paths src/ros-bridge --ignore-src -r -y 2>&1 | tail -5

echo "=== Building with colcon (full ros-bridge) ==="
colcon build \
    --symlink-install \
    2>&1 | tail -40

echo "=== Done. Source: source $WS/install/setup.bash ==="
