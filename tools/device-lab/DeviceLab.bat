@echo off
cd /d "%~dp0"
python -c "import playwright" 2>nul || (pip install playwright && python -m playwright install chromium webkit)
start "" pythonw gui.py
