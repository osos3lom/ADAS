"""Phase 2 — full ADAS stack: perception → planning → control (+ optional ecu_bridge).

Run AFTER adas_bringup.launch.py (CARLA bridge + ego + sensors must be up):

    # WSL2, workspace sourced:
    ros2 launch /mnt/c/Users/Asus/Documents/GitHub/ADAS/ros2_ws/launch/adas_stack.launch.py

Args:
    cruise_setpoint_mps  (default 13.9 ≈ 50 km/h)
    with_ecu_bridge      (default false — needs the FastAPI backend on :8000)
    with_waypoints       (default true — carla_waypoint_publisher for lane-following)

Phase 2 gate (automated): double-click phase2_gate.bat → phase2_gate_report.txt
"""
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    return LaunchDescription([
        DeclareLaunchArgument("cruise_setpoint_mps", default_value="13.9"),
        DeclareLaunchArgument("with_ecu_bridge", default_value="false"),
        DeclareLaunchArgument("backend_url", default_value="http://localhost:8000"),
        DeclareLaunchArgument("with_waypoints", default_value="true"),

        # Route planner: publishes /carla/ego_vehicle/waypoints (latched Path)
        # once a goal arrives on /carla/ego_vehicle/goal. Pure Pursuit in
        # adas_control lane-follows when the path exists, else steer = 0.
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(
                os.path.join(
                    get_package_share_directory("carla_waypoint_publisher"),
                    "carla_waypoint_publisher.launch.py",
                )
            ),
            condition=IfCondition(LaunchConfiguration("with_waypoints")),
            launch_arguments={
                "host": "localhost",
                "port": "2000",
                "timeout": "10",
                "role_name": "ego_vehicle",
            }.items(),
        ),

        Node(
            package="adas_perception",
            executable="perception_node",
            name="perception_node",
            output="screen",
        ),
        Node(
            package="adas_planning",
            executable="planning_node",
            name="planning_node",
            output="screen",
            parameters=[{
                "cruise_setpoint_mps": LaunchConfiguration("cruise_setpoint_mps"),
            }],
        ),
        Node(
            package="adas_control",
            executable="control_node",
            name="control_node",
            output="screen",
        ),
        Node(
            package="adas_ecu_bridge",
            executable="ecu_bridge_node",
            name="ecu_bridge_node",
            output="screen",
            condition=IfCondition(LaunchConfiguration("with_ecu_bridge")),
            parameters=[{
                "backend_url": LaunchConfiguration("backend_url"),
            }],
        ),
    ])
