"""
ISO 14229 (UDS) Server
======================
The backend's UDS diagnostic engine. It takes a raw hex request string, runs
the ISO 14229 service logic against the live :class:`SimulationState`, and
returns a structured result that the dashboard renders in its UDS Console.

Ported from ``frontend/lib/uds-processor.ts``.

Package layout
--------------
    constants.py   Service-ID / NRC / DID lookup tables + the ``to_hex`` helper.
    services.py    One handler per UDS service (0x10, 0x11, 0x14, 0x19,
                   0x22, 0x27, 0x2E). Each mutates the simulation state and
                   returns a partial result dict.
    processor.py   ``process_uds()`` — parses bytes, dispatches to a handler,
                   logs the REQ/RES pair, and emits the observer event.

Where this connects to the frontend
------------------------------------
The dashboard talks to this engine over a single POST endpoint. End to end:

    components/uds-console.tsx          user types "22 F1 90", clicks Send
        |  fetch POST /api/sim/uds  { command }
        v
    app/api/sim/uds/route.ts            Next.js route handler
        |  backendEnabled() ? proxyJSON('/api/sim/uds')      (lib/backend.ts)
        |  (no BACKEND_URL -> falls back to the in-process TS mock in
        |   lib/uds-processor.ts, which this package was ported from)
        v
    POST {BACKEND_URL}/api/sim/uds
        v
    api/routes.py :: send_uds()         FastAPI route, mounted under /api/sim
        |  process_uds(command, state)
        v
    uds/processor.py :: process_uds()   <-- THIS PACKAGE
        |  returns a UDSCommandResult (camelCase JSON)
        v
    ...back up the chain, rendered as REQ -> / RES <- lines in the console.

The returned dict matches the ``UDSCommandResult`` TypeScript type
(``frontend/types/index.ts``: requestHex, responseHex, serviceName, positive,
interpretation, timestamp) field-for-field, so the proxy passes it through
verbatim with no transformation.
"""
