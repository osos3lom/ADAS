"""Phase 2A — launch the LiDAR perception node."""
from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    return LaunchDescription([
        Node(
            package="adas_perception",
            executable="perception_node",
            name="perception_node",
            output="screen",
            parameters=[{
                "cluster_tolerance": 0.7,
                "min_cluster_size": 8,
                "range_max": 60.0,
                "lane_half_width": 1.5,
            }],
        ),
    ])
