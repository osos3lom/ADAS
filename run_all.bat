@echo off
rem ADAS full restart — kills old ROS2 nodes, relaunches bridge + stack, runs diagnostics
wsl.exe -d Ubuntu-22.04 -- bash /mnt/c/Users/Asus/Documents/GitHub/ADAS/scripts/run_all.sh
