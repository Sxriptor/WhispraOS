#!/bin/bash
# LanguageTool Server Launcher for macOS/Linux
# This script launches the LanguageTool server silently in the background

cd "$(dirname "$0")"

# Check if runtime exists
if [ ! -f "runtime/bin/java" ]; then
    echo "Error: Java runtime not found in runtime/bin/java" >&2
    exit 1
fi

# Check if JAR exists
if [ ! -f "grammar-core.jar" ]; then
    echo "Error: grammar-core.jar not found" >&2
    exit 1
fi

# Launch LanguageTool server in background
# Redirect all output to /dev/null to run silently
nohup ./runtime/bin/java -jar grammar-core.jar --port 8081 > /dev/null 2>&1 &

exit 0

