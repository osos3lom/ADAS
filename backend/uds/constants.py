"""
ISO 14229 (UDS) Constants
=========================
Service IDs, negative response codes, DID name map, and the ``to_hex`` helper.

Ported from ``frontend/lib/uds-processor.ts``.
"""
from __future__ import annotations

from typing import List

# ── UDS wire format (how these tables map onto the bytes) ─────────────────────
#   Request : [ SID, sub-function/data... ]            e.g. 22 F1 90
#   Positive: [ SID + 0x40, echoed-bytes, payload... ] e.g. 62 F1 90 ..   (0x22 -> 0x62)
#   Negative: [ 0x7F, SID, NRC ]                        e.g. 7F 22 31
# SERVICE_NAMES is keyed by the request SID; NRC_NAMES decodes the 3rd byte of a
# negative response; DID_NAMES decodes the 16-bit data identifier in 0x22/0x2E.

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

NRC_NAMES: dict[int, str] = {
    0x10: "generalReject",
    0x11: "serviceNotSupported",
    0x12: "subFunctionNotSupported",
    0x13: "incorrectMessageLength",
    0x22: "conditionsNotCorrect",
    0x24: "requestSequenceError",
    0x31: "requestOutOfRange",
    0x33: "securityAccessDenied",
    0x35: "invalidKey",
    0x36: "exceededNumberOfAttempts",
}

DID_NAMES: dict[int, str] = {
    0xF190: "VehicleSpeed",
    0xF18C: "ECUSerialNumber",
    0xF197: "SystemSupplierECUSoftwareNumber",
    0x0200: "ADAS_Mode",
    0x0201: "AEB_Status",
    0x0202: "LDW_Status",
    0x0203: "AEB_Sensitivity",
    0x0204: "TimeToCollision",
    0x0205: "LaneOffset",
    0x0206: "TargetDistance",
    0x0207: "TargetSpeed",
    0x0210: "ActiveDTCCount",
}


def to_hex(byte_list: List[int]) -> str:
    """Render a list of byte values as space-separated uppercase hex (``A0 1F``)."""
    return " ".join(f"{b & 0xFF:02X}" for b in byte_list)
