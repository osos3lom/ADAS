// Phase 2C — Pure Pursuit lateral controller.
#ifndef ADAS_CONTROL__PURE_PURSUIT_HPP_
#define ADAS_CONTROL__PURE_PURSUIT_HPP_

#include <optional>
#include <utility>
#include <vector>

namespace adas_control
{

struct Pose2d
{
  double x{0.0};
  double y{0.0};
  double yaw{0.0};
};

/// Pure Pursuit steering over a path of map-frame waypoints.
class PurePursuit
{
public:
  PurePursuit(double wheelbase_m, double lookahead_min_m, double lookahead_gain_s);

  /// Steering angle (rad, +left) toward the lookahead point, or std::nullopt
  /// when no waypoint lies ahead of the ego.
  std::optional<double> compute_steer(
    const Pose2d & ego,
    double speed_mps,
    const std::vector<std::pair<double, double>> & path_xy) const;

private:
  double wheelbase_m_;
  double lookahead_min_m_;
  double lookahead_gain_s_;   // Ld = max(min, gain * v)
};

}  // namespace adas_control

#endif  // ADAS_CONTROL__PURE_PURSUIT_HPP_
