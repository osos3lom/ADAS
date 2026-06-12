# ADAS Master Plan v3 — Unified Strategy + Implementation

> **This document supersedes** `docs/PLAN.md`, `docs/PHASE1_SETUP.md`, `ADAS-transformation-plan-v2.md`, and `implementation_plan.md` as the single source of truth.
>
> **How to read it:**
> - **Part I — Strategy** answers *why* and *what*: the industry problem, personas, agent architecture, workflows, competitive position, and end-state vision.
> - **Part II — Implementation** answers *how* and *when*: 8 concrete phases (0–7) with file-level deliverables, verification gates, and timelines on the actual dev environment (Windows + WSL2 + CARLA 0.9.15 + ROS2 Humble + RTX 2080 Ti).
> - **Part III — Governance** holds the merged roadmap, risk register, KPIs, and open questions.

---

## Design Decisions (locked)

| Decision | Choice |
|----------|--------|
| **Core strategy** | Hybrid — practical CARLA/ROS2/UDS stack first (Phases 1–3), then evolve into agentic platform (Phases 4–7) |
| **AlpaSim challenge** | Real goal — architecture must support actual competition submission |
| **Agent ecosystem** | Full (Scout, Analyst, Planner, Builder, Experiment, Evaluator, Policy, Reviewer, Copilot, Orchestrator, Challenge Ops) — built in Phases 4–7 |
| **LLM provider** | Model-agnostic agent layer — `LLMProvider` ABC; Claude tiers as default routing, swappable |
| **GPU resources** | Local RTX 2080 Ti + cloud GPU budget for AlpaSim/RL |
| **Timeline** | 6–12 months, quality over speed (~38 weeks estimated) |
| **Product intent** | Personal-first, product-ready architecture |
| **Frontend** | Complete redesign — new design system, glassmorphism, dark mode, micro-animations |
| **Environment status** | WSL2 ✅, ROS2 ✅, CARLA ✅, Docker ✅, Postgres ✅, carla-ros-bridge ✅, Phase 2 adas_* stack ✅ built & running (2026-06-12) — closed-loop data path verified end-to-end (world 10 Hz, odom 11 Hz, planning/control 20 Hz); DDS = FastDDS localhost-only; AEB-with-traffic demo pending |

### Phase mapping (old strategy numbering → this plan)

| Strategy v2 phase | This plan |
|---|---|
| v2 P1 (Copilot + SimBackend seam + incident model) | P1B (SimBackend), P3B (incident model), P4 (Copilot) |
| v2 P2 (Memory + research) | P4C (memory/KB), P4B (Scout/Analyst) |
| v2 P3 (Autonomous build loop) | P6C (Builder/Reviewer/Planner) |
| v2 P4 (CLVE) | P5 |
| v2 P5 (Policy + Challenge Ops) | P6A/6B |
| v2 P6 (Level-5 platform) | P7 |

---

# PART I — STRATEGY

## 0. The Industry Challenge This Plan Targets

### 0.1 The problem, precisely stated

Every production ADAS/AD organization — Lucid, Rivian, Mercedes, Waymo, the robotaxi startups — faces the same structural bottleneck:

1. **Models and functions are developed open-loop, but deployed closed-loop.** Open-loop validation replays recorded data and scores the model against ground truth. It is fast and cheap — and it systematically hides compounding errors, because in the real world the ego vehicle's own actions change the scene. A policy that scores well open-loop can drift off-lane, miss a cut-in, or freeze at an unprotected turn within seconds of closed-loop deployment. NVIDIA frames Alpamayo/AlpaGym explicitly as closing this "training ↔ deployment gap."
2. **Closed-loop validation doesn't scale manually.** Real-vehicle testing is slow, expensive, and dangerous; classical HIL rigs (dSPACE, Vector) validate ECUs, not learned behavior across millions of scenario variations. The long tail (OOD weather, adversarial agents, construction chaos, unusual geometry) is exactly where production systems fail and exactly what hand-built scenario suites never cover.
3. **The scenario suite itself rots.** Regulations (UNECE R157 ALKS, Euro NCAP protocols), benchmark practice (CARLA leaderboard → nuPlan/NAVSIM → AlpaSim), and incident learnings from the fleet all move monthly. Someone must continuously notice, author, validate, and regression-guard new scenarios. Today that someone is a human — the bottleneck.
4. **Validation results and vehicle diagnostics live in different universes.** When a closed-loop sim run produces an at-fault incident, no existing toolchain expresses that failure in the language the rest of the vehicle organization speaks: **DTCs, freeze-frames, UDS sessions, ISO 26262/21448 traceability.** The perception/planning team and the diagnostics/ECU team cannot triage the same artifact.

### 0.2 The public instantiation: NVIDIA AlpaSim E2E Closed-Loop Challenge 2026

NVIDIA's CVPR-2026 challenge (huggingface.co/spaces/nvidia/AlpasimE2EClosedLoopChallenge2026) evaluates submitted driving policies **in closed loop**, measuring **how long a model can drive without at-fault incidents** (collisions, road excursions, etc.) across a battery of **reconstructed real-world scenarios** rendered in AlpaSim — NVIDIA's open-source, microservice, GPU-parallel AV simulator (Omniverse NuRec rendering, configurable traffic, camera/LiDAR/radar sensor models). Its sibling, the Physical AI AV OOD Reasoning Challenge, targets long-tail reasoning. AlpaGym closes the loop further: closed-loop RL post-training (GRPO via Cosmos-RL) so policies *learn from the consequences of their actions*.

This challenge is the perfect external forcing function for ADAS-the-platform, because it is **exactly the internal gate an OEM runs**: "How many kilometers can this policy drive in our reconstructed scenario bank before an at-fault incident, and did the latest change regress that number?"

### 0.3 Why this is Lucid-shaped

- **DreamDrive validation:** Lucid's ADAS Domain Controller (camera ring + Luminar 1550nm LiDAR + radar + GNSS/IMU) runs perception+planning that must be validated against UNECE/NCAP and against regression across OTA releases. That is a closed-loop scenario-bank problem.
- **Diagnostics are first-class at an OEM:** the ADC speaks **UDS over DoIP (ISO 13400)**, powertrain over CAN-FD. Every field failure becomes a DTC + freeze-frame. A validation platform that emits incidents *in DTC form* plugs directly into existing OEM triage, audit, and ISO 26262/21448 (SOTIF) workflows — no general AI coding agent and no AV research sim does this.
- **OTA cadence:** each FOTA release of an ADAS function must re-clear the entire closed-loop regression bank within days, not quarters. That demands the autonomous build-validate loop this plan ships.

### 0.4 What "tackling it seamlessly after full production" means (acceptance definition)

At full production (Phase 7), an engineer states: *"Track the AlpaSim 2026 challenge; keep a submission-ready policy and a leaderboard position report every week."* The platform then — autonomously, under governance gates —

1. ingests the challenge rules/scenario distribution into the Knowledge Base (Scout),
2. stands up local closed-loop evaluation against the same metric (time-to-at-fault-incident) in its sim backends (Evaluator),
3. iterates policy/scenario/parameter improvements via AlpaGym-style closed-loop post-training in a sandbox (Policy + Experiment agents),
4. expresses every at-fault incident as a DTC + freeze-frame + UDS-readable artifact for engineer triage (the diagnostics bridge),
5. assembles a human-gated submission packet (weights/config/eval report) and, on approval, submits and tracks the leaderboard,
6. feeds leaderboard + incident outcomes back into steering memory — so the *next* challenge (or the next UNECE amendment, or the next internal release gate) requires zero re-architecture.

The challenge becomes a routine **workflow**, not a project.

---

## 1. Executive Summary

ADAS today (Phase 0, complete) is a clean, well-tested but *manually-maintained, open-loop, deterministic* simulator + UDS diagnostic stack. This plan transforms it in two movements:

**Movement 1 (Phases 1–3): make it real.** Replace the scripted tick engine with a genuine perception → planning → control stack running against CARLA via ROS2, and replace REST-mocked UDS with real ISO 14229 over ISO-TP — while laying the two architectural keystones everything later depends on: the **SimBackend abstraction** and the **structured incident model**.

**Movement 2 (Phases 4–7): make it self-developing and closed-loop-grounded.** Four pillars:

1. **Daily industry-research swarm** (Scout → Analyst): scans standards bodies, regulators, papers, OEM/AV news — explicitly including benchmark/challenge feeds (AlpaSim leaderboard, NAVSIM, CARLA, OOD challenge) — and converts signal into ranked, product-relevant insights.
2. **Self-developing product loop** (Planner → Builder → Reviewer → Experiment): turns insights + engineer input into concrete changes — scenarios, UDS services, fault libraries — built in a sandbox, validated, and presented as an approve/reject Release Candidate.
3. **Practitioner copilot** (Diagnostic Copilot): natural-language diagnostics over the real tools, embedded in the 3D workspace.
4. **Closed-Loop Validation Engine (CLVE)**: a pluggable **SimBackend** lane system (internal CPU engine → CARLA → **AlpaSim**), an **Evaluator agent** that scores any policy/scenario change on closed-loop KPIs (km-between-at-fault-incidents, route completion, infraction score), an **incident→DTC diagnostics bridge** that makes every sim failure triageable through the existing UDS layer, and a **Challenge Ops** workflow that can take the platform to any public leaderboard under human gates.

The flywheel: *research → proposal → build → **closed-loop validate** → approve → learn*. The regression spine shifts from "unit tests pass" to "**closed-loop KPIs did not regress on the golden scenario bank**" — the gate that actually matters at an OEM.

**Competitive position:** Cursor/Devin can't drive a simulator; dSPACE/Vector/NI can't research or self-develop; CARLA/AlpaSim/Foretellix don't speak UDS or run an autonomous build loop. ADAS owns the intersection: **domain-native autonomy + closed-loop validation + diagnostics-grade traceability.**

---

## 2. UX/UI Audit

Severity scale: **CRITICAL** (blocks the vision), **HIGH**, **MEDIUM**, **LOW**.

| # | Finding | Evidence | Severity | Impact | Fixed in |
|---|---------|----------|----------|--------|----------|
| 1 | No AI/agent surface exists at all | No agent code in repo | CRITICAL | Nothing to build the vision on | P4 |
| 2 | No user/engineer identity | `page.tsx` holds only sim state | CRITICAL | No feedback attribution, governance, or steering signal | P4C |
| 3 | Errors silently swallowed | `catch { /* ignore */ }` in polling/API helpers | HIGH | Untrustable state for humans *and* agents | P1C |
| 4 | One dense expert HUD, no task workspaces | Single `page.tsx` | HIGH | Decision fatigue across personas | P1C |
| 5 | No streaming transport (500ms polling) | `setInterval(fetchState, 500)` | HIGH | Blocks agent chat and live eval telemetry | P4D |
| 6 | History shallow & unsearchable | `history.py`, last-25 | HIGH | Closed-loop eval produces orders of magnitude more data; needs semantic + structured query | P4C/P5 |
| 7 | Status conveyed primarily by color | `scene-config.ts` palette | MEDIUM | Accessibility; agents narrating state need text/ARIA | P1C |
| 8 | No onboarding for either persona | No first-run flow | MEDIUM | High time-to-first-value | P1C |
| 9 | Control Center is admin-only | `control-center.tsx` | MEDIUM | Insights/Proposals/Governance/Eval surfaces have no home | P1C (shell), P4–P7 (content) |
| 10 | Mobile stacking; dark-only | grid classes | LOW | Field engineers on tablets | P1C (light mode), backlog |
| 11 | Dependency currency / sandbox hygiene | HANDOFF.txt; package.json (next CVE, recharts 2.x) | LOW→HIGH once build loop ships | Auto-codegen amplifies supply-chain risk | P1C (deps), P6C (CI scanning) |
| 12 | **Sim engine is hard-wired, deterministic, ego-scripted** | `scenarios.py` tick functions mutate state directly; no policy-in/observation-out seam | **CRITICAL** | Closed-loop evaluation requires a *policy interface* (obs → action → world step). Without the SimBackend/Policy seam, CARLA/AlpaSim integration and any E2E policy work is impossible. The single most important architectural change. | P1B |
| 13 | **No incident model** | Failures exist only as DTC strings + logs | **HIGH** | The challenge metric is *at-fault incidents over time*; regression gating, triage, and the diagnostics bridge all need incidents as first-class records | P3B |

**Strengths to preserve:** the `observers.py` event seam (becomes the incident emitter), offline/proxy duality in `lib/backend.ts`, damped 60fps rendering, WebGL fallback, and the 3D substrate — which doubles as the **replay theater for closed-loop incidents** (scrub the seconds before an at-fault collision in 3D, DTC/freeze-frame panel synced).

---

## 3. User Journey Redesign

### Persona A — UDS Diagnostic Engineer ("Dana")
**Job-to-be-done:** reproduce a field fault, run the correct UDS sequence, root-cause it, document it to standard.

**Today:** Dana manually picks a scenario, hand-types hex (`19 02 FF`), reads a raw response, interprets it herself, copies notes elsewhere. Every step manual; nothing explained or remembered.

**Future (Copilot-driven):**
1. Dana types *"Reproduce a forward-radar dropout and walk me through diagnosing it per ISO-14229."*
2. Copilot sets `sensor_fault` (`set_scenario` tool), watches the `observers` stream, narrates: *"B1001 + U0100 active; radar `target_present=false`. Standard sequence: extended session → read DTC by status → read freeze-frame."*
3. Copilot proposes each UDS command with a one-line rationale; Dana approves (or edits); Copilot executes via `send_uds` and **decodes the response** inline.
4. Copilot drafts a standards-formatted diagnostic report (citing exact ISO services used) and files it to history. Dana signs off.

**New journey — triaging a closed-loop incident:** Overnight, the Evaluator ran 400 seeded rollouts of a candidate policy; three produced at-fault incidents. Dana opens the **Eval workspace**: each incident is a card — *"Incident #112: front collision, `urban_cutin` seed 41, TTC trace attached, mapped DTC `P1C77` (policy late-brake), freeze-frame at T-2.0s."* She clicks Replay (3D scrubber), asks the Copilot *"why did braking start 600ms late?"*, and files a verdict: **policy fault** (steers Policy agent) vs **scenario fault** (unrealistic actor, steers Builder) vs **sim artifact**. Her verdict is steering memory.

**Friction removed:** hex memorization, response decoding, sequence recall, report writing. **Dana's role:** judgment and sign-off.

### Persona B — ADAS Engineer ("Arman")
**Job-to-be-done:** validate ADAS behavior against the latest scenarios/regulations and keep the sim suite current.

**Today:** Arman would have to read a UNECE update, decide it matters, and hand-code a new scenario tick function. Nobody does this continuously.

**Future (research + build loop):**
1. Each morning the **Insights Feed** shows ranked cards: *"UNECE R157 amendment raises ALKS max speed to 130 km/h — your `highway_acc` scenario caps at 120. Proposed: new `alks_high_speed` scenario + 2 regression checks. [Review proposal]."*
2. Arman opens the **Proposal Inbox**: diff of a new scenario spec, a new UDS DID if needed, generated tests, and a **closed-loop eval report** (the Evaluator already ran it: KPI table before/after, no new incidents, acceptance criteria pass).
3. Arman edits a threshold, adds *"use 5% radar noise above 110 km/h,"* clicks **Approve**. The agent applies the note, re-validates, merges via the normal PR flow.
4. Arman's comment becomes **durable steering memory**: future high-speed scenarios default to that noise model.

**New journey — standing challenge objective:** Arman creates a goal: *"AlpaSim E2E Challenge 2026 — submission-ready weekly."* The **Challenge dashboard** shows current local score (median km-to-at-fault-incident across the mirrored scenario distribution), gap analysis vs. last leaderboard snapshot, this week's policy/scenario deltas, and a one-click **"Approve submission"** gate.

### Persona C — AD/Policy Engineer ("Noor")
**Job-to-be-done:** improve the driving policy's closed-loop performance.

Noor doesn't write training boilerplate. She states constraints ("comfort penalty stays ≥0.5; never trade collision rate for progress"), reviews AlpaGym-style post-training runs the Policy agent launched in the sandbox GPU queue, compares reward curves and incident breakdowns per checkpoint, and promotes a checkpoint to "candidate" — which automatically triggers the full golden-bank closed-loop regression before it can reach the Challenge dashboard.

### Journey principles (all personas)
- **Director-not-operator:** every screen offers an agent action with a human gate, never a blank form.
- **Explain-by-default:** no raw hex/DTC/telemetry without an inline natural-language decode.
- **One inbox for decisions:** research, proposals, incidents, and sign-offs converge into a single prioritized queue.
- **Incidents are conversations:** every at-fault incident is replayable, explainable (Copilot), diagnosable (DTC/freeze-frame), and attributable (which change introduced it) — never a row in a CSV.

---

## 4. Agentic AI Strategy

### 4.1 Model-agnostic provider layer with role-based routing

The agent layer is abstracted behind an `LLMProvider` ABC (`chat()`, `stream()`, `embed()`) with implementations for Anthropic, OpenAI, and Google (Phase 4A). Default routing:

| Role | Default model tier | Why |
|------|--------------------|-----|
| Orchestrator, Planner, Analyst, Reviewer | Frontier (e.g., `claude-fable-5`) | Hardest planning/synthesis/judgment |
| Builder (code/content) | Frontier, fallback large (`claude-opus-4-8`) | Code quality; sandboxed |
| Evaluator (eval design + incident triage drafts) | Frontier | KPI design, causal analysis |
| Policy agent (training config, reward shaping within bounds) | Frontier plan / small monitoring loops | Long-running jobs need cheap heartbeat turns |
| Scout fan-out, Copilot quick turns | Small/fast (e.g., `claude-haiku-4-5`) | Cheap, frequent, narrow |

Routing lives in `backend/llm/router.py` and is configuration, not code. **Note:** the *driving policy itself is not an LLM* — it's a separately trained/evaluated model (rule-based FSM today → optionally Alpamayo-class VLA later). LLM agents orchestrate, configure, evaluate, and explain; they do not steer the car at 10Hz.

### 4.2 The agent roster

| Agent | Mission | Key tools | Outputs | Built in |
|-------|---------|-----------|---------|----------|
| **Orchestrator** | Daily OODA loop; delegation; governance gates; escalation | all (delegation) | Task graph, escalations | P4 (manual), P7 (autonomous) |
| **Scout** | Daily industry scan incl. challenge/leaderboard feeds | `web_search/fetch`, `kb_search` | Signal cards | P4B |
| **Analyst** | Score signal relevance to *our* product; map to concrete gaps | `kb_search`, codebase tools, `list_scenarios`, `list_uds_services` | Insight cards | P4B |
| **Planner** | Insights + engineer input → ranked, scoped backlog | `kb_search`, codebase tools, `backlog_write` | Proposals | P6C |
| **Builder** | Implement backlog items + tests in sandbox worktree | sandbox file tools, `run_tests`, `git_*` | Draft PR | P6C |
| **Experiment** | Run scenarios, tune params within engineer-set bounds | sim tools, `query_telemetry` | Sim report | P5 |
| **Evaluator** | Run closed-loop eval batteries (policy × scenario × seeds) on any SimBackend; compute KPIs; emit incidents; gate regressions | `run_eval`, `query_incidents`, `kb_search` | Eval report, incidents, pass/fail gate | P5A |
| **Policy** | Configure & launch closed-loop post-training (AlpaGym/Cosmos-RL recipes) in GPU sandbox; manage checkpoints | `launch_training`, `list_checkpoints`, `run_eval` | Checkpoint candidates + report | P6A |
| **Reviewer** | Standards/safety/quality check → approval packet (incl. eval report) | codebase tools, `run_tests`, `kb_search` | Approval packet, risk flags | P6C |
| **Copilot** | Practitioner diagnostics + incident triage explanations | sim/UDS tools, `query_incidents`, `replay_incident` | Live guidance, reports | P4 |
| **Challenge Ops** | Challenge monitoring, submission assembly, leaderboard tracking | `build_submission_packet`, `submit_challenge` (gated), `fetch_leaderboard` | Submission packets, leaderboard deltas | P6B |

### 4.3 Memory systems

Four stores, persisted in Postgres (extending `backend/db/`) with pgvector for semantic recall:

| Store | Implementation | Contents |
|-------|---------------|----------|
| **Episodic** | PostgreSQL tables | Every sim run, UDS session, fault injection, copilot transcript, agent action, `closed_loop_run`, `incident`, `training_run`, `checkpoint` |
| **Semantic / KB** | pgvector embeddings | Industry signals, standards index (ISO-14229 services/DIDs, UNECE clauses, NCAP protocols), scenario library, fault library, **challenge rules & scenario-distribution docs, AlpaSim/AlpaGym/Cosmos-RL docs, leaderboard snapshots** |
| **Procedural** | JSON playbooks in DB | Diagnostic playbooks ("for B1001 → these 4 UDS steps"), incident-triage playbooks ("late-brake collisions on cut-in → check TTC threshold vs perception latency first"), reward-shaping heuristics with observed effects, builder patterns |
| **Steering** | Per-engineer preference table | Every approve/reject/edit with reason, incident verdicts, direction notes, source ratings, challenge priorities — **the primary preference signal**, injected into Planner/Builder/Policy prompts |

"Continuous learning" is concrete: **no fine-tuning of the LLM agents required** — retrieval-augmented memory + evolving prompt/heuristic stores + simulation-in-the-loop parameter/policy optimization.

### 4.4 Planning loop (Orchestrator OODA)

```
OBSERVE  → research signals + engineer feedback + sim/telemetry events (observers.py)
           + eval results & incidents
ORIENT   → retrieve memory (semantic + steering); assess gaps vs product
           AND closed-loop KPI deltas vs golden bank
DECIDE   → Planner produces ranked backlog; Orchestrator picks next safe unit of work
ACT      → Builder → Experiment → EVALUATOR (closed-loop battery) → Reviewer
GATE     → hard automated pre-gate: no proposal reaches a human if it regresses
           golden-bank closed-loop KPIs beyond engineer-set tolerance
           THEN human approval (REQUIRED before merge)
LEARN    → outcomes, engineer reasons, verdicts, reward/parameter effects → memory;
           update source weights, playbooks, params
```

### 4.5 Feedback & continuous-learning loops

| Signal | Source | Updates |
|--------|--------|---------|
| Proposal approved/rejected/edited (+reason) | Engineer | Planner priorities; steering memory; Scout source weights |
| Incident verdict (policy/scenario/artifact + reason) | Engineer | Triage playbooks; Policy-vs-Builder routing; sim-fidelity backlog |
| Closed-loop KPI delta per change | Evaluator | Regression gates; Planner priorities; Builder prompts |
| Sim acceptance pass/fail | Experiment | Builder prompts; scenario param tuning |
| Checkpoint promotion / rejection | Policy engineer | Reward-shaping heuristics; training-recipe defaults |
| Diagnostic outcome correct/incorrect | Copilot sign-off | Procedural playbooks |
| Insight rated useful/noise | Engineer thumbs | Scout source ranking; Analyst relevance model |
| Leaderboard delta after submission | Challenge Ops | Goal progress; scenario-distribution weighting (close the gap where we lose km) |

---

## 5. Autonomous Workflow Architecture

### 5.1 Tool contracts

Existing endpoints become tools verbatim; new surfaces added per phase:

```jsonc
// READ (Phase 0 endpoints, wrapped in P4B registry)
get_sim_state()                    -> GET  /api/sim/state
list_injectable_faults()           -> GET  /api/sim/inject-fault
query_history(kind, limit, query?) -> GET  /api/history/{kind}   // + semantic query (P4C)
get_system_status()                -> GET  /api/system/status
// ACT — sim/diagnostics (auto-allowed in Copilot, fully audited)
set_scenario(scenario, backend?)   -> POST /api/sim/scenario
send_uds(command_hex)              -> POST /api/sim/uds          // real ISO-TP from P3
inject_fault(code?)                -> POST /api/sim/inject-fault
clear_dtcs()                       -> POST /api/sim/clear-dtcs
// RESEARCH / MEMORY (P4)
kb_search(query, k) / kb_ingest(doc)
web_search(query) / web_fetch(url)           // allowlisted sources
// BUILD (P6C; gated)
backlog_write(item)
run_tests(scope)                             // pytest in sandbox worktree
git_worktree_pr(branch, diff)                // draft PR only; merge is human-gated
// CLOSED-LOOP VALIDATION ENGINE (P5)
list_sim_backends()                          -> internal | carla | alpasim
run_eval(policy_id, suite_id, backend, seeds, budget) -> POST /api/eval/run  // async
get_eval_report(run_id)                      -> GET  /api/eval/{id}
query_incidents(filter)                      -> GET  /api/eval/incidents
replay_incident(incident_id)                 -> trajectory + sensor + decision trace
// POLICY TRACK (P6A; sandboxed GPU queue)
launch_training(recipe_id, bounds)           -> POST /api/policy/train
list_checkpoints(run_id) / promote(ckpt)     // promotion human-gated
// CHALLENGE OPS (P6B; all writes human-gated)
build_submission_packet(goal_id)
submit_challenge(packet_id)                  // GATED: pushes to HF challenge space
fetch_leaderboard(goal_id)
```

**Governance invariants:** merge, checkpoint `promote`, `submit_challenge`, and any reward-function change are human-gated. `run_eval` and `launch_training` are budget-capped (GPU-hours/day) and fully audited. Sim/diagnostic ACT tools are auto-allowed in the Copilot but logged to `uds_audit`/`log_record`/`agent_action`.

### 5.2 Workflow 1 — Daily Industry Scan (scheduled, autonomous)
```
06:00 cron → Orchestrator
  Scout: web_search/fetch allowlisted sources → dedupe vs KB
         (ISO/SAE, UNECE, Euro NCAP, NHTSA, arXiv cs.RO/cs.CV, OEM ADAS newsrooms,
          CARLA & ROS2 releases, AlpaSim challenge space + leaderboard,
          Physical AI OOD challenge, NVIDIA Alpamayo/AlpaGym release notes & recipes)
  Analyst: score relevance to our scenario/UDS/fault libraries → Insight cards
  Write Insights Feed; push top-N to engineers
```
Source allowlist + per-source weights live in `app_config`; engineers tune via thumbs.

### 5.3 Workflow 2 — Research → Proposal → Build → Closed-Loop Validate → Approve → Merge
```
Planner   : top insight (or engineer request) → scoped backlog item
Builder   : in git worktree, write scenario spec / UDS handler / fault entry + tests
Experiment: run + tune within bounds
Evaluator : NON-SKIPPABLE — run affected slice of golden bank closed-loop
            (policy-in-the-loop where applicable, N seeds, fixed budget)
Reviewer  : tests, lint, standards-citation check, safety check → Approval Packet
            (diff + tests + sim report + closed-loop KPI table before/after
             + any new incidents with replays)
GATE      : Proposal Inbox → Approve / Edit+note / Reject (+reason)  [REQUIRED]
Merge     : on approve → PR merge; on edit → apply note, re-run from Experiment
Learn     : outcome + reason → steering memory
```

### 5.4 Workflow 3 — Continuous Simulation Learning (closed loop)
The Experiment agent treats scenario and (bounded) policy parameters as an optimization problem expressed in challenge-aligned terms: maximize km-between-at-fault-incidents subject to comfort/progress constraints. Every accepted scenario contributes seeds to the golden regression bank. Any change that breaks an accepted scenario is auto-reverted and flagged.

### 5.5 Workflow 4 — Engineer-in-the-loop Diagnostic Copilot (reactive, real-time)
Streaming chat in the 3D workspace; Copilot observes the `observers.py` event bus, proposes the next UDS step with rationale, executes on approval, decodes responses, drafts the standards report. **Incident-triage mode:** opens any incident, narrates the causal chain from telemetry/decision trace, proposes a verdict, drafts the SOTIF-style triage note for engineer signature. Every action audited.

### 5.6 Workflow 5 — Closed-Loop Policy Improvement (sandboxed)
```
Goal (e.g., "improve urban cut-in handling")
  Policy agent: select recipe (AlpaGym-style closed-loop post-training; GRPO),
                set reward terms WITHIN engineer-locked bounds
                (defaults: progress +1.0, collision −10.0, offroad −5.0, comfort −0.5)
  launch_training → GPU sandbox (local 2080 Ti or cloud batch; no prod secrets)
  per-checkpoint: Evaluator runs held-out closed-loop battery
  best checkpoint → candidate → FULL golden-bank regression → human promotion gate
```

### 5.7 Workflow 6 — Challenge Ops (the "seamless after production" loop)
```
Standing goal: "AlpaSim E2E Closed-Loop Challenge 2026 — weekly submission-ready"
  Scout       : monitor challenge rules/timeline/leaderboard; diff vs KB
  Analyst     : map rule/scenario-distribution changes to our suite gaps
  Builder     : mirror missing scenario types into our suite (sandbox)
  Policy      : targeted post-training on weakest scenario classes
  Evaluator   : weekly full battery on the AlpaSim backend, challenge metric exactly
                (time/km driven without at-fault incidents)
  Challenge Ops: build_submission_packet → GATE (engineer approve) → submit → fetch_leaderboard
  Learn       : leaderboard delta + per-scenario losses → next week's priorities
```
The identical machinery serves **internal release gates** (an OTA-style candidate must clear the bank) and **future challenges/regulatory test catalogs**: new benchmark = new goal object + source allowlist entry, zero re-architecture.

### 5.8 SimBackend abstraction (the keystone)
```
backend/simbackends/
  base.py        # SimBackend ABC: reset(scenario, seed) / step(action) -> obs, state, events
                 # PolicyAdapter ABC: obs -> action  (fsm today; onnx / remote-VLA later)
  internal.py    # wraps existing scenarios.py engine (CPU; fast; deterministic) — P1B
  carla.py       # carla.Client step-based interface (local GPU; mid-fidelity)    — P5B
  alpasim.py     # gRPC/HTTP client to dockerized AlpaSim microservices
                 # (cloud/GPU; NuRec rendering, traffic, sensor sims)             — P5B
```
**Two-lane strategy:** internal engine is the fast lane (thousands of CPU rollouts for UDS/FSM logic); CARLA is the mid-fidelity local lane; AlpaSim is the high-fidelity lane (sensor-realistic closed loop, challenge-identical scoring). The Evaluator chooses lanes by purpose and budget.

### 5.9 Incident → DTC diagnostics bridge (the moat)
Every at-fault event from any backend is normalized into an `incident` record and **simultaneously expressed through the existing UDS layer**: a synthetic DTC from the reserved `P1C00–P1CFF` (policy/validation) range is raised with a freeze-frame (scenario id, seed, TTC trace tail, ego state, policy decision id), readable via standard `19 02 / 19 04` services in the UDS console. Diagnostics engineers triage AV validation failures with the exact tooling and mental model they use for field DTCs — no other platform does this.

### 5.10 UI: five workspaces
```
┌─ ADAS · workspace switcher: [Diagnose] [Build] [Research] [Eval] [Govern] ────────┐
│ DIAGNOSE: 3D scene + Copilot chat (stream) + auto-decoded UDS console              │
│ BUILD:    Proposal Inbox — diff viewer, eval report, Approve/Edit+note/Reject      │
│ RESEARCH: Insights Feed — ranked cards, thumbs up/down, [Review proposal]          │
│ EVAL:     Challenge dashboard (local score vs leaderboard, gap analysis)           │
│           Incident inbox + 3D replay scrubber (synced DTC/freeze-frame panel)      │
│           Checkpoint comparison (reward curves, incident breakdown per class)      │
│ GOVERN:   Autonomy dial, kill-switches, GPU/token/$ telemetry, audit log,          │
│           per-engineer approval attribution, one-click rollback                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Competitive Benchmark

| Product | Strength | Why ADAS wins |
|---------|----------|---------------|
| Cursor / Devin / Replit Agent | General autonomous coding | No UDS/ADAS semantics, no sim substrate, no closed-loop validation loop |
| dSPACE / Vector CANoe / NI | ECU/HIL tooling, OEM-trusted | Validates ECUs, not learned behavior; static; no research/build autonomy |
| **Foretellix / Applied Intuition** | Scenario coverage & sim tooling (closest commercial neighbors) | No agentic research-and-build loop; no diagnostics-native (DTC/UDS) incident model; no self-developing scenario suite |
| CARLA / openpilot | Open simulation / production L2 stack | No diagnostics layer, no agentic R&D, no governance |
| **NVIDIA Alpamayo / AlpaSim / AlpaGym** | State-of-the-art closed-loop sim + RL post-training | **Complementary, not competitive:** ADAS consumes AlpaSim as a backend and adds the agentic loop, diagnostics bridge, governance, and OEM workflow on top |
| Khanmigo / Duolingo Max | Adaptive AI guidance | Consumer learning, not engineering autonomy |

**Defensible position:** the only platform combining (a) domain-native UDS/ADAS semantics with a **DTC-grade incident model**, (b) an embodied sim substrate **with pluggable high-fidelity closed-loop backends**, and (c) a governed, self-developing research-build-**validate** loop steered by working engineers. The moat compounds via steering memory + standards index + golden scenario bank + challenge telemetry.

---

## 7. Final Product Vision

**ADAS becomes the automotive-software platform that advances itself — and proves it in closed loop.** Every morning it has read the industry (including the benchmarks and rule changes that will judge it), mapped changes to its own gaps, built candidate improvements, and — before any human sees them — driven them for thousands of simulated kilometers, expressing every failure as a replayable, DTC-coded incident an engineer can triage in minutes. Engineers direct: they set standing goals like *"stay submission-ready for AlpaSim 2026"* or *"every release candidate clears the golden bank,"* approve at the gates, and watch their judgment become durable memory. The open-loop/closed-loop gap that haunts every OEM validation organization — the gap that decides whether a DreamDrive-class feature ships — stops being a quarterly fire drill and becomes a continuously-running, fully-audited, self-improving workflow with humans firmly in command.

---

# PART II — IMPLEMENTATION

## Target Architecture

```
Windows host (native)                           WSL2: Ubuntu 22.04 (vhdx on D:)
┌────────────────────────────┐                 ┌──────────────────────────────────────────┐
│ CARLA 0.9.15 (D:\adas)      │  TCP 2000       │ ROS2 Humble + carla-ros-bridge             │
│ RTX 2080 Ti, sync mode      │◄──────────────► │  perception(C++) planning(py) ctrl(C++)    │
└────────────────────────────┘  (mirrored net)  │  ecu_bridge → UDS over ISO-TP              │
                                                └──────────────────────────────────────────┘
┌────────────────────────────┐                      │
│ Next.js Dashboard v2        │  SSE + REST         │ ROS2 topic bridge
│ (glassmorphism, dark mode,  │◄──────────────► ┌───┴──────────────┐   ┌────────────────┐
│  3D replay, workspace UI,   │                 │ FastAPI + agents  │◄─►│ PostgreSQL (D:) │
│  agent chat, eval dashbrd)  │                 │ + LLM provider    │   │ + pgvector KB   │
└────────────────────────────┘                  │ abstraction layer │   │ DTC/log/audit/  │
                                                └───────────────────┘   │ incidents/runs/ │
                                                        │               │ memory/steering │
                                                ┌───────┴───────┐       └────────────────┘
                                                │  SimBackend    │
                                                │  abstraction   │
                                                ├────────────────┤
                                                │ internal.py    │ ← CPU, fast, deterministic
                                                │ carla.py       │ ← mid-fidelity, local GPU
                                                │ alpasim.py     │ ← high-fidelity, cloud GPU
                                                └────────────────┘
```

## Phase Summary

| Phase | Name | Duration | Key Deliverable |
|-------|------|----------|-----------------|
| **0** | Foundation | ✅ Complete | FastAPI + Next.js + PostgreSQL + UDS sim |
| **1** | CARLA/ROS2 Bridge + SimBackend Seam + Frontend v2 | 1A ✅ 1B ✅ / 1C pending | Live CARLA sensor data in ROS2 topics ✅; SimBackend abstraction ✅; redesigned dashboard (1C) pending |
| **2** | ADAS Perception → Planning → Control | ✅ Built & running (2026-06-12) | Real ADAS stack processing CARLA sensor data in ROS2 — see Status Log below; AEB-with-traffic gate demo pending |
| **3** | Virtual ECU + Real UDS + Incident Model | ~4 weeks | ISO 14229 over ISO-TP; structured incident records; P1Cxx DTCs |
| **4** | Agentic AI Infrastructure | ~6 weeks | Agent framework, Copilot, Scout/Analyst, memory system, model-agnostic LLM layer |
| **5** | Closed-Loop Validation Engine | ~6 weeks | Evaluator agent; CARLA + AlpaSim SimBackends; golden-bank regression gates; Eval workspace |
| **6** | Policy Track + Challenge Ops + Build Loop | ~6 weeks | AlpaGym-style RL; checkpoint lifecycle; challenge submission pipeline; Builder/Reviewer/Planner |
| **7** | Level-5 Self-Developing Platform | ~4 weeks | Orchestrator OODA; goal objects; governance dashboard; full autonomy dial |

**Total estimated: ~38 weeks (~9 months)**

---

## Status Log & Runbook (single source of truth — supersedes the old HANDOFF.txt)

> Last updated: **2026-06-12** (Phase 2 bring-up session)

### Where the project stands

| Layer | Status |
|-------|--------|
| Phase 0 backend + dashboard + Postgres + tests/CI | ✅ Complete (26 tests pass) |
| 1A carla-ros-bridge (colcon, WSL2) | ✅ Built — full ws 23/23 packages |
| 1B SimBackend abstraction + golden-snapshot tests | ✅ Complete |
| 1C Frontend v2 design system | 🔲 Pending |
| 2A `adas_perception` (C++/PCL clustering → `/adas/obstacles`, `/adas/nearest_obstacle`) | ✅ Built & running — real LiDAR clusters at ~6 Hz |
| 2B `adas_planning` (`planning_node` + `fsm` + `thresholds`, Phase 0 values 1:1) | ✅ Built & running — `/adas/state` at 20 Hz; 7/7 unit tests |
| 2C `adas_control` (Pure Pursuit + PID → `CarlaEgoVehicleControl`) | ✅ Built & running — commands at 20 Hz |
| **Phase 2 gate** (ego drives, AEB fires on lead vehicle, rviz markers) | 🟡 Data path verified end-to-end; the visual AEB-with-traffic demo is the remaining step |
| 3A ecu_bridge / 3B incidents API | 🟡 Skeleton + `/api/incidents` files exist; UDS-over-ISO-TP not started |

Verified live on 2026-06-12 (FastDDS): `/carla/status` 10 Hz · `/carla/ego_vehicle/odometry` 11 Hz · LiDAR 10 Hz · `/adas/state` + `/adas/acc_setpoint_mps` 20 Hz · `/carla/ego_vehicle/vehicle_control_cmd` 20 Hz.

### How to run (one machine: CARLA on Windows, ROS2 in WSL2)

```bash
# One-time build (artifacts on ext4 — NEVER build under /mnt/c, see quirks):
bash /mnt/c/Users/Asus/Documents/GitHub/ADAS/scripts/build_ws.sh

# Full pipeline (kills stale nodes, starts bridge + ADAS stack detached,
# writes bringup_log.txt / stack_log.txt / diag_output.txt to the repo root):
#   Windows:  run_all.bat          (CARLA must already be running)
#   Windows:  restart_all.bat     (also force-restarts CARLA from D:\adas)
# Chase-cam + live ego speed readout:  follow_ego.bat

# Manual, per terminal:
source /mnt/c/Users/Asus/Documents/GitHub/ADAS/scripts/wsl_env.sh
ros2 launch /mnt/c/Users/Asus/Documents/GitHub/ADAS/ros2_ws/launch/adas_bringup.launch.py   # bridge + ego + sensors
ros2 launch /mnt/c/Users/Asus/Documents/GitHub/ADAS/ros2_ws/launch/adas_stack.launch.py     # perception + planning + control
ros2 topic echo /adas/state        # aebStatus: standby → warning → active on approach
```

Diagnostics: `run_probe3.bat` (topic-rate health check → `probe_output.txt`), `scripts/diag.sh` (full snapshot → `diag_output.txt`), `phase2_gate.bat` (automated AEB gate test → `phase2_gate_report.txt`).

Camera: `run_all.sh` auto-starts a chase-cam daemon (`scripts/follow_ego.py`) — the CARLA window follows the ego after every start/restart, re-attaching across respawns. Stop it to free-fly: `pkill -f follow_ego` (or run `follow_ego.bat` manually for a speed readout).

### Environment quirks (hard-won — read before debugging)

1. **Never colcon-build under `/mnt/c`** — NTFS ACLs make CMake `configure_file` fail with "Operation not permitted". Build/install live on ext4: `/home/osos/adas_build`, `/home/osos/adas_install` (what `scripts/build_ws.sh` does).
2. **DDS = FastDDS + `ROS_LOCALHOST_ONLY=1`** (set by `scripts/wsl_env.sh`). CycloneDDS-on-loopback was tried and abandoned: WSL2's `lo` has no multicast, and unicast peer discovery degraded as participants accumulated.
3. **`ros2 daemon` hangs on this WSL2** (XMLRPC ~2 min timeout). Always use `ros2 node list --no-daemon` / `ros2 topic list --no-daemon`.
4. **carla-ros-bridge publishes NOTHING per-vehicle by default** — odometry/tf/speedometer come from **pseudo-sensors** that must be declared in `ros2_ws/config/adas_objects.json` (`sensor.pseudo.odom`, `sensor.pseudo.tf`, `sensor.pseudo.speedometer`). Their absence silently breaks the control loop (control holds 0.3 brake without odometry).
5. **CARLA can freeze in synchronous mode** if a bridge is killed uncleanly — the window stops responding to close clicks; `restart_all.bat` force-kills and reboots it.
6. `ros2 topic echo` may print nothing when its stdout is redirected to a file; `ros2 topic hz` is the reliable scripted probe.
7. AEB scenario note (from Phase 0): tests assert on the deterministic sensor-fault DTC (B1001); the AEB P1001 timing window is revisited now that the real FSM exists.
8. Planning's lane-offset is an event-based estimate from `lane_invasion` (decaying latch); waypoint-based continuous offset is a Phase 2 follow-up.

### Next steps

1. **Finish the Phase 2 gate demo**: double-click `phase2_gate.bat`. The test is self-contained: it teleports the ego to a verified-straight stretch, waits for cruise (≥12 m/s), spawns a stationary lead 32 m ahead (TTC ≈ 2.3 s — close enough that ACC cannot defuse it), and requires warning → active → hard braking → no collision. First run (2026-06-12 06:22) FAILED: ego had crashed into a lamppost pre-test — root cause was steer=0 with no waypoint path. Fixes: `carla_waypoint_publisher` now launches with the stack (`with_waypoints:=true`, lane-following once a goal is on `/carla/ego_vehicle/goal` — the gate publishes one), and the gate's teleport+straight-stretch design removes the dependency on steering.
2. Phase 1C frontend redesign (independent track).
3. Phase 3: real ISO 14229 over ISO-TP in `adas_ecu_bridge` (reuse `backend/uds/` wholesale), incidents model end-to-end, tester scripts in `scripts/`.

---

## Phase 0 — Foundation ✅ (Complete)

> **Status:** Done. All items verified on this machine.

### What exists today

| Module | Status | Key files |
|--------|--------|-----------|
| Backend simulation engine | ✅ | `backend/simulation/state.py`, `scenarios.py`, `engine.py` |
| UDS processor | ✅ | `backend/uds/services.py`, `processor.py`, `constants.py` |
| API layer | ✅ | `backend/api/routes.py`, `history.py`, `system.py` |
| Database | ✅ | `backend/db/models.py`, `repository.py`, `engine.py` |
| Event bridge | ✅ | `backend/observers.py` |
| Frontend dashboard | ✅ | `frontend/app/page.tsx`, 9 domain components, 17 3D scene files, 23 UI primitives |
| Docker | ✅ | `docker-compose.yml` |
| Tests + CI | ✅ | 5 test files, 26 tests, `.github/workflows/ci.yml` |
| CAN interface | 🔲 Placeholder | `backend/can/interface.py` |
| ROS2 bridge | 🔲 Placeholder | `backend/ros2/bridge.py` |

### Environment status

| Component | Status |
|-----------|--------|
| WSL2 Ubuntu 22.04 | ✅ Running |
| ROS2 Humble | ✅ Installed |
| CARLA 0.9.15 (Windows) | ✅ Extracted |
| WSL → CARLA smoke test | ✅ Passing |
| Docker Compose | ✅ Verified |
| PostgreSQL | ✅ Working |
| carla-ros-bridge (colcon) | ✅ Built (2026-06-12, all pkgs rc=0) |

---

## Phase 1 — CARLA/ROS2 Bridge + SimBackend Seam + Frontend v2

> **Goal:** Complete the CARLA-ROS2 pipeline, lay the SimBackend abstraction (the keystone — audit finding #12), and redesign the frontend with a premium design system.
> **Strategy link:** Part I §5.8 (SimBackend), §2 findings #3/#4/#7/#8/#11.

### 1A — carla-ros-bridge + ego vehicle + sensors (~2 weeks)

| Task | Details |
|------|---------|
| Clone + build carla-ros-bridge | `ros2_ws/src/ros-bridge` at 0.9.15-compatible ref; `colcon build` |
| Spawn ego + sensors | RGB camera, LiDAR, IMU, collision sensor via ros-bridge launch file |
| CARLA synchronous mode | Fixed-timestep mode for reproducible ADAS tests |
| Verify topics | `/carla/ego_vehicle/*` streaming; `rviz2` renders sensors |

#### Gate
```bash
$ ros2 topic list | grep /carla             # /carla/ego_vehicle/* present
$ ros2 topic echo /carla/ego_vehicle/lidar  # streams while CARLA renders on Windows
$ rviz2                                     # visualize LiDAR + camera
```

### 1B — SimBackend abstraction (the keystone) (~2 weeks)

> **IMPORTANT:** The single most important architectural change. It decouples the simulation engine from the rest of the stack, enabling CARLA and AlpaSim backends later without touching any other code — and creates the policy-in/observation-out seam that all closed-loop work depends on.

#### New files
```
backend/simbackends/
├── __init__.py
├── base.py          # SimBackend ABC: reset(scenario, seed) / step(action) → obs, state, events
│                    # PolicyAdapter ABC: obs → action  (FSM today; ONNX/VLA later)
├── internal.py      # Wraps existing scenarios.py engine — ZERO behavior change
└── carla.py         # Stub (feature-flagged, filled in Phase 5B)
```

#### Modifications
| File | Change |
|------|--------|
| `backend/simulation/engine.py` | Refactor `tick_simulation()` to call through `SimBackend.step()` |
| `backend/api/routes.py` | `POST /scenario` selects backend; default = `internal` |
| `backend/observers.py` | Events now come from `SimBackend.step()` return value |

#### Gate
- **Golden snapshot test**: `internal.py` produces byte-identical output to the legacy engine for all 5 scenarios across 100 ticks each.
- New test: `test_simbackend.py` — exercises the `SimBackend` interface directly.

### 1C — Frontend v2 Design System + Redesign (~2 weeks)

> Complete visual overhaul. Functionality stays the same; the look becomes premium. Also fixes audit findings #3 (surface swallowed errors as a status banner), #7 (text + ARIA alongside color), #8 (first-run orientation), #11 (Next.js CVE + recharts upgrade).

#### Design system
```
frontend/
├── app/
│   ├── globals.css              # [REWRITE] CSS custom properties design system
│   └── layout.tsx               # [MODIFY] Google Fonts (Inter/Outfit), meta tags
├── styles/
│   └── design-tokens.css        # [NEW] Palette, spacing, typography, shadows, glass effects
```

#### Design principles
- **Dark mode first** with optional light mode
- **Glassmorphism**: frosted glass cards with `backdrop-filter: blur()`
- **Curated palette**: HSL-based dark grays + accent gradients
- **Typography**: Inter (UI) + JetBrains Mono (code/hex/UDS console)
- **Micro-animations**: smooth transitions, hover effects, loading skeletons
- **Workspace tabs**: `[Diagnose] [Build] [Research] [Eval] [Govern]` — only Diagnose active initially (shell for audit finding #9)

#### Component redesign priority
1. Layout shell (sidebar/workspace switcher + header)
2. Vehicle telemetry cards (glassmorphism)
3. 3D scene view (keep R3F, restyle container)
4. UDS console (terminal-style redesign)
5. DTC manager (card-based with severity indicators)
6. Speed chart (restyle with design tokens)
7. Control Center / system status (incl. connection/error status banner)
8. System log (monospace, filterable)

#### Gate
- Side-by-side screenshots: old vs new
- All existing functionality works identically
- Lighthouse accessibility score ≥ 90

---

## Phase 2 — ADAS Perception → Planning → Control

> **Goal:** Build the real ROS2 ADAS stack that processes CARLA sensor data.

### 2A — Perception node (C++ / rclcpp) (~2 weeks)

| Deliverable | Details |
|-------------|---------|
| LiDAR clustering | Euclidean/DBSCAN clustering on `/carla/ego_vehicle/lidar` |
| Obstacle detection | Nearest in-lane object → publish `/obstacles` (range + relative speed) |
| TF integration | Sensor → world coordinate transforms |

```
ros2_ws/src/adas_perception/
├── CMakeLists.txt
├── package.xml
├── src/
│   ├── perception_node.cpp      # Subscribe LiDAR, cluster, publish /obstacles
│   └── clustering.cpp           # DBSCAN/Euclidean clustering
├── include/adas_perception/
│   ├── perception_node.hpp
│   └── clustering.hpp
└── launch/perception.launch.py
```

### 2B — Planning FSM (Python / rclpy) (~2 weeks)

| Deliverable | Details |
|-------------|---------|
| AEB logic | TTC → warning at `1.5 < TTC < 3.0`, active at `TTC ≤ 1.5` (full brake, `accel = -8.5`) |
| LDW logic | Warning when `lane_offset > 0.5` |
| ACC logic | Following-distance based speed control |
| State publisher | `/adas/state` topic with current ADAS state |

> **IMPORTANT:** Reuse the exact thresholds from `backend/simulation/scenarios.py`. These are the spec, not arbitrary values. (Also fix the AEB DTC timing window — see Known Issues.)

```
ros2_ws/src/adas_planning/
├── setup.py
├── package.xml
├── adas_planning/
│   ├── planning_node.py         # Subscribe /obstacles, publish /adas/state
│   ├── fsm.py                   # AEB/LDW/ACC state machine
│   └── thresholds.py            # Imported from backend/simulation/scenarios.py constants
└── launch/planning.launch.py
```

### 2C — Control node (C++ / rclcpp) (~2 weeks)

| Deliverable | Details |
|-------------|---------|
| Pure Pursuit | Steering geometry for path following |
| PID controller | Throttle/brake from speed error |
| CARLA actuator | Send vehicle commands back to CARLA |

```
ros2_ws/src/adas_control/
├── CMakeLists.txt
├── package.xml
├── src/
│   ├── control_node.cpp         # Subscribe /adas/state, compute+send CARLA commands
│   ├── pure_pursuit.cpp
│   └── pid.cpp
├── include/adas_control/
└── launch/control.launch.py
```

#### Phase 2 Gate
```bash
# Drive an AEB approach in CARLA:
$ ros2 topic echo /adas/state          # flips to AEB active
$ ros2 topic echo /obstacles           # shows lead vehicle with range + speed
# rviz2 markers sit on the lead vehicle
# The ego brakes; numbers track the Phase 0 thresholds
```

---

## Phase 3 — Virtual ECU + Real UDS over ISO-TP + Incident Model

> **Goal:** Wire the ROS2 ADAS stack to real UDS diagnostics, and introduce the structured incident model (audit finding #13; strategy §5.9 — the diagnostics bridge).

### 3A — ecu_bridge (rclpy node) (~2 weeks)

| Deliverable | Details |
|-------------|---------|
| ROS2 subscriber | Subscribe `/adas/state`, maintain DID registry + DTC store |
| UDS server | Real ISO 14229 over ISO-TP using `udsoncan` + `python-can` virtual bus |
| Reuse uds/ | **Wholesale reuse** of `backend/uds/` — services, constants, processor, SecurityAccess key |

#### Modifications
| File | Change |
|------|--------|
| `backend/can/` | **Rename to `backend/canbus/`** (shadows PyPI `python-can`) |
| `backend/ros2/bridge.py` | Implement real ROS2 bridge — subscribe topics, feed to FastAPI |

```
ros2_ws/src/adas_ecu_bridge/
├── setup.py
├── package.xml
├── adas_ecu_bridge/
│   ├── ecu_node.py              # rclpy node: /adas/state → DID/DTC store → UDS server
│   ├── uds_server.py            # udsoncan server over ISO-TP (python-can virtual bus)
│   └── transport.py             # python-can virtual + pure-Python isotp (no kernel vcan needed)
└── launch/ecu_bridge.launch.py
```

### 3B — Structured incident model (~1 week)

> **IMPORTANT:** The bridge between simulation failures and OEM-style diagnostics. Every at-fault event becomes a DTC + freeze-frame, making AV validation failures triageable with existing diagnostic tooling. This is the platform's moat (strategy §5.9).

| File | Change |
|------|--------|
| `backend/db/models.py` | Add `incident` table: type, at_fault, scenario, seed, timestamp, ttc_trace, freeze_frame (JSON), policy_decision_id, DTC code |
| `backend/db/repository.py` | Add `record_incident()`, `list_incidents()`, `get_incident()` |
| `backend/observers.py` | Emit incident events from SimBackend collision/road-excursion events |
| `backend/uds/constants.py` | Reserve DTC range `P1C00–P1CFF` for validation incidents |
| `backend/api/incidents.py` | **[NEW]** `/api/incidents` — CRUD for incident records |

### 3C — Diagnostic tester scripts (~1 week)

```
scripts/
├── read_adas_status.py          # udsoncan client: read DIDs
├── inject_fault.py              # udsoncan client: inject scenario fault
├── write_adas_param.py          # udsoncan client: SecurityAccess (0x27) + WriteDataByIdentifier
└── clear_dtcs.py                # udsoncan client: ClearDiagnosticInformation
```

#### Phase 3 Gate
```bash
# Bus trace: 10 03 → 27 01/02 → 2E … → 22 … → 19 02 FF
# Dashboard shows DTCs from CARLA-driven scenario (not mock), persisted to Postgres
# An injected collision → structured incident row + P1Cxx DTC with freeze-frame via 19 04
$ python scripts/read_adas_status.py     # reads live DIDs
$ python scripts/clear_dtcs.py           # clears and verifies
```

---

## Phase 4 — Agentic AI Infrastructure

> **Goal:** Build the model-agnostic agent framework, Diagnostic Copilot, research agents (Scout/Analyst), memory system, and engineer identity.
> **Strategy link:** Part I §4 (agent strategy), §5.2 (daily scan), §5.5 (Copilot workflow), audit findings #1/#2/#5/#6.

### 4A — Model-agnostic LLM provider layer (~1 week)

```
backend/llm/
├── __init__.py
├── base.py              # LLMProvider ABC: chat(), stream(), embed()
├── anthropic.py         # Claude implementation (default)
├── openai.py            # GPT implementation
├── google.py            # Gemini implementation
├── router.py            # Role-based model routing (see Part I §4.1 table)
└── config.py            # Provider selection, API key management (env only, validated at startup), rate limits
```

### 4B — Agent framework + tool registry (~2 weeks)

```
backend/agents/
├── __init__.py
├── base.py              # BaseAgent ABC: think(), act(), observe(), tool use
├── registry.py          # Tool registry: sim, UDS, KB, codebase, eval tools
├── orchestrator.py      # OODA loop coordinator (Phase 7 full autonomy, Phase 4 manual)
├── copilot.py           # Diagnostic Copilot — natural language over sim/UDS/incident tools
├── scout.py             # Industry scanner — web search, challenge feeds, arXiv (allowlisted)
├── analyst.py           # Signal → insight → product gap mapper
└── tools/
    ├── sim_tools.py     # set_scenario, get_state, inject_fault, …
    ├── uds_tools.py     # send_uds, read_did, clear_dtcs, …
    ├── kb_tools.py      # kb_search, kb_ingest (pgvector)
    ├── codebase_tools.py# read_file, grep, list_dir (sandboxed)
    └── eval_tools.py    # run_eval, query_incidents, replay_incident (wired in Phase 5)
```

### 4C — Memory system + Knowledge Base + engineer identity (~2 weeks)

| Store | Implementation | Contents |
|-------|---------------|----------|
| Episodic | PostgreSQL tables | Agent actions, decisions, outcomes, `closed_loop_run`, `incident`, `training_run` |
| Semantic / KB | pgvector embeddings | Standards docs, **challenge rules**, AlpaSim/AlpaGym docs, papers, leaderboard snapshots |
| Procedural | JSON playbooks in DB | Incident-triage playbooks, reward-shaping heuristics, builder patterns |
| Steering | Per-engineer preference table | Incident verdicts, direction notes, source ratings, challenge priorities |

```
backend/db/models.py additions:
  - engineer            (identity — lightweight name/role selector, no heavy auth yet)
  - agent_action        (agent, tool, args, result, timestamp)
  - kb_document         (title, source, content, embedding vector, metadata)
  - insight_card        (signal, relevance, proposed change, thumbs)
  - engineer_feedback   (engineer_id, target_type, target_id, verdict, note)
  - steering_preference (engineer_id, key, value, context)
```

The agent layer subscribes to `observers.py` so episodic memory captures every run/UDS/DTC/incident automatically. KB is pre-loaded with the standards index **and** the AlpaSim challenge ruleset. Scheduled daily Scout run (cron) writes `insight_card`s.

### 4D — Copilot UI + streaming transport + Research workspace (~1 week)

| Change | Details |
|--------|---------|
| Backend SSE endpoint | `/api/agent/chat` — Server-Sent Events for streaming agent responses |
| Frontend CopilotPanel | Chat interface in `[Diagnose]` workspace; tool-use visualization |
| Replace polling | Upgrade 500ms `setInterval` to SSE for live state updates (audit #5) |
| `[Research]` workspace | Insights Feed with thumbs up/down (writes `engineer_feedback`) |

#### Phase 4 Gate
- Copilot answers *"What DTCs are active?"* → calls `read_dtcs` → streams answer
- Copilot runs *"Run the AEB scenario and show me what happens"* → orchestrates sim + explains
- Scout runs manually and returns insight cards from web sources; Insights Feed renders with working thumbs
- KB search returns relevant results for "AEB threshold" or "AlpaSim rules"
- All agent actions logged in `agent_action` with full audit trail

---

## Phase 5 — Closed-Loop Validation Engine (CLVE)

> **Goal:** Build the evaluation infrastructure that scores policies against scenarios in closed loop, with CARLA and AlpaSim backends.
> **Strategy link:** Part I §5.3 (validate stage), §5.8 (lanes), Evaluator agent.

### 5A — Evaluator agent + eval API (~2 weeks)

```
backend/agents/evaluator.py      # Design eval batteries, run them, compute KPIs, emit incidents
backend/api/eval.py              # /api/eval/run (async job), /api/eval/{id}, /api/eval/incidents
backend/eval/
├── runner.py                    # Async job runner: policy × scenario × seeds × backend
├── kpi.py                       # km-between-at-fault-incidents, route completion, infraction score
├── golden_bank.py               # Golden scenario bank management; regression tolerance gates
└── reporter.py                  # Eval report generation (KPI tables, incident summaries)
```

### 5B — CARLA + AlpaSim SimBackends (~2 weeks)

```
backend/simbackends/
├── carla.py             # [IMPLEMENT] carla.Client → step-based interface, scenario spawning
├── alpasim.py           # [NEW] gRPC/HTTP client to dockerized AlpaSim microservices
└── config.py            # [NEW] Backend selection, feature flags, GPU allocation
docker-compose.gpu.yml   # [NEW] AlpaSim services for GPU hosts (local 2080 Ti dev / cloud batch)
```

### 5C — Eval workspace in frontend (~2 weeks)

| Component | Function |
|-----------|----------|
| Challenge dashboard | Local score vs leaderboard, gap analysis, KPI trends |
| Incident inbox | Card-based: each incident = type, DTC, TTC trace, scenario, seed |
| 3D incident replay | Reuse R3F scene + time-scrub data source, synced DTC/freeze-frame panel |
| KPI comparison tables | Before/after for proposals; golden-bank regression status |

#### Phase 5 Gate
- `run_eval` executes N seeded rollouts on internal backend; KPIs land in `closed_loop_run`
- A deliberately-degraded parameter is **blocked by the golden-bank regression gate**
- Same scenario spec runs on dockerized AlpaSim and produces comparable incidents
- Incident replay scrubs in the 3D scene with synced DTC panel
- Eval workspace renders all of the above

---

## Phase 6 — Policy Track + Challenge Ops + Autonomous Build Loop

> **Goal:** AlpaGym-style closed-loop RL post-training, checkpoint lifecycle, challenge submission pipeline, and the Builder/Reviewer/Planner build loop.
> **Strategy link:** Part I §5.3 (build workflow), §5.6 (policy workflow), §5.7 (Challenge Ops).

### 6A — Policy agent + training infrastructure (~3 weeks)

```
backend/agents/policy.py          # Configure/launch RL training, manage checkpoints
backend/api/policy.py             # /api/policy/train, /checkpoints, /promote (promotion human-gated)
policy/
├── recipes/                      # AlpaGym/Cosmos-RL-style training configs (YAML)
├── rewards/                      # Reward functions with engineer-locked bounds
│                                 #  (defaults: progress +1.0, collision −10.0,
│                                 #   offroad −5.0, comfort −0.5)
└── checkpoints/                  # Checkpoint storage with full provenance
backend/simbackends/base.py       # PolicyAdapter implementations:
                                  #   fsm (today's logic), onnx (learned), remote (VLA endpoint)
```

### 6B — Challenge Ops (~2 weeks)

```
backend/agents/challenge.py       # Challenge monitoring, submission assembly, leaderboard tracking
backend/api/challenge.py          # build_submission_packet, submit_challenge (HF Hub, human-gated),
                                  # fetch_leaderboard
```

| Workflow step | Agent | Human gate? |
|---------------|-------|-------------|
| Monitor challenge rules/timeline | Scout | No |
| Map rule changes to suite gaps | Analyst | No |
| Mirror missing scenarios | Builder | Sandbox review |
| Targeted post-training | Policy | Reward bounds locked |
| Weekly full battery eval | Evaluator | Auto |
| Build submission packet | Challenge Ops | **Yes — explicit approve** |
| Submit to HuggingFace | Challenge Ops | **Yes — explicit approve** |
| Leaderboard delta → next priorities | Learn | No |

**Pre-submission verification harness:** local scoring must reproduce the challenge metric (time/km without at-fault incidents) within stated tolerance on public dev scenarios before any submission is allowed.

### 6C — Builder + Reviewer + Planner: the autonomous build loop (~1 week)

```
backend/agents/builder.py         # Implement backlog items in sandbox git worktree
                                  #  — Python tick functions AND declarative scenario specs
                                  #    (YAML, OpenSCENARIO-inspired) that run on any SimBackend
backend/agents/reviewer.py        # Standards/safety/quality + eval-report check → approval packet
backend/agents/planner.py         # Insights + engineer input → ranked backlog
```
- Builder **never writes to `main`** — draft PRs from isolated worktrees only.
- Reviewer runs `pytest`, lint, standards-citation check; assembles Approval Packet (diff + tests + cited clauses + closed-loop KPI table + risk flags).
- Frontend: `[Build]` workspace = **Proposal Inbox** (diff viewer, eval report, Approve/Edit+note/Reject → `engineer_feedback`).
- CI: extend `.github/workflows/ci.yml` to run on agent PRs; **dependency scanning + package allowlist** on any agent-added packages.

#### Phase 6 Gate
- A recipe launches bounded post-training in GPU sandbox
- Per-checkpoint eval reports render with incident breakdowns
- `build_submission_packet` produces audited bundle
- Local metric reproduces challenge dev-set score within tolerance
- Submission requires and records explicit human approval
- Planner → Builder produces a draft PR with passing tests; Proposal Inbox round-trips Approve/Edit/Reject

---

## Phase 7 — Level-5 Self-Developing Platform

> **Goal:** Full autonomous OODA loop with governance, goal objects, and safety controls.
> **Strategy link:** Part I §0.4 (acceptance definition), §4.4 (OODA), §5.7.

### 7A — Orchestrator + goal objects (~2 weeks)

| Deliverable | Details |
|-------------|---------|
| Orchestrator OODA | Scheduled daily loop: observe → orient → decide → act → gate → learn |
| Goal objects | Benchmark goals ("AlpaSim 2026 weekly-ready"), release-gate goals ("candidate clears golden bank") — same machinery |
| Weekly RC packets | Auto-assembled, prioritized release-candidate summaries with one-click approve/merge and full provenance |

### 7B — Governance dashboard + safety controls (~2 weeks)

Frontend workspace: `[Govern]`

| Control | Function |
|---------|----------|
| Autonomy dial (L1–L5) | Adjust how much the platform does autonomously vs. requires approval |
| GPU-hours budget | Daily caps with cost telemetry |
| Training kill-switch | Immediate halt of any eval/training job; global pause for all agents |
| Rollback | One-click revert of any merged agent change |
| Audit log | Immutable trail of every agent action, decision, and human approval, per-engineer attribution |
| Safety envelope | Reward-term bounds, scenario safety limits, max PRs/day, max sim cost/day, mandatory human gate for safety-relevant thresholds and external submissions |

#### Phase 7 Gate
- Standing benchmark goal yields weekly RC + Challenge dashboard update
- Govern workspace shows GPU/token/$ telemetry
- Kill-switch halts eval/training jobs
- Rollback reverts a merged agent change
- The platform runs a full daily cycle autonomously under governance gates

---

## Cross-Cutting Concerns

### Reuse Map (don't rewrite what Phase 0 proved)

| Need in the real stack | Reuse from Phase 0 |
|---|---|
| ADAS trigger thresholds (AEB/LDW/ACC) | `backend/simulation/scenarios.py` |
| UDS service handlers + DID/NRC maps + seed-key | `backend/uds/` |
| Data contract (camelCase) the dashboard speaks | `frontend/types/index.ts` + `backend/simulation/state.py` |
| Dashboard ↔ backend proxy | `frontend/lib/backend.ts` |
| DTC / log / audit persistence | `backend/db/` |
| Observer event seam | `backend/observers.py` |

### Known Issues to Address

| Issue | When | Action |
|-------|------|--------|
| `backend/can/` shadows PyPI `python-can` | Phase 3 | Rename to `backend/canbus/` |
| next@15.3.3 CVE-2025-66478 | Phase 1C | Upgrade Next.js during frontend redesign |
| recharts 2.x deprecated | Phase 1C | Upgrade during redesign |
| 500ms polling (no SSE) | Phase 4D | Replace with Server-Sent Events |
| Swallowed errors in polling/API helpers | Phase 1C | Surface a connection/status banner |
| AEB DTC timing window too narrow | Phase 2B | Fix when real ROS2 planning FSM is built |

---

## Verification Plan

### Per-Phase End-to-End Smoke

| Phase | Verification |
|-------|-------------|
| **1** | carla-ros-bridge streams sensor topics; `internal.py` SimBackend is golden-snapshot identical; new frontend renders all existing functionality (Lighthouse a11y ≥ 90) |
| **2** | AEB approach in CARLA → `/adas/state` flips to AEB active, ego brakes, rviz markers on lead vehicle |
| **3** | UDS bus trace `10 03 → 27 01/02 → 2E … → 22 … → 19 02 FF`; collision → incident row + P1Cxx DTC + freeze-frame via `19 04` |
| **4** | Copilot streams and drives `set_scenario → send_uds`; Scout populates Insights Feed (incl. a challenge-feed card); `kb_search` returns the challenge ruleset; thumbs write `engineer_feedback`; all agent actions audited |
| **5** | `run_eval` N seeded rollouts; degraded param blocked by golden-bank regression gate; AlpaSim backend runs same scenario spec; 3D incident replay with synced DTC panel |
| **6** | RL training job → checkpoint eval → submission packet → local metric matches challenge dev-set within tolerance; explicit human gate recorded; Builder draft PR + Proposal Inbox round-trip |
| **7** | Daily OODA cycle runs; Govern dashboard live; kill-switch + rollback functional; standing goal yields weekly RC |

### CI Strategy
- **Phases 1–3:** `colcon build` + `pytest` in CI; CARLA-in-the-loop is local-only (no GPU on GH Actions)
- **Phase 5+:** CI replays recorded `ros2 bag` fixtures through the ROS2/UDS layer deterministically
- **Phase 6+:** dependency scanning + package allowlist on agent PRs
- All phases: `npm run build` + frontend tests in CI

---

# PART III — GOVERNANCE: ROADMAP, RISKS, METRICS

## Feature Roadmap (prioritized, mapped to phases)

### HIGH (unlocks the vision)
1. SimBackend seam + golden snapshot test (P1B) — **the keystone**
2. carla-ros-bridge + real perception/planning/control (P1A, P2)
3. Real UDS over ISO-TP + structured incident model + P1Cxx DTC bridge (P3)
4. Frontend v2 + swallowed-errors fix + workspace shell (P1C)
5. Model-agnostic LLM layer + agent framework + Diagnostic Copilot (P4A/4B/4D)
6. Engineer identity + feedback capture + memory/KB (P4C)
7. Daily Scout/Analyst → Insights Feed incl. challenge feeds (P4B/4C/4D)

### MEDIUM
8. Evaluator + golden-bank closed-loop regression gates (P5A)
9. CARLA + AlpaSim SimBackends + Eval workspace with 3D incident replay (P5B/5C)
10. Auto-decode layer for hex/DTC/telemetry (P4, Copilot)
11. Standards index + citation checker (P4C/P6C)
12. Sandbox Builder + Proposal Inbox + Approval Packet (P6C)

### LOW (scale/polish)
13. Policy track: AlpaGym-style post-training + checkpoint lifecycle (P6A)
14. Challenge Ops: gated submission + leaderboard learning loop (P6B)
15. Orchestrator L5 goal loop + weekly RC packets (P7A)
16. Governance dashboard, autonomy dial, kill-switch, rollback, GPU budgets (P7B)
17. Accessibility deep pass; mobile/tablet layout; multi-engineer collaboration; light theme polish
18. Durable-heuristic promotion store

## Risk Register (merged)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Autonomous codegen merges a bad/unsafe change | CRITICAL | Sandbox worktree only; human merge gate; closed-loop KPI regression pre-gate; one-click rollback; immutable audit log |
| Sim-to-real / sim-to-challenge gap (internal engine ≠ AlpaSim scoring) | HIGH | AlpaSim lane for anything challenge- or release-gated; local metric reproduction tolerance test before submissions; internal/CARLA lanes for fast iteration |
| GPU cost blowout (closed-loop eval + RL are GPU-hungry) | HIGH | Two-lane strategy (CPU internal for breadth, AlpaSim for depth); hard GPU-hour caps; local 2080 Ti for dev, spot/batch cloud for full batteries; cost telemetry in Govern |
| Hallucinated standards / wrong UDS semantics | HIGH | Reviewer citation-check vs standards index; Copilot must cite the ISO service/DID used; engineer sign-off on diagnostic reports |
| Supply-chain risk from agent-added dependencies | HIGH | CI dep scanning on agent PRs; package allowlist; sandbox has no prod secrets |
| Runaway cost/token spend in autonomous loops | HIGH | Hard daily caps (PRs, sim runs, $); cheaper model tier for high-frequency sub-tasks; cost telemetry + kill-switch |
| LLM provider lock-in | MEDIUM | Model-agnostic `LLMProvider` ABC from day one; provider-specific code isolated |
| Reward hacking / Goodharting the metric (policy games km-without-incident) | MEDIUM | Engineer-locked reward bounds; held-out scenario battery; incident-class breakdowns surfaced (a policy that parks forever scores zero progress); human checkpoint promotion |
| Challenge ToS / licensing (AlpaSim, Alpamayo weights, dataset licenses; submission rules) | MEDIUM | Scout ingests and Reviewer checks license/ToS terms into the approval packet; legal-flag field on submission gate; respect eval-budget rules |
| Research noise / low-signal insights | MEDIUM | Engineer thumbs weight sources; Analyst relevance threshold; dedupe vs KB |
| Trust erosion if agent state is wrong | MEDIUM | Fix swallowed errors; explicit LIVE/STALE + agent-health surfacing; every agent action audited and explainable |
| Over-automation alienates expert engineers | MEDIUM | Director-not-operator framing; engineers always approve and can edit-with-note; their reasons visibly steer the system |
| Frontend redesign delays backend progress | MEDIUM | Phase 1C parallelizable with 1A/1B; design system first, then incremental component migration |
| carla-ros-bridge version incompatibility | MEDIUM | Pin a 0.9.15 + Humble compatible ref as the first P1A task (see Open Questions) |
| Web research source instability / ToS | LOW | Allowlist reputable sources; cache fetched docs into KB; respect robots/ToS; prefer official standards/regulator feeds |

## Success Metrics & KPIs (merged)

**North-star:** *Validated Autonomous Improvement Rate* — net product improvements shipped per week **that pass closed-loop regression** with engineer approval.

| Category | KPI | Target |
|----------|-----|--------|
| **Closed-loop** | Median km between at-fault incidents on golden bank (sim-MTBF) | Monotonic ↑ release-over-release |
| **Closed-loop** | Local ↔ challenge metric reproduction error | < 10% before any submission |
| **Closed-loop** | Golden-bank regression escape rate (found post-merge) | < 2% |
| **Challenge** | Lag: challenge rule/leaderboard change → relevant proposal | < 72h |
| **Challenge** | Submission cadence achievable on standing goal | Weekly, fully packet-audited |
| Autonomy | % merged changes agent-originated | ≥ 60% by Phase 7 |
| Quality | Proposal approval rate (usefulness proxy) | ≥ 70% |
| Quality | Post-merge regression/rollback rate | < 5% |
| Research | Insight precision (thumbs-up / total) | ≥ 50% and rising |
| Research | Median lag: industry event → relevant proposal | < 48h |
| Practitioner | Time-to-diagnosis (Copilot vs manual) | −50% |
| Practitioner | UDS sequences completed without manual hex entry | ≥ 80% |
| Practitioner | Median incident triage time (replay + verdict) | < 10 min |
| Coverage | Scenario classes mirrored from challenge distribution | 100% of published classes |
| Coverage | Scenarios + UDS services + fault library growth | +X/quarter |
| Trust/Safety | Agent actions with full audit + citation | 100% |
| Efficiency | GPU-hours and $ per accepted closed-loop-validated change | Trend ↓ |
| Adoption | Weekly active engineers; approvals/engineer | Up |

## Open Questions

> **1. Phase ordering — parallel tracks?**
> Phases 1A (carla-ros-bridge) and 1C (frontend redesign) are independent. Run them in parallel, or finish the backend/simulation track completely before touching the frontend?

> **2. AlpaSim deployment model**
> For Phase 5B, AlpaSim needs GPU. Options: (a) local AlpaSim Docker deployment on the RTX 2080 Ti alongside CARLA, (b) cloud GPU instance (Lambda Labs, RunPod, etc.), or (c) both — local for dev, cloud for full eval batteries. *(Recommended: c.)*

> **3. carla-ros-bridge compatibility**
> The ros-bridge repo needs a specific ref compatible with CARLA 0.9.15 and ROS2 Humble. Identify the working ref/branch as the first P1A task.

> **4. Team size**
> Scoped for a single engineer with AI assistance. With additional engineers, parallelize more aggressively (ROS2 C++ nodes + frontend redesign + agent framework simultaneously).
