# ADAS-ECU Simulation with Integrated UDS Diagnostics

A vertical slice of a production-mirroring ADAS stack: an autonomous-driving
simulation feeding an ADAS state machine (AEB / LDW / ACC), exposed over an
**ISO 14229 (UDS)** diagnostic interface, with a live web dashboard that doubles
as a diagnostic tester.

The end goal is the full robotics stack (CARLA → ROS2 → SocketCAN UDS), run on a single
workstation: **CARLA 0.9.15 native on Windows (GPU) + ROS2 Humble in WSL2 Ubuntu 22.04**.
This repository is built up to that in phases — see the full learning roadmap in
[ADAS-master-plan-v3.md](ADAS-master-plan-v3.md).

> **Status (2026-06-12): Phases 0–2 built and running.** Phase 0: Next.js
> **Admin / Control Center** dashboard + FastAPI backend with a working UDS server and
> **PostgreSQL persistence**. Phases 1–2: the real robotics stack is live —
> **CARLA 0.9.15 (Windows GPU) → carla-ros-bridge → C++ LiDAR perception →
> Python AEB/LDW/ACC planning FSM → C++ Pure Pursuit/PID control → back into CARLA**,
> all in ROS2 Humble on WSL2 with the closed-loop data path verified end-to-end
> (planning/control at 20 Hz). Remaining for the Phase 2 gate: the AEB-with-traffic demo.
> Single source of truth for plan + status: [ADAS-master-plan-v3.md](ADAS-master-plan-v3.md).

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  Next.js Dashboard  (tester + live visualization)             │
│  telemetry · ADAS status · UDS console · DTC manager · charts │
└───────────────────────────┬───────────────────────────────────┘
                            │  HTTP  /api/sim/*
                            │  (proxied to BACKEND_URL when set,
                            │   else served by an in-process TS mock)
                            ▼
┌───────────────────────────────────────────────────────────────┐
│  FastAPI backend  (Python — source of truth)                  │
│   simulation/  5 driving scenarios → ADAS FSM (AEB/LDW/ACC)   │
│   uds/         ISO 14229 services 0x10/11/14/19/22/27/2E       │
│   db/          SQLModel + Alembic → PostgreSQL persistence     │
│   ros2/ , can/ Phase-3 placeholders (rclpy / SocketCAN)        │
└──────────────┬────────────────────────────────────────────────┘
               ▼                          ▲ (Phase 1–3, on this box)
        PostgreSQL (Docker)      CARLA 0.9.15 (Windows GPU)
        DTC/log/audit/runs       →  ROS2 Humble (WSL2)  →  UDS over CAN
```

The Python simulation + UDS logic in `backend/` is ported 1-to-1 from the intact
TypeScript reference in `frontend/lib/` (`scenarios.ts`, `uds-processor.ts`,
`simulation-state.ts`). The TS mock remains as an **offline/demo mode** so the
dashboard runs with or without the backend.

---

## Quick start

### Option A — Docker (both services)

```bash
docker compose up --build
# dashboard → http://localhost:3000
# backend   → http://localhost:8000  (/docs, /health)
```

`BACKEND_URL=http://backend:8000` is injected into the frontend, so the dashboard
talks to the real Python backend.

### Option B — Run each service locally

Backend:
```bash
cd backend
python -m venv .venv && . .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend (standalone TS mock — no backend needed):
```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

Frontend against the local backend:
```bash
cd frontend
BACKEND_URL=http://localhost:8000 npm run dev     # PowerShell: $env:BACKEND_URL="http://localhost:8000"; npm run dev
```

### Option C — Full robotics stack (CARLA + ROS2, Phases 1–2)

One machine: CARLA native on Windows (`D:\adas\CARLA_0.9.15`), ROS2 Humble in WSL2 Ubuntu 22.04.

```bash
# WSL2, one-time build — artifacts go to ext4 (~/adas_build, ~/adas_install);
# building under /mnt/c fails on NTFS permissions:
bash /mnt/c/Users/Asus/Documents/GitHub/ADAS/scripts/build_ws.sh
```

Then either double-click `restart_all.bat` (starts/repairs everything: CARLA + bridge +
ADAS stack + diagnostics), or run manually:

```bash
source /mnt/c/Users/Asus/Documents/GitHub/ADAS/scripts/wsl_env.sh   # ROS2 + overlay + FastDDS localhost
ros2 launch ros2_ws/launch/adas_bringup.launch.py    # bridge + ego (Tesla M3) + 8 sensors, sync 20 Hz
ros2 launch ros2_ws/launch/adas_stack.launch.py      # perception → planning → control
ros2 topic echo /adas/state                          # aebStatus flips standby → warning → active
```

| Helper | Purpose |
|--------|---------|
| `scripts/build_ws.sh` | colcon build with ext4 build/install bases |
| `scripts/wsl_env.sh` | env: overlay, `ROS_DOMAIN_ID=42`, FastDDS + `ROS_LOCALHOST_ONLY=1` |
| `run_all.bat` / `restart_all.bat` | restart pipeline (the latter also reboots CARLA) |
| `follow_ego.bat` | chase-cam pinned behind the ego + live speed readout |
| `run_probe3.bat`, `scripts/diag.sh` | topic-rate health checks → `probe_output.txt` / `diag_output.txt` |

ROS2 topics: `/adas/obstacles` (markers), `/adas/nearest_obstacle` `[range, closing, x, y]`,
`/adas/state` (JSON), `/adas/aeb_command`, `/adas/acc_setpoint_mps`, `/adas/ldw_alert`,
`/adas/dtc_event` → ecu_bridge → `/api/incidents`.

Troubleshooting (full list in the master plan's *Status Log*): use `--no-daemon` with
`ros2 node/topic list` (the daemon hangs on this WSL2); per-vehicle topics like odometry
come from **pseudo-sensors** declared in `ros2_ws/config/adas_objects.json`; never
colcon-build under `/mnt/c`.

---

## API (`/api/sim/*`)

| Method | Path                  | Body          | Description                              |
|--------|-----------------------|---------------|------------------------------------------|
| GET    | `/api/sim/state`      | —             | Current simulation state (camelCase)     |
| POST   | `/api/sim/scenario`   | `{scenario}`  | Switch scenario                          |
| POST   | `/api/sim/uds`        | `{command}`   | Send a UDS hex request, get the response |
| POST   | `/api/sim/clear-dtcs` | —             | Clear all stored DTCs                    |
| POST   | `/api/sim/inject-fault` | `{code?}`   | Inject a named (or random) DTC           |
| GET    | `/api/sim/inject-fault` | —           | List injectable faults                   |

Scenarios: `normal_driving`, `highway_acc`, `aeb_trigger`, `lane_departure`,
`sensor_fault`.

### UDS quick reference

Services: `0x10` SessionControl · `0x11` ECUReset · `0x14` ClearDTC ·
`0x19` ReadDTC · `0x22` ReadDataByIdentifier · `0x27` SecurityAccess ·
`0x2E` WriteDataByIdentifier. SecurityAccess key = `seed XOR 0xCAFEBABE`.

Example flow (paste into the UDS console, or POST to `/api/sim/uds`):
```
10 03            # enter Extended session
27 01            # request seed   → 67 01 <seed×4>
27 02 <key×4>    # send key = seed XOR CA FE BA BE
2E 02 03 03      # WriteDID AEB_Sensitivity = HIGH
22 02 03         # ReadDID  AEB_Sensitivity
19 02 FF         # ReadDTC by status mask
14 FF FF FF      # ClearDTC (all)
```

---

## Tests

```bash
cd backend
pip install -r requirements.txt
pytest
```

Covers the UDS services (session/security/read-write/DTC round-trips) and the
scenario engine (AEB triggers `P1001`, sensor-fault triggers `B1001`, etc.).
CI runs these plus a frontend build on every push (`.github/workflows/ci.yml`).

---

## Roadmap

Full learning-oriented detail (LEARN / READ / BUILD / CHECK per phase) lives in
[ADAS-master-plan-v3.md](ADAS-master-plan-v3.md).

- **Phase 0 — Foundation (✅ done):** runnable FastAPI backend, dashboard↔backend
  proxy, Docker, tests, CI — **plus** PostgreSQL persistence and the Admin / Control Center.
- **Phase 1 — Simulation backbone (✅ 1A/1B done, 1C pending):** WSL2 + ROS2 Humble +
  CARLA 0.9.15 on Windows; carla-ros-bridge built (23/23 packages); ego + camera/LiDAR/
  IMU/radar/GNSS topics live; SimBackend abstraction in `backend/simbackends/`.
  Remaining: 1C frontend redesign.
- **Phase 2 — ADAS stack (✅ built & running):** C++ perception (`adas_perception`,
  PCL Euclidean clustering), Python planning FSM (`adas_planning` — Phase 0 thresholds
  1:1), C++ control (`adas_control`, Pure Pursuit + PID). Closed loop verified at
  20 Hz; AEB-with-traffic gate demo pending.
- **Phase 3 — Virtual ECU + real UDS over CAN (next):** `adas_ecu_bridge` + ISO 14229
  over ISO-TP (`python-can` virtual bus + pure-Python `isotp` first; real `vcan0` via a
  custom WSL2 kernel later). Reuse `backend/uds/` wholesale; incidents API end-to-end.
- **Phase 4 — Tester scripts:** `read_adas_status.py`, `inject_fault.py`,
  `write_adas_param.py`, `clear_dtcs.py` over real CAN.
- **Phase 5 — CI + docs + demo:** replay-based integration test, colcon build in CI,
  demo recording.

---

## Layout

```
backend/        FastAPI app, simulation engine, UDS server, SimBackends, incidents API
frontend/       Next.js dashboard (+ standalone TS simulation/UDS mock)
ros2_ws/        ROS2 workspace: ros-bridge + adas_perception/planning/control/ecu_bridge,
                launch/ (adas_bringup, adas_stack), config/adas_objects.json
scripts/        wsl_env.sh, build_ws.sh, diag/probe scripts, follow_ego.py, UDS testers (Phase 4)
*.bat           Windows launchers (restart_all, run_all, follow_ego, probes)
Dockerfile      frontend image (build context = repo root)
docker-compose.yml
```
