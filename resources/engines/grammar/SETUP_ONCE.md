# Java Runtime Setup (One-Time)

## Quick Setup

Run this **once** to download and embed Java 17 runtime:

```bash
npm run setup:java-runtime
```

This will:
1. Download JDK 17 (~150MB)
2. Create minimal runtime (~50MB) 
3. Place it in `resources/engines/grammar/runtime/`

## Commit to Repository

After running the setup, **commit the runtime folder**:

```bash
git add resources/engines/grammar/runtime/
git commit -m "Add embedded Java 17 runtime for LanguageTool"
```

## Result

After committing, the Java runtime is **embedded in your source code** - just like WASAPI and Python. Everyone who clones the repo will have it automatically, no downloads needed.

## File Structure

```
resources/engines/grammar/
├── grammar-core.jar (or grammer-core.jar)
├── runtime/              ← Commit this folder
│   ├── bin/
│   │   └── java.exe
│   └── ...
├── boot.bat
└── boot.sh
```

## Size

- Runtime folder: ~50MB
- This is acceptable for source control (similar to Python folder)

## .gitignore

The runtime folder is **NOT** in .gitignore, so it will be committed. Only temporary setup files (`temp-jdk-setup/`) are ignored.

