# Phase 1 Setup Runbook — Hybrid CARLA (Windows) + ROS2 (WSL2)

Copy-paste bring-up for **this machine** (Windows 11 + RTX 2080 Ti, WSL2 enabled). Each
step has a **gate** — verify it before moving on. Roadmap context: [PLAN.md](PLAN.md).

Conventions: `PS>` = Windows PowerShell, `$` = inside WSL2 Ubuntu.

---

## 0. D: layout (free C: before the big downloads)

```powershell
PS> New-Item -ItemType Directory -Force D:\adas\CARLA_0.9.15, D:\adas\wsl, `
        D:\adas\pgdata, D:\adas\recordings, D:\adas\maps
```

| Folder | Holds |
|---|---|
| `D:\adas\CARLA_0.9.15` | CARLA server + AdditionalMaps |
| `D:\adas\wsl` | Ubuntu-22.04 vhdx (moved off C:) |
| `D:\adas\pgdata` | Postgres data volume |
| `D:\adas\recordings` | `ros2 bag` captures (Phase 5) |
| `D:\adas\maps` | extra CARLA assets |

---

## 1. WSL2 networking config

Create `%USERPROFILE%\.wslconfig` (so WSL can reach the Windows CARLA server at
`localhost:2000`):

```ini
[wsl2]
networkingMode=mirrored
memory=16GB
processors=12
swap=8GB
```

```powershell
PS> wsl --shutdown          # apply .wslconfig
```

**Gate:** `wsl --version` ≥ 2.0 (yours is 2.6.3 ✓). Mirrored networking needs ≥ 2.0.

---

## 2. Install Ubuntu 22.04 and move it to D:

```powershell
PS> wsl --install -d Ubuntu-22.04        # create your UNIX user when prompted
PS> wsl -l -v                            # confirm Ubuntu-22.04, VERSION 2
```

Relocate the distro disk off C: onto D::

```powershell
PS> wsl --shutdown
PS> wsl --export Ubuntu-22.04 D:\adas\ubuntu2204.tar
PS> wsl --unregister Ubuntu-22.04
PS> wsl --import Ubuntu-22.04 D:\adas\wsl D:\adas\ubuntu2204.tar --version 2
PS> Remove-Item D:\adas\ubuntu2204.tar
# default user resets to root after import — set it back:
PS> ubuntu2204 config --default-user <your-user>   # if the launcher exists; else edit /etc/wsl.conf
```

If the `ubuntu2204` launcher isn't present, set the default user inside WSL via
`/etc/wsl.conf`:

```bash
$ printf '[user]\ndefault=%s\n' "$USER" | sudo tee -a /etc/wsl.conf
```

**Gate:** `wsl -l -v` shows `Ubuntu-22.04` running v2; the vhdx exists at
`D:\adas\wsl\ext4.vhdx`; `whoami` in WSL is your user, not root.

---

## 3. ROS2 Humble (inside WSL2 Ubuntu)

```bash
$ sudo apt update && sudo apt install -y locales curl gnupg lsb-release software-properties-common
$ sudo locale-gen en_US en_US.UTF-8 && sudo update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
$ sudo add-apt-repository -y universe
$ sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key \
      -o /usr/share/keyrings/ros-archive-keyring.gpg
$ echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] \
http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" \
      | sudo tee /etc/apt/sources.list.d/ros2.list
$ sudo apt update && sudo apt install -y ros-humble-desktop ros-dev-tools
$ echo 'source /opt/ros/humble/setup.bash' >> ~/.bashrc && source ~/.bashrc
$ sudo rosdep init && rosdep update
```

**Gate (two terminals):**
```bash
$ ros2 run demo_nodes_cpp talker      # terminal A
$ ros2 run demo_nodes_py listener     # terminal B  → prints "I heard: ..."
$ ros2 doctor                          # no critical warnings
```

---

## 4. CARLA 0.9.15 (native on Windows)

1. Download `CARLA_0.9.15.zip` (and optionally `AdditionalMaps_0.9.15.zip`) from the
   CARLA GitHub releases.
2. Extract to `D:\adas\CARLA_0.9.15` (drop AdditionalMaps into the same tree if used).
3. Launch the server:

```powershell
PS> D:\adas\CARLA_0.9.15\CarlaUE4.exe -quality-level=Low -carla-rpc-port=2000
```

**Gate:** a CARLA window renders; the RPC port is listening:
```powershell
PS> Test-NetConnection localhost -Port 2000      # TcpTestSucceeded : True
```

---

## 5. Cross-boundary smoke test (WSL client → Windows CARLA)

⚠ **Version match:** the `carla` Python wheel must match your WSL Python. Ubuntu 22.04 ships
Python 3.10; CARLA 0.9.15 publishes wheels for 3.7/3.8/3.10. Verify before relying on it:

```bash
$ python3 --version
$ python3 -m pip install --user carla==0.9.15   # if no 3.10 wheel resolves, see fallback
$ python3 - <<'PY'
import carla
c = carla.Client("localhost", 2000); c.set_timeout(10.0)
print("CARLA map:", c.get_world().get_map().name)
PY
```

**Fallback if no 3.10 wheel:** install `pyenv`, build Python 3.8, `pip install carla==0.9.15`
in that venv; or use the `.egg` shipped under
`D:\adas\CARLA_0.9.15\PythonAPI\carla\dist` (add it to `PYTHONPATH`).

**Gate:** the script prints the map name (e.g. `Town10HD_Opt`) — proves the WSL↔Windows
TCP bridge works.

---

## 6. ros2_ws + carla-ros-bridge

```bash
$ mkdir -p ~/ros2_ws/src && cd ~/ros2_ws/src
$ git clone --recurse-submodules https://github.com/carla-simulator/ros-bridge.git
$ cd ros-bridge && git checkout <0.9.15-compatible-ref> && cd ~/ros2_ws
$ rosdep install --from-paths src --ignore-src -r -y
$ colcon build --symlink-install
$ source install/setup.bash
# CARLA must be running on Windows (step 4):
$ ros2 launch carla_ros_bridge carla_ros_bridge_with_example_ego_vehicle.launch.py \
      host:=localhost port:=2000
```

**Gate:**
```bash
$ ros2 topic list | grep /carla            # /carla/ego_vehicle/* present
$ ros2 topic echo /carla/ego_vehicle/odometry   # streams while CARLA renders on Windows
```

> The repo's `ros2_ws/` keeps only source; `build/`, `install/`, `log/` are git-ignored.

---

## 7. Database (PostgreSQL on D:)

The backend persists DTCs/logs/UDS-audit/runs to Postgres. The data volume lives on D:.

```powershell
PS> cd C:\Users\Asus\Documents\GitHub\ADAS
PS> Copy-Item backend\.env.example backend\.env        # adjust if needed
PS> docker compose up --build db backend
```

**Gate:**
```powershell
PS> curl http://localhost:8000/health                  # {"status":"ok",...}
PS> curl http://localhost:8000/api/system/status       # db: "connected"
# inject a fault, then read it back from the DB-backed history:
PS> curl -X POST http://localhost:8000/api/sim/inject-fault -H "Content-Type: application/json" -d '{\"code\":\"B1002\"}'
PS> curl http://localhost:8000/api/history/dtcs         # contains B1002
```

Postgres data is persisted under `D:\adas\pgdata` (survives `docker compose down`; remove
that folder to reset).

---

## Quick reference — daily startup

```powershell
PS> D:\adas\CARLA_0.9.15\CarlaUE4.exe -quality-level=Low      # 1. CARLA (Windows)
PS> docker compose up db backend frontend                    # 2. backend+db+dashboard
```
```bash
$ cd ~/ros2_ws && source install/setup.bash                  # 3. ROS2 (WSL2)
$ ros2 launch carla_ros_bridge carla_ros_bridge_with_example_ego_vehicle.launch.py host:=localhost port:=2000
```
Dashboard → http://localhost:3000 (Control Center shows each service's health).

## Troubleshooting
- **WSL can't reach `localhost:2000`** → confirm `networkingMode=mirrored` in `.wslconfig`
  and `wsl --shutdown`; otherwise target the Windows host IP from `ip route | grep default`.
- **`colcon build` fails on a package** → re-run `rosdep install`; check the ros-bridge ref
  matches CARLA 0.9.15.
- **Postgres volume not mounting** → in Docker Desktop, ensure drive **D:** is shared
  (Settings → Resources → File sharing).
- **C: filling up** → the WSL vhdx must be under `D:\adas\wsl` (step 2), not the default
  `%LOCALAPPDATA%`.
