// Phase 2C — Pure Pursuit implementation.
//
// delta = atan2(2 * L * sin(alpha), Ld)
//   alpha — bearing to the lookahead point in the vehicle frame
//   L     — wheelbase, Ld — speed-scaled lookahead distance
#include "adas_control/pure_pursuit.hpp"

#include <algorithm>
#include <cmath>

namespace adas_control
{

PurePursuit::PurePursuit(
  double wheelbase_m, double lookahead_min_m, double lookahead_gain_s)
: wheelbase_m_(wheelbase_m),
  lookahead_min_m_(lookahead_min_m),
  lookahead_gain_s_(lookahead_gain_s)
{
}

std::optional<double> PurePursuit::compute_steer(
  const Pose2d & ego,
  double speed_mps,
  const std::vector<std::pair<double, double>> & path_xy) const
{
  if (path_xy.empty()) {
    return std::nullopt;
  }
  const double ld = std::max(lookahead_min_m_, lookahead_gain_s_ * speed_mps);
  const double cos_yaw = std::cos(ego.yaw);
  const double sin_yaw = std::sin(ego.yaw);

  // First waypoint ahead of the ego at distance >= Ld (vehicle frame).
  std::optional<std::pair<double, double>> target;
  double best_dist = 0.0;
  for (const auto & [wx, wy] : path_xy) {
    const double dx = wx - ego.x;
    const double dy = wy - ego.y;
    const double local_x = cos_yaw * dx + sin_yaw * dy;    // forward
    const double local_y = -sin_yaw * dx + cos_yaw * dy;   // left
    if (local_x <= 0.0) {
      continue;  // behind
    }
    const double dist = std::hypot(local_x, local_y);
    if (dist >= ld) {
      target = {local_x, local_y};
      best_dist = dist;
      break;
    }
    // remember the farthest forward point as a fallback
    if (!target || dist > best_dist) {
      target = {local_x, local_y};
      best_dist = dist;
    }
  }
  if (!target) {
    return std::nullopt;
  }
  const double alpha = std::atan2(target->second, target->first);
  return std::atan2(2.0 * wheelbase_m_ * std::sin(alpha), std::max(best_dist, 1e-3));
}

}  // namespace adas_control
