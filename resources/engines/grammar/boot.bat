@echo off
REM LanguageTool Server Launcher for Windows
REM This script launches the LanguageTool server silently in the background

cd /d "%~dp0"

REM Check if runtime exists
if not exist "runtime\bin\java.exe" (
    echo Error: Java runtime not found in runtime\bin\java.exe
    exit /b 1
)

REM Check if JAR exists
if not exist "grammar-core.jar" (
    echo Error: grammar-core.jar not found
    exit /b 1
)

REM Launch LanguageTool server silently
REM Using start with /B to run in background without new window
start "" /B "%~dp0runtime\bin\java.exe" -jar "%~dp0grammar-core.jar" --port 8081

exit /b 0

