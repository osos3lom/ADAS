"""ADAS Phase 1A bringup: carla_ros_bridge + ego vehicle (Tesla Model3) with
RGB camera, 64-ch LiDAR, IMU, GNSS, radar, collision and lane-invasion sensors.

Synchronous mode at 20 Hz (fixed_delta_seconds=0.05) so every ADAS step gets
a deterministic physics tick.

Usage (from WSL2, workspace sourced):
    ros2 launch /mnt/c/Users/Asus/Documents/GitHub/ADAS/ros2_ws/launch/adas_bringup.launch.py
    ros2 launch ... town:=Town03 host:=localhost port:=2000

Verify:
    ros2 topic list | grep /carla/ego_vehicle
"""
import os

import launch
from ament_index_python.packages import get_package_share_directory

_OBJECTS_JSON = "/mnt/c/Users/Asus/Documents/GitHub/ADAS/ros2_ws/config/adas_objects.json"


def generate_launch_description():
    return launch.LaunchDescription([
        # ── tuneable args ─────────────────────────────────────────────────────
        launch.actions.DeclareLaunchArgument("host", default_value="localhost"),
        launch.actions.DeclareLaunchArgument("port", default_value="2000"),
        launch.actions.DeclareLaunchArgument("timeout", default_value="60"),
        launch.actions.DeclareLaunchArgument("town", default_value="Town10HD_Opt"),
        launch.actions.DeclareLaunchArgument(
            "fixed_delta_seconds", default_value="0.05"
        ),
        launch.actions.DeclareLaunchArgument("role_name", default_value="ego_vehicle"),
        launch.actions.DeclareLaunchArgument(
            "spawn_point",
            default_value="None",
            description="x,y,z,roll,pitch,yaw — omit to let CARLA choose",
        ),

        # ── carla_ros_bridge (synchronous mode) ───────────────────────────────
        launch.actions.IncludeLaunchDescription(
            launch.launch_description_sources.PythonLaunchDescriptionSource(
                os.path.join(
                    get_package_share_directory("carla_ros_bridge"),
                    "carla_ros_bridge.launch.py",
                )
            ),
            launch_arguments={
                "host": launch.substitutions.LaunchConfiguration("host"),
                "port": launch.substitutions.LaunchConfiguration("port"),
                "timeout": launch.substitutions.LaunchConfiguration("timeout"),
                "town": launch.substitutions.LaunchConfiguration("town"),
                "passive": "False",
                "synchronous_mode": "True",
                "synchronous_mode_wait_for_vehicle_control_command": "False",
                "fixed_delta_seconds": launch.substitutions.LaunchConfiguration(
                    "fixed_delta_seconds"
                ),
            }.items(),
        ),

        # ── spawn ego vehicle + sensors from adas_objects.json ────────────────
        launch.actions.IncludeLaunchDescription(
            launch.launch_description_sources.PythonLaunchDescriptionSource(
                os.path.join(
                    get_package_share_directory("carla_spawn_objects"),
                    "carla_spawn_objects.launch.py",
                )
            ),
            launch_arguments={
                "host": launch.substitutions.LaunchConfiguration("host"),
                "port": launch.substitutions.LaunchConfiguration("port"),
                "timeout": launch.substitutions.LaunchConfiguration("timeout"),
                "role_name": launch.substitutions.LaunchConfiguration("role_name"),
                "spawn_point": launch.substitutions.LaunchConfiguration("spawn_point"),
                "objects_definition_file": _OBJECTS_JSON,
            }.items(),
        ),
    ])


if __name__ == "__main__":
    generate_launch_description()
