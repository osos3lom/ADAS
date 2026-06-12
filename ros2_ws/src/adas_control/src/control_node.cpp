// Phase 2C — control node: Pure Pursuit (lateral) + PID (longitudinal).
//
// Subscribes: /carla/ego_vehicle/odometry      (nav_msgs/Odometry)
//             /adas/acc_setpoint_mps           (std_msgs/Float32)
//             /adas/aeb_command                (std_msgs/Bool)  full-brake override
//             /carla/ego_vehicle/waypoints     (nav_msgs/Path)  optional — straight
//                                              roads work with steer = 0
// Publishes:  /carla/ego_vehicle/vehicle_control_cmd (carla_msgs/CarlaEgoVehicleControl)
//
// AEB semantics follow the Phase 0 spec: when /adas/aeb_command is true the
// node commands throttle 0 / brake 1.0 (≈ -8.5 m/s² in CARLA) regardless of
// the ACC setpoint.
#include <chrono>
#include <cmath>
#include <memory>
#include <utility>
#include <vector>

#include <carla_msgs/msg/carla_ego_vehicle_control.hpp>
#include <nav_msgs/msg/odometry.hpp>
#include <nav_msgs/msg/path.hpp>
#include <rclcpp/rclcpp.hpp>
#include <std_msgs/msg/bool.hpp>
#include <std_msgs/msg/float32.hpp>

#include "adas_control/pid.hpp"
#include "adas_control/pure_pursuit.hpp"

using adas_control::Pid;
using adas_control::Pose2d;
using adas_control::PurePursuit;

class ControlNode : public rclcpp::Node
{
public:
  ControlNode()
  : Node("control_node"),
    pid_(
      declare_parameter("kp", 0.25),
      declare_parameter("ki", 0.05),
      declare_parameter("kd", 0.02),
      declare_parameter("i_limit", 2.0)),
    pure_pursuit_(
      declare_parameter("wheelbase_m", 2.875),       // Tesla Model 3
      declare_parameter("lookahead_min_m", 6.0),
      declare_parameter("lookahead_gain_s", 0.8))
  {
    max_steer_rad_ = declare_parameter("max_steer_rad", 1.221);  // ≈70°

    odom_sub_ = create_subscription<nav_msgs::msg::Odometry>(
      "/carla/ego_vehicle/odometry", 10,
      [this](const nav_msgs::msg::Odometry::SharedPtr msg) {on_odom(msg);});
    setpoint_sub_ = create_subscription<std_msgs::msg::Float32>(
      "/adas/acc_setpoint_mps", 10,
      [this](const std_msgs::msg::Float32::SharedPtr msg) {
        setpoint_mps_ = msg->data;
      });
    aeb_sub_ = create_subscription<std_msgs::msg::Bool>(
      "/adas/aeb_command", 10,
      [this](const std_msgs::msg::Bool::SharedPtr msg) {
        if (msg->data && !aeb_active_) {
          pid_.reset();  // don't let integral fight the emergency brake
        }
        aeb_active_ = msg->data;
      });
    path_sub_ = create_subscription<nav_msgs::msg::Path>(
      "/carla/ego_vehicle/waypoints", rclcpp::QoS(1).transient_local(),
      [this](const nav_msgs::msg::Path::SharedPtr msg) {on_path(msg);});

    cmd_pub_ = create_publisher<carla_msgs::msg::CarlaEgoVehicleControl>(
      "/carla/ego_vehicle/vehicle_control_cmd", 10);

    const double hz = declare_parameter("rate_hz", 20.0);
    timer_ = create_wall_timer(
      std::chrono::duration<double>(1.0 / hz), [this]() {tick();});

    RCLCPP_INFO(get_logger(), "ControlNode ready (PID + Pure Pursuit @ %.0f Hz)", hz);
  }

private:
  void on_odom(const nav_msgs::msg::Odometry::SharedPtr msg)
  {
    const auto & p = msg->pose.pose.position;
    const auto & q = msg->pose.pose.orientation;
    ego_.x = p.x;
    ego_.y = p.y;
    // yaw from quaternion (z-axis rotation)
    ego_.yaw = std::atan2(
      2.0 * (q.w * q.z + q.x * q.y),
      1.0 - 2.0 * (q.y * q.y + q.z * q.z));
    const auto & v = msg->twist.twist.linear;
    speed_mps_ = std::hypot(v.x, v.y);
    last_odom_s_ = now().seconds();
  }

  void on_path(const nav_msgs::msg::Path::SharedPtr msg)
  {
    path_xy_.clear();
    path_xy_.reserve(msg->poses.size());
    for (const auto & ps : msg->poses) {
      path_xy_.emplace_back(ps.pose.position.x, ps.pose.position.y);
    }
  }

  void tick()
  {
    carla_msgs::msg::CarlaEgoVehicleControl cmd;
    cmd.header.stamp = now();

    const double t = now().seconds();
    const bool have_odom = (t - last_odom_s_) < 1.0;
    if (!have_odom) {
      // no telemetry → coast safe
      cmd.throttle = 0.0;
      cmd.brake = 0.3;
      cmd_pub_->publish(cmd);
      return;
    }

    // ── longitudinal ────────────────────────────────────────────────────
    if (aeb_active_) {
      cmd.throttle = 0.0;
      cmd.brake = 1.0;   // full brake — Phase 0: brake 100%, accel -8.5 m/s²
    } else {
      const double dt = (prev_tick_s_ > 0.0) ? (t - prev_tick_s_) : 0.05;
      const double u = pid_.step(setpoint_mps_ - speed_mps_, dt);
      cmd.throttle = static_cast<float>(std::clamp(u, 0.0, 0.75));
      cmd.brake = static_cast<float>(std::clamp(-u, 0.0, 1.0));
    }
    prev_tick_s_ = t;

    // ── lateral ─────────────────────────────────────────────────────────
    const auto steer = pure_pursuit_.compute_steer(ego_, speed_mps_, path_xy_);
    if (steer) {
      // CARLA: steer ∈ [-1, 1], +ve = right; ROS yaw/steer +ve = left.
      cmd.steer = static_cast<float>(
        std::clamp(-(*steer) / max_steer_rad_, -1.0, 1.0));
    } else {
      cmd.steer = 0.0;   // no path (straight-road AEB scenario) → hold lane
    }

    cmd.hand_brake = false;
    cmd.reverse = false;
    cmd.manual_gear_shift = false;
    cmd_pub_->publish(cmd);
  }

  Pid pid_;
  PurePursuit pure_pursuit_;
  double max_steer_rad_{1.221};

  Pose2d ego_;
  double speed_mps_{0.0};
  double setpoint_mps_{0.0};
  bool aeb_active_{false};
  double last_odom_s_{-1e9};
  double prev_tick_s_{-1.0};
  std::vector<std::pair<double, double>> path_xy_;

  rclcpp::Subscription<nav_msgs::msg::Odometry>::SharedPtr odom_sub_;
  rclcpp::Subscription<std_msgs::msg::Float32>::SharedPtr setpoint_sub_;
  rclcpp::Subscription<std_msgs::msg::Bool>::SharedPtr aeb_sub_;
  rclcpp::Subscription<nav_msgs::msg::Path>::SharedPtr path_sub_;
  rclcpp::Publisher<carla_msgs::msg::CarlaEgoVehicleControl>::SharedPtr cmd_pub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<ControlNode>());
  rclcpp::shutdown();
  return 0;
}
