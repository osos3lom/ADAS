#!/usr/bin/env bash
# Build the ros2_ws workspace with build/install dirs on Linux native FS.
# Source stays on /mnt/c (Windows), artifacts go to /home/osos/ (ext4).
# This avoids CMake configure_file "Operation not permitted" on NTFS under WSL2.
#
# Usage (from WSL2):
#   bash /mnt/c/Users/Asus/Documents/GitHub/ADAS/scripts/build_ws.sh
#   # Then source the result:
#   source /mnt/c/Users/Asus/Documents/GitHub/ADAS/scripts/wsl_env.sh
set -eo pipefail

SRC="/mnt/c/Users/Asus/Documents/GitHub/ADAS/ros2_ws"
BUILD="/home/osos/adas_build"
INSTALL="/home/osos/adas_install"

echo "=== Sourcing ROS2 Humble ==="
set +u && source /opt/ros/humble/setup.bash && set -u || true

echo "=== Building ros2_ws (src: $SRC, build: $BUILD, install: $INSTALL) ==="
cd "$SRC"
colcon build \
    --symlink-install \
    --build-base  "$BUILD" \
    --install-base "$INSTALL" \
    2>&1

echo ""
echo "=== Build complete. To use: ==="
echo "    source /mnt/c/Users/Asus/Documents/GitHub/ADAS/scripts/wsl_env.sh"
