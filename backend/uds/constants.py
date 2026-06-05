"""
ISO 14229 (UDS) Constants
--------------------------
Service IDs, negative response codes, and DID name map.
"""

# ── Service IDs ───────────────────────────────────────────────────────────────

SERVICE_NAMES: dict[int, str] = {
    0x10: "DiagnosticSessionControl",
    0x11: "ECUReset",
    0x14: "ClearDiagnosticInformation",
    0x19: "ReadDTCInformation",
    0x22: "ReadDataByIdentifier",
    0x27: "SecurityAccess",
    0x2E: "WriteDataByIdentifier",
    0x31: "RoutineControl",
}

# ── N…(truncated)