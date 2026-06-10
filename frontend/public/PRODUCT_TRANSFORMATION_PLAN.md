# ADAS → Self-Developing, Research-Driven Agentic Engineering Platform
### Product Transformation Plan (Strategy + Multi-Phase Build, Phase 1 → Level-5 Autonomy)

---

## Context

**What ADAS is today.** A clean, well-tested **Phase-0 ADAS simulation + diagnostics platform**:
- **Backend** (`backend/main.py`) — FastAPI app with 5 deterministic driving scenarios (`backend/simulation/scenarios.py`), an ISO-14229 UDS diagnostic server (`backend/uds/services.py`, `backend/uds/processor.py`), and a decoupled persistence seam (`backend/observers.py`) writing DTCs/logs/UDS-audit/telemetry to PostgreSQL (`backend/db/models.py`).
- **API surface** — `/api/sim/*` (`backend/api/routes.py`), `/api/history/*` (`backend/api/history.py`), `/api/system/*` (`backend/api/system.py`). These map almost 1:1 to agent tools.
- **Frontend** — cinematic Next.js 16 + React Three Fiber 3D dashboard (`frontend/app/page.tsx`, `frontend/components/scene/`) with UDS console, DTC manager, system log, and an admin Control Center.
- **Critically: there is zero AI/LLM integration today.** Everything is hand-tuned state machines. The agentic layer is genuinely net-new surface, not a refactor — which means we add it cleanly without fighting legacy AI code.

**Why transform.** The product is a high-fidelity *static* simulator. The automotive-software domain it serves (UDS/ISO-14229, AUTOSAR, UNECE R79/R152/R157, Euro NCAP, SAE J3016, CARLA/ROS2) moves continuously. Today a human must manually notice a standards change, decide it matters, and hand-code a new scenario or UDS service. **That human is the bottleneck.**

**Intended outcome.** Turn ADAS into a **continuously self-improving platform** where a Claude Fable 5 multi-agent system (1) watches the industry every day, (2) proposes and builds concrete product improvements in a sandbox, (3) validates them by simulation, and (4) surfaces a one-click, fully-audited approval packet to UDS/ADAS engineers — who steer the system with their domain expertise rather than doing the mechanical work. The engineers become **directors and approvers**, not operators.

**Assumptions (flag if wrong).** (1) Agents *propose* product/code/content changes; humans *approve* before anything merges to `main` (safety + governance). (2) The autonomous build loop runs in an isolated git worktree/sandbox with no production secrets. (3) Claude Fable 5 (`claude-fable-5`) is the default model for planning/research/synthesis; cheaper tiers used for high-frequency sub-tasks.

---

## 1. Executive Summary

ADAS today is a beautiful but *manually-maintained* simulator. The opportunity is to make it the **first ADAS/UDS engineering platform that maintains and advances itself** under expert supervision.

The transformation has three pillars:

1. **A daily industry-research swarm** (Scout → Analyst) that scans standards bodies, regulators, papers, and OEM/AV news, and converts raw signal into ranked, product-relevant insights — every morning, before engineers log in.
2. **A self-developing product loop** (Planner → Builder → Reviewer → Experiment) that turns insights + engineer inputs into concrete changes — new scenarios, new UDS services, expanded fault libraries, higher sim fidelity — built in a sandbox, validated by simulation, and presented as an approve/reject "Release Candidate."
3. **A practitioner copilot** (Diagnostic Copilot) embedded in the existing 3D workspace that lets UDS and ADAS engineers run diagnostics, reproduce faults, and reason about behavior in natural language while the agent drives the actual tools.

The engineers' feedback (approve/reject/edit, with reasons) is the **primary training signal**: it steers what the swarm builds next, weights research sources, and refines diagnostic playbooks. The result is a flywheel — *research → proposal → build → simulate → approve → learn* — that compounds. At **Level 5**, an engineer states a standing objective ("keep us aligned with UNECE R157 and Euro NCAP 2026") and the platform autonomously tracks, builds, validates, and reports, escalating only at governance gates.

**Competitive position:** No general AI coding agent (Cursor, Devin, Replit Agent) understands UDS/ADAS domain semantics, and no ADAS toolchain (dSPACE, Vector CANoe, NI) has an autonomous research-and-build loop. ADAS would own the intersection: **domain-native autonomy with an embodied 3D simulation substrate.**

---

## 2. UX/UI Audit

Severity scale: **CRITICAL** (blocks the product vision), **HIGH**, **MEDIUM**, **LOW**.

| # | Finding | Evidence | Severity | Impact |
|---|---------|----------|----------|--------|
| 1 | **No AI/agent surface exists at all** — the entire value proposition is absent. | No `anthropic`/agent code anywhere in repo. | CRITICAL | Nothing to build the vision on; must add a first-class agent workspace. |
| 2 | **No user/engineer identity** — the app has no concept of *who* is using it. | `page.tsx` holds only sim state; no auth/profile. | CRITICAL | Cannot capture per-engineer feedback, governance audit, personalization, or steering signal — all of which the new vision depends on. |
| 3 | **Errors are silently swallowed.** | `catch { /* ignore */ }` in the polling loop and API helpers. | HIGH | Engineers can't trust state; agents need observable failures to act on. Kills transparency. |
| 4 | **Everything crammed into one dense expert HUD** — no task-oriented workspaces. | Single `page.tsx` with telemetry + 3D + ADAS + chart + 3 tabs + Control Center toggle. | HIGH | Decision fatigue. UDS engineers and ADAS engineers have different jobs but see one undifferentiated wall of panels. |
| 5 | **No streaming transport** — 500ms polling only. | `setInterval(fetchState, 500)` in `page.tsx`. | HIGH | Agent chat/research need token streaming (SSE/WebSocket); polling can't carry it well and wastes a request every 0.5s. |
| 6 | **History is shallow & unsearchable** — last-25, no query, no recall. | `history.py` + Control Center tables. | MEDIUM | Agents need semantic recall over the full corpus (past faults, UDS sessions, runs) for memory. |
| 7 | **Status conveyed primarily by color** (AEB red/amber/cyan, etc.). | `scene-config.ts` palette; status badges. | MEDIUM | Colorblind/contrast risk; needs text + ARIA live regions, especially as agents narrate state changes. |
| 8 | **No onboarding for either persona** — drops users into a cinematic HUD with no orientation. | No first-run flow. | MEDIUM | High time-to-first-value; new engineers don't know what to do. |
| 9 | **Control Center is admin-only** — no surface for research insights, proposals, or governance. | `control-center.tsx` = config + health + last-25 tables. | MEDIUM | The new "Insights Feed," "Proposal Inbox," and "Governance" surfaces have no home yet. |
| 10 | **Mobile stacking buries the 3D + panels**; dark-only theme. | `grid-cols-1 lg:grid-cols-[260px_1fr_280px]`. | LOW | Field engineers on tablets lose context; theme rigidity. |
| 11 | **Dependency currency / sandbox hygiene** — Next was on a CVE'd 15.3.3 per HANDOFF (now 16.2.7); the new build loop must never touch prod secrets. | HANDOFF.txt note; package.json. | LOW→HIGH once build loop ships | Autonomous code-gen amplifies supply-chain risk; needs sandbox + dep scanning. |

**Strengths to preserve:** the decoupled `observers.py` event seam (perfect agent observation hook), the offline/proxy duality in `lib/backend.ts`, the damped 60fps-from-2Hz rendering, the WebGL→MiniMap fallback, and the genuinely beautiful 3D substrate (it becomes the agent's *embodiment*).

---

## 3. User Journey Redesign

### Persona A — UDS Diagnostic Engineer ("Dana")
**Job-to-be-done:** reproduce a field fault, run the correct UDS sequence, root-cause it, and document it to standard.

**Today:** Dana manually picks a scenario, hand-types hex (`19 02 FF`), reads a raw response (`59 02 FF 01 B1 ...`), interprets it herself, and copies notes elsewhere. Every step is manual; nothing is explained or remembered.

**Future (Copilot-driven):**
1. Dana types *"Reproduce a forward-radar dropout and walk me through diagnosing it per ISO-14229."*
2. Copilot sets `sensor_fault` scenario (`set_scenario` tool), watches the `observers` stream, and narrates: *"B1001 + U0100 now active; radar `target_present=false`. Standard sequence: extended session → read DTC by status → read freeze-frame."*
3. Copilot proposes the next UDS command with a one-line rationale; Dana approves (or edits); Copilot executes via `send_uds` and **explains the decoded response** inline.
4. At the end, Copilot drafts a standards-formatted diagnostic report (citing the exact ISO services used) and files it to history. Dana reviews and signs off.

**Friction removed:** hex memorization, response decoding, sequence recall, report writing. **Dana's role:** judgment and sign-off.

### Persona B — ADAS Engineer ("Arman")
**Job-to-be-done:** validate ADAS behavior against the latest scenarios/regulations and keep the sim suite current.

**Today:** Arman would have to read a UNECE update, decide it matters, and hand-code a new scenario tick function. Nobody does this continuously.

**Future (research + build loop):**
1. Each morning the **Insights Feed** shows ranked cards: *"UNECE R157 amendment 4 raises ALKS max operational speed to 130 km/h — your `highway_acc` scenario caps at 120. Proposed: new `alks_high_speed` scenario + 2 regression checks. [Review proposal]."*
2. Arman opens the **Proposal Inbox**: a diff of a new `tick_alks_high_speed` in `scenarios.py`, a new UDS DID if needed, generated tests, and a **simulation report** (the Experiment agent already ran it: TTC never negative, ACC engages, acceptance criteria pass).
3. Arman edits a threshold, adds a comment *"use 5% sensor-noise on radar above 110 km/h,"* and clicks **Approve**. The agent applies the note, re-simulates, and merges via the normal PR flow.
4. Arman's comment becomes **durable steering memory**: future high-speed scenarios default to that noise model.

**Friction removed:** monitoring the industry, boilerplate scenario coding, test writing, running validations. **Arman's role:** set direction, review, approve, inject domain wisdom.

### Journey principles (both personas)
- **Director-not-operator:** every screen offers an agent action with a human gate, never a blank form.
- **Explain-by-default:** no raw hex/DTC/telemetry without an inline natural-language decode.
- **One inbox for decisions:** research, proposals, and diagnostic sign-offs converge into a single prioritized queue so engineers spend attention only where judgment is required.

---

## 4. Agentic AI Strategy (Claude Fable 5)

### 4.1 Model routing
| Role | Model | Why |
|------|-------|-----|
| Orchestrator, Planner, Analyst, Reviewer (deep reasoning) | `claude-fable-5` | Hardest planning/synthesis/judgment. |
| Builder (code/content generation) | `claude-fable-5` (fallback `claude-opus-4-8`) | Code quality matters; sandboxed. |
| Scout fan-out (high-frequency fetch/triage), Copilot quick turns | `claude-haiku-4-5` | Cheap, frequent, narrow. |

(IDs for this environment: Fable 5 = `claude-fable-5`, Opus 4.8 = `claude-opus-4-8`, Haiku 4.5 = `claude-haiku-4-5-20251001`. Confirm current pricing/params at build time rather than from memory.)

### 4.2 The agent roster (multi-agent collaboration)
A supervisor/orchestrator delegates to specialists. Each is a Claude Fable 5 agent with a scoped tool set and a scoped memory view.

| Agent | Mission | Key tools | Outputs |
|-------|---------|-----------|---------|
| **Orchestrator** | Run the daily OODA loop; delegate; enforce governance gates; escalate to humans. | All (delegation) | Task graph, escalations |
| **Scout (Research)** | Daily scan of industry sources; dedupe vs. memory; emit raw signals. | `web_search`, `web_fetch`, `kb_search` | Signal cards |
| **Analyst (Synthesis)** | Score signal relevance to *our* product; map to concrete gaps. | `kb_search`, `read_codebase`, `list_scenarios`, `list_uds_services` | Insight cards w/ impact |
| **Product Planner** | Convert insights + engineer inputs into a prioritized, scoped backlog. | `kb_search`, `read_codebase`, `backlog_write` | Ranked proposals |
| **Builder** | Implement a backlog item as code/content + tests in a sandbox worktree. | `read/write_file` (sandbox), `run_tests`, `git_*` (worktree) | Draft PR/diff |
| **Experiment (Sim)** | Run the new scenario, collect telemetry, evaluate acceptance, tune params. | `set_scenario`, `get_sim_state`, `query_telemetry`, `inject_fault` | Sim report, tuned params |
| **Reviewer/Governance** | Check proposal vs. standards/safety/quality; build the human approval packet. | `read_codebase`, `run_tests`, `kb_search` | Approval packet, risk flags |
| **Diagnostic Copilot** | Practitioner-facing: drive diagnostics + explain, in natural language. | `set_scenario`, `send_uds`, `inject_fault`, `clear_dtcs`, `query_history` | Live guidance, reports |

### 4.3 Memory systems
Four stores, all persisted in Postgres (extending the existing `db/` layer) with a vector index for semantic recall:

- **Episodic** — every sim run, UDS session, fault injection, copilot transcript, experiment. *Extends existing* `sim_run`, `uds_audit`, `telemetry_sample`, `log_record`.
- **Semantic / Knowledge Base** — industry signals, a standards index (ISO-14229 services/DIDs, UNECE clauses, NCAP protocols), the scenario library, the fault library. Vector-embedded for retrieval.
- **Procedural** — learned diagnostic playbooks ("for B1001 → these 4 UDS steps") and tuning heuristics, refined by outcomes.
- **Steering / Engineer-feedback memory** — every approve/reject/edit with the engineer's reason, attributed to a person. This is the **primary preference signal** and is injected into Planner/Builder prompts ("Arman requires radar noise modeling above 110 km/h").

### 4.4 Planning loop (Orchestrator OODA)
```
OBSERVE  → new research signals + new engineer feedback + sim/telemetry events (from observers.py)
ORIENT   → retrieve relevant memory (semantic + steering); assess gaps vs. current product
DECIDE   → Planner produces/updates a ranked backlog; Orchestrator picks the next safe unit of work
ACT      → delegate to Builder → Experiment → Reviewer; assemble approval packet
GATE     → human approval (UDS/ADAS engineer) — REQUIRED before merge
LEARN    → write outcome + engineer reasons to memory; update source weights, playbooks, params
```

### 4.5 Feedback & continuous-learning loops
| Signal | Source | Updates |
|--------|--------|---------|
| Proposal approved/rejected/edited (+reason) | Engineer | Planner priorities; steering memory; Scout source weights |
| Sim acceptance pass/fail | Experiment agent | Builder prompts; scenario param tuning |
| Diagnostic outcome correct/incorrect | Copilot session sign-off | Procedural playbooks |
| Insight rated useful/noise | Engineer thumbs | Scout source ranking; Analyst relevance model |

"Continuous learning" is concrete here: **no fine-tuning required** — it's retrieval-augmented memory + evolving prompt/heuristic stores + simulation-in-the-loop parameter optimization.

---

## 5. Autonomous Workflow Architecture

### 5.1 Tool contracts (thin wrappers over existing endpoints + new ones)
Existing endpoints become tools verbatim — this is why the current API is the ideal substrate:

```jsonc
// READ
get_sim_state()                    -> GET  /api/sim/state
list_injectable_faults()           -> GET  /api/sim/inject-fault
query_history(kind, limit, query?) -> GET  /api/history/{kind}   // + new semantic query param
get_system_status()                -> GET  /api/system/status
// ACT (sim/diagnostics)
set_scenario(scenario)             -> POST /api/sim/scenario
send_uds(command_hex)              -> POST /api/sim/uds
inject_fault(code?)                -> POST /api/sim/inject-fault
clear_dtcs()                       -> POST /api/sim/clear-dtcs
// NEW (agent/build/research)
kb_search(query, k)                -> vector search over Knowledge Base
backlog_write(item)                -> create/update a proposal
run_tests(scope)                   -> pytest in sandbox worktree
git_worktree_pr(branch, diff)      -> open draft PR from sandbox
web_search(query) / web_fetch(url) -> Scout research (allowlisted sources)
```
**Governance invariant:** write/merge tools (`git_worktree_pr`, merge) are gated; sim/diagnostic ACT tools are auto-allowed in the Copilot but logged to `uds_audit`/`log_record` for audit.

### 5.2 Workflow 1 — Daily Industry Scan (scheduled, autonomous)
```
06:00 cron → Orchestrator
  Scout: web_search/fetch allowlisted sources (ISO/SAE, UNECE, Euro NCAP, arXiv cs.RO/cs.CV,
         CARLA & ROS2 releases, NHTSA, OEM ADAS newsrooms) → dedupe vs. KB
  Analyst: score relevance to our scenario/UDS/fault libraries → Insight cards w/ proposed change
  Write Insights Feed; push top-N to engineers (push notification)
```
Source allowlist + per-source weights live in `app_config`; engineers tune via thumbs.

### 5.3 Workflow 2 — Research → Proposal → Build → Validate → Approve → Merge
```
Planner   : pick top insight (or engineer-filed request) → scoped backlog item
Builder   : in git worktree (isolation), write new tick_* / UDS handler / fault entry + tests
Experiment: set_scenario(new) → collect telemetry → check acceptance (TTC>=0, FSM transitions,
            determinism) → auto-tune thresholds within bounds
Reviewer  : run_tests, lint, standards-citation check, safety check → Approval Packet
GATE      : Proposal Inbox → engineer Approve/Edit/Reject (+reason)  [REQUIRED]
Merge     : on approve → normal PR merge to main; on edit → apply note, re-run from Experiment
Learn     : persist outcome + reason to steering memory
```

### 5.4 Workflow 3 — Continuous Simulation Learning (closed loop)
The Experiment agent treats scenario parameters (TTC thresholds, sensor-noise sigma, deceleration profiles) as a small optimization problem: run sim → measure objective (e.g., "AEB engages within spec window across N seeds, no false positives") → adjust within engineer-set bounds → converge. Results feed the fault/scenario libraries and update procedural memory. Regression guard: any change that breaks an existing accepted scenario is auto-reverted and flagged.

### 5.5 Workflow 4 — Engineer-in-the-loop Diagnostic Copilot (reactive, real-time)
Streaming chat in the 3D workspace; Copilot observes the `observers.py` event bus, proposes the next UDS step with rationale, executes on approval, decodes responses, and drafts the standards report. Every action is audited.

### 5.6 Orchestration & delegation
Supervisor pattern: Orchestrator spawns specialists, runs Builder/Experiment in **background + worktree isolation**, monitors via task status, and assembles results. Long-running build/sim work never blocks the practitioner UI.

### 5.7 Wireframe-level UI additions
```
┌─ ADAS · workspace switcher: [Diagnose] [Build] [Research] [Govern] ──────────────┐
│                                                                                   │
│  DIAGNOSE (Persona A)            │  RESEARCH (Insights Feed)                       │
│  ┌───────────────┬────────────┐  │  ┌─────────────────────────────────────────┐  │
│  │  3D scene     │  Copilot   │  │  │ ▲ UNECE R157 am.4 — ALKS 130km/h         │  │
│  │ (existing R3F)│  chat      │  │  │   impact: highway_acc caps at 120        │  │
│  │  + live decode│  (stream)  │  │  │   [Review proposal]  thumbs up / down    │  │
│  │  overlays     │  > next: 19│  │  ├─────────────────────────────────────────┤  │
│  └───────────────┴────────────┘  │  │ • CARLA 0.10 release — new sensor API    │  │
│   UDS console (auto-decoded)      │  │ • arXiv: radar-camera fusion DTC model   │  │
│                                   │  └─────────────────────────────────────────┘  │
│  BUILD (Proposal Inbox)           │  GOVERN (audit + kill-switch)                  │
│  ┌─────────────────────────────┐  │  ┌─────────────────────────────────────────┐  │
│  │ Proposal #42  diff   sim    │  │  │ Autonomy: [L4]   rollback    pause all  │  │
│  │ + tick_alks_high_speed()    │  │  │ Approvals log · per-engineer attribution│  │
│  │ tests ok  sim ok  std-cite  │  │  │ Daily run history · cost · tokens       │  │
│  │ [Approve] [Edit+note] [Rej] │  │  └─────────────────────────────────────────┘  │
│  └─────────────────────────────┘  │                                               │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Multi-Phase Build Plan (file-level)

Each phase ships independently and raises the autonomy level. Backend agent code lives in a **new `backend/agents/` package**; new routes under **`/api/agent/*`**; new memory tables extend `backend/db/`.

### Phase 1 — Foundation & Diagnostic Copilot (Autonomy L1–L2, reactive)
**Goal:** a streaming, tool-using Copilot grounded in the existing API. Human drives; agent assists + explains.
- **Add** `backend/agents/__init__.py`, `backend/agents/client.py` (Anthropic SDK, model routing, retries), `backend/agents/tools.py` (tool registry wrapping `routes.py`/`history.py`/`system.py` — reuse, don't reimplement), `backend/agents/copilot.py` (system prompt + tool loop).
- **Add** `backend/api/agent.py` → `POST /api/agent/chat` with **SSE streaming**; register router in `main.py` alongside existing routers.
- **Frontend:** new `frontend/components/copilot/CopilotPanel.tsx` (streaming chat) + `frontend/app/api/agent/chat/route.ts` proxy (mirror `lib/backend.ts` pattern). Add a `[Diagnose]` workspace tab to `page.tsx`.
- **Tools wired:** `get_sim_state`, `set_scenario`, `send_uds`, `inject_fault`, `clear_dtcs`, `query_history`.
- **Fix** the swallowed-error anti-pattern in the polling path (surface a status banner) — prerequisite for trustable agent state.
- **Secrets:** `ANTHROPIC_API_KEY` via env only; validate at startup.
- **Tests:** tool-wrapper unit tests + a mocked-LLM copilot loop test (>=80%).

### Phase 2 — Memory + Daily Research (Autonomy L2–L3)
**Goal:** the platform remembers and watches the industry.
- **Add memory tables** in `backend/db/models.py`: `agent_memory` (kind, content, embedding, source, ts), `kb_document`, `insight_card`, `engineer_feedback` (engineer_id, target, decision, reason, ts), `engineer` (identity). Repository writers/readers in `repository.py` following the existing pattern.
- **Add** vector search (pgvector or a local index) behind `kb_search`.
- **Add** `backend/agents/scout.py` + `analyst.py`; allowlisted `web_search`/`web_fetch`.
- **Schedule** the daily scan (cron/routine) → writes `insight_card`s.
- **Frontend:** `[Research]` workspace = Insights Feed with thumbs up/down (writes `engineer_feedback`). Minimal engineer identity (no heavy auth yet — name/role selector persisted).
- **Observe:** subscribe the agent layer to `observers.py` so episodic memory captures every run/UDS/DTC automatically.

### Phase 3 — Autonomous Build Loop in Sandbox (Autonomy L3–L4)
**Goal:** agents propose real product changes; humans approve.
- **Add** `backend/agents/planner.py`, `builder.py`, `reviewer.py`.
- **Builder runs in git worktree isolation** — writes new `tick_*` in `scenarios.py`, new handlers in `uds/services.py`, new fault entries, **plus tests**; opens a **draft PR**. Never writes to `main`.
- **Reviewer** runs `pytest`, lint, and a standards-citation check; assembles an **Approval Packet** (diff + test results + cited clauses + risk flags).
- **Frontend:** `[Build]` workspace = **Proposal Inbox** (diff viewer, sim report, Approve/Edit+note/Reject). Approvals/edits write `engineer_feedback` (steering memory).
- **CI:** extend `.github/workflows/ci.yml` to run on agent PRs; dependency scan on any new packages (mitigates the supply-chain risk from auto-codegen).

### Phase 4 — Continuous Simulation Learning (Autonomy L4)
**Goal:** close the sim loop; the platform tunes and regression-guards itself.
- **Add** `backend/agents/experiment.py`: runs candidate scenarios via the tool API, pulls `telemetry_sample`s, evaluates acceptance criteria, and tunes parameters within **engineer-set bounds** stored in `app_config`.
- **Add** a regression suite: every accepted scenario becomes a golden test; auto-revert + flag on regression.
- **Frontend:** sim reports embedded in each proposal; a "tuning history" view per scenario.

### Phase 5 — Level-5 Self-Developing Platform (Autonomy L5, goal-driven)
**Goal:** engineer states a standing objective; the platform runs the full loop autonomously and reports.
- **Add** `backend/agents/orchestrator.py` running the OODA loop on schedule; goal objects ("track UNECE R157 + NCAP 2026") persisted and decomposed into recurring backlogs.
- **Weekly Release Candidate packet:** batched, prioritized proposals with one-click approve/merge and full provenance.
- **Governance dashboard** (`[Govern]` workspace): autonomy-level dial (L1–L5), **global pause / kill-switch**, per-engineer approval attribution, cost/token/run telemetry, and **one-click rollback** of any merged agent change.
- **Safety envelope:** hard caps (max PRs/day, max sim cost/day), mandatory human gate for any change touching safety-relevant thresholds, and an immutable audit log.

---

## 7. Feature Roadmap (prioritized)

### HIGH (do first — unlocks the vision)
1. Diagnostic Copilot with streaming + tool use over existing API (**Phase 1**).
2. Engineer identity + feedback capture (**Phase 2**) — without it, no steering/learning.
3. Memory tables + KB + semantic recall (**Phase 2**).
4. Daily Scout/Analyst research → Insights Feed (**Phase 2**).
5. Fix swallowed errors + add a connection/agent status surface (**Phase 1**, small, high-trust payoff).

### MEDIUM
6. Sandbox Builder + Proposal Inbox + Approval Packet (**Phase 3**).
7. Experiment agent + regression golden tests (**Phase 4**).
8. Workspace switcher (Diagnose/Build/Research/Govern) replacing the one-screen HUD (**Phase 3**).
9. Auto-decode layer (every hex/DTC/telemetry gets an inline natural-language explanation) (**Phase 1–2**).
10. Standards index + citation checker (**Phase 3**).

### LOW (polish / scale)
11. Orchestrator goal-driven L5 loop + weekly RC packets (**Phase 5**).
12. Governance dashboard, autonomy dial, kill-switch, rollback (**Phase 5**).
13. Accessibility pass (ARIA live regions for status, colorblind-safe palette, light theme).
14. Mobile/tablet field layout; multi-engineer real-time collaboration.
15. Durable-heuristic promotion (instinct/learning store) for repeated patterns.

---

## 8. Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Autonomous codegen merges a bad/unsafe change** | CRITICAL | Sandbox worktree only; mandatory human gate before merge; safety-threshold changes require explicit sign-off; one-click rollback; immutable audit log. |
| **Hallucinated standards / wrong UDS semantics** | HIGH | Reviewer citation-check against the standards index; Copilot must cite the ISO service/DID it used; engineer sign-off on diagnostic reports. |
| **Supply-chain risk from agent-added dependencies** | HIGH | Dep scanning in CI on agent PRs; allowlist for new packages; sandbox has no prod secrets. |
| **Runaway cost/token spend in autonomous loops** | HIGH | Hard daily caps (PRs, sim runs, $); cheaper model tier for high-frequency sub-tasks; cost telemetry + kill-switch in Govern. |
| **Research noise / low-signal insights** | MEDIUM | Engineer thumbs weight sources; Analyst relevance threshold; dedupe vs. KB. |
| **Trust erosion if agent state is wrong** | MEDIUM | Fix swallowed errors; explicit LIVE/STALE + agent-health surfacing; every agent action audited and explainable. |
| **Over-automation alienates expert engineers** | MEDIUM | Director-not-operator framing; engineers always approve and can edit-with-note; their reasons visibly steer the system. |
| **Web research source instability / ToS** | LOW | Allowlist reputable sources; cache fetched docs into KB; respect robots/ToS; prefer official standards/regulator feeds. |

---

## 9. Success Metrics & KPIs

**North-star:** *Autonomous Net Useful Change* — net product improvements (scenarios, UDS coverage, fault models, fidelity) shipped per week with engineer approval and zero regressions.

| Category | KPI | Target |
|----------|-----|--------|
| Autonomy | % of merged changes originated by agents | >=60% by Phase 5 |
| Quality | Proposal approval rate (proxy for usefulness) | >=70% |
| Quality | Post-merge regression/rollback rate | <5% |
| Research | Insight precision (thumbs-up / total) | >=50% and rising |
| Research | Median lag: industry event → relevant proposal | <48h |
| Practitioner | Time-to-diagnosis (Copilot vs. manual) | -50% |
| Practitioner | UDS sequences completed without manual hex entry | >=80% |
| Coverage | Scenarios + UDS services + fault library size growth | +X/quarter |
| Trust/Safety | % agent actions with full audit + citation | 100% |
| Efficiency | Cost per accepted change ($/tokens) | trend down |
| Adoption | Weekly active engineers; approvals/engineer | up |

---

## 10. Competitive Benchmark

| Product | Strength | Why ADAS wins |
|---------|----------|---------------|
| **Cursor / Devin / Replit Agent** | General autonomous coding | No UDS/ADAS domain semantics, no embodied sim substrate, no standards-grounded validation loop. |
| **dSPACE / Vector CANoe / NI** | Industry-standard ADAS/UDS tooling | Static, manually maintained; no autonomous research or self-development. |
| **CARLA / OpenPilot** | Open AV simulation | Simulation only; no diagnostic/UDS layer, no agentic R&D loop, no governance. |
| **Khanmigo / Duolingo Max** | Adaptive AI guidance | Consumer learning, not professional engineering autonomy. |

**ADAS's defensible position:** the **only** platform combining (a) domain-native UDS/ADAS semantics, (b) an embodied 3D simulation substrate agents can *operate*, and (c) a governed, self-developing research-and-build loop steered by working engineers. The moat compounds with the steering-memory + standards-index corpus.

---

## 11. Final Product Vision

**ADAS becomes the automotive-software platform that advances itself.** Every morning it has already read the industry, mapped what changed to its own gaps, built and simulation-validated candidate improvements, and queued a short, high-signal set of decisions for its UDS and ADAS engineers. The engineers do what only they can — apply judgment, encode hard-won domain wisdom, approve — and the platform absorbs their reasoning as durable memory that makes the next cycle sharper. Diagnostics that once required memorizing hex and standards become a conversation with a copilot that operates the real tools and explains every step. The simulator is no longer a static artifact; it is a **living, continuously-learning system** that stays at the frontier of UDS/ADAS practice with humans firmly in command at the gates.

---

## Verification

Per phase, the change is end-to-end verifiable on the existing stack:
- **Phase 1:** `POST /api/agent/chat` streams; Copilot can run `set_scenario` → `send_uds` → decode against the live FastAPI backend; new tool-wrapper + mocked-LLM tests pass (`pytest`), frontend builds (`npm run build`) — both already gated by `.github/workflows/ci.yml`.
- **Phase 2:** trigger a manual Scout run → Insights Feed populates; thumbs writes `engineer_feedback`; `kb_search` returns relevant docs; episodic memory rows appear after a sim run (observe via `/api/history/*`).
- **Phase 3:** Planner → Builder produces a draft PR in an isolated worktree with passing tests; Proposal Inbox renders the diff + Approval Packet; Approve merges, Reject discards, Edit re-runs — verified by inspecting the PR and `engineer_feedback`.
- **Phase 4:** Experiment agent runs a candidate scenario, telemetry lands in `telemetry_sample`, acceptance report attaches to the proposal; a deliberately-broken change is auto-reverted by the regression guard.
- **Phase 5:** a standing goal produces a scheduled weekly RC packet; Govern dashboard shows autonomy level, costs, audit log; kill-switch halts all agents and rollback reverts a merged change.

End-to-end smoke per phase: run backend (`uvicorn`/Docker Compose) + frontend, set `ANTHROPIC_API_KEY` and `BACKEND_URL`, and drive each new workspace through one full loop.
