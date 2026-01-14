# Automatic Java 17 Runtime Setup

This script automatically downloads Java 17 JDK and creates a minimal runtime (~50MB) for LanguageTool.

## Usage

### Automatic (during npm install)

The script runs automatically during `npm install` if the runtime doesn't exist. You can skip it by setting:

```bash
SKIP_JAVA_SETUP=true npm install
```

### Manual

Run manually anytime:

```bash
npm run setup:java-runtime
```

## What it does

1. **Downloads JDK 17** (~150MB) from Adoptium
2. **Extracts** the JDK to a temporary directory
3. **Creates minimal runtime** using `jlink` (~50MB)
4. **Cleans up** temporary files
5. **Verifies** the runtime works

## Requirements

- Internet connection (for download)
- PowerShell (Windows) or tar (macOS/Linux) for extraction
- ~200MB free disk space (temporary, cleaned up after)

## Output

The minimal runtime will be created at:
```
resources/engines/grammar/runtime/
```

This runtime includes only:
- `java.base` - Core Java
- `java.logging` - Logging support  
- `java.xml` - XML processing
- `java.net.http` - HTTP client

## Troubleshooting

### Download fails
- Check internet connection
- Try running manually: `npm run setup:java-runtime`

### Extraction fails
- Windows: Ensure PowerShell is available
- macOS/Linux: Ensure `tar` command is available

### jlink fails
- The downloaded JDK might be corrupted, try running again
- Check disk space availability

