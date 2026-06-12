"""DEPRECATED — LDW logic moved to the consolidated planning node.

See: adas_planning/planning_node.py (node), adas_planning/fsm.py (logic),
adas_planning/thresholds.py (Phase 0 spec values).
No longer registered as an entry point; safe to delete.
"""
from .planning_node import main  # noqa: F401  (back-compat shim)
