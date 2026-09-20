@echo off
REM Double-click this file to run the Codex image-generation smoke test.
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0smoke-test.ps1"
