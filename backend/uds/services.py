"""
ISO 14229 Service Handlers
==========================
One handler per UDS service.  Each returns a partial result dict with the keys
``responseHex``, ``serviceName``, ``positive`` and ``interpretation`` (the
``requestHex`` / ``timestamp`` fields are filled in by :mod:`uds.processor`).

Services implemented:
  0x10  DiagnosticSessionControl
  0x11  ECUReset
  0x14  ClearDiagnosticInformation
  0x19  ReadDTCInformation
  0x22  ReadDataByIdentifier
  0x27  SecurityAccess
  0x2E  WriteDataByIdentifier

Ported 1-to-1 from ``frontend/lib/uds-processor.ts``.  The security-access
key algorithm is intentionally identical: ``key = seed XOR 0xCAFEBABE``.
"""
from __future__ import annotations

import secrets
from typing import Dict, List

from simulation.state import SimulationState, add_log
from uds.constants import DID_NAMES, NRC_NAMES, SERVICE_NAMES, to_hex

Result = Dict[str, object]

_XOR_KEY = [0xCA, 0xFE, 0xBA, 0xBE]


def negative_response(svc_id: int, nrc: int, note: str) -> Result:
    return {
        "responseHex": to_hex([0x7F, svc_id, nrc]),
        "serviceName": SERVICE_NAMES.get(svc_id, f"Service_0x{svc_id:X}"),
        "positive": False,
        "interpretation": f"NRC 0x{nrc:X} — {NRC_NAMES.get(nrc, 'unknown')}: {note}",
    }


# ── 0x10 DiagnosticSessionControl ─────────────────────────────────────────────

def handle_session(req: List[int], state: SimulationState) -> Result:
    sub = req[1] if len(req) > 1 else None
    session_map = {0x01: "default", 0x03: "extended", 0x02: "programming"}
    session_label = {
        0x01: "DefaultSession",
        0x03: "ExtendedDiagnosticSession",
        0x02: "ProgrammingSession",
    }

    if sub not in session_map:
        return negative_response(0x10, 0x12, "SubFunction not supported")
    if sub == 0x02 and not state.ecu.security_unlocked:
        return negative_response(0x10, 0x22, "SecurityAccess required for ProgrammingSession")

    state.ecu.session = session_map[sub]
    return {
        "responseHex": to_hex([0x50, sub, 0x00, 0x19, 0x01, 0xF4]),
        "serviceName": "DiagnosticSessionControl",
        "positive": True,
        "interpretation": f"Session changed to {session_label[sub]} (P2=25ms, P2*=500ms)",
    }


# ── 0x11 ECUReset ─────────────────────────────────────────────────────────────

def handle_reset(req: List[int], state: SimulationState) -> Result:
    sub = req[1] if len(req) > 1 else None
    types = {0x01: "HardReset", 0x02: "KeyOffOnReset", 0x03: "SoftReset"}
    if sub not in types:
        return negative_response(0x11, 0x12, "Unknown reset type")

    state.ecu.session = "default"
    state.ecu.security_unlocked = False
    state.ecu.pending_seed = []
    add_log(state, "warn", "ECU", f"ECU {types[sub]} executed — session reset")

    return {
        "responseHex": to_hex([0x51, sub]),
        "serviceName": "ECUReset",
        "positive": True,
        "interpretation": f"{types[sub]} acknowledged. ECU rebooting...",
    }


# ── 0x14 ClearDiagnosticInformation ───────────────────────────────────────────

def handle_clear_dtc(req: List[int], state: SimulationState) -> Result:
    if len(req) < 4:
        return negative_response(0x14, 0x13, "Need 3-byte groupOfDTC")
    group = to_hex(req[1:4])

    if group == "FF FF FF":
        count = len(state.dtcs)
        state.dtcs = []
        add_log(state, "info", "ECU", f"ClearDTC: All {count} DTCs cleared")
        return {
            "responseHex": to_hex([0x54]),
            "serviceName": "ClearDiagnosticInformation",
            "positive": True,
            "interpretation": f"All DTCs cleared ({count} removed). Group: 0xFFFFFF",
        }

    return {
        "responseHex": to_hex([0x54]),
        "serviceName": "ClearDiagnosticInformation",
        "positive": True,
        "interpretation": f"DTC group 0x{group.replace(' ', '')} cleared",
    }


# ── 0x19 ReadDTCInformation ───────────────────────────────────────────────────

def handle_read_dtc(req: List[int], state: SimulationState) -> Result:
    sub = req[1] if len(req) > 1 else None

    if sub == 0x02:
        # reportDTCByStatusMask
        mask = req[2] if len(req) > 2 else 0xFF
        active = [d for d in state.dtcs if d.status in ("active", "pending")]
        response_bytes = [0x59, 0x02, mask]
        for dtc in active:
            response_bytes.extend([*dtc.byte_code, 0x08])  # 0x08 = confirmedDTC
        codes = ", ".join(d.code for d in active) or "none"
        return {
            "responseHex": to_hex(response_bytes),
            "serviceName": "ReadDTCInformation",
            "positive": True,
            "interpretation": f"{len(active)} DTC(s) found: {codes}",
        }

    if sub == 0x0A:
        # reportSupportedDTC
        response_bytes = [0x59, 0x0A, 0xFF]
        for dtc in state.dtcs:
            response_bytes.extend([*dtc.byte_code, 0x08 if dtc.status == "active" else 0x00])
        listing = ", ".join(f"{d.code}[{d.status}]" for d in state.dtcs) or "none"
        return {
            "responseHex": to_hex(response_bytes),
            "serviceName": "ReadDTCInformation",
            "positive": True,
            "interpretation": f"All stored DTCs ({len(state.dtcs)}): {listing}",
        }

    return negative_response(0x19, 0x12, "SubFunction not supported (use 02 or 0A)")


# ── 0x22 ReadDataByIdentifier ─────────────────────────────────────────────────

def handle_read_did(req: List[int], state: SimulationState) -> Result:
    if len(req) < 3:
        return negative_response(0x22, 0x13, "Need 2-byte DID")
    did = (req[1] << 8) | req[2]
    did_name = DID_NAMES.get(did, f"DID_0x{did:04X}")

    response_bytes = [0x62, req[1], req[2]]
    interp = ""

    # Each physical value is encoded as a fixed-point big-endian integer so it
    # survives the byte transport, then decoded by the client. The scaling
    # factor below is per-DID and must match the frontend's reader exactly:
    #   speed / TTC / lane-offset -> x100   (0.01 resolution)
    #   target distance / speed    -> x10    (0.1  resolution)
    #   modes / statuses / counts  -> single enum byte
    v = state.vehicle
    a = state.adas
    ecu = state.ecu

    if did == 0xF190:
        raw = round(v.speed * 100)
        response_bytes.extend([(raw >> 8) & 0xFF, raw & 0xFF])
        interp = f"{did_name} = {v.speed:.1f} km/h (raw: 0x{raw:X})"
    elif did == 0xF18C:
        serial = ecu.ecu_serial_number
        for ch in serial[:20]:
            response_bytes.append(ord(ch))
        interp = f'{did_name} = "{serial}"'
    elif did == 0xF197:
        response_bytes.extend([0x41, 0x44, 0x41, 0x53, 0x5F, 0x32, 0x2E, 0x34, 0x2E, 0x31])
        interp = f'{did_name} = "ADAS_2.4.1"'
    elif did == 0x0200:
        response_bytes.append(ecu.adas_mode)
        interp = f"{did_name} = 0x{ecu.adas_mode:X} ({'ACTIVE' if ecu.adas_mode else 'OFF'})"
    elif did == 0x0201:
        aeb_map = {"standby": 0x01, "warning": 0x02, "active": 0x03, "fault": 0xFF}
        val = aeb_map.get(a.aeb_status, 0x00)
        response_bytes.append(val)
        interp = f"{did_name} = 0x{val:X} ({a.aeb_status.upper()})"
    elif did == 0x0202:
        ldw_map = {"inactive": 0x00, "left": 0x01, "right": 0x02}
        val = ldw_map.get(a.ldw_status, 0x00)
        response_bytes.append(val)
        interp = f"{did_name} = 0x{val:X} ({a.ldw_status.upper()})"
    elif did == 0x0203:
        response_bytes.append(ecu.aeb_sensitivity)
        sens_map = {1: "LOW", 2: "MEDIUM", 3: "HIGH"}
        interp = f"{did_name} = 0x{ecu.aeb_sensitivity:X} ({sens_map.get(ecu.aeb_sensitivity, 'UNKNOWN')})"
    elif did == 0x0204:
        raw = min(9999, round(a.ttc * 100))
        response_bytes.extend([(raw >> 8) & 0xFF, raw & 0xFF])
        interp = f"{did_name} = {a.ttc:.2f}s (raw: 0x{raw:X})"
    elif did == 0x0205:
        raw = round(v.lane_offset * 100) & 0xFFFF
        response_bytes.extend([(raw >> 8) & 0xFF, raw & 0xFF])
        interp = f"{did_name} = {v.lane_offset:.2f}m (raw: 0x{raw:X})"
    elif did == 0x0206:
        raw = round(a.target_distance * 10)
        response_bytes.extend([(raw >> 8) & 0xFF, raw & 0xFF])
        interp = f"{did_name} = {a.target_distance:.1f}m (raw: 0x{raw:X})"
    elif did == 0x0207:
        raw = round(a.target_speed * 10)
        response_bytes.extend([(raw >> 8) & 0xFF, raw & 0xFF])
        interp = f"{did_name} = {a.target_speed:.1f} km/h"
    elif did == 0x0210:
        active = len([d for d in state.dtcs if d.status == "active"])
        response_bytes.append(active & 0xFF)
        interp = f"{did_name} = {active} active DTC(s)"
    else:
        return negative_response(0x22, 0x31, f"DID 0x{did:04X} not supported")

    return {
        "responseHex": to_hex(response_bytes),
        "serviceName": "ReadDataByIdentifier",
        "positive": True,
        "interpretation": interp,
    }


# ── 0x27 SecurityAccess ───────────────────────────────────────────────────────
#
# Two-step seed/key challenge (the console hint surfaces this flow):
#   1. 27 01            -> ECU replies 67 01 <4-byte random seed>
#   2. 27 02 <4 bytes>  -> client must send key = seed XOR 0xCAFEBABE
# A correct key flips ``ecu.security_unlocked`` so 0x2E writes are allowed.
# The XOR is a deliberately trivial *demo* algorithm — real ECUs use a secret
# seed/key function. Requires an Extended session (10 03) first.

def handle_security_access(req: List[int], state: SimulationState) -> Result:
    sub = req[1] if len(req) > 1 else None

    if sub == 0x01:
        # Seed request
        if state.ecu.session == "default":
            return negative_response(0x27, 0x22, "Not in ExtendedDiagnosticSession")
        seed = [secrets.randbelow(256) for _ in range(4)]
        state.ecu.pending_seed = seed
        seed_hex = "".join(f"{b:02x}" for b in seed)
        return {
            "responseHex": to_hex([0x67, 0x01, *seed]),
            "serviceName": "SecurityAccess",
            "positive": True,
            "interpretation": f"Seed issued: 0x{seed_hex}. Send key = seed XOR 0xCAFEBABE",
        }

    if sub == 0x02:
        # Key response
        if not state.ecu.pending_seed:
            return negative_response(0x27, 0x24, "No pending seed — request seed first (0x27 0x01)")
        client_key = req[2:6]
        expected_key = [b ^ _XOR_KEY[i] for i, b in enumerate(state.ecu.pending_seed)]
        match = len(client_key) == 4 and all(client_key[i] == expected_key[i] for i in range(4))
        expected_hex = "".join(f"{b:02x}" for b in expected_key)

        if not match:
            state.ecu.pending_seed = []
            add_log(state, "warn", "UDS", f"SecurityAccess DENIED — invalid key (expected 0x{expected_hex})")
            return negative_response(0x27, 0x35, f"Invalid key. Expected: 0x{expected_hex}")

        state.ecu.security_unlocked = True
        state.ecu.pending_seed = []
        add_log(state, "info", "ECU", "SecurityAccess GRANTED — Level 1 unlocked")
        return {
            "responseHex": to_hex([0x67, 0x02]),
            "serviceName": "SecurityAccess",
            "positive": True,
            "interpretation": "Access GRANTED. Security level 1 unlocked. WriteDID now available.",
        }

    return negative_response(0x27, 0x12, "SubFunction must be 0x01 (seedReq) or 0x02 (keyResp)")


# ── 0x2E WriteDataByIdentifier ────────────────────────────────────────────────

def handle_write_did(req: List[int], state: SimulationState) -> Result:
    if not state.ecu.security_unlocked:
        return negative_response(0x2E, 0x33, "SecurityAccess required before WriteDataByIdentifier")
    if len(req) < 4:
        return negative_response(0x2E, 0x13, "Need DID (2 bytes) + data (1+ bytes)")

    did = (req[1] << 8) | req[2]
    data = req[3:]
    did_name = DID_NAMES.get(did, f"DID_0x{did:04X}")

    if did == 0x0203:
        # AEB Sensitivity
        val = data[0]
        if val < 1 or val > 3:
            return negative_response(0x2E, 0x31, "AEB_Sensitivity must be 0x01 (Low) / 0x02 (Med) / 0x03 (High)")
        sens_map = {1: "LOW", 2: "MEDIUM", 3: "HIGH"}
        state.ecu.aeb_sensitivity = val
        add_log(state, "info", "ECU", f"WriteDID: AEB_Sensitivity updated to {sens_map[val]} (0x{val:X})")
        return {
            "responseHex": to_hex([0x6E, req[1], req[2]]),
            "serviceName": "WriteDataByIdentifier",
            "positive": True,
            "interpretation": f"{did_name} written: 0x{val:X} ({sens_map[val]})",
        }

    if did == 0x0200:
        # ADAS Mode
        val = data[0] & 0x01
        state.ecu.adas_mode = val
        add_log(state, "info", "ECU", f"WriteDID: ADAS_Mode set to {'ACTIVE' if val else 'OFF'}")
        return {
            "responseHex": to_hex([0x6E, req[1], req[2]]),
            "serviceName": "WriteDataByIdentifier",
            "positive": True,
            "interpretation": f"{did_name} written: 0x{val:X} (ADAS {'ACTIVE' if val else 'OFF'})",
        }

    return negative_response(0x2E, 0x31, f"DID 0x{did:04X} is read-only or not supported for write")
