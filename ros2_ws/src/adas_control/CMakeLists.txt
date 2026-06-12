cmake_minimum_required(VERSION 3.8)
project(adas_control)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(std_msgs REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(nav_msgs REQUIRED)
find_package(carla_msgs REQUIRED)

include_directories(include)

# Phase 2C — control node (Pure Pursuit + PID → CarlaEgoVehicleControl)
add_executable(control_node
  src/control_node.cpp
  src/pure_pursuit.cpp
  src/pid.cpp
)
ament_target_dependencies(control_node
  rclcpp
  std_msgs
  geometry_msgs
  nav_msgs
  carla_msgs
)

install(TARGETS control_node
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
