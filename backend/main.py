"""
ADAS-ECU Backend — FastAPI Application
=======================================
Entry point for the Python simulation backend.

Architecture
------------
  ┌─────────────────────────────────────────────────────────────┐
  │  FastAPI (uvicorn ASGI)                                     │
  │                                                             │
  │  REST   /api/sim/*  ←── Next.js frontend (proxy via        │
  │  WS     /ws         ←── optional direct WebSocket clients  │
  │  GET    /he…(truncated)