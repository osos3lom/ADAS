"""ISO 14229 UDS service tests (against the pure-Python processor)."""
from __future__ import annotations

from typing import List

from simulation.state import add_dtc, create_initial_state
from uds.processor import process_uds

_XOR_KEY = [0xCA, 0xFE, 0xBA, 0xBE]


def _bytes(hex_str: str) -> List[int]:
    return [int(x, 16) for x in hex_str.split()]


def test_invalid_hex_returns_incorrect_length_nrc():
    state = create_initial_state()
    r = process_uds("ZZ", state)
    assert r["positive"] is False
    assert r["responseHex"] == "7F 00 13"


def test_unknown_service_returns_service_not_supported():
    state = create_initial_state()
    r = process_uds("99", state)
    assert r["positive"] is False
    assert r["responseHex"] == "7F 99 11"


def test_session_control_extended():
    state = create_initial_state()
    r = process_uds("10 03", state)
    assert r["positive"] is True
    assert r["serviceName"] == "DiagnosticSessionControl"
    assert r["responseHex"].startswith("50 03")
    assert state.ecu.session == "extended"


def test_programming_session_requires_security():
    state = create_initial_state()
    r = process_uds("10 02", state)
    assert r["positive"] is False
    assert r["responseHex"] == "7F 10 22"  # conditionsNotCorrect


def test_seed_request_denied_in_default_session():
    state = create_initial_state()
    r = process_uds("27 01", state)
    assert r["positive"] is False
    assert r["responseHex"] == "7F 27 22"


def test_security_access_full_flow_and_write_did():
    state = create_initial_state()

    assert process_uds("10 03", state)["positive"] is True

    seed_resp = process_uds("27 01", state)
    assert seed_resp["positive"] is True
    seed = _bytes(seed_resp["responseHex"])[2:6]
    assert len(seed) == 4

    key = [s ^ k for s, k in zip(seed, _XOR_KEY)]
    key_cmd = "27 02 " + " ".join(f"{b:02X}" for b in key)
    key_resp = process_uds(key_cmd, state)
    assert key_resp["positive"] is True
    assert state.ecu.security_unlocked is True

    # Now WriteDID AEB_Sensitivity = HIGH (0x03)
    w = process_uds("2E 02 03 03", state)
    assert w["positive"] is True
    assert state.ecu.aeb_sensitivity == 3
    assert w["responseHex"] == "6E 02 03"


def test_security_access_wrong_key_is_rejected():
    state = create_initial_state()
    process_uds("10 03", state)
    process_uds("27 01", state)
    r = process_uds("27 02 00 00 00 00", state)
    assert r["positive"] is False
    assert r["responseHex"] == "7F 27 35"  # invalidKey
    assert state.ecu.security_unlocked is False


def test_write_did_without_security_denied():
    state = create_initial_state()
    process_uds("10 03", state)  # extended but not unlocked
    r = process_uds("2E 02 03 03", state)
    assert r["positive"] is False
    assert r["responseHex"] == "7F 2E 33"  # securityAccessDenied


def test_read_did_vehicle_speed():
    state = create_initial_state()
    state.vehicle.speed = 65.0
    r = process_uds("22 F1 90", state)
    assert r["positive"] is True
    assert r["responseHex"].startswith("62 F1 90")
    # 65.0 km/h * 100 = 6500 = 0x1964
    assert _bytes(r["responseHex"])[3:5] == [0x19, 0x64]


def test_read_did_unsupported():
    state = create_initial_state()
    r = process_uds("22 AB CD", state)
    assert r["positive"] is False
    assert r["responseHex"] == "7F 22 31"  # requestOutOfRange


def test_read_dtc_by_status_mask_lists_active():
    state = create_initial_state()
    add_dtc(state, code="B1001", description="Forward Radar Sensor Fault",
            severity="critical", status="active", byte_code=[0x02, 0x10, 0x01])
    r = process_uds("19 02 FF", state)
    assert r["positive"] is True
    assert r["responseHex"].startswith("59 02 FF")
    assert "B1001" in r["interpretation"]
    # 02 10 01 (DTC) + 08 (confirmed status) appended
    assert _bytes(r["responseHex"])[3:7] == [0x02, 0x10, 0x01, 0x08]


def test_clear_dtcs_removes_all():
    state = create_initial_state()
    add_dtc(state, code="P1001", description="AEB", severity="warning",
            status="active", byte_code=[0x01, 0x10, 0x01])
    assert len(state.dtcs) == 1
    r = process_uds("14 FF FF FF", state)
    assert r["positive"] is True
    assert r["responseHex"] == "54"
    assert state.dtcs == []


def test_ecu_reset_clears_security():
    state = create_initial_state()
    state.ecu.session = "extended"
    state.ecu.security_unlocked = True
    r = process_uds("11 01", state)
    assert r["positive"] is True
    assert r["responseHex"] == "51 01"
    assert state.ecu.session == "default"
    assert state.ecu.security_unlocked is False
