@echo off
wsl.exe -d Ubuntu-22.04 -- bash -c "source /mnt/c/Users/Asus/Documents/GitHub/ADAS/scripts/wsl_env.sh >/dev/null 2>&1; python3 /mnt/c/Users/Asus/Documents/GitHub/ADAS/scripts/follow_ego.py"
pause
