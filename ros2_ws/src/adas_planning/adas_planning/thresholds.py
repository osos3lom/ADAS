"""Phase 2B — ADAS thresholds.

These values are the SPEC, mirrored 1:1 from the Phase 0 reference
implementation in ``backend/simulation/scenarios.py``. Do not tune them here
without changing the backend reference (and its tests) in the same commit.

Provenance (backend/simulation/scenarios.py):
  - AEB warning window:   ``1.5 < ttc < 3.0``          (line ~128)
  - AEB active:           ``ttc <= 1.5`` → brake 100%, accel -8.5 m/s² (lines ~133-136)
  - LDW warn:             ``lane_offset > 0.5`` m       (line ~191)
  - LDW clear hysteresis: ``lane_offset > 0.4`` keeps it on (line ~205)
  - ACC following gap:    80 m                          (line ~78)
"""

# ── AEB ─────────────────────────────────────────────────────────────────────
AEB_TTC_WARNING_S: float = 3.0    # warning when AEB_TTC_ACTIVE_S < ttc < this
AEB_TTC_ACTIVE_S: float = 1.5     # full braking at/below this TTC
AEB_DECEL_MPS2: float = -8.5      # commanded deceleration when active
AEB_BRAKE_PCT: float = 100.0      # brake pressure when active

# ── LDW ─────────────────────────────────────────────────────────────────────
LDW_OFFSET_WARN_M: float = 0.5    # warn above this lateral offset
LDW_OFFSET_CLEAR_M: float = 0.4   # clear below this (hysteresis)

# ── ACC ─────────────────────────────────────────────────────────────────────
ACC_FOLLOW_DISTANCE_M: float = 80.0   # desired following gap
ACC_DEFAULT_SETPOINT_MPS: float = 13.9  # ~50 km/h cruise default for CARLA towns
ACC_MIN_CLOSING_SPEED_MPS: float = 0.1  # below this, TTC is treated as infinite
