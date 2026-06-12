cmake_minimum_required(VERSION 3.8)
project(adas_perception)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(sensor_msgs REQUIRED)
find_package(std_msgs REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(visualization_msgs REQUIRED)
find_package(pcl_conversions REQUIRED)
find_package(PCL REQUIRED COMPONENTS common filters segmentation search)

include_directories(include ${PCL_INCLUDE_DIRS})

# Phase 2A — perception node (LiDAR clustering → /adas/obstacles)
add_executable(perception_node
  src/perception_node.cpp
  src/clustering.cpp
)
ament_target_dependencies(perception_node
  rclcpp
  sensor_msgs
  std_msgs
  geometry_msgs
  visualization_msgs
  pcl_conversions
)
target_link_libraries(perception_node ${PCL_LIBRARIES})

install(TARGETS perception_node
  DESTINATION lib/${PROJECT_NAME}
)
install(DIRECTORY launch
  DESTINATION share/${PROJECT_NAME}
)

if(BUILD_TESTING)
  find_package(ament_lint_auto REQUIRED)
  ament_lint_auto_find_test_dependencies()
endif()

ament_package()
