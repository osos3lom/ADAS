"""
ISO 14229 Service Handlers
---------------------------
One function per UDS service.  Each returns (response_bytes, interpretation_str).
Negative responses are also expressed as (bytes, str) where bytes[0] == 0x7F.

Services implemented:
  0x10  DiagnosticSessionControl
  0x11  ECUReset
  0x14  ClearDiagnosticInformation
  0x19  ReadDTCInformation
  0x22  ReadDataByIdentifier
  0x27  SecurityAccess
  0x2E  WriteDataByIdentifier
"""
from __future__ import annotations

import os
import random
…(truncated)