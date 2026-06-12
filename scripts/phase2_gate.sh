#!/usr/bin/env bash
# Phase 2 gate — fully automated AEB-approach test.
# Result: phase2_gate_report.txt (PASS/FAIL + timeline) in the repo root.
REPO=/mnt/c/Users/Asus/Documents/GitHub/ADAS
exec > "$REPO/gate_run_log.txt" 2>&1
source "$REPO/scripts/wsl_env.sh"

echo "[gate] checking the stack is alive..."
if ! timeout 8 ros2 topic hz /adas/state 2>/dev/null | grep -q "average rate"; then
    echo "[gate] stack not running — restarting pipeline (CARLA must be up)"
    bash "$REPO/scripts/run_all.sh"
fi
if ! timeout 8 ros2 topic hz /carla/ego_vehicle/odometry 2>/dev/null | grep -q "average rate"; then
    echo "[gate] ERROR: no odometry — is CARLA running? Try restart_all.bat"
    echo "PHASE 2 GATE: FAIL (pipeline not running)" > "$REPO/phase2_gate_report.txt"
    exit 1
fi

echo "[gate] starting monitor..."
python3 "$REPO/scripts/gate_monitor.py" &
MON=$!
sleep 12   # let the ego accelerate toward cruise

echo "[gate] spawning stationary lead vehicle 45 m ahead..."
python3 "$REPO/scripts/spawn_lead.py"

wait $MON
echo "[gate] done — see phase2_gate_report.txt"
