#!/usr/bin/env bash
# Source this inside WSL2 to set up the full ADAS ROS2 environment:
#   source /mnt/c/Users/Asus/Documents/GitHub/ADAS/scripts/wsl_env.sh
#
#   1. Sources ROS2 Humble base + ros2_ws install overlay (ext4)
#   2. Purges Windows CARLA eggs from PYTHONPATH
#   3. Sets ROS_DOMAIN_ID=42
#   4. CycloneDDS pinned to loopback (WSL2 vEthernet breaks DDS multicast)
#
# NOTE: `ros2 node list` goes through the ros2 daemon. If the daemon was
# started under a different RMW/domain it silently returns NOTHING. After
# changing this env (or on first use): ros2 daemon stop && ros2 daemon start
# Ground-truth check that bypasses the daemon: ros2 node list --no-daemon

set +u  # ROS2 setup.bash uses unbound variables

WS="/mnt/c/Users/Asus/Documents/GitHub/ADAS/ros2_ws"
# Build/install artifacts live on Linux-native FS (ext4) — NTFS under WSL2
# fails CMake configure_file with "Operation not permitted".
WS_INSTALL="/home/osos/adas_install"

# ROS2 Humble base
source /opt/ros/humble/setup.bash

# ros2_ws overlay
if [ -f "$WS_INSTALL/setup.bash" ]; then
    source "$WS_INSTALL/setup.bash"
elif [ -f "$WS/install/setup.bash" ]; then
    source "$WS/install/setup.bash"
else
    echo "[wsl_env] WARNING: ros2_ws not built yet — run scripts/build_ws.sh first"
fi

# Purge any Windows CARLA egg leaked into PYTHONPATH (win-amd64 .pyd files
# → "invalid ELF header" inside Linux). Linux client comes from pip carla==0.9.15.
if [ -n "${PYTHONPATH:-}" ]; then
    PYTHONPATH=$(echo "$PYTHONPATH" | tr ':' '\n' | grep -v 'win-amd64.egg' | tr '\n' ':' | sed 's/:$//')
    export PYTHONPATH
fi

export ROS_DOMAIN_ID=42

# FastDDS (Humble default) with localhost-only: same-host pub/sub goes over
# shared memory + loopback with NO config. CycloneDDS-on-lo was unreliable on
# WSL2 (unicast peer discovery degraded as participants accumulated).
unset CYCLONEDDS_URI
export RMW_IMPLEMENTATION=rmw_fastrtps_cpp
export ROS_LOCALHOST_ONLY=1

echo "[wsl_env] ROS2 Humble + overlay sourced (domain $ROS_DOMAIN_ID, RMW FastDDS localhost-only)"
echo "[wsl_env] If 'ros2 node list' is empty: ros2 daemon stop && ros2 daemon start"
