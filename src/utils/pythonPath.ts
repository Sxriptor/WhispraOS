import fs from 'fs';
import path from 'path';

const PYTHON_DIR_NAME = 'python';
const PYTHON_BINARY_NAME = process.platform === 'win32' ? 'python.exe' : 'python';

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function buildCandidateDirs(): string[] {
  const candidates: string[] = [];

  // For packaged apps, check process.resourcesPath first (highest priority)
  const resourcesPath = process.resourcesPath;
  if (resourcesPath) {
    // Check unpacked ASAR location first (most likely for executables)
    candidates.push(path.join(resourcesPath, 'app.asar.unpacked', PYTHON_DIR_NAME));
    candidates.push(path.join(resourcesPath, PYTHON_DIR_NAME));
    candidates.push(path.join(path.dirname(resourcesPath), PYTHON_DIR_NAME));
  }

  // Check executable directory (for portable apps)
  const execDir = path.dirname(process.execPath);
  if (execDir) {
    candidates.push(path.join(execDir, PYTHON_DIR_NAME));
    candidates.push(path.join(execDir, 'resources', PYTHON_DIR_NAME));
    // Check relative to executable for different packaging structures
    candidates.push(path.join(execDir, '..', 'Resources', PYTHON_DIR_NAME)); // macOS
    candidates.push(path.join(execDir, 'Resources', PYTHON_DIR_NAME));
  }

  // Development paths (lower priority)
  const cwd = process.cwd();
  if (cwd) {
    candidates.push(path.join(cwd, PYTHON_DIR_NAME));
    candidates.push(path.join(cwd, 'resources', PYTHON_DIR_NAME));
  }

  const appDirFromDist = path.resolve(__dirname, '..', '..');
  if (appDirFromDist) {
    candidates.push(path.join(appDirFromDist, PYTHON_DIR_NAME));
  }

  // Additional fallback paths for different packaging scenarios
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    candidates.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, PYTHON_DIR_NAME));
  }

  return unique(
    candidates
      .map(candidate => path.normalize(candidate))
      .filter(Boolean)
  );
}

function directoryHasPythonExecutable(dir: string): boolean {
  try {
    const stats = fs.statSync(dir);
    if (!stats.isDirectory()) {
      return false;
    }

    const exePath = path.join(dir, PYTHON_BINARY_NAME);
    return fs.existsSync(exePath);
  } catch {
    return false;
  }
}

export function resolveEmbeddedPythonDirectory(): string | null {
  const candidates = buildCandidateDirs();
  
  for (const candidate of candidates) {
    if (directoryHasPythonExecutable(candidate)) {
      return candidate;
    }
  }
  
  return null;
}

export function resolveEmbeddedPythonExecutable(): string | null {
  const pythonDir = resolveEmbeddedPythonDirectory();
  if (!pythonDir) {
    return null;
  }
  return path.join(pythonDir, PYTHON_BINARY_NAME);
}

