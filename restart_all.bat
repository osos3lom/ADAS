@echo off
rem Full clean restart: CARLA + bridge + ADAS stack + diagnostics
echo [1/4] Killing frozen CARLA...
taskkill /F /IM CarlaUE4-Win64-Shipping.exe 2>nul
taskkill /F /IM CarlaUE4.exe 2>nul
timeout /t 8 /nobreak >nul

echo [2/4] Starting CARLA fresh...
start "" "D:\adas\CARLA_0.9.15\CarlaUE4.exe" -quality-level=Low
echo [3/4] Waiting 75s for CARLA to boot...
timeout /t 75 /nobreak >nul

echo [4/4] Restarting ROS2 bridge + ADAS stack + diagnostics...
wsl.exe -d Ubuntu-22.04 -- bash /mnt/c/Users/Asus/Documents/GitHub/ADAS/scripts/run_all.sh
echo Done — see diag_output.txt
