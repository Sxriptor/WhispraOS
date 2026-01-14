# LanguageTool JRE Setup Script
# Run this script as Administrator to create a minimal JRE

param(
    [string]$JDKPath = "",
    [string]$OutputPath = "resources\engines\grammar\runtime"
)

Write-Host "🔧 LanguageTool JRE Setup Script" -ForegroundColor Cyan
Write-Host ""

# Try to find JDK 17 automatically
if ([string]::IsNullOrEmpty($JDKPath)) {
    Write-Host "🔍 Searching for JDK 17..." -ForegroundColor Yellow
    
    $possiblePaths = @(
        "C:\Program Files\Java\jdk-17*",
        "C:\Program Files\Eclipse Adoptium\jdk-17*",
        "C:\Program Files\Microsoft\jdk-17*",
        "C:\Program Files (x86)\Java\jdk-17*",
        "$env:JAVA_HOME"
    )
    
    foreach ($pattern in $possiblePaths) {
        $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found -and (Test-Path "$($found.FullName)\bin\jlink.exe")) {
            $JDKPath = $found.FullName
            Write-Host "✅ Found JDK at: $JDKPath" -ForegroundColor Green
            break
        }
    }
    
    if ([string]::IsNullOrEmpty($JDKPath)) {
        Write-Host "❌ Could not find JDK 17 automatically." -ForegroundColor Red
        Write-Host ""
        Write-Host "Please provide the JDK path manually:" -ForegroundColor Yellow
        Write-Host "  .\setup-jre.ps1 -JDKPath 'C:\Program Files\Java\jdk-17'" -ForegroundColor White
        Write-Host ""
        Write-Host "Or download JDK 17 from:" -ForegroundColor Yellow
        Write-Host "  https://adoptium.net/temurin/releases/?version=17" -ForegroundColor Cyan
        exit 1
    }
}

# Verify JDK path
if (-not (Test-Path "$JDKPath\bin\jlink.exe")) {
    Write-Host "❌ jlink.exe not found at: $JDKPath\bin\jlink.exe" -ForegroundColor Red
    exit 1
}

# Check JDK version
Write-Host "📋 Checking JDK version..." -ForegroundColor Yellow
$jdkVersion = & "$JDKPath\bin\java.exe" -version 2>&1 | Select-Object -First 1
Write-Host "   $jdkVersion" -ForegroundColor Gray

# Create output directory
Write-Host ""
Write-Host "📁 Creating output directory: $OutputPath" -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null

# Check if runtime already exists
if (Test-Path "$OutputPath\bin\java.exe") {
    Write-Host "⚠️  Runtime already exists at: $OutputPath" -ForegroundColor Yellow
    $response = Read-Host "Do you want to recreate it? (y/N)"
    if ($response -ne 'y' -and $response -ne 'Y') {
        Write-Host "❌ Aborted." -ForegroundColor Red
        exit 0
    }
    Write-Host "🗑️  Removing existing runtime..." -ForegroundColor Yellow
    Remove-Item -Path $OutputPath -Recurse -Force
    New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null
}

# Run jlink
Write-Host ""
Write-Host "🔨 Creating minimal JRE with jlink..." -ForegroundColor Cyan
Write-Host "   JDK Path: $JDKPath" -ForegroundColor Gray
Write-Host "   Output: $OutputPath" -ForegroundColor Gray
Write-Host "   Modules: java.base, java.logging, java.xml, java.net.http" -ForegroundColor Gray
Write-Host ""

$jlinkPath = "$JDKPath\bin\jlink.exe"
$jmodsPath = "$JDKPath\jmods"

try {
    & $jlinkPath `
        --module-path $jmodsPath `
        --add-modules java.base,java.logging,java.xml,java.net.http `
        --output $OutputPath `
        --strip-debug `
        --compress=2 `
        --no-header-files `
        --no-man-pages
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Success! Minimal JRE created at: $OutputPath" -ForegroundColor Green
        
        # Verify the runtime
        if (Test-Path "$OutputPath\bin\java.exe") {
            Write-Host ""
            Write-Host "🧪 Testing runtime..." -ForegroundColor Yellow
            $javaVersion = & "$OutputPath\bin\java.exe" -version 2>&1 | Select-Object -First 1
            Write-Host "   $javaVersion" -ForegroundColor Gray
            
            # Calculate size
            $size = (Get-ChildItem -Path $OutputPath -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
            Write-Host ""
            Write-Host "📊 Runtime size: $([math]::Round($size, 2)) MB" -ForegroundColor Green
            Write-Host ""
            Write-Host "✨ Setup complete! LanguageTool is ready to use." -ForegroundColor Green
        } else {
            Write-Host "⚠️  Warning: java.exe not found in output directory" -ForegroundColor Yellow
        }
    } else {
        Write-Host ""
        Write-Host "❌ jlink failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "❌ Error running jlink: $_" -ForegroundColor Red
    exit 1
}

