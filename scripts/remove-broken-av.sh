#!/bin/bash

# Remove broken Windows-specific av module from whisper folder on Mac
# This allows Python to use the properly installed av from site-packages

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WHISPER_PATH="$HOME/AppData/Roaming/whispra/models/whisper"

if [ -d "$WHISPER_PATH/av" ]; then
    echo "🗑️  Removing broken av module from whisper folder..."
    rm -rf "$WHISPER_PATH/av"
    echo "✅ Removed: $WHISPER_PATH/av"
    echo "💡 Python will now use av from macpython/lib/python3.10/site-packages/"
else
    echo "ℹ️  No av module found in whisper folder"
fi

