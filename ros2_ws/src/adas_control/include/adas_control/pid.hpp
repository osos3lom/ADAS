// Phase 2C — longitudinal PID controller.
#ifndef ADAS_CONTROL__PID_HPP_
#define ADAS_CONTROL__PID_HPP_

namespace adas_control
{

/// Simple PID with integral anti-windup clamping.
class Pid
{
public:
  Pid(double kp, double ki, double kd, double i_limit);

  /// Returns the control effort for the given error and timestep.
  double step(double error, double dt);

  void reset();

private:
  double kp_, ki_, kd_, i_limit_;
  double integral_{0.0};
  double prev_error_{0.0};
  bool has_prev_{false};
};

}  // namespace adas_control

#endif  // ADAS_CONTROL__PID_HPP_
