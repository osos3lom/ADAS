# ADAS-ECU Simulation with Integrated UDS Diagnostics

A vertical slice of a production-mirroring ADAS stack: an autonomous-driving
simulation feeding an ADAS state machine (AEB / LDW / ACC), exposed over an
**ISO 14229 (UDS)** diagnostic interface, with a live web dashboard that doubles
as a diagnostic tester.

The end goal is the full robotics stack (CARLA → ROS2 → SocketCAN UDS), run on a single
workstation: **CARLA 0.9.15 native on Windows (GPU) + ROS2 Humble in WSL2 Ubuntu 22.04**.
This repository is built up to that in phases — see the full learning roadmap in
[ADAS-master-plan-v3.md](ADAS-master-plan-v3.md).

> **Status: Phase 0 complete (+ persistence & admin UI).** A Next.js dashboard that
> doubles as an **Admin / Control Center** (per-service health + deep links) and a runnable
> Python FastAPI backend that simulates the ADAS vehicle, serves a working UDS server over
> REST, and **persists DTCs / logs / UDS audit / sim runs to PostgreSQL**. CARLA / ROS2 /
> real SocketCAN are Phase 1+.

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

- **Phase 0 — Foundation (done):** runnable FastAPI backend, dashboard↔backend
  proxy, Docker, tests, CI — **plus** PostgreSQL persistence and the Admin / Control Center.
- **Phase 1 — Simulation backbone:** WSL2 Ubuntu 22.04 + ROS2 Humble + CARLA 0.9.15 on
  Windows; spawn ego vehicle, publish camera/LiDAR/IMU topics (`ros2_ws/`).
- **Phase 2 — ADAS stack:** C++ perception (LiDAR clustering), Python planning
  FSM, C++ control (Pure Pursuit). Reuse the thresholds in `simulation/`.
- **Phase 3 — Virtual ECU + real UDS over CAN:** rclpy bridge + ISO 14229 over ISO-TP
  (`python-can` virtual bus + pure-Python `isotp` first; real `vcan0` via a custom WSL2
  kernel later). Wire `backend/ros2/`. (`backend/can/` already renamed to `backend/canbus/`.)
- **Phase 4 — Tester scripts:** `read_adas_status.py`, `inject_fault.py`,
  `write_adas_param.py`, `clear_dtcs.py` over real CAN.
- **Phase 5 — CI + docs + demo:** replay-based integration test, colcon build in CI,
  demo recording.

---

## Layout

```
backend/        FastAPI app, simulation engine, UDS server, Phase-3 placeholders
frontend/       Next.js dashboard (+ standalone TS simulation/UDS mock)
Dockerfile      frontend image (build context = repo root)
docker-compose.yml
```
