# ── Python ADAS-ECU Backend ───────────────────────────────────────────────────
# Multi-stage: dependencies layer is cached separately from source code.
# Includes can-utils + iproute2 so vcan0 can be set up inside the container
# when CAN_INTERFACE=socketcan.

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System deps: SocketCAN tools + health-check curl
RUN apt-get update && apt-get instal…(truncated)