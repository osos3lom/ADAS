// Phase 2C — PID implementation.
#include "adas_control/pid.hpp"

#include <algorithm>

namespace adas_control
{

Pid::Pid(double kp, double ki, double kd, double i_limit)
: kp_(kp), ki_(ki), kd_(kd), i_limit_(i_limit)
{
}

double Pid::step(double error, double dt)
{
  if (dt <= 0.0) {
    return kp_ * error;
  }
  integral_ = std::clamp(integral_ + error * dt, -i_limit_, i_limit_);
  double derivative = 0.0;
  if (has_prev_) {
    derivative = (error - prev_error_) / dt;
  }
  prev_error_ = error;
  has_prev_ = true;
  return kp_ * error + ki_ * integral_ + kd_ * derivative;
}

void Pid::reset()
{
  integral_ = 0.0;
  prev_error_ = 0.0;
  has_prev_ = false;
}

}  // namespace adas_control
