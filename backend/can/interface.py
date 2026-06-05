"""
CAN Bus Interface
-----------------
Wraps python-can so the rest of the codebase is interface-agnostic.

Env variables:
  CAN_INTERFACE  socketcan | virtual | kvaser | pcan  (default: virtual)
  CAN_CHANNEL    vcan0, can0, PCAN_USBBUS1, …         (default: vcan0)

For development without real hardware the "virtual" bus is used.
To test with a real SocketCAN adapter on Linux:
    sudo ip link add dev vcan0 type vcan
    sudo ip link set vcan0 up
    export CAN_INTERFACE=socketcan CAN_CHANNEL=…(truncated)