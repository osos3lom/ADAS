@echo off
echo Running Phase 2 gate test (2-3 minutes)...
wsl.exe -d Ubuntu-22.04 -- bash /mnt/c/Users/Asus/Documents/GitHub/ADAS/scripts/phase2_gate.sh
type C:\Users\Asus\Documents\GitHub\ADAS\phase2_gate_report.txt
pause
