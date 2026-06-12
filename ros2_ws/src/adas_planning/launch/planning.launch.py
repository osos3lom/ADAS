"""Phase 2B — launch the consolidated ADAS planning node."""
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    return LaunchDescription([
        DeclareLaunchArgument("cruise_setpoint_mps", default_value="13.9"),
        Node(
            package="adas_planning",
            executable="planning_node",
            name="planning_node",
            output="screen",
            parameters=[{
                "cruise_setpoint_mps": LaunchConfiguration("cruise_setpoint_mps"),
            }],
        ),
    ])
