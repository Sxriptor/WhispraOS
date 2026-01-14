# LanguageTool JRE Setup Guide

## What is jlink?

`jlink` is a tool that comes with Java 9+ that creates **custom minimal JREs** containing only the modules you need. Instead of bundling a full 200MB JRE, you can create a ~40-70MB runtime with just the essentials.

## Prerequisites

You need **Java 17 JDK** (not just JRE) installed. The JDK includes `jlink`.

### Check if you have JDK 17:

```powershell
# Check Java version
java -version

# Check if jlink exists (it's in the JDK bin folder)
jlink --version
```

If you don't have JDK 17, download it from:
- **Oracle JDK 17**: https://www.oracle.com/java/technologies/javase/jdk17-archive-downloads.html
- **OpenJDK 17**: https://adoptium.net/temurin/releases/?version=17

## Creating the Minimal JRE

### Step 1: Find your JDK installation

The JDK is usually installed at:
- `C:\Program Files\Java\jdk-17` (or similar)
- `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot` (if using Adoptium)

### Step 2: Run jlink command

Open PowerShell **as Administrator** and run:

```powershell
# Replace C:\Program Files\Java\jdk-17 with your actual JDK path
$JDK_PATH = "C:\Program Files\Java\jdk-17"
$OUTPUT_PATH = "resources\engines\grammar\runtime"

# Create the runtime directory if it doesn't exist
New-Item -ItemType Directory -Force -Path $OUTPUT_PATH | Out-Null

# Run jlink to create minimal JRE
& "$JDK_PATH\bin\jlink.exe" `
    --module-path "$JDK_PATH\jmods" `
    --add-modules java.base,java.logging,java.xml,java.net.http `
    --output $OUTPUT_PATH `
    --strip-debug `
    --compress=2 `
    --no-header-files `
    --no-man-pages

Write-Host "✅ Minimal JRE created at: $OUTPUT_PATH"
```

### Step 3: Verify the runtime

Check that `java.exe` exists:
```powershell
Test-Path "resources\engines\grammar\runtime\bin\java.exe"
```

## Alternative: Manual Setup Script

I've created a PowerShell script (`setup-jre.ps1`) that automates this process.

## What modules are included?

- `java.base` - Core Java classes (required)
- `java.logging` - Logging support (LanguageTool uses this)
- `java.xml` - XML processing (LanguageTool uses this)
- `java.net.http` - HTTP client (for LanguageTool server)

## File Size Comparison

- **Full JRE 17**: ~200 MB
- **Minimal JRE (jlink)**: ~40-70 MB
- **Savings**: ~130-160 MB

## Troubleshooting

### "jlink: command not found"
- Make sure you have JDK (not just JRE) installed
- Add JDK bin folder to your PATH, or use full path to jlink.exe

### "module not found" errors
- Make sure you're using JDK 17 or later
- Check that the jmods folder exists in your JDK installation

### "Access denied" errors
- Run PowerShell as Administrator
- Check folder permissions

