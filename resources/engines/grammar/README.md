# Grammar Engine Resources

This directory contains the LanguageTool grammar checking engine bundled with a minimal JRE.

## Structure

- `grammar-core.jar` or `grammer-core.jar` - LanguageTool server JAR file (to be added)
- `libs/` - Dependency jars (copy the `lib/` folder from the official LanguageTool download)
- `runtime/` - Minimal JRE runtime created with jlink (to be added)
- `boot.bat` - Windows launcher script
- `boot.sh` - macOS/Linux launcher script
- `setup-jre.ps1` - PowerShell script to automatically create minimal JRE
- `SETUP_JRE.md` - Detailed setup instructions

## Quick Setup

### 1. Add LanguageTool JAR and Language Modules

**Option A: Automated Setup (Recommended if you have Maven)**

If you have Maven installed, run:
```bash
npm run setup:languagetool
```

This script will automatically download LanguageTool server and all language modules from Maven Central.

**Option B: Manual Setup**

If you don't have Maven, you have two options:

**B1. Build from Source**

1. Clone LanguageTool repository:
   ```bash
   git clone https://github.com/languagetool-org/languagetool.git
   cd languagetool
   ```

2. Build LanguageTool:
   ```bash
   mvn clean package -DskipTests
   ```

3. Copy files:
   - Copy `languagetool-server/target/languagetool-server-*.jar` to `resources/engines/grammar/grammar-core.jar`
   - Copy all JARs from `languagetool-server/target/lib/` to `resources/engines/grammar/libs/`
   - Copy all language module JARs from `languagetool-language-*/target/` to `resources/engines/grammar/libs/`

**B2. Download Pre-built Release**

Download the **full LanguageTool release** from https://github.com/languagetool-org/languagetool/releases. Note: Some releases may not include a `lib/` folder. If that's the case, use Option A or B1.

If the release includes a `lib/` folder:
1. **Server JAR**: Rename `LanguageTool-*/languageTool-server.jar` (or `languagetool-server.jar`) to `grammar-core.jar` (or `grammer-core.jar`).
2. **Dependencies AND Language Modules**: Copy the entire `LanguageTool-*/lib/` directory into `resources/engines/grammar/libs/` so that **all** JARs are available, including:
   - Dependency JARs (slf4j, logback, etc.)
   - **Language module JARs** (`languagetool-language-es-*.jar`, `languagetool-language-en-*.jar`, etc.) - **These are REQUIRED!**

   **Important**: The language module JARs contain `META-INF/org/languagetool/language-module.properties` files that LanguageTool needs to recognize languages.

### 2. Create Minimal JRE

**Option A: Use the automated script (Recommended)**

```powershell
# Run as Administrator
.\setup-jre.ps1
```

The script will automatically find JDK 17 and create the minimal runtime.

**Option B: Manual setup**

See `SETUP_JRE.md` for detailed manual instructions.

### 3. Verify Setup

After setup, you should have:
- `grammar-core.jar` (or `grammer-core.jar`) - LanguageTool server
- `libs/*.jar` - **All** dependency jars AND language module jars from the LanguageTool `lib` folder
- `runtime/bin/java.exe` - Java runtime executable

**Verify language modules are present:**
```powershell
Get-ChildItem "resources\engines\grammar\libs" -Filter "languagetool-language-*.jar"
```

You should see multiple language module JARs (e.g., `languagetool-language-es-6.4.jar`, `languagetool-language-en-6.4.jar`, etc.).

## What is jlink?

`jlink` is a tool that comes with Java 9+ JDK that creates custom minimal JREs. Instead of bundling a full 200MB JRE, you can create a ~40-70MB runtime with only the modules needed for LanguageTool.

**You need JDK 17** (not just JRE) to run jlink. Download from:
- https://adoptium.net/temurin/releases/?version=17

## File Size

- Full JRE 17: ~200 MB
- Minimal JRE (jlink): ~40-70 MB
- **Savings: ~130-160 MB**

## Troubleshooting

### Error: "'es' is not a language code known to LanguageTool"

This means language module JARs are missing. Make sure you:
1. Downloaded the **full LanguageTool distribution** (not just the standalone server)
2. Copied **all** JARs from the `lib/` folder, including `languagetool-language-*.jar` files
3. The language module JARs are in `resources/engines/grammar/libs/`

### Error: "NoClassDefFoundError"

This means dependency JARs are missing. Make sure you copied the entire `lib/` folder from the LanguageTool distribution.

See `SETUP_JRE.md` for detailed troubleshooting steps.


