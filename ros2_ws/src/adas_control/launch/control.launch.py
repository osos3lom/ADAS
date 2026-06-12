"""Phase 2C — launch the Pure Pursuit + PID control node."""
from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    return LaunchDescription([
        Node(
            package="adas_control",
            executable="control_node",
            name="control_node",
            output="screen",
            parameters=[{
                "kp": 0.25,
                "ki": 0.05,
                "kd": 0.02,
                "wheelbase_m": 2.875,
                "rate_hz": 20.0,
            }],
        ),
    ])
