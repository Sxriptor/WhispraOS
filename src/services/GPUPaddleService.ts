import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { resolveEmbeddedPythonExecutable } from '../utils/pythonPath';

export interface CUDAInfo {
  hasCUDA: boolean;
  cudaVersion?: string;
  error?: string;
}

export interface GPUPaddleStatus {
  isGPUAvailable: boolean;
  hasGPUPaddle: boolean;
  cudaInfo?: CUDAInfo;
  canRunOnGPU: boolean;
}

export class GPUPaddleService {
  private static instance: GPUPaddleService;
  private statusCache: { result: boolean; timestamp: number } | null = null;
  private readonly CACHE_DURATION = 60000; // 60 seconds cache for better UI stability

  private constructor() {}

  public static getInstance(): GPUPaddleService {
    if (!GPUPaddleService.instance) {
      GPUPaddleService.instance = new GPUPaddleService();
    }
    return GPUPaddleService.instance;
  }

  /**
   * Get the path where GPU Paddle is installed (subfolder under Paddle)
   */
  private getGPUPaddleInstallPath(): string {
    let appDataPath: string;
    
    try {
      // Try to use Electron's app.getPath if available
      appDataPath = app.getPath('appData');
    } catch (error) {
      // Fallback for non-Electron environments (testing)
      appDataPath = process.env.APPDATA || path.join(process.env.USERPROFILE || process.env.HOME || '', 'AppData', 'Roaming');
    }
    
    // Use gpu subfolder under Paddle to avoid conflicts with regular PaddlePaddle
    return path.join(appDataPath, 'whispra', 'models', 'Paddle', 'gpu');
  }

  /**
   * Get Python code that adds the GPU Paddle installation path to sys.path
   */
  private getPythonPathSetupCode(): string {
    const gpuPaddleModelsPath = this.getGPUPaddleInstallPath();
    return `
import sys
import os

# Add GPU Paddle installation path to sys.path (gpu subfolder under Paddle)
gpu_paddle_path = r"${gpuPaddleModelsPath.replace(/\\/g, '\\\\')}"
if os.path.exists(gpu_paddle_path) and gpu_paddle_path not in sys.path:
    sys.path.insert(0, gpu_paddle_path)
    print(f"Added GPU Paddle path to sys.path: {gpu_paddle_path}")
`;
  }

  /**
   * Get embedded Python path
   */
  private getPythonPath(): string {
    const embeddedPythonPath = resolveEmbeddedPythonExecutable();

    if (embeddedPythonPath && fs.existsSync(embeddedPythonPath)) {
      console.log('🎮 Using embedded Python:', embeddedPythonPath);
      return embeddedPythonPath;
    }

    console.log('🎮 Using system Python');
    return 'python';
  }

  /**
   * Check if pip is available for the given Python path
   */
  private async checkPipAvailability(pythonPath: string): Promise<{ hasPip: boolean; error?: string }> {
    return new Promise((resolve) => {
      const pipProcess = spawn(pythonPath, ['-m', 'pip', '--version'], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      pipProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pipProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pipProcess.on('close', (code) => {
        if (code === 0) {
          console.log('🎮 Pip is available:', output.trim());
          resolve({ hasPip: true });
        } else {
          console.log('🎮 Pip not available:', errorOutput.trim());
          resolve({ hasPip: false, error: errorOutput.trim() });
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        pipProcess.kill();
        resolve({ hasPip: false, error: 'Pip check timeout' });
      }, 10000);
    });
  }

  /**
   * Download and install pip for embedded Python
   */
  private async installPipForEmbeddedPython(pythonPath: string): Promise<{ success: boolean; error?: string }> {
    return new Promise(async (resolve) => {
      try {
        console.log('🎮 Downloading get-pip.py...');
        
        // Download get-pip.py
        const https = require('https');
        const getPipUrl = 'https://bootstrap.pypa.io/get-pip.py';
        const getPipPath = path.join(path.dirname(pythonPath), 'get-pip.py');

        const file = fs.createWriteStream(getPipPath);
        
        https.get(getPipUrl, (response: any) => {
          response.pipe(file);
          
          file.on('finish', () => {
            file.close();
            console.log('🎮 get-pip.py downloaded successfully');
            
            // Run get-pip.py
            console.log('🎮 Installing pip...');
            const pipInstallProcess = spawn(pythonPath, [getPipPath], {
              shell: true,
              stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';

            pipInstallProcess.stdout.on('data', (data) => {
              const text = data.toString();
              output += text;
              console.log('🎮 PIP INSTALL OUTPUT:', text.trim());
            });

            pipInstallProcess.stderr.on('data', (data) => {
              const text = data.toString();
              errorOutput += text;
              console.log('🎮 PIP INSTALL STDERR:', text.trim());
            });

            pipInstallProcess.on('close', (code) => {
              // Clean up get-pip.py
              try {
                fs.unlinkSync(getPipPath);
              } catch (e) {
                console.log('🎮 Could not clean up get-pip.py:', e);
              }

              if (code === 0) {
                console.log('🎮 Pip installed successfully');
                resolve({ success: true });
              } else {
                console.log('🎮 Pip installation failed with code:', code);
                resolve({ success: false, error: errorOutput || 'Pip installation failed' });
              }
            });

            // Timeout after 5 minutes
            setTimeout(() => {
              pipInstallProcess.kill();
              resolve({ success: false, error: 'Pip installation timeout' });
            }, 300000);
          });
        }).on('error', (err: any) => {
          console.error('🎮 Error downloading get-pip.py:', err);
          resolve({ success: false, error: `Failed to download get-pip.py: ${err.message}` });
        });

      } catch (error) {
        console.error('🎮 Error in installPipForEmbeddedPython:', error);
        resolve({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  }

  /**
   * Try to use system pip as fallback
   */
  private async trySystemPip(): Promise<{ pythonPath: string; hasPip: boolean }> {
    const systemPythonPaths = ['python', 'python3', 'py'];
    
    for (const pythonCmd of systemPythonPaths) {
      try {
        const pipCheck = await this.checkPipAvailability(pythonCmd);
        if (pipCheck.hasPip) {
          console.log(`🎮 Found system Python with pip: ${pythonCmd}`);
          return { pythonPath: pythonCmd, hasPip: true };
        }
      } catch (error) {
        console.log(`🎮 System Python ${pythonCmd} not available:`, error);
      }
    }
    
    return { pythonPath: 'python', hasPip: false };
  }

  /**
   * Ensure pip is available, installing it if necessary
   */
  private async ensurePipAvailable(): Promise<{ pythonPath: string; success: boolean; error?: string }> {
    const embeddedPythonPath = resolveEmbeddedPythonExecutable();
    
    // First, try embedded Python
    if (embeddedPythonPath && fs.existsSync(embeddedPythonPath)) {
      console.log('🎮 Checking pip availability for embedded Python...');
      const pipCheck = await this.checkPipAvailability(embeddedPythonPath);
      
      if (pipCheck.hasPip) {
        return { pythonPath: embeddedPythonPath, success: true };
      }
      
      console.log('🎮 Embedded Python found but pip missing, attempting to install pip...');
      const pipInstall = await this.installPipForEmbeddedPython(embeddedPythonPath);
      
      if (pipInstall.success) {
        return { pythonPath: embeddedPythonPath, success: true };
      }
      
      console.log('🎮 Failed to install pip for embedded Python, trying system Python...');
    }
    
    // Fallback to system Python
    console.log('🎮 Trying system Python as fallback...');
    const systemPython = await this.trySystemPip();
    
    if (systemPython.hasPip) {
      return { pythonPath: systemPython.pythonPath, success: true };
    }
    
    return { 
      pythonPath: embeddedPythonPath || 'python', 
      success: false, 
      error: 'No Python installation with pip found. Please install pip manually or use system Python with pip.' 
    };
  }

  /**
   * Detect CUDA version installed on the system
   */
  public async detectCUDA(): Promise<CUDAInfo> {
    return new Promise(async (resolve) => {
      console.log('🎮 Starting CUDA detection...');

      // Try multiple detection methods in order of reliability
      const methods = [
        () => this.detectCUDAViaNVCC(),
        () => this.detectCUDAViaNvidiaSMI(),
        () => this.detectCUDAViaPython(this.getPythonPath())
      ];

      for (const method of methods) {
        try {
          const result = await method();
          if (result.hasCUDA) {
            console.log(`🎮 CUDA detected successfully: ${result.cudaVersion}`);
            resolve(result);
            return;
          }
        } catch (error) {
          console.log(`🎮 Detection method failed:`, error);
        }
      }

      // If all methods fail
      console.log('🎮 All CUDA detection methods failed');
      resolve({
        hasCUDA: false,
        error: 'No CUDA installation detected'
      });
    });
  }

  /**
   * Detect CUDA via nvcc --version (most reliable method)
   */
  private async detectCUDAViaNVCC(): Promise<CUDAInfo> {
    return new Promise((resolve) => {
      console.log('🎮 Trying CUDA detection via nvcc...');

      const nvccProcess = spawn('nvcc', ['--version'], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      nvccProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      nvccProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      nvccProcess.on('close', (code) => {
        if (code === 0 && output.trim()) {
          // Parse CUDA version from nvcc output
          const versionMatch = output.match(/release\s+(\d+\.\d+)/i);
          if (versionMatch) {
            const version = versionMatch[1].split('.')[0]; // Get major version
            console.log(`🎮 CUDA detected via nvcc: ${versionMatch[1]}`);
            resolve({
              hasCUDA: true,
              cudaVersion: version
            });
          } else {
            console.log('🎮 Could not parse CUDA version from nvcc output');
            resolve({
              hasCUDA: false,
              error: 'Failed to parse nvcc output'
            });
          }
        } else {
          console.log('🎮 nvcc not found or failed');
          resolve({
            hasCUDA: false,
            error: 'nvcc not found'
          });
        }
      });

      nvccProcess.on('error', (error) => {
        console.log('🎮 nvcc error:', error.message);
        resolve({
          hasCUDA: false,
          error: `nvcc error: ${error.message}`
        });
      });

      // Timeout
      setTimeout(() => {
        nvccProcess.kill();
        resolve({
          hasCUDA: false,
          error: 'nvcc timeout'
        });
      }, 3000);
    });
  }

  /**
   * Detect CUDA via nvidia-smi (second most reliable method)
   */
  private async detectCUDAViaNvidiaSMI(): Promise<CUDAInfo> {
    return new Promise((resolve) => {
      console.log('🎮 Trying CUDA detection via nvidia-smi...');

      const nvidiaSmiProcess = spawn('nvidia-smi', ['--query-gpu=driver_version', '--format=csv,noheader'], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      nvidiaSmiProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      nvidiaSmiProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      nvidiaSmiProcess.on('close', (code) => {
        if (code === 0 && output.trim()) {
          // If nvidia-smi works, we know NVIDIA drivers are installed
          // Try to get CUDA version as well
          this.getCUDADriverVersion().then((cudaInfo) => {
            if (cudaInfo.hasCUDA) {
              resolve(cudaInfo);
            } else {
              // At least we know NVIDIA drivers are available
              resolve({
                hasCUDA: true,
                cudaVersion: '11' // Default fallback
              });
            }
          }).catch(() => {
            resolve({
              hasCUDA: true,
              cudaVersion: '11' // Default fallback
            });
          });
        } else {
          console.log('🎮 nvidia-smi failed or not found');
          resolve({
            hasCUDA: false,
            error: 'nvidia-smi not found or failed'
          });
        }
      });

      nvidiaSmiProcess.on('error', (error) => {
        console.log('🎮 nvidia-smi error:', error.message);
        resolve({
          hasCUDA: false,
          error: `nvidia-smi error: ${error.message}`
        });
      });

      // Timeout
      setTimeout(() => {
        nvidiaSmiProcess.kill();
        resolve({
          hasCUDA: false,
          error: 'nvidia-smi timeout'
        });
      }, 3000);
    });
  }

  /**
   * Get CUDA runtime version from nvidia-smi
   */
  private async getCUDADriverVersion(): Promise<CUDAInfo> {
    return new Promise((resolve) => {
      const cudaProcess = spawn('nvidia-smi', ['--query-gpu=cuda_version', '--format=csv,noheader'], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';

      cudaProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      cudaProcess.on('close', (code) => {
        if (code === 0 && output.trim()) {
          const version = output.trim().split('.')[0];
          resolve({
            hasCUDA: true,
            cudaVersion: version
          });
        } else {
          resolve({
            hasCUDA: false,
            error: 'Could not get CUDA version'
          });
        }
      });

      cudaProcess.on('error', () => {
        resolve({
          hasCUDA: false,
          error: 'nvidia-smi CUDA query failed'
        });
      });

      setTimeout(() => {
        cudaProcess.kill();
        resolve({
          hasCUDA: false,
          error: 'nvidia-smi CUDA query timeout'
        });
      }, 2000);
    });
  }

  /**
   * Detect CUDA via Python (fallback method)
   */
  private async detectCUDAViaPython(pythonPath: string): Promise<CUDAInfo> {
    return new Promise((resolve) => {
      console.log('🎮 Trying CUDA detection via Python PaddlePaddle...');

      const gpuPaddleModelsPath = this.getGPUPaddleInstallPath();
      
      // Create a temporary Python file
      const tempDir = require('os').tmpdir();
      const tempPythonFile = path.join(tempDir, `gpu_cuda_check_${Date.now()}.py`);
      
      const pythonCode = `import sys
import os

# Add GPU Paddle installation path to sys.path (gpu subfolder under Paddle)
gpu_paddle_path = r"${gpuPaddleModelsPath.replace(/\\/g, '\\\\')}"
if os.path.exists(gpu_paddle_path) and gpu_paddle_path not in sys.path:
    sys.path.insert(0, gpu_paddle_path)

try:
    import paddle
    if paddle.device.is_compiled_with_cuda():
        print("CUDA_AVAILABLE")
        try:
            print(paddle.version.cuda())
        except:
            print("11.8")  # Default version if can't detect
    else:
        print("NO_CUDA")
except ImportError:
    print("NO_PADDLE")
except Exception as e:
    print(f"ERROR: {str(e)}")
`;

      // Write the Python code to a temporary file
      try {
        fs.writeFileSync(tempPythonFile, pythonCode);
      } catch (error) {
        console.error('🎮 Failed to write temporary Python file:', error);
        resolve({
          hasCUDA: false,
          error: 'Failed to create temporary Python file'
        });
        return;
      }

      const pythonProcess = spawn(pythonPath, [tempPythonFile], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        // Clean up temporary file
        try {
          fs.unlinkSync(tempPythonFile);
        } catch (e) {
          console.log('🎮 Could not clean up temporary Python file:', e);
        }

        const trimmedOutput = output.trim();

        if (trimmedOutput.includes('CUDA_AVAILABLE')) {
          const lines = trimmedOutput.split('\n');
          const versionLine = lines.find(line => /^\d+\.\d+/.test(line));
          const version = versionLine ? versionLine.split('.')[0] : '11'; // Default to 11 if can't detect

          console.log(`🎮 CUDA detected via Python PaddlePaddle: ${version}`);
          resolve({
            hasCUDA: true,
            cudaVersion: version
          });
        } else if (trimmedOutput.includes('NO_CUDA')) {
          console.log('🎮 PaddlePaddle compiled without CUDA support');
          resolve({
            hasCUDA: false,
            error: 'PaddlePaddle not compiled with CUDA'
          });
        } else if (trimmedOutput.includes('NO_PADDLE')) {
          console.log('🎮 PaddlePaddle not installed');
          resolve({
            hasCUDA: false,
            error: 'PaddlePaddle not installed'
          });
        } else {
          console.log('🎮 Python CUDA detection failed:', trimmedOutput);
          resolve({
            hasCUDA: false,
            error: 'Python CUDA detection failed'
          });
        }
      });

      pythonProcess.on('error', (error) => {
        console.log('🎮 Python process error:', error.message);
        // Clean up temporary file on error
        try {
          fs.unlinkSync(tempPythonFile);
        } catch (e) {
          // Ignore cleanup errors
        }
        resolve({
          hasCUDA: false,
          error: `Python execution failed: ${error.message}`
        });
      });

      // Timeout
      setTimeout(() => {
        pythonProcess.kill();
        console.log('🎮 Python CUDA detection timeout');
        // Clean up temporary file on timeout
        try {
          fs.unlinkSync(tempPythonFile);
        } catch (e) {
          // Ignore cleanup errors
        }
        resolve({
          hasCUDA: false,
          error: 'Python CUDA detection timeout'
        });
      }, 5000);
    });
  }

  /**
   * Check if GPU Paddle files exist in the installation directory
   */
  private checkGPUPaddleFilesExist(): boolean {
    const gpuPaddleModelsPath = this.getGPUPaddleInstallPath();
    
    // Check for key paddle files/directories in GPU Paddle subfolder
    const paddleDir = path.join(gpuPaddleModelsPath, 'paddle');
    const paddleInit = path.join(paddleDir, '__init__.py');
    const gpuDistInfo = path.join(gpuPaddleModelsPath, 'paddlepaddle_gpu-3.2.0.dist-info');
    
    const filesExist = fs.existsSync(paddleDir) && fs.existsSync(paddleInit);
    const gpuDistExists = fs.existsSync(gpuDistInfo);
    
    console.log('🎮 GPU Paddle files check:', {
      gpuPaddleModelsPath,
      paddleDir,
      paddleInit,
      gpuDistInfo,
      filesExist,
      gpuDistExists,
      overallExists: filesExist || gpuDistExists
    });
    
    return filesExist || gpuDistExists;
  }

  /**
   * Check if GPU version of Paddle is installed
   */
  public async checkGPUPaddleInstalled(): Promise<boolean> {
    // Check cache first to avoid repeated expensive checks
    const now = Date.now();
    if (this.statusCache && (now - this.statusCache.timestamp) < this.CACHE_DURATION) {
      console.log('🎮 Using cached GPU Paddle status:', this.statusCache.result);
      return this.statusCache.result;
    }

    // First check if files exist
    if (!this.checkGPUPaddleFilesExist()) {
      console.log('🎮 GPU Paddle files not found in installation directory');
      this.statusCache = { result: false, timestamp: now };
      return false;
    }

    return new Promise((resolve) => {
      const pythonPath = this.getPythonPath();
      const gpuPaddleModelsPath = this.getGPUPaddleInstallPath();
      
      // Create a temporary Python file to avoid issues with multiline strings in -c
      const tempDir = require('os').tmpdir();
      const tempPythonFile = path.join(tempDir, `gpu_paddle_check_${Date.now()}.py`);
      
      const pythonCode = `import sys
import os

# Add GPU Paddle installation path to sys.path (gpu subfolder under Paddle)
gpu_paddle_path = r"${gpuPaddleModelsPath.replace(/\\/g, '\\\\')}"
if os.path.exists(gpu_paddle_path) and gpu_paddle_path not in sys.path:
    sys.path.insert(0, gpu_paddle_path)
    print(f"Added GPU Paddle path to sys.path: {gpu_paddle_path}")

try:
    import paddle
    print(f"Paddle imported successfully from: {paddle.__file__}")
    print(f"Paddle version: {paddle.__version__}")
    if paddle.device.is_compiled_with_cuda():
        print("GPU_PADDLE_INSTALLED")
    else:
        print("CPU_ONLY")
except Exception as e:
    print(f"NO_PADDLE: {e}")
    import traceback
    traceback.print_exc()
`;

      console.log('🎮 Checking GPU Paddle installation at:', gpuPaddleModelsPath);

      // Write the Python code to a temporary file
      try {
        fs.writeFileSync(tempPythonFile, pythonCode);
      } catch (error) {
        console.error('🎮 Failed to write temporary Python file:', error);
        resolve(false);
        return;
      }

      const pythonProcess = spawn(pythonPath, [tempPythonFile], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log('🎮 GPU Paddle check output:', text.trim());
      });

      pythonProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        console.log('🎮 GPU Paddle check error:', text.trim());
      });

      pythonProcess.on('close', (code) => {
        // Clean up temporary file
        try {
          fs.unlinkSync(tempPythonFile);
        } catch (e) {
          console.log('🎮 Could not clean up temporary Python file:', e);
        }

        console.log('🎮 GPU Paddle check completed with code:', code);
        const isInstalled = output.includes('GPU_PADDLE_INSTALLED');
        console.log('🎮 Output contains GPU_PADDLE_INSTALLED:', isInstalled);
        
        // Cache the result
        this.statusCache = { result: isInstalled, timestamp: Date.now() };
        resolve(isInstalled);
      });

      pythonProcess.on('error', (error) => {
        console.error('🎮 GPU Paddle check process error:', error);
        // Clean up temporary file on error
        try {
          fs.unlinkSync(tempPythonFile);
        } catch (e) {
          // Ignore cleanup errors
        }
        // Cache the error result
        this.statusCache = { result: false, timestamp: Date.now() };
        resolve(false);
      });

      setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        console.log('🎮 GPU Paddle check timeout after 5 seconds');
        // Clean up temporary file on timeout
        try {
          fs.unlinkSync(tempPythonFile);
        } catch (e) {
          // Ignore cleanup errors
        }
        // Cache the timeout result
        this.statusCache = { result: false, timestamp: Date.now() };
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Get quick GPU Paddle status (uses cache and file check only, no Python execution)
   */
  public getQuickGPUPaddleStatus(): { hasGPUPaddle: boolean; fromCache: boolean } {
    // First check cache
    const now = Date.now();
    if (this.statusCache && (now - this.statusCache.timestamp) < this.CACHE_DURATION) {
      return { hasGPUPaddle: this.statusCache.result, fromCache: true };
    }

    // If no cache, do a quick file check only
    const filesExist = this.checkGPUPaddleFilesExist();
    
    // Update cache with file check result
    this.statusCache = { result: filesExist, timestamp: now };
    
    return { hasGPUPaddle: filesExist, fromCache: false };
  }

  /**
   * Get comprehensive GPU Paddle status
   */
  public async getGPUPaddleStatus(): Promise<GPUPaddleStatus> {
    const cudaInfo = await this.detectCUDA();
    const hasGPUPaddle = await this.checkGPUPaddleInstalled();

    return {
      isGPUAvailable: cudaInfo.hasCUDA,
      hasGPUPaddle: hasGPUPaddle,
      cudaInfo: cudaInfo,
      canRunOnGPU: cudaInfo.hasCUDA && !hasGPUPaddle  // Show button when CUDA available but GPU Paddle NOT installed
    };
  }

  /**
   * Install GPU version of PaddlePaddle based on CUDA version
   */
  public async installGPUPaddle(cudaVersion: string, onProgress?: (message: string) => void): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🎮 Installing GPU PaddlePaddle for CUDA ${cudaVersion}...`);

      const pythonPath = this.getPythonPath();

      // Determine the correct CUDA package based on version
      let cudaPackage = 'cu129'; // Default to CUDA 12.9

      const cudaVersionNum = parseInt(cudaVersion);
      if (cudaVersionNum >= 12 && cudaVersionNum < 13) {
        // CUDA 12.x
        if (cudaVersionNum >= 129) {
          cudaPackage = 'cu129';
        } else if (cudaVersionNum >= 126) {
          cudaPackage = 'cu126';
        } else {
          cudaPackage = 'cu118'; // Fallback for older CUDA 12
        }
      } else if (cudaVersionNum === 11) {
        cudaPackage = 'cu118';
      } else if (cudaVersionNum >= 13) {
        cudaPackage = 'cu129'; // Use latest for CUDA 13+
      }

      console.log(`🎮 Selected CUDA package: ${cudaPackage}`);

      const pipUrl = `https://www.paddlepaddle.org.cn/packages/stable/${cudaPackage}/`;

      if (onProgress) {
        onProgress(`Installing PaddlePaddle GPU version for CUDA ${cudaVersion}...`);
      }

      // Install GPU version
      const result = await this.runPipInstall(pythonPath, pipUrl, onProgress);

      if (result.success) {
        console.log('🎮 GPU PaddlePaddle installed successfully!');
        if (onProgress) {
          onProgress('GPU PaddlePaddle installed successfully!');
        }
      }

      return result;

    } catch (error) {
      console.error('🎮 Error installing GPU PaddlePaddle:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Run pip install for GPU PaddlePaddle
   */
  private async runPipInstall(
    pythonPath: string,
    indexUrl: string,
    onProgress?: (message: string) => void
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise(async (resolve) => {
      try {
        // First ensure pip is available
        if (onProgress) onProgress('Checking pip availability...');
        
        const pipAvailability = await this.ensurePipAvailable();
        if (!pipAvailability.success) {
          resolve({ success: false, error: pipAvailability.error });
          return;
        }

        // Use the Python path that has pip available
        const actualPythonPath = pipAvailability.pythonPath;
        console.log('🎮 Using Python with pip:', actualPythonPath);

        // Verify Python executable exists
        if (!fs.existsSync(actualPythonPath)) {
          resolve({
            success: false,
            error: `Python executable not found: ${actualPythonPath}`
          });
          return;
        }

        if (onProgress) onProgress('Preparing installation...');

        // Install to gpu subfolder under Paddle to avoid conflicts
        const gpuPaddleModelsPath = this.getGPUPaddleInstallPath();
        const parentDir = path.dirname(gpuPaddleModelsPath);

        console.log('🎮 Installing GPU PaddlePaddle to gpu subfolder:', gpuPaddleModelsPath);
        console.log('🎮 Parent directory:', parentDir);

        // Ensure the parent directory structure exists first
        try {
          // Create parent directory if it doesn't exist
          if (!fs.existsSync(parentDir)) {
            console.log('🎮 Creating parent directory:', parentDir);
            fs.mkdirSync(parentDir, { recursive: true });
          }
          
          // Now create the gpu subfolder if it doesn't exist
          if (!fs.existsSync(gpuPaddleModelsPath)) {
            console.log('🎮 Creating GPU Paddle subfolder:', gpuPaddleModelsPath);
            fs.mkdirSync(gpuPaddleModelsPath, { recursive: true });
          }
          
          // Verify both directories exist
          if (!fs.existsSync(parentDir)) {
            resolve({
              success: false,
              error: `Failed to create parent directory: ${parentDir}`
            });
            return;
          }
          
          if (!fs.existsSync(gpuPaddleModelsPath)) {
            resolve({
              success: false,
              error: `Failed to create installation directory: ${gpuPaddleModelsPath}`
            });
            return;
          }
          
          console.log('🎮 Verified directories exist - parent:', fs.existsSync(parentDir), 'target:', fs.existsSync(gpuPaddleModelsPath));
        } catch (dirError) {
          console.error('🎮 Directory creation error:', dirError);
          resolve({
            success: false,
            error: `Failed to create installation directory: ${dirError instanceof Error ? dirError.message : 'Unknown error'}`
          });
          return;
        }

        // Install paddlepaddle-gpu first (without numpy to avoid shell redirection issues)
        const pipArgs = [
          '-m',
          'pip',
          'install',
          'paddlepaddle-gpu==3.2.0',
          '--target', gpuPaddleModelsPath,  // Install to gpu subfolder under Paddle
          '--upgrade',  // Upgrade existing CPU version if present
          '-i',
          indexUrl
        ];

        console.log('🎮 Running pip command (paddlepaddle-gpu):', actualPythonPath, pipArgs.join(' '));
        console.log('🎮 Python path exists:', fs.existsSync(actualPythonPath));
        console.log('🎮 Target directory exists:', fs.existsSync(gpuPaddleModelsPath));
        console.log('🎮 Target directory:', gpuPaddleModelsPath);

        // On Windows, ensure we have proper temp directory for pip
        const tempDir = require('os').tmpdir();
        console.log('🎮 Temp directory:', tempDir);

        const pipProcess = spawn(actualPythonPath, pipArgs, {
          shell: true,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            TMP: tempDir,
            TEMP: tempDir
          }
        });

        let output = '';
        let errorOutput = '';

        pipProcess.stdout.on('data', (data) => {
          const text = data.toString();
          output += text;
          console.log('🎮 PIP OUTPUT:', text.trim());

          if (onProgress) {
            // Extract meaningful progress messages
            if (text.includes('Downloading')) {
              onProgress('Downloading packages...');
            } else if (text.includes('Installing')) {
              onProgress('Installing packages...');
            } else if (text.includes('Collecting')) {
              onProgress('Collecting package information...');
            }
          }
        });

        pipProcess.stderr.on('data', (data) => {
          const text = data.toString();
          errorOutput += text;
          console.log('🎮 PIP STDERR:', text.trim());
          // Log full error output for debugging
          if (text.includes('cannot find') || text.includes('ERROR') || text.includes('Error')) {
            console.error('🎮 PIP ERROR DETAIL:', text);
          }
        });

        pipProcess.on('close', async (code) => {
          console.log('🎮 PIP process exited with code:', code);
          console.log('🎮 Full pip output:', output);
          console.log('🎮 Full pip error output:', errorOutput);

          if (code === 0) {
            // Verify installation actually succeeded by checking if files were created
            const paddleDir = path.join(gpuPaddleModelsPath, 'paddle');
            if (fs.existsSync(paddleDir)) {
              console.log('✅ GPU PaddlePaddle installation verified - paddle directory exists');
              
              // Now install compatible NumPy version separately
              console.log('🎮 Installing compatible NumPy version (< 2.0)...');
              if (onProgress) onProgress('Installing compatible NumPy version...');
              
              const numpyArgs = [
                '-m',
                'pip',
                'install',
                'numpy==1.26.4',  // Use specific compatible version instead of < constraint
                '--target', gpuPaddleModelsPath,
                '--upgrade',
                '--force-reinstall'
              ];
              
              console.log('🎮 Running pip command (numpy):', actualPythonPath, numpyArgs.join(' '));
              
              const numpyProcess = spawn(actualPythonPath, numpyArgs, {
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                  ...process.env,
                  TMP: tempDir,
                  TEMP: tempDir
                }
              });
              
              let numpyOutput = '';
              let numpyErrorOutput = '';
              
              numpyProcess.stdout.on('data', (data) => {
                numpyOutput += data.toString();
                console.log('🎮 NUMPY PIP OUTPUT:', data.toString().trim());
              });
              
              numpyProcess.stderr.on('data', (data) => {
                numpyErrorOutput += data.toString();
                console.log('🎮 NUMPY PIP STDERR:', data.toString().trim());
              });
              
              numpyProcess.on('close', (numpyCode) => {
                if (numpyCode === 0) {
                  console.log('✅ NumPy installation completed successfully');
                  resolve({ success: true });
                } else {
                  console.warn('⚠️ NumPy installation failed, but PaddlePaddle GPU is installed');
                  // Don't fail the whole installation if numpy fails - PaddlePaddle will fall back to CPU
                  resolve({ success: true });
                }
              });
              
              numpyProcess.on('error', (error) => {
                console.error('🎮 NumPy PIP process error:', error);
                // Don't fail the whole installation if numpy fails
                resolve({ success: true });
              });
              
              // Timeout for numpy installation
              setTimeout(() => {
                numpyProcess.kill();
                console.warn('⚠️ NumPy installation timeout, but PaddlePaddle GPU is installed');
                resolve({ success: true });
              }, 300000); // 5 minutes
            } else {
              console.warn('⚠️ Installation reported success but paddle directory not found');
              resolve({
                success: false,
                error: 'Installation completed but verification failed. Paddle directory not found.'
              });
            }
          } else {
            resolve({
              success: false,
              error: `Installation failed with code ${code}. ${errorOutput || output || 'Unknown error'}`
            });
          }
        });

        pipProcess.on('error', (error) => {
          console.error('🎮 PIP process error:', error);
          console.error('🎮 Error details:', {
            name: error.name,
            message: error.message,
            code: (error as any).code,
            errno: (error as any).errno,
            syscall: (error as any).syscall
          });
          resolve({
            success: false,
            error: `Failed to start pip: ${error.message}. Python path: ${actualPythonPath}, Target: ${gpuPaddleModelsPath}`
          });
        });

        // Timeout after 10 minutes (GPU packages are large)
        setTimeout(() => {
          pipProcess.kill();
          resolve({
            success: false,
            error: 'Installation timeout after 10 minutes'
          });
        }, 600000);

      } catch (error) {
        console.error('🎮 Error in runPipInstall:', error);
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  }

  /**
   * Fix NumPy compatibility issue for GPU PaddlePaddle
   * Installs compatible NumPy version (< 2.0) in the GPU PaddlePaddle directory
   */
  public async fixNumPyCompatibility(onProgress?: (message: string) => void): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔧 Fixing NumPy compatibility for GPU PaddlePaddle...');

      const pythonPath = this.getPythonPath();
      const gpuPaddleModelsPath = this.getGPUPaddleInstallPath();

      if (!fs.existsSync(gpuPaddleModelsPath)) {
        return {
          success: false,
          error: 'GPU PaddlePaddle not installed. Please install GPU PaddlePaddle first.'
        };
      }

      // First ensure pip is available
      if (onProgress) onProgress('Checking pip availability...');
      
      const pipAvailability = await this.ensurePipAvailable();
      if (!pipAvailability.success) {
        return { success: false, error: pipAvailability.error };
      }

      const actualPythonPath = pipAvailability.pythonPath;
      console.log('🔧 Using Python with pip:', actualPythonPath);

      if (onProgress) onProgress('Installing compatible NumPy version...');

      // Install compatible NumPy version (< 2.0) to GPU PaddlePaddle directory
      const pipArgs = [
        '-m',
        'pip',
        'install',
        'numpy<2.0',  // Install NumPy 1.x (compatible with PaddlePaddle GPU 3.2.0)
        '--target', gpuPaddleModelsPath,
        '--upgrade',  // Upgrade existing NumPy if present
        '--force-reinstall'  // Force reinstall to ensure compatibility
      ];

      console.log('🔧 Running pip command:', actualPythonPath, pipArgs.join(' '));

      return new Promise((resolve) => {
        const pipProcess = spawn(actualPythonPath, pipArgs, {
          shell: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        pipProcess.stdout.on('data', (data) => {
          const text = data.toString();
          output += text;
          console.log('🔧 PIP OUTPUT:', text.trim());
          if (onProgress && text.includes('Installing')) {
            onProgress('Installing NumPy...');
          }
        });

        pipProcess.stderr.on('data', (data) => {
          const text = data.toString();
          errorOutput += text;
          console.log('🔧 PIP STDERR:', text.trim());
        });

        pipProcess.on('close', (code) => {
          console.log('🔧 PIP process exited with code:', code);

          if (code === 0) {
            console.log('✅ NumPy compatibility fix completed successfully!');
            if (onProgress) {
              onProgress('NumPy compatibility fixed! Please restart OCR.');
            }
            resolve({ success: true });
          } else {
            resolve({
              success: false,
              error: `NumPy installation failed with code ${code}. ${errorOutput || 'Unknown error'}`
            });
          }
        });

        pipProcess.on('error', (error) => {
          console.error('🔧 PIP process error:', error);
          resolve({
            success: false,
            error: `Failed to start pip: ${error.message}`
          });
        });

        // Timeout after 5 minutes
        setTimeout(() => {
          pipProcess.kill();
          resolve({
            success: false,
            error: 'NumPy installation timeout after 5 minutes'
          });
        }, 300000);
      });

    } catch (error) {
      console.error('🔧 Error fixing NumPy compatibility:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
