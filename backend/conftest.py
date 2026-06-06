"""Shared pytest fixtures for the ADAS-ECU backend tests."""
from __future__ import annotations

import pytest

from simulation.state import reset_sim_state


@pytest.fixture(autouse=True)
def _fresh_state():
    """Reset the simulation singleton before every test for isolation."""
    reset_sim_state()
    yield
