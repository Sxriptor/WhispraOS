#!/bin/bash

# Force install numpy and PyAV (av) with FFmpeg support to macpython
# Run this from the project root directory

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Paths
FFMPEG_LIB="$PROJECT_ROOT/ffmpeg/mac/lib"
FFMPEG_INCLUDE="$PROJECT_ROOT/ffmpeg/mac/include"
FFMPEG_BIN="$PROJECT_ROOT/ffmpeg/mac/bin"
MACPYTHON_BIN="$PROJECT_ROOT/macpython/bin/python3"

# Check if macpython exists
if [ ! -f "$MACPYTHON_BIN" ]; then
    echo "❌ macpython not found at: $MACPYTHON_BIN"
    exit 1
fi

# Check if FFmpeg exists
if [ ! -d "$FFMPEG_LIB" ]; then
    echo "❌ FFmpeg libraries not found at: $FFMPEG_LIB"
    echo "💡 Run: npm run setup:ffmpeg-mac"
    exit 1
fi

echo "🐍 Using Python: $MACPYTHON_BIN"
echo "📦 FFmpeg libraries: $FFMPEG_LIB"
echo ""

# Set environment variables for PyAV build
export DYLD_LIBRARY_PATH="$FFMPEG_LIB${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"
export AV_CFLAGS="-I$FFMPEG_INCLUDE"
export AV_LDFLAGS="-L$FFMPEG_LIB"
export PATH="$FFMPEG_BIN:$PATH"

# Set PKG_CONFIG_PATH if pkgconfig exists
if [ -d "$FFMPEG_LIB/pkgconfig" ]; then
    export PKG_CONFIG_PATH="$FFMPEG_LIB/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
fi

echo "🔧 Environment variables:"
echo "   DYLD_LIBRARY_PATH=$DYLD_LIBRARY_PATH"
echo "   AV_CFLAGS=$AV_CFLAGS"
echo "   AV_LDFLAGS=$AV_LDFLAGS"
echo "   PKG_CONFIG_PATH=${PKG_CONFIG_PATH:-not set}"
echo ""

echo "📥 Installing required dependencies..."
echo ""

# Install numpy first (required dependency)
echo "  → Installing numpy..."
"$MACPYTHON_BIN" -m pip install --force-reinstall --no-cache-dir numpy

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ numpy installation failed"
    exit 1
fi

echo "  ✅ numpy installed"
echo ""

# Install tokenizers (required by faster-whisper)
echo "  → Installing tokenizers..."
"$MACPYTHON_BIN" -m pip install --force-reinstall --no-cache-dir tokenizers

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ tokenizers installation failed"
    exit 1
fi

echo "  ✅ tokenizers installed"
echo ""

# Install ctranslate2 (required by faster-whisper)
echo "  → Installing ctranslate2..."
"$MACPYTHON_BIN" -m pip install --force-reinstall --no-cache-dir ctranslate2

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ ctranslate2 installation failed"
    exit 1
fi

echo "  ✅ ctranslate2 installed"
echo ""

echo "📥 Installing PyAV (av) with FFmpeg support..."
echo "   This may take several minutes as it needs to compile the C extension..."
echo ""

# Force reinstall PyAV, building from source to use FFmpeg
"$MACPYTHON_BIN" -m pip install --force-reinstall --no-cache-dir --no-binary av av

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ PyAV installed successfully with FFmpeg support!"
    echo "📦 Installed to: macpython/lib/python3.10/site-packages/av/"
    echo ""
    echo "🎉 All dependencies installed successfully!"
else
    echo ""
    echo "❌ PyAV installation failed"
    exit 1
fi

