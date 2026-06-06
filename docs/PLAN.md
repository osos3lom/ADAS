# ADAS-ECU — Learning Roadmap (CARLA → ROS2 → UDS)

> **This is the source-of-truth roadmap.** It supersedes any plan that lives only in a
> local `~/.claude/plans/` folder. The companion runbook with copy-paste commands is
> [PHASE1_SETUP.md](PHASE1_SETUP.md).

The goal is to learn the full production-mirroring ADAS stack **end-to-end on one
machine** — not just build it. Each phase is written as
**LEARN** (concepts) · **READ** (canonical docs) · **BUILD** (deliverable) ·
**CHECK** (a command/observation that proves both that it works *and* that you understood
it).

---

## Target architecture

```
Windows host (native)                         WSL2: Ubuntu 22.04 (vhdx on D:)
┌──────────────────────────┐                 ┌─────────────────────────────────────┐
│ CARLA 0.9.15 (D:\adas)    │ TCP 2000-2      │ ROS2 Humble + carla-ros-bridge       │
│ RTX 2080 Ti, sync mode    │◀──────────────▶ │ perception(C++) planning(py) ctrl(C++)│
└──────────────────────────┘ (mirrored net)  │ ecu_bridge → UDS over ISO-TP         │
┌──────────────────────────┐                 └─────────────────────────────────────┘
│ Next.js dashboard =       │  /api/*           ┌──────────────┐   ┌────────────────┐
│ ADMIN / CONTROL CENTER    │◀────────────────▶ │ FastAPI      │◀─▶│ Postgres (D:)  │
│ service health + deep     │                   │ + SQLModel   │   │ DTC/log/audit/ │
│ links to backend/CARLA/DB │                   │ + Alembic    │   │ runs/telemetry │
└──────────────────────────┘                   └──────────────┘   └────────────────┘
```

**Why this split:** CARLA renders best on the **native Windows GPU driver** (RTX 2080 Ti,
11 GB). ROS2 Humble is Linux-only, so it lives in **WSL2 Ubuntu 22.04**. The CARLA
client/server protocol is plain TCP, so the WSL2 ROS2 stack connects to the Windows CARLA
server over `localhost:2000` (WSL2 *mirrored networking*). This avoids fragile GPU-render
passthrough inside WSL while still being one physical machine.

**This machine:** i9-9900K (8C/16T), 32 GB RAM, RTX 2080 Ti (11 GB), Windows 11 Pro,
WSL2 v2.6.3 (kernel 6.6.87, WSLg + GPU). Heavy data lives on **D:** (894 GB free); the git
repo stays on **C:**.

---

## Phase 0 — Foundation ✅ (complete)

Runnable FastAPI backend (pure-Python ADAS sim + ISO 14229 UDS server), Next.js dashboard,
Docker, pytest, CI. The Python in `backend/` is ported 1-to-1 from the TypeScript reference
in `frontend/lib/`. **This phase's thresholds and UDS logic are reused as the spec for the
real ROS2/CAN stack below** — they are not throwaway mocks.

**This iteration also adds** (still cross-platform, no CARLA needed):
- **PostgreSQL persistence** (DTC history, system logs, UDS audit, sim runs, telemetry).
- The dashboard becomes an **Admin / Control Center**: per-service health + deep links to
  the backend (`/docs`), CARLA, ROS2 bridge, DB, etc.

---

## Phase 1 — Environment + simulation backbone

**The bring-up runbook is [PHASE1_SETUP.md](PHASE1_SETUP.md).** Two sub-steps:

### 1.0 — Hybrid environment
- **LEARN:** what WSL2 is and why mirrored networking lets WSL reach a Windows TCP server;
  the CARLA client/server model; `apt` ROS2 install vs source.
- **READ:** WSL networking docs; CARLA "Quick start"; ROS2 Humble "Installation (Debian)".
- **BUILD:** `.wslconfig` (mirrored, 16 GB); Ubuntu 22.04 (vhdx relocated to `D:\adas\wsl`);
  ROS2 Humble desktop; CARLA 0.9.15 in `D:\adas\CARLA_0.9.15`.
- **CHECK:** ROS2 talker/listener demo runs; CARLA renders on Windows with port 2000 open;
  a 5-line `carla.Client('localhost', 2000)` script in WSL prints the map name.

### 1.1 — Ego vehicle + sensors → ROS2 topics
- **LEARN:** CARLA actors & blueprints; sensor model (RGB, LiDAR, IMU, collision); ROS2
  nodes / topics / QoS; TF coordinate frames; colcon workspaces; **why synchronous +
  fixed-timestep mode is essential for reproducible ADAS tests.**
- **READ:** docs.ros.org Humble beginner tutorials (CLI, workspace, topics, TF2); CARLA
  "ROS bridge" + "Sensors reference".
- **BUILD:** `ros2_ws/` colcon workspace; clone `ros-bridge` at the **0.9.15-compatible
  ref**; spawn ego + RGB/LiDAR/IMU/collision; run CARLA synchronous fixed-timestep.
- **CHECK:** `ros2 topic list` shows `/carla/ego_vehicle/*`;
  `ros2 topic echo /carla/ego_vehicle/lidar` streams; `rqt_graph` + `rviz2` render the
  sensors while CARLA draws on Windows.

---

## Phase 2 — ADAS stack (perception → planning → control)

- **LEARN:** point-cloud clustering (Euclidean / DBSCAN); Time-To-Collision (TTC) math;
  finite-state-machine design; Pure-Pursuit steering geometry; PID; sensor→world TF.
- **READ:** CARLA sensor reference; a Pure-Pursuit primer; `ros2_control` basics.
- **BUILD:**
  - **Perception** (C++ / `rclcpp`): cluster LiDAR → nearest in-lane object → `/obstacles`
    (range + relative speed).
  - **Planning FSM** (Python / `rclpy`): TTC→AEB, lane-offset→LDW, gap→ACC → `/adas/state`.
    **Reuse the exact thresholds already in
    [`backend/simulation/scenarios.py`](../backend/simulation/scenarios.py):** AEB *warning*
    at `1.5 < TTC < 3.0`, *active* at `TTC ≤ 1.5` (full brake, `accel = -8.5`); LDW when
    `lane_offset > 0.5`; the ACC following-distance logic. These are the spec.
  - **Control** (C++ / `rclcpp`): Pure Pursuit (steering) + PID (throttle/brake) → CARLA.
- **CHECK:** drive an AEB approach in CARLA → `/adas/state` flips to AEB *active*, the ego
  brakes, rviz markers sit on the lead vehicle; the numbers track the Phase-0 thresholds.

---

## Phase 3 — Virtual ECU + real UDS over CAN

- **LEARN:** ISO 14229 (UDS) services; ISO-TP (ISO 15765-2) multi-frame framing; SocketCAN;
  seed-key SecurityAccess; the DTC lifecycle (active / pending / stored).
- **READ:** `udsoncan`, `python-can`, `can-isotp` docs; an ISO 14229 service overview.
- **BUILD:**
  - **`ecu_bridge`** (Python / `rclpy`): subscribe `/adas/state`, keep a DID registry +
    DTC store, run a real ISO 14229 server over ISO-TP. **Reuse
    [`backend/uds/`](../backend/uds/) wholesale** — `services.py`
    (0x10/11/14/19/22/27/2E), `constants.py` (DID/NRC maps), `processor.py`,
    SecurityAccess key = `seed XOR 0xCAFEBABE` — wrapped behind the `udsoncan` server.
  - **Transport on WSL2 (key gotcha):** the default WSL2 kernel likely lacks
    `CONFIG_CAN_VCAN`. **Start with `python-can` `virtual` bus + pure-Python `isotp`** —
    full UDS-over-ISO-TP with no kernel change. Build a custom WSL2 kernel
    (CAN/VCAN/ISOTP, `kernel=` in `.wslconfig`) only when you want real SocketCAN
    `candump`/`cansend` tooling.
  - Rename **`backend/can/` → `backend/canbus/`** (avoids shadowing the PyPI `python-can`
    package); wire [`backend/ros2/bridge.py`](../backend/ros2/bridge.py) so `/api/sim/*`
    serves live ROS2/UDS data. Dashboard unchanged.
- **CHECK:** a bus trace of `10 03 → 27 01/02 → 2E … → 22 … → 19 02 FF`; the dashboard
  shows DTCs produced by the *CARLA-driven* scenario (and persisted to Postgres), not the
  mock.

---

## Phase 4 — Diagnostic tester scripts

- **LEARN:** tester vs ECU roles; the `udsoncan` client API; the SecurityAccess handshake.
- **READ:** `udsoncan` client examples.
- **BUILD:** `read_adas_status.py`, `inject_fault.py`, `write_adas_param.py` (uses `0x27`),
  `clear_dtcs.py` — `udsoncan` clients over the real transport.
- **CHECK:** run each against the live ECU; assert the responses; cross-check on the
  dashboard + DB history views.

---

## Phase 5 — Integration test + CI + demo

- **LEARN:** `ros2 bag` record/replay; `launch_testing`; ROS2 CI (`industrial_ci` / colcon);
  reproducibility.
- **READ:** ROS2 testing + bag docs.
- **BUILD:** a headless CARLA scenario that asserts specific DTCs appear over UDS; record
  `ros2 bag` fixtures into `D:\adas\recordings`.
- **CHECK:** **CARLA can't run on GitHub Actions (no GPU)** — so CI replays the recorded
  bags through the ROS2/UDS layer deterministically; colcon build runs in CI; a short demo
  is recorded in the README. Keep CARLA-in-the-loop as a local-only test.

---

## Reuse map (don't rewrite what Phase 0 already proved)

| Need in the real stack | Reuse from Phase 0 |
|---|---|
| ADAS trigger thresholds (AEB/LDW/ACC) | [`backend/simulation/scenarios.py`](../backend/simulation/scenarios.py) |
| UDS service handlers + DID/NRC maps + seed-key | [`backend/uds/`](../backend/uds/) |
| Data contract (camelCase) the dashboard speaks | [`frontend/types/index.ts`](../frontend/types/index.ts) + `backend/simulation/state.py` |
| Dashboard ↔ backend proxy | [`frontend/lib/backend.ts`](../frontend/lib/backend.ts) |
| DTC / log / audit persistence | `backend/db/` (added this iteration) |
