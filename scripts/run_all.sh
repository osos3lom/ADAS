#!/usr/bin/env bash
REPO=/mnt/c/Users/Asus/Documents/GitHub/ADAS
source "$REPO/scripts/wsl_env.sh"

echo "[run_all] stopping old ROS2 processes..."
pkill -9 -f "ros2 launch" 2>/dev/null
pkill -9 -f carla_ros_bridge 2>/dev/null
pkill -9 -f carla_spawn_objects 2>/dev/null
pkill -9 -f perception_node 2>/dev/null
pkill -9 -f planning_node 2>/dev/null
pkill -9 -f control_node 2>/dev/null
pkill -9 -f _ros2_daemon 2>/dev/null
pkill -9 -f follow_ego 2>/dev/null
rm -rf /dev/shm/fastrtps_* /dev/shm/sem.fastrtps_* 2>/dev/null
sleep 5

echo "[run_all] starting bridge (log: bringup_log.txt)..."
setsid nohup ros2 launch "$REPO/ros2_ws/launch/adas_bringup.launch.py" \
    > "$REPO/bringup_log.txt" 2>&1 &
sleep 30

echo "[run_all] starting ADAS stack (log: stack_log.txt)..."
setsid nohup ros2 launch "$REPO/ros2_ws/launch/adas_stack.launch.py" \
    > "$REPO/stack_log.txt" 2>&1 &
sleep 15

echo "[run_all] starting chase-cam (spectator follows ego)..."
setsid nohup python3 "$REPO/scripts/follow_ego.py" > /dev/null 2>&1 &

echo "[run_all] running diagnostics..."
bash "$REPO/scripts/diag.sh"
echo "[run_all] done — see diag_output.txt"
