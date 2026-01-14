import { ipcMain, IpcMainInvokeEvent, desktopCapturer, BrowserWindow, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigurationManager } from '../../services/ConfigurationManager';
import { getTtsPlaybackState } from '../handlers.js';
import { AudioLevelOverlayManager } from '../../services/AudioLevelOverlayManager';


let isTtsPlaying = false;
let ttsPlaybackStartTime = 0;
let ttsPlaybackEndTime = 0;


/**
 * WASAPI Handlers
 * 
 * This module contains all IPC handlers related to WASAPI audio capture,
 * including addon loading, capture management, VAD processing, and helper functions.
 */

function resolveAudioAddonPath(): string | null {
  try {
    const platform = process.platform;
    const addonName = platform === 'darwin' ? 'coreaudio_loopback.node' : 'wasapi_loopback.node';
    const nativeDir = platform === 'darwin' ? 'native-coreaudio-loopback' : 'native-wasapi-loopback';
    const buildDir = platform === 'darwin' ? 'build/Release' : 'build/Release';
    
    const candidates: string[] = [];
    const res = (process as any).resourcesPath as string | undefined;
    const here = __dirname;
    const cwd = process.cwd();
    
    // In packaged app, the addon will be unpacked from ASAR
    if (app.isPackaged && res) {
      // Check in the unpacked app directory
      candidates.push(path.join(res, 'app.asar.unpacked', addonName));
      candidates.push(path.join(res, 'app', addonName));
      // Check in extraResources (for installed version)
      candidates.push(path.join(res, addonName));
      // Also check in the native directory structure
      candidates.push(path.join(res, 'app.asar.unpacked', nativeDir, buildDir, addonName));
      candidates.push(path.join(res, 'app', nativeDir, buildDir, addonName));
    }
    
    // Development paths
    const rels = [
      [addonName], // Direct path in dist
      ['..', nativeDir, buildDir, addonName],
      ['..', '..', nativeDir, buildDir, addonName],
      [nativeDir, buildDir, addonName]
    ];
    
    for (const segs of rels) {
      candidates.push(path.join(here, ...segs));
      candidates.push(path.join(cwd, ...segs));
      if (res) {
        candidates.push(path.join(res, ...segs));
        candidates.push(path.join(res, 'app', ...segs));
      }
    }
    
    for (const p of candidates) {
      try { 
        if (fs.existsSync(p)) {
          console.log(`[main] Found ${platform === 'darwin' ? 'CoreAudio' : 'WASAPI'} addon at:`, p);
          return p; 
        } 
      } catch {}
    }
    
    console.log(`[main] ${platform === 'darwin' ? 'CoreAudio' : 'WASAPI'} addon not found in any of these paths:`, candidates);
    return null;
  } catch (e) {
    console.log(`[main] Error resolving ${process.platform === 'darwin' ? 'CoreAudio' : 'WASAPI'} path:`, e);
    return null;
  }
}

// Keep resolveWasapiPath for backward compatibility
function resolveWasapiPath(): string | null {
  return resolveAudioAddonPath();
}

// Audio addon loading and management (platform-aware)
let wasapiAddon: any = null; // Actually holds either WASAPI or CoreAudio addon

function loadWasapiAddon(): boolean {
  if (wasapiAddon) {
    const platform = process.platform;
    console.log(`[main] ${platform === 'darwin' ? 'CoreAudio' : 'WASAPI'} addon already loaded`);
    return true;
  }
  
  try {
    const platform = process.platform;
    console.log(`[main] Attempting to load ${platform === 'darwin' ? 'CoreAudio' : 'WASAPI'} addon...`);
    const addonPath = resolveAudioAddonPath();
    if (!addonPath) {
      console.log(`[main] ${platform === 'darwin' ? 'CoreAudio' : 'WASAPI'} addon path not found`);
      return false;
    }
    
    console.log(`[main] Loading ${platform === 'darwin' ? 'CoreAudio' : 'WASAPI'} addon from:`, addonPath);
    wasapiAddon = require(addonPath);
    console.log(`[main] ${platform === 'darwin' ? 'CoreAudio' : 'WASAPI'} addon loaded successfully`);
    console.log(`[main] ${platform === 'darwin' ? 'CoreAudio' : 'WASAPI'} addon exports:`, Object.keys(wasapiAddon));
    return true;
  } catch (e) {
    const platform = process.platform;
    console.log(`[main] Failed to load ${platform === 'darwin' ? 'CoreAudio' : 'WASAPI'} addon:`, e instanceof Error ? e.message : e);
    console.log('[main] Error stack:', e instanceof Error ? e.stack : 'No stack trace');
    return false;
  }
}

// Voice boost settings for whisper-level speech detection
let voiceBoostEnabled = true;
let voiceBoostLevel = 10.0; // Default 10x boost for quiet audio (adjust from 1.0-50.0)

/**
 * Apply voice boost to PCM audio data
 * Uses RMS normalization + compression + soft limiting for whisper-level speech
 * @param pcmData Raw 16-bit PCM audio buffer
 * @param boostLevel Multiplier (1.0 = no boost, 3.0 = 3x, 6.0 = 6x max)
 * @returns Boosted PCM buffer
 */
function applyVoiceBoost(pcmData: Buffer, boostLevel: number = voiceBoostLevel): Buffer {
  if (!voiceBoostEnabled || boostLevel <= 1.0) {
    return pcmData;
  }
  
  const samples = pcmData.length / 2; // 16-bit samples
  if (samples === 0) return pcmData;
  
  // Convert to float32 for processing
  const floatData = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    floatData[i] = pcmData.readInt16LE(i * 2) / 32768.0;
  }
  
  // Calculate RMS (root mean square) for normalization
  let sumSquares = 0;
  for (let i = 0; i < samples; i++) {
    sumSquares += floatData[i] * floatData[i];
  }
  const rms = Math.sqrt(sumSquares / samples);
  
  // Skip processing if audio is essentially silent (noise floor)
  // Lower threshold to catch very quiet signals at -60dB and below
  if (rms < 0.00001) {
    return pcmData;
  }
  
  // Target RMS for normalized audio (0.20 is a good level for Whisper)
  const targetRms = 0.20;
  
  // Calculate adaptive gain based on how quiet the audio is
  // Quieter audio gets more boost, up to a maximum
  // For -40dB audio (rms ~0.01), we need ~20x to reach 0.20
  // For -60dB audio (rms ~0.001), we need ~200x
  let adaptiveGain = targetRms / rms;
  adaptiveGain = Math.min(adaptiveGain, 200.0); // Cap at 200x for very quiet audio
  adaptiveGain = Math.max(adaptiveGain, 1.0); // Don't attenuate
  
  // Apply dynamic compression to bring up whispers while limiting loud peaks
  // Compression threshold: -30dB (0.0316 linear)
  const threshold = 0.0316;
  const ratio = 4.0; // 4:1 compression ratio
  const makeupGain = boostLevel; // Apply the boost as makeup gain
  
  // Process with compression + gain
  const outputData = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    let sample = floatData[i];
    const absSample = Math.abs(sample);
    
    // Apply compression above threshold
    if (absSample > threshold) {
      const excess = absSample - threshold;
      const compressed = threshold + (excess / ratio);
      sample = sample > 0 ? compressed : -compressed;
    } else {
      // Below threshold: boost quiet signals more aggressively
      sample *= adaptiveGain;
    }
    
    // Apply makeup gain
    sample *= makeupGain;
    
    // Soft limiting using tanh to prevent harsh clipping
    if (Math.abs(sample) > 0.7) {
      sample = Math.tanh(sample);
    }
    
    // Hard limit to prevent clipping
    sample = Math.max(-0.99, Math.min(0.99, sample));
    
    outputData[i] = sample;
  }
  
  // Convert back to 16-bit PCM
  const boostedBuffer = Buffer.alloc(pcmData.length);
  for (let i = 0; i < samples; i++) {
    const intSample = Math.round(outputData[i] * 32767);
    boostedBuffer.writeInt16LE(Math.max(-32768, Math.min(32767, intSample)), i * 2);
  }
  
  return boostedBuffer;
}

// Expose voice boost controls
export function setVoiceBoostEnabled(enabled: boolean): void {
  voiceBoostEnabled = enabled;
  console.log(`[VoiceBoost] ${enabled ? 'Enabled' : 'Disabled'}`);
}

export function setVoiceBoostLevel(level: number): void {
  voiceBoostLevel = Math.max(1.0, Math.min(50.0, level)); // Clamp between 1.0 and 50.0
  console.log(`[VoiceBoost] Level set to ${voiceBoostLevel.toFixed(1)}x`);
}

export function getVoiceBoostSettings(): { enabled: boolean; level: number } {
  return { enabled: voiceBoostEnabled, level: voiceBoostLevel };
}

// Helper function to convert raw PCM to WAV format (with optional voice boost)
function convertPcmToWav(pcmData: Buffer, sampleRate: number, channels: number, applyBoost: boolean = true): Buffer {
  // Apply voice boost for better whisper detection
  const processedPcm = applyBoost ? applyVoiceBoost(pcmData) : pcmData;
  
  const length = processedPcm.length;
  const buffer = Buffer.alloc(44 + length);
  
  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + length, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Sub-chunk size
  buffer.writeUInt16LE(1, 20);  // Audio format (PCM)
  buffer.writeUInt16LE(channels, 22); // Number of channels
  buffer.writeUInt32LE(sampleRate, 24); // Sample rate
  buffer.writeUInt32LE(sampleRate * channels * 2, 28); // Byte rate
  buffer.writeUInt16LE(channels * 2, 32); // Block align
  buffer.writeUInt16LE(16, 34); // Bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(length, 40);
  
  // Copy processed PCM data
  processedPcm.copy(buffer, 44);
  
  return buffer;
}

export function registerWasapiHandlers(): void {
  // Initialize audio addon on startup (only on supported platforms)
  if (process.platform === 'win32' || process.platform === 'darwin') {
    loadWasapiAddon();
  }

  // Voice boost control handlers
  ipcMain.handle('voice-boost:set-enabled', async (event, enabled: boolean) => {
    setVoiceBoostEnabled(enabled);
    return { success: true, enabled: voiceBoostEnabled };
  });

  ipcMain.handle('voice-boost:set-level', async (event, level: number) => {
    setVoiceBoostLevel(level);
    return { success: true, level: voiceBoostLevel };
  });

  ipcMain.handle('voice-boost:get-settings', async () => {
    return getVoiceBoostSettings();
  });

  ipcMain.on('wasapi:pcm', (event, pcm: Buffer) => {
  try {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) win.webContents.send('wasapi:pcm', pcm);
    }
  } catch {}
});

ipcMain.handle('get-desktop-sources', async (_event, types: Array<'screen' | 'window'>) => {
  const sources = await desktopCapturer.getSources({ types });
  return sources;
});

ipcMain.handle('resolve-wasapi-addon', async () => resolveWasapiPath());

ipcMain.on('resolve-wasapi-addon-sync', (event) => {
  event.returnValue = resolveWasapiPath();
});

	// WASAPI IPC handlers with enhanced VAD and WAV output
ipcMain.handle('wasapi:start-capture', async (event, pid: number) => {
	try {
		const platform = process.platform;
		
		// On macOS, we use screen capture audio instead of Core Audio addon
		if (platform === 'darwin') {
			console.log('[main] macOS: Using screen capture audio (no addon needed)');
			console.log('[main] Screen capture will be initiated from renderer process');
			
			// Check if BlackHole is installed (for virtual microphone)
			if (!loadWasapiAddon()) {
				console.log('[main] ⚠️  BlackHole check: addon not loaded, showing setup overlay');
				// Show BlackHole setup overlay
				const { BlackHoleSetupOverlayManager } = await import('../../services/BlackHoleSetupOverlayManager');
				const blackHoleSetupManager = BlackHoleSetupOverlayManager.getInstance();
				await blackHoleSetupManager.showBlackHoleSetupOverlay(true);
			} else if (wasapiAddon && typeof wasapiAddon.checkMultiOutputSetup === 'function') {
				const setupCheck = wasapiAddon.checkMultiOutputSetup();
				console.log('[main] BlackHole check:', setupCheck);
				
				if (!setupCheck.blackHoleInstalled) {
					console.log('[main] ⚠️  BlackHole not installed, showing setup overlay');
					const { BlackHoleSetupOverlayManager } = await import('../../services/BlackHoleSetupOverlayManager');
					const blackHoleSetupManager = BlackHoleSetupOverlayManager.getInstance();
					await blackHoleSetupManager.showBlackHoleSetupOverlay(true);
				}
			}
			
			// Return success - the renderer will handle screen capture
			return { 
				success: true, 
				method: 'screen-capture',
				message: 'Screen capture audio will be used on macOS. BlackHole is only needed for virtual microphone.'
			};
		}
		
		// Windows: Use WASAPI addon
		const addonName = 'WASAPI';
		console.log(`[main] ${addonName} start-capture called with PID:`, pid);
		console.log(`[main] Current ${addonName} addon state:`, wasapiAddon ? 'loaded' : 'not loaded');
		
		if (!loadWasapiAddon()) {
			console.log(`[main] Failed to load ${addonName} addon`);
			throw new Error(`${addonName} addon not available`);
		}
		
		console.log(`[main] ${addonName} addon loaded, checking startCapture function...`);
		if (!wasapiAddon || typeof wasapiAddon.startCapture !== 'function') {
			console.log(`[main] ${addonName} addon available functions:`, wasapiAddon ? Object.keys(wasapiAddon) : 'null');
			throw new Error(`${addonName} addon startCapture function not available`);
		}
		
		console.log(`[main] Starting ${addonName} capture for PID:`, pid);
		
		// Get config manager instance for dynamic language updates
		const configManager = ConfigurationManager.getInstance();
		
		// Helper function to check if language is complex and get MIN_CHUNK_MS
		const getMinChunkMs = (): { minChunkMs: number; sourceLanguage: string; isComplex: boolean } => {
			const config = configManager.getConfig();
			const bidiLang = config.uiSettings?.bidirectionalSourceLanguage;
			const mainLang = config.sourceLanguage;
			const sourceLanguage = (bidiLang || mainLang || 'auto').toLowerCase().trim();
			
			// Slavic languages and other complex languages require longer chunks for better transcription accuracy
			const complexLanguages = ['ru', 'pl', 'cs', 'sk', 'bg', 'sr', 'hr', 'sl', 'uk', 'be', 'mk', 'bs', 'sv',
			                          'russian', 'polish', 'czech', 'slovak', 'bulgarian', 'serbian', 'croatian', 
			                          'slovenian', 'ukrainian', 'belarusian', 'macedonian', 'bosnian', 'swedish'];
			const isComplexLanguage = sourceLanguage !== 'auto' && complexLanguages.includes(sourceLanguage);
			
			// Use longer chunks for complex languages (2000ms) vs simple languages (500ms)
			const minChunkMs = isComplexLanguage ? 2500 : 1000;
			return { minChunkMs, sourceLanguage, isComplex: isComplexLanguage };
		};
		
		// Enhanced VAD with WebRTC for better speech detection
		let vad: any = null;
		try {
			const WebRtcVad = require('@serenade/webrtcvad');
			vad = new WebRtcVad();
			vad.setMode(3); // Aggressive mode (3) for better noise filtering
			console.log('[main] WebRTC VAD loaded in aggressive mode');
		} catch {
			console.warn('[main] WebRTC VAD not available; using energy-based fallback');
		}

		// VAD configuration with silence-based chunking (cuts at natural pauses)
		const TARGET_RATE = 16000;
		const VAD_FRAME_MS = 20;
		const VAD_FRAME_SAMPLES = (TARGET_RATE * VAD_FRAME_MS) / 1000; // 320 samples
		const VAD_FRAME_BYTES = VAD_FRAME_SAMPLES * 2; // int16 mono

		// Silence-based chunking parameters (dynamic, will update based on language)
		const MAX_CHUNK_MS = 3000; // Maximum chunk duration (force cut if too long)
		const PAUSE_THRESHOLD_MS = 50; // 50ms pause = end of word boundary (was fixed 800ms)
		const OVERLAP_MS = 100; // Reduced overlap since we're cutting at natural boundaries

		// Dynamic chunking variables that update based on language
		const initialCheck = getMinChunkMs();
		let currentMinChunkMs = initialCheck.minChunkMs;
		let MIN_CHUNK_FRAMES = Math.floor(currentMinChunkMs / VAD_FRAME_MS);
		let lastLanguageCheck = Date.now();
		const LANGUAGE_CHECK_INTERVAL_MS = 1000; // Check language every 1 second
		
		console.log(`[main] 🎯 ${addonName} start-capture - Language: "${initialCheck.sourceLanguage}", IsComplex: ${initialCheck.isComplex}, MIN_CHUNK_MS: ${currentMinChunkMs}, MIN_CHUNK_FRAMES: ${MIN_CHUNK_FRAMES}`);
		const MAX_CHUNK_FRAMES = Math.floor(MAX_CHUNK_MS / VAD_FRAME_MS);
		const PAUSE_FRAMES = Math.floor(PAUSE_THRESHOLD_MS / VAD_FRAME_MS); // 2-3 frames = word boundary
		const OVERLAP_FRAMES = Math.floor(OVERLAP_MS / VAD_FRAME_MS);

		// Backpressure handling
		let processingQueue: Buffer[] = [];
		let isProcessingBacklog = false;
		const MAX_QUEUE_SIZE = 50; // Maximum WAV chunks to queue
		
		// Silence-based chunking state
		let pendingInt16 = Buffer.alloc(0);
		let currentChunkFrames: Buffer[] = []; // Current accumulating chunk
		let lastChunkOverlapFrames: Buffer[] = []; // Overlap from previous chunk
		let consecutiveSilenceFrames = 0; // Track consecutive silence
		let hasAnySpeechInChunk = false; // Track if current chunk has speech
		let lastFrameTime = Date.now();
		
		const webContentsId = event.sender.id;
		
		// Process backlog function for backpressure handling
		const processBacklog = async () => {
			if (isProcessingBacklog || processingQueue.length === 0) return;
			
			isProcessingBacklog = true;
			console.log('[main] Processing VAD backlog:', processingQueue.length, 'chunks');
			
			try {
				while (processingQueue.length > 0) {
					const wavChunk = processingQueue.shift()!;
					
					// Send to renderer for transcription (fixed-size chunk)
					try {
						const { webContents } = require('electron');
						const wc = webContents.fromId(webContentsId);
						if (wc && !wc.isDestroyed()) {
							wc.send('wasapi:chunk-wav', wavChunk);
						}
					} catch (error) {
						console.warn('[main] Failed to send WAV chunk to renderer:', error);
					}
					
					// Small delay to prevent overwhelming the renderer
					await new Promise(resolve => setTimeout(resolve, 10));
				}
			} finally {
				isProcessingBacklog = false;
			}
		};

		// Start audio capture with WAV output and VAD
		const startedOk: boolean = wasapiAddon.startCapture(pid >>> 0, (wavData: Buffer) => {
			console.log(`[main] ${addonName} WAV data received:`, wavData.length, 'bytes');

			// NOTE: No need to filter TTS audio - it's routed to VB-Audio Cable (separate device)
			// WASAPI captures system audio which excludes the VB-Cable device

			// Extract PCM data from WAV for VAD processing
			// WAV header is 44 bytes, PCM data starts at offset 44
			if (wavData.length <= 44) {
				console.warn('[main] WAV chunk too small, skipping VAD');
				return;
			}
			
			const pcmData = wavData.subarray(44); // Skip WAV header
			
			// Also send PCM data to renderer for real-time VAD analyzer (MediaStream feed)
			// This allows the bidirectional VAD to detect audio levels in real-time
			// CoreAudio sends 16kHz mono 16-bit PCM, which matches what the worklet expects
			try {
				const { webContents } = require('electron');
				const wc = webContents.fromId(webContentsId);
				if (wc && !wc.isDestroyed()) {
					// Send PCM data as Buffer (will be converted to ArrayBuffer in renderer)
					wc.send('wasapi:pcm', pcmData);
					
					// Debug: Log first few samples to verify audio is being captured
					if (pcmData.length >= 4) {
						const firstSample = pcmData.readInt16LE(0);
						const secondSample = pcmData.readInt16LE(2);
						// Only log occasionally to avoid spam
						if (Math.random() < 0.01) { // 1% of the time
							console.log(`[main] ${addonName} PCM feed: ${pcmData.length} bytes, first samples: ${firstSample}, ${secondSample}`);
						}
					}
				}
			} catch (error) {
				console.warn(`[main] Failed to send ${addonName} PCM to renderer:`, error);
			}
			
			// Calculate audio levels for bidirectional overlay
			try {
				const int16Data = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength / 2);
				let sumSq = 0;
				for (let i = 0; i < int16Data.length; i++) {
					const normalized = int16Data[i] / 32768; // Normalize to -1 to 1
					sumSq += normalized * normalized;
				}
				const rms = Math.sqrt(sumSq / int16Data.length);
				
				// Create 8 bars based on RMS
				const baseLevel = Math.min(1, rms * 8); // Amplify for visibility
				const audioLevels: number[] = [];
				for (let i = 0; i < 8; i++) {
					const distanceFromCenter = Math.abs(i - 3.5);
					const centerBoost = 1 - (distanceFromCenter / 4) * 0.3;
					const value = Math.max(0.15, Math.min(1, baseLevel * centerBoost * (0.9 + Math.random() * 0.2)));
					audioLevels.push(value);
				}
				
				// Send to overlay
				AudioLevelOverlayManager.getInstance().updateBidiAudio(audioLevels);
			} catch (e) {
				// Ignore errors
			}
			
			// Resample and convert for VAD if needed
			// WASAPI output should already be 16-bit PCM, but we need 16kHz mono for VAD
			let vadInput: Buffer;
			
			// Read WAV header to get format info
			const channels = wavData.readUInt16LE(22);
			const sampleRate = wavData.readUInt32LE(24);
			
			if (sampleRate === TARGET_RATE && channels === 1) {
				// Perfect format for VAD
				vadInput = pcmData;
			} else {
				// Convert stereo to mono and/or resample
				const int16Data = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength / 2);
				let monoData: Int16Array;
				
				if (channels === 2) {
					// Convert stereo to mono by averaging channels
					monoData = new Int16Array(int16Data.length / 2);
					for (let i = 0; i < monoData.length; i++) {
						monoData[i] = Math.round((int16Data[i * 2] + int16Data[i * 2 + 1]) / 2);
					}
				} else {
					monoData = int16Data;
				}
				
				// Simple resampling if needed (basic decimation/interpolation)
				if (sampleRate !== TARGET_RATE) {
					const resampleRatio = sampleRate / TARGET_RATE;
					const outputLength = Math.floor(monoData.length / resampleRatio);
					const resampledData = new Int16Array(outputLength);
					
					for (let i = 0; i < outputLength; i++) {
						const sourceIndex = Math.floor(i * resampleRatio);
						resampledData[i] = monoData[sourceIndex];
					}
					monoData = resampledData;
				}
				
				vadInput = Buffer.from(monoData.buffer);
			}
			
			// Process VAD frames
			pendingInt16 = Buffer.concat([pendingInt16, vadInput]);
			
			while (pendingInt16.length >= VAD_FRAME_BYTES) {
				const frame = pendingInt16.subarray(0, VAD_FRAME_BYTES);
				pendingInt16 = pendingInt16.subarray(VAD_FRAME_BYTES);

        			// Dynamically update chunking parameters if language changed
			const now = Date.now();
			if (now - lastLanguageCheck >= LANGUAGE_CHECK_INTERVAL_MS) {
				const langCheck = getMinChunkMs();
				if (langCheck.minChunkMs !== currentMinChunkMs) {
					currentMinChunkMs = langCheck.minChunkMs;
					MIN_CHUNK_FRAMES = Math.floor(currentMinChunkMs / VAD_FRAME_MS);
					console.log(`[main] 🔄 Language changed - "${langCheck.sourceLanguage}" (Complex: ${langCheck.isComplex}), MIN_CHUNK_MS: ${currentMinChunkMs}, MIN_CHUNK_FRAMES: ${MIN_CHUNK_FRAMES}`);
				}
				lastLanguageCheck = now;
			}
			// Detect speech using WebRTC VAD or fallback
			let isSpeech = false;
				if (vad) {
					try { 
						isSpeech = vad.isSpeech(frame, TARGET_RATE); 
					} catch (error) { 
						console.warn('[main] VAD processing error:', error);
						isSpeech = false; 
					}
				} else {
					// Energy-based fallback VAD
					let sum = 0;
					for (let i = 0; i < VAD_FRAME_BYTES; i += 2) {
						const sample = frame.readInt16LE(i) / 32768;
						sum += sample * sample;
					}
					const rms = Math.sqrt(sum / VAD_FRAME_SAMPLES);
					isSpeech = rms > 0.005; // Lowered from 0.015 for quiet voice detection
				}

				// Silence-based chunking: accumulate frames and cut at natural pauses
				lastFrameTime = Date.now();
				currentChunkFrames.push(frame);

				if (isSpeech) {
					hasAnySpeechInChunk = true;
					consecutiveSilenceFrames = 0;
				} else {
					consecutiveSilenceFrames++;
				}

				const chunkDurationFrames = currentChunkFrames.length;

				// Cut chunk at natural boundary: 50ms pause after speech (word/phrase boundary)
				const shouldCutAtPause = consecutiveSilenceFrames >= PAUSE_FRAMES &&
				                         hasAnySpeechInChunk &&
				                         chunkDurationFrames >= MIN_CHUNK_FRAMES;

				// Force cut if chunk gets too long (3 seconds max)
				const shouldForceCut = chunkDurationFrames >= MAX_CHUNK_FRAMES && hasAnySpeechInChunk;

				if (shouldCutAtPause || shouldForceCut) {
					// Build chunk with overlap from previous chunk
					const allFrames = [...lastChunkOverlapFrames, ...currentChunkFrames];
					const chunkPcm = Buffer.concat(allFrames);
					const chunkWav = convertPcmToWav(chunkPcm, TARGET_RATE, 1);

					if (processingQueue.length < MAX_QUEUE_SIZE) {
						processingQueue.push(chunkWav);
						setImmediate(processBacklog);
						const chunkDurationMs = (allFrames.length * VAD_FRAME_MS).toFixed(0);
						const cutReason = shouldForceCut ? 'max-length' : 'pause';
						console.log(`[main] VAD: Sent ${chunkDurationMs}ms chunk (cut at ${cutReason}, pause: ${consecutiveSilenceFrames * VAD_FRAME_MS}ms, overlap: ${lastChunkOverlapFrames.length * VAD_FRAME_MS}ms)`);
					} else {
						console.warn('[main] VAD: Processing queue full, dropping chunk');
					}

					// Save overlap for next chunk (last 100ms)
					lastChunkOverlapFrames = currentChunkFrames.slice(-OVERLAP_FRAMES);

					// Start new chunk
					currentChunkFrames = [];
					hasAnySpeechInChunk = false;
					consecutiveSilenceFrames = 0;
				}

			// Long silence cleanup: if 1 second of silence and we had some speech, flush it
			const LONG_SILENCE_FRAMES = 50; // 1 second
			const VERY_LONG_SILENCE_FRAMES = 100; // 2 seconds - clear everything including overlap
			
			if (consecutiveSilenceFrames >= LONG_SILENCE_FRAMES && hasAnySpeechInChunk && chunkDurationFrames >= MIN_CHUNK_FRAMES) {
				console.log(`[main] VAD: Flushing chunk after ${consecutiveSilenceFrames * VAD_FRAME_MS}ms silence (${chunkDurationFrames} frames)`);
				const allFrames = [...lastChunkOverlapFrames, ...currentChunkFrames];
				const chunkPcm = Buffer.concat(allFrames);
				const chunkWav = convertPcmToWav(chunkPcm, TARGET_RATE, 1);

				if (processingQueue.length < MAX_QUEUE_SIZE) {
					processingQueue.push(chunkWav);
					setImmediate(processBacklog);
				}

				// Clear state
				lastChunkOverlapFrames = [];
				currentChunkFrames = [];
				hasAnySpeechInChunk = false;
				consecutiveSilenceFrames = 0;
			}
			// Very long silence (2+ seconds): Clear everything including overlap to prevent contamination
			else if (consecutiveSilenceFrames >= VERY_LONG_SILENCE_FRAMES) {
				if (currentChunkFrames.length > 0 || lastChunkOverlapFrames.length > 0) {
					console.log(`[main] VAD: 🧹 Clearing all state after ${consecutiveSilenceFrames * VAD_FRAME_MS}ms silence (fresh start)`);
					lastChunkOverlapFrames = [];
					currentChunkFrames = [];
					hasAnySpeechInChunk = false;
					consecutiveSilenceFrames = 0;
				}
			}
		}
	});
		
		if (!startedOk) {
			const addonName = process.platform === 'darwin' ? 'CoreAudio' : 'WASAPI';
			console.error(`[main] ${addonName} startCapture returned false (capture thread not started)`);
			return { success: false, error: `Failed to start ${addonName} capture (addon returned false)` };
		}
		
		return { success: true };
	} catch (error) {
		const addonName = process.platform === 'darwin' ? 'CoreAudio' : 'WASAPI';
		console.error(`[main] Failed to start ${addonName} capture:`, error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
});

ipcMain.handle('wasapi:stop-capture', async (event) => {
  try {
    if (wasapiAddon && typeof wasapiAddon.stopCapture === 'function') {
      const addonName = process.platform === 'darwin' ? 'CoreAudio' : 'WASAPI';
      console.log(`[main] Stopping ${addonName} capture`);
      
      // Send a flush signal to the renderer to indicate we should process any remaining audio
      const webContentsId = event.sender.id;
      try {
        const { webContents } = require('electron');
        const wc = webContents.fromId(webContentsId);
        if (wc && !wc.isDestroyed()) {
          wc.send('wasapi:flush-remaining');
          console.log('[main] Sent flush signal to renderer');
        }
      } catch (error) {
        console.warn('[main] Failed to send flush signal:', error);
      }
      
      // Wait a moment for the flush to be processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      wasapiAddon.stopCapture();
    }
    return { success: true };
  } catch (error) {
    console.error('[main] Failed to stop WASAPI capture:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// WASAPI capture with current process excluded
ipcMain.handle('wasapi:start-capture-exclude-current', async (event) => {
	try {
		const platform = process.platform;
		const addonName = platform === 'darwin' ? 'CoreAudio' : 'WASAPI';
		console.log(`[main] ${addonName} start-capture-exclude-current called`);
		console.log(`[main] Current ${addonName} addon state:`, wasapiAddon ? 'loaded' : 'not loaded');
		
		if (!loadWasapiAddon()) {
			console.log(`[main] Failed to load ${addonName} addon`);
			throw new Error(`${addonName} addon not available`);
		}
		
		console.log(`[main] ${addonName} addon loaded, checking startCaptureExcludeCurrent function...`);
		if (!wasapiAddon || typeof wasapiAddon.startCaptureExcludeCurrent !== 'function') {
			console.log(`[main] ${addonName} addon available functions:`, wasapiAddon ? Object.keys(wasapiAddon) : 'null');
			throw new Error(`${addonName} addon startCaptureExcludeCurrent function not available`);
		}
		
		console.log(`[main] Starting ${addonName} capture with current process excluded`);
		
		// Get config manager instance for dynamic language updates
		const configManager = ConfigurationManager.getInstance();
		
		// Helper function to check if language is complex and get MIN_CHUNK_MS
		const getMinChunkMs = (): { minChunkMs: number; sourceLanguage: string; isComplex: boolean } => {
			const config = configManager.getConfig();
			const bidiLang = config.uiSettings?.bidirectionalSourceLanguage;
			const mainLang = config.sourceLanguage;
			const sourceLanguage = (bidiLang || mainLang || 'auto').toLowerCase().trim();
			
			// Slavic languages and other complex languages require longer chunks for better transcription accuracy
			const complexLanguages = ['ru', 'pl', 'cs', 'sk', 'bg', 'sr', 'hr', 'sl', 'uk', 'be', 'mk', 'bs', 'sv',
			                          'russian', 'polish', 'czech', 'slovak', 'bulgarian', 'serbian', 'croatian', 
			                          'slovenian', 'ukrainian', 'belarusian', 'macedonian', 'bosnian', 'swedish'];
			const isComplexLanguage = sourceLanguage !== 'auto' && complexLanguages.includes(sourceLanguage);
			
			// Use longer chunks for complex languages (2000ms) vs simple languages (500ms)
			const minChunkMs = isComplexLanguage ? 1250 : 500;
			return { minChunkMs, sourceLanguage, isComplex: isComplexLanguage };
		};
		
		// Enhanced VAD with WebRTC for better speech detection
		let vad: any = null;
		try {
			const WebRtcVad = require('@serenade/webrtcvad');
			vad = new WebRtcVad();
			vad.setMode(3); // Aggressive mode (3) for better noise filtering
			console.log('[main] WebRTC VAD loaded in aggressive mode');
		} catch {
			console.warn('[main] WebRTC VAD not available; using energy-based fallback');
		}

		// VAD configuration with silence-based chunking (cuts at natural pauses)
		const TARGET_RATE = 16000;
		const VAD_FRAME_MS = 20;
		const VAD_FRAME_SAMPLES = (TARGET_RATE * VAD_FRAME_MS) / 1000; // 320 samples
		const VAD_FRAME_BYTES = VAD_FRAME_SAMPLES * 2; // int16 mono

		// Silence-based chunking parameters (dynamic, will update based on language)
		const MAX_CHUNK_MS = 3000; // Maximum chunk duration (force cut if too long)
		const PAUSE_THRESHOLD_MS = 50; // 50ms pause = end of word boundary (was fixed 800ms)
		const OVERLAP_MS = 100; // Reduced overlap since we're cutting at natural boundaries

		// Dynamic chunking variables that update based on language
		const initialCheck = getMinChunkMs();
		let currentMinChunkMs = initialCheck.minChunkMs;
		let MIN_CHUNK_FRAMES = Math.floor(currentMinChunkMs / VAD_FRAME_MS);
		let lastLanguageCheck = Date.now();
		const LANGUAGE_CHECK_INTERVAL_MS = 1000; // Check language every 1 second
		
		console.log(`[main] 🎯 ${addonName} exclude-current - Language: "${initialCheck.sourceLanguage}", IsComplex: ${initialCheck.isComplex}, MIN_CHUNK_MS: ${currentMinChunkMs}, MIN_CHUNK_FRAMES: ${MIN_CHUNK_FRAMES}`);
		const MAX_CHUNK_FRAMES = Math.floor(MAX_CHUNK_MS / VAD_FRAME_MS);
		const PAUSE_FRAMES = Math.floor(PAUSE_THRESHOLD_MS / VAD_FRAME_MS); // 2-3 frames = word boundary
		const OVERLAP_FRAMES = Math.floor(OVERLAP_MS / VAD_FRAME_MS);

		// Backpressure handling
		let processingQueue: Buffer[] = [];
		let isProcessingBacklog = false;
		const MAX_QUEUE_SIZE = 50; // Maximum WAV chunks to queue
		
		// Silence-based chunking state
		let pendingInt16 = Buffer.alloc(0);
		let currentChunkFrames: Buffer[] = []; // Current accumulating chunk
		let lastChunkOverlapFrames: Buffer[] = []; // Overlap from previous chunk
		let consecutiveSilenceFrames = 0; // Track consecutive silence
		let hasAnySpeechInChunk = false; // Track if current chunk has speech
		let lastFrameTime = Date.now();
		
		const webContentsId = event.sender.id;
		
		// Process backlog function for backpressure handling
		const processBacklog = async () => {
			if (isProcessingBacklog || processingQueue.length === 0) return;
			
			isProcessingBacklog = true;
			console.log('[main] Processing VAD backlog:', processingQueue.length, 'chunks');
			
			try {
				while (processingQueue.length > 0) {
					const wavChunk = processingQueue.shift()!;
					
					// Send to renderer for transcription (fixed-size chunk)
					try {
						const { webContents } = require('electron');
						const wc = webContents.fromId(webContentsId);
						if (wc && !wc.isDestroyed()) {
							wc.send('wasapi:chunk-wav', wavChunk);
						}
					} catch (error) {
						console.warn('[main] Failed to send WAV chunk to renderer:', error);
					}
					
					// Small delay to prevent overwhelming the renderer
					await new Promise(resolve => setTimeout(resolve, 10));
				}
			} finally {
				isProcessingBacklog = false;
			}
		};

		// Start audio capture with current process excluded
		const startedOk: boolean = wasapiAddon.startCaptureExcludeCurrent((wavData: Buffer) => {
			console.log(`[main] ${addonName} WAV data received (exclude current):`, wavData.length, 'bytes');
			
			// Filter out audio during TTS playback to prevent feedback
			const currentTime = Date.now();
			if (isTtsPlaying || (currentTime <= ttsPlaybackEndTime + 500)) { // 500ms grace period
				console.log('[main] Filtering out WASAPI audio during TTS playback (exclude current)');
				return;
			}
			
			// Extract PCM data from WAV for VAD processing
			// WAV header is 44 bytes, PCM data starts at offset 44
			if (wavData.length <= 44) {
				console.warn('[main] WAV chunk too small, skipping VAD');
				return;
			}
			
			const pcmData = wavData.subarray(44); // Skip WAV header
			
			// Resample and convert for VAD if needed
			// WASAPI output should already be 16-bit PCM, but we need 16kHz mono for VAD
			let vadInput: Buffer;
			
			// Read WAV header to get format info
			const channels = wavData.readUInt16LE(22);
			const sampleRate = wavData.readUInt32LE(24);
			
			if (sampleRate === TARGET_RATE && channels === 1) {
				// Perfect format for VAD
				vadInput = pcmData;
			} else {
				// Convert stereo to mono and/or resample
				const int16Data = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength / 2);
				let monoData: Int16Array;
				
				if (channels === 2) {
					// Convert stereo to mono by averaging channels
					monoData = new Int16Array(int16Data.length / 2);
					for (let i = 0; i < monoData.length; i++) {
						monoData[i] = Math.round((int16Data[i * 2] + int16Data[i * 2 + 1]) / 2);
					}
				} else {
					monoData = int16Data;
				}
				
				// Simple resampling if needed (basic decimation/interpolation)
				if (sampleRate !== TARGET_RATE) {
					const resampleRatio = sampleRate / TARGET_RATE;
					const outputLength = Math.floor(monoData.length / resampleRatio);
					const resampledData = new Int16Array(outputLength);
					
					for (let i = 0; i < outputLength; i++) {
						const sourceIndex = Math.floor(i * resampleRatio);
						resampledData[i] = monoData[sourceIndex];
					}
					monoData = resampledData;
				}
				
				vadInput = Buffer.from(monoData.buffer);
			}
			
			// Process VAD frames
			pendingInt16 = Buffer.concat([pendingInt16, vadInput]);
			
			while (pendingInt16.length >= VAD_FRAME_BYTES) {
				const frame = pendingInt16.subarray(0, VAD_FRAME_BYTES);
				pendingInt16 = pendingInt16.subarray(VAD_FRAME_BYTES);

        	// Dynamically update chunking parameters if language changed
			const now = Date.now();
			if (now - lastLanguageCheck >= LANGUAGE_CHECK_INTERVAL_MS) {
				const langCheck = getMinChunkMs();
				if (langCheck.minChunkMs !== currentMinChunkMs) {
					currentMinChunkMs = langCheck.minChunkMs;
					MIN_CHUNK_FRAMES = Math.floor(currentMinChunkMs / VAD_FRAME_MS);
					console.log(`[main] 🔄 Language changed - "${langCheck.sourceLanguage}" (Complex: ${langCheck.isComplex}), MIN_CHUNK_MS: ${currentMinChunkMs}, MIN_CHUNK_FRAMES: ${MIN_CHUNK_FRAMES}`);
				}
				lastLanguageCheck = now;
			}
      
			// Detect speech using WebRTC VAD or fallback
			let isSpeech = false;
				if (vad) {
					try { 
						isSpeech = vad.isSpeech(frame, TARGET_RATE); 
					} catch (error) { 
						console.warn('[main] VAD processing error:', error);
						isSpeech = false; 
					}
				} else {
					// Energy-based fallback VAD
					let sum = 0;
					for (let i = 0; i < VAD_FRAME_BYTES; i += 2) {
						const sample = frame.readInt16LE(i) / 32768;
						sum += sample * sample;
					}
					const rms = Math.sqrt(sum / VAD_FRAME_SAMPLES);
					isSpeech = rms > 0.005; // Lowered from 0.015 for quiet voice detection
				}

				// Silence-based chunking: accumulate frames and cut at natural pauses
				lastFrameTime = Date.now();
				currentChunkFrames.push(frame);

				if (isSpeech) {
					hasAnySpeechInChunk = true;
					consecutiveSilenceFrames = 0;
				} else {
					consecutiveSilenceFrames++;
				}

				const chunkDurationFrames = currentChunkFrames.length;

				// Cut chunk at natural boundary: 50ms pause after speech (word/phrase boundary)
				const shouldCutAtPause = consecutiveSilenceFrames >= PAUSE_FRAMES &&
				                         hasAnySpeechInChunk &&
				                         chunkDurationFrames >= MIN_CHUNK_FRAMES;

				// Force cut if chunk gets too long (3 seconds max)
				const shouldForceCut = chunkDurationFrames >= MAX_CHUNK_FRAMES && hasAnySpeechInChunk;

				if (shouldCutAtPause || shouldForceCut) {
					// Build chunk with overlap from previous chunk
					const allFrames = [...lastChunkOverlapFrames, ...currentChunkFrames];
					const chunkPcm = Buffer.concat(allFrames);
					const chunkWav = convertPcmToWav(chunkPcm, TARGET_RATE, 1);

					if (processingQueue.length < MAX_QUEUE_SIZE) {
						processingQueue.push(chunkWav);
						setImmediate(processBacklog);
						const chunkDurationMs = (allFrames.length * VAD_FRAME_MS).toFixed(0);
						const cutReason = shouldForceCut ? 'max-length' : 'pause';
						console.log(`[main] VAD: Sent ${chunkDurationMs}ms chunk (cut at ${cutReason}, pause: ${consecutiveSilenceFrames * VAD_FRAME_MS}ms, overlap: ${lastChunkOverlapFrames.length * VAD_FRAME_MS}ms)`);
					} else {
						console.warn('[main] VAD: Processing queue full, dropping chunk');
					}

					// Save overlap for next chunk (last 100ms)
					lastChunkOverlapFrames = currentChunkFrames.slice(-OVERLAP_FRAMES);

					// Start new chunk
					currentChunkFrames = [];
					hasAnySpeechInChunk = false;
					consecutiveSilenceFrames = 0;
				}

			// Long silence cleanup: if 1 second of silence and we had some speech, flush it
			const LONG_SILENCE_FRAMES = 50; // 1 second
			const VERY_LONG_SILENCE_FRAMES = 100; // 2 seconds - clear everything including overlap
			
			if (consecutiveSilenceFrames >= LONG_SILENCE_FRAMES && hasAnySpeechInChunk && chunkDurationFrames >= MIN_CHUNK_FRAMES) {
				console.log(`[main] VAD: Flushing chunk after ${consecutiveSilenceFrames * VAD_FRAME_MS}ms silence (${chunkDurationFrames} frames)`);
				const allFrames = [...lastChunkOverlapFrames, ...currentChunkFrames];
				const chunkPcm = Buffer.concat(allFrames);
				const chunkWav = convertPcmToWav(chunkPcm, TARGET_RATE, 1);

				if (processingQueue.length < MAX_QUEUE_SIZE) {
					processingQueue.push(chunkWav);
					setImmediate(processBacklog);
				}

				// Clear state
				lastChunkOverlapFrames = [];
				currentChunkFrames = [];
				hasAnySpeechInChunk = false;
				consecutiveSilenceFrames = 0;
			}
			// Very long silence (2+ seconds): Clear everything including overlap to prevent contamination
			else if (consecutiveSilenceFrames >= VERY_LONG_SILENCE_FRAMES) {
				if (currentChunkFrames.length > 0 || lastChunkOverlapFrames.length > 0) {
					console.log(`[main] VAD: 🧹 Clearing all state after ${consecutiveSilenceFrames * VAD_FRAME_MS}ms silence (fresh start)`);
					lastChunkOverlapFrames = [];
					currentChunkFrames = [];
					hasAnySpeechInChunk = false;
					consecutiveSilenceFrames = 0;
				}
			}
		}
	});
		
		if (!startedOk) {
			const addonName = process.platform === 'darwin' ? 'CoreAudio' : 'WASAPI';
			console.error(`[main] ${addonName} startCaptureExcludeCurrent returned false (capture thread not started)`);
			return { success: false, error: `Failed to start ${addonName} capture with current process excluded (addon returned false)` };
		}
		
		return { success: true };
	} catch (error) {
		const addonName = process.platform === 'darwin' ? 'CoreAudio' : 'WASAPI';
		console.error(`[main] Failed to start ${addonName} capture with current process excluded:`, error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
});

// Helper to resolve PID from window handle on Windows
ipcMain.handle('resolve-pid-from-window', async (event, windowHandle: number) => {
  try {
    if (process.platform !== 'win32') {
      return null;
    }
    
    // Prefer native addon for HWND -> PID
    if (!loadWasapiAddon()) {
      console.warn('[main] WASAPI addon unavailable when resolving PID from window; falling back to PowerShell lookup');
    } else if (wasapiAddon && typeof wasapiAddon.resolvePidFromWindow === 'function') {
      try {
        const pid = wasapiAddon.resolvePidFromWindow(windowHandle);
        if (pid && pid > 0) {
          console.log('[main] Resolved PID', pid, 'from window handle', windowHandle);
          return pid;
        }
      } catch (err) {
        console.warn('[main] resolvePidFromWindow via addon failed:', err);
      }
    }

    // Fallback: PowerShell lookup
    const { spawn } = require('child_process');
    return new Promise<number | null>((resolve) => {
      const proc = spawn('powershell', [
        '-Command',
        `Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Where-Object { $_.MainWindowHandle -eq ${windowHandle} } | Select-Object -ExpandProperty Id`
      ], { windowsHide: true });
      let output = '';
      proc.stdout.on('data', (data: Buffer) => { output += data.toString(); });
      proc.on('close', (code: number | null) => {
        if (code === 0) {
          const pid = parseInt(output.trim(), 10);
          if (!isNaN(pid) && pid > 0) {
            console.log('[main] Resolved PID', pid, 'from window handle', windowHandle);
            resolve(pid);
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
      proc.on('error', () => { resolve(null); });
    });
  } catch (error) {
    console.error('[main] Failed to resolve PID from window handle:', error);
    return null;
  }
});

// Helper to find active audio PID for a process using WASAPI audio session enumeration
ipcMain.handle('find-audio-pid-for-process', async (event, processName: string) => {
	try {
		if (process.platform !== 'win32') {
			return null;
		}
		
		if (!wasapiAddon || typeof wasapiAddon.findAudioPidForProcess !== 'function') {
			console.warn('[main] WASAPI addon not available for audio session enumeration');
			return null;
		}
		
		const pid = wasapiAddon.findAudioPidForProcess(processName);
		if (pid && pid > 0) {
			console.log('[main] Found active audio PID:', pid, 'for process:', processName);
			return pid;
		} else {
			console.log('[main] No active audio session found for process:', processName);
			return null;
		}
	} catch (error) {
		console.error('[main] Failed to find audio PID for process:', error);
		return null;
	}
});

// Enhanced handler for starting capture by process name with automatic PID resolution
ipcMain.handle('wasapi:start-capture-by-process', async (event, processName: string) => {
	try {
		const platform = process.platform;
		const addonName = platform === 'darwin' ? 'CoreAudio' : 'WASAPI';
		console.log(`[main] ${addonName} start-capture-by-process called with process name:`, processName);
		
		if (!loadWasapiAddon()) {
			throw new Error(`${addonName} addon not available`);
		}
		
		if (!wasapiAddon || typeof wasapiAddon.startCaptureByProcessName !== 'function') {
			throw new Error(`${addonName} addon startCaptureByProcessName function not available`);
		}
		
		console.log(`[main] Starting ${addonName} capture for process:`, processName);
		
		// Get config manager instance for dynamic language updates
		const configManager = ConfigurationManager.getInstance();
		
		// Helper function to check if language is complex and get CHUNK_MS
		const getChunkMs = (): { chunkMs: number; sourceLanguage: string; isComplex: boolean } => {
			const config = configManager.getConfig();
			const bidiLang = config.uiSettings?.bidirectionalSourceLanguage;
			const mainLang = config.sourceLanguage;
			const sourceLanguage = (bidiLang || mainLang || 'auto').toLowerCase().trim();
			
			// Slavic languages and other complex languages require longer chunks for better transcription accuracy
			const complexLanguages = ['ru', 'pl', 'cs', 'sk', 'bg', 'sr', 'hr', 'sl', 'uk', 'be', 'mk', 'bs', 'sv',
			                          'russian', 'polish', 'czech', 'slovak', 'bulgarian', 'serbian', 'croatian', 
			                          'slovenian', 'ukrainian', 'belarusian', 'macedonian', 'bosnian', 'swedish'];
			const isComplexLanguage = sourceLanguage !== 'auto' && complexLanguages.includes(sourceLanguage);
			
			// Use longer chunks for complex languages (2000ms) vs simple languages (500ms)
			const chunkMs = isComplexLanguage ? 2000 : 500;
			return { chunkMs, sourceLanguage, isComplex: isComplexLanguage };
		};
		
		// Enhanced VAD with WebRTC for better speech detection
		let vad: any = null;
		try {
			const WebRtcVad = require('@serenade/webrtcvad');
			vad = new WebRtcVad();
			vad.setMode(3); // Aggressive mode (3) for better noise filtering
			console.log('[main] WebRTC VAD loaded in aggressive mode');
		} catch {
			console.warn('[main] WebRTC VAD not available; using energy-based fallback');
		}

		// VAD configuration and chunked streaming
		const TARGET_RATE = 16000;
		const VAD_FRAME_MS = 20;
		const VAD_FRAME_SAMPLES = (TARGET_RATE * VAD_FRAME_MS) / 1000;
		const VAD_FRAME_BYTES = VAD_FRAME_SAMPLES * 2;
		
		// Dynamic chunking based on language
		const initialCheck = getChunkMs();
		let currentChunkMs = initialCheck.chunkMs;
		let lastLanguageCheck = Date.now();
		const LANGUAGE_CHECK_INTERVAL_MS = 1000; // Check language every 1 second
		
		console.log(`[main] 🎯 ${addonName} by-process - Language: "${initialCheck.sourceLanguage}", IsComplex: ${initialCheck.isComplex}, CHUNK_MS: ${currentChunkMs}`);

		// Backpressure handling
		let processingQueue: Buffer[] = [];
		let isProcessingBacklog = false;
		const MAX_QUEUE_SIZE = 50;
		
		// VAD state for chunk gating
		let pendingInt16 = Buffer.alloc(0);
		let chunkFrames: Buffer[] = [];
		let chunkMs = 0;
		let chunkHasSpeech = false;
		let consecutiveSilenceMs = 0; // Track silence duration for cleanup
		
		const webContentsId = event.sender.id;
		
		// Process backlog function
		const processBacklog = async () => {
			if (isProcessingBacklog || processingQueue.length === 0) return;
			
			isProcessingBacklog = true;
			console.log('[main] Processing VAD backlog:', processingQueue.length, 'chunks');
			
			try {
				while (processingQueue.length > 0) {
					const wavChunk = processingQueue.shift()!;
					
					try {
						const { webContents } = require('electron');
						const wc = webContents.fromId(webContentsId);
						if (wc && !wc.isDestroyed()) {
							wc.send('wasapi:chunk-wav', wavChunk);
						}
					} catch (error) {
						console.warn('[main] Failed to send WAV chunk to renderer:', error);
					}
					
					await new Promise(resolve => setTimeout(resolve, 10));
				}
			} finally {
				isProcessingBacklog = false;
			}
		};

		// Start capture by process name (addon will resolve PID internally)
		const startedOk2: boolean = wasapiAddon.startCaptureByProcessName(processName, (wavData: Buffer) => {
			console.log(`[main] ${addonName} WAV data received for`, processName, ':', wavData.length, 'bytes');
			
			// DON'T filter during TTS when capturing specific process
			// Since we're only capturing the selected app (e.g., Chrome), we won't hear Whispra's TTS
			// This allows continuous chunk capture without stopping after chunk 3
			
			// Extract PCM data from WAV for VAD processing
			if (wavData.length <= 44) {
				console.warn('[main] WAV chunk too small, skipping VAD');
				return;
			}
			
			const pcmData = wavData.subarray(44);
			const channels = wavData.readUInt16LE(22);
			const sampleRate = wavData.readUInt32LE(24);
			
			// Prepare VAD input
			let vadInput: Buffer;
			
			if (sampleRate === TARGET_RATE && channels === 1) {
				vadInput = pcmData;
			} else {
				const int16Data = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength / 2);
				let monoData: Int16Array;
				
				if (channels === 2) {
					monoData = new Int16Array(int16Data.length / 2);
					for (let i = 0; i < monoData.length; i++) {
						monoData[i] = Math.round((int16Data[i * 2] + int16Data[i * 2 + 1]) / 2);
					}
				} else {
					monoData = int16Data;
				}
				
				if (sampleRate !== TARGET_RATE) {
					const resampleRatio = sampleRate / TARGET_RATE;
					const outputLength = Math.floor(monoData.length / resampleRatio);
					const resampledData = new Int16Array(outputLength);
					
					for (let i = 0; i < outputLength; i++) {
						const sourceIndex = Math.floor(i * resampleRatio);
						resampledData[i] = monoData[sourceIndex];
					}
					monoData = resampledData;
				}
				
				vadInput = Buffer.from(monoData.buffer);
			}
			
			// Process VAD frames
			pendingInt16 = Buffer.concat([pendingInt16, vadInput]);
			
			while (pendingInt16.length >= VAD_FRAME_BYTES) {
				const frame = pendingInt16.subarray(0, VAD_FRAME_BYTES);
				pendingInt16 = pendingInt16.subarray(VAD_FRAME_BYTES);

				// Dynamically update chunking parameters if language changed
				const now = Date.now();
				if (now - lastLanguageCheck >= LANGUAGE_CHECK_INTERVAL_MS) {
					const langCheck = getChunkMs();
					if (langCheck.chunkMs !== currentChunkMs) {
						currentChunkMs = langCheck.chunkMs;
						console.log(`[main] 🔄 Language changed - "${langCheck.sourceLanguage}" (Complex: ${langCheck.isComplex}), CHUNK_MS: ${currentChunkMs}`);
					}
					lastLanguageCheck = now;
				}

				let isSpeech = false;
				if (vad) {
					try { 
						isSpeech = vad.isSpeech(frame, TARGET_RATE); 
					} catch (error) { 
						console.warn('[main] VAD processing error:', error);
						isSpeech = false; 
					}
				} else {
					let sum = 0;
					for (let i = 0; i < VAD_FRAME_BYTES; i += 2) {
						const sample = frame.readInt16LE(i) / 32768;
						sum += sample * sample;
					}
					const rms = Math.sqrt(sum / VAD_FRAME_SAMPLES);
					isSpeech = rms > 0.005; // Lowered from 0.015 for quiet voice detection
				}

			// Chunk accumulation and gating
			chunkFrames.push(frame);
			chunkMs += VAD_FRAME_MS;
			
			// Track silence for cleanup
			if (isSpeech) {
				chunkHasSpeech = true;
				consecutiveSilenceMs = 0;
			} else {
				consecutiveSilenceMs += VAD_FRAME_MS;
			}

			// Clear state after 2 seconds of silence to prevent contamination
			if (consecutiveSilenceMs >= 2000 && (chunkFrames.length > 0 || chunkMs > 0)) {
				console.log(`[main] VAD: 🧹 Clearing state after ${consecutiveSilenceMs}ms silence (by-process, fresh start)`);
				chunkFrames = [];
				chunkMs = 0;
				chunkHasSpeech = false;
				consecutiveSilenceMs = 0;
			}

			if (chunkMs >= currentChunkMs) {
				if (chunkHasSpeech && chunkFrames.length > 0) {
					const chunkPcm = Buffer.concat(chunkFrames);
					const chunkWav = convertPcmToWav(chunkPcm, TARGET_RATE, 1);
					if (processingQueue.length < MAX_QUEUE_SIZE) {
						processingQueue.push(chunkWav);
						setImmediate(processBacklog);
					} else {
						console.warn('[main] VAD: Processing queue full, dropping chunk');
					}
				}
				chunkFrames = [];
				chunkMs = 0;
				chunkHasSpeech = false;
			}
		}
	});
		
		if (!startedOk2) {
			const addonName = process.platform === 'darwin' ? 'CoreAudio' : 'WASAPI';
			console.error(`[main] ${addonName} startCaptureByProcessName returned false (capture thread not started)`);
			return { success: false, error: `Failed to start ${addonName} capture by process (addon returned false)` };
		}
		
		return { success: true };
	} catch (error) {
		const addonName = process.platform === 'darwin' ? 'CoreAudio' : 'WASAPI';
		console.error(`[main] Failed to start ${addonName} capture by process name:`, error);
		return { success: false, error: error instanceof Error ? error.message : String(error) };
	}
});

  // Helper to enumerate all active audio sessions
  ipcMain.handle('enumerate-audio-sessions', async (event) => {
    try {
      console.log('[main] 🔍 enumerate-audio-sessions called');
      if (process.platform !== 'win32') {
        console.log('[main] Not Windows platform, returning empty array');
        return [];
      }
      
      // Ensure addon is loaded
      if (!loadWasapiAddon()) {
        console.warn('[main] ❌ Failed to load WASAPI addon');
        return [];
      }
      
      if (!wasapiAddon || typeof wasapiAddon.enumerateAudioSessions !== 'function') {
        console.warn('[main] ❌ WASAPI addon enumerateAudioSessions not available');
        console.log('[main] Available functions:', wasapiAddon ? Object.keys(wasapiAddon) : 'none');
        return [];
      }
      
      console.log('[main] 🔊 Enumerating active audio sessions...');
      let sessions;
      
      try {
        sessions = wasapiAddon.enumerateAudioSessions();
        console.log('[main] 🔍 Raw result from enumerateAudioSessions:', sessions);
        console.log('[main] 🔍 Type:', typeof sessions);
        console.log('[main] 🔍 Is array?', Array.isArray(sessions));
      } catch (enumError) {
        console.error('[main] ❌ Error calling enumerateAudioSessions:', enumError);
        return [];
      }
      
      if (!Array.isArray(sessions)) {
        console.warn('[main] ❌ enumerateAudioSessions returned non-array:', typeof sessions);
        return [];
      }
      
      console.log(`[main] ✅ Found ${sessions.length} active audio sessions`);
      if (sessions.length === 0) {
        console.warn('[main] ⚠️ No audio sessions found. Possible reasons:');
        console.warn('   - No apps are currently playing audio');
        console.warn('   - WASAPI COM initialization failed');
        console.warn('   - Permission issues');
      } else {
        sessions.forEach((s: any) => {
          console.log(`   - ${s.processName} (PID: ${s.pid})`);
        });
      }
      
      return sessions;
    } catch (error) {
      console.error('[main] ❌ Failed to enumerate audio sessions:', error);
      return [];
    }
  });

  // Legacy Chrome process finder (kept for compatibility)
  ipcMain.handle('find-main-chrome-process', async (event, childPid: number) => {
    try {
      if (process.platform !== 'win32') {
        return childPid;
      }
      
      // First try to find Chrome process with active audio session
      if (wasapiAddon && typeof wasapiAddon.findAudioPidForProcess === 'function') {
        const audioPid = wasapiAddon.findAudioPidForProcess('chrome.exe');
        if (audioPid && audioPid > 0) {
          console.log('[main] Found Chrome process with active audio:', audioPid, 'instead of', childPid);
          return audioPid;
        }
      }
      
      // Fallback to original method
      const { spawn } = require('child_process');
      return new Promise<number>((resolve) => {
        const proc = spawn('powershell', [
          '-Command',
          `Get-Process chrome -ErrorAction SilentlyContinue | Sort-Object Id | Select-Object -First 1 -ExpandProperty Id`
        ], { windowsHide: true });
        
        let output = '';
        proc.stdout.on('data', (data: any) => {
          output += data.toString();
        });
        
        proc.on('close', () => {
          const mainPid = parseInt(output.trim(), 10);
          if (!isNaN(mainPid) && mainPid > 0) {
            console.log('[main] Found main Chrome process PID:', mainPid, 'for child PID:', childPid);
            resolve(mainPid);
          } else {
            console.log('[main] Could not find main Chrome process, using original PID:', childPid);
            resolve(childPid);
          }
        });
        
        proc.on('error', () => {
          console.log('[main] Error finding main Chrome process, using original PID:', childPid);
          resolve(childPid);
        });
      });
    } catch (error) {
      console.error('[main] Failed to find main Chrome process:', error);
      return childPid;
    }
  });

  // macOS-specific: System output device management for BlackHole routing
  ipcMain.handle('coreaudio:set-system-output-to-blackhole', async () => {
    try {
      if (process.platform !== 'darwin') {
        return { success: false, error: 'macOS only' };
      }
      
      if (!loadWasapiAddon()) {
        return { success: false, error: 'CoreAudio addon not available' };
      }
      
      if (!wasapiAddon || typeof wasapiAddon.setSystemOutputToBlackHole !== 'function') {
        return { success: false, error: 'setSystemOutputToBlackHole function not available' };
      }
      
      const result = wasapiAddon.setSystemOutputToBlackHole();
      console.log('[main] Set system output to BlackHole:', result);
      return { success: result };
    } catch (error) {
      console.error('[main] Failed to set system output to BlackHole:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('coreaudio:restore-system-output', async () => {
    try {
      if (process.platform !== 'darwin') {
        return { success: false, error: 'macOS only' };
      }
      
      if (!wasapiAddon || typeof wasapiAddon.restoreSystemOutput !== 'function') {
        return { success: false, error: 'restoreSystemOutput function not available' };
      }
      
      const result = wasapiAddon.restoreSystemOutput();
      console.log('[main] Restored system output:', result);
      return { success: result };
    } catch (error) {
      console.error('[main] Failed to restore system output:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('coreaudio:get-real-output-device', async () => {
    try {
      if (process.platform !== 'darwin') {
        return { success: false, error: 'macOS only' };
      }
      
      if (!wasapiAddon || typeof wasapiAddon.getRealOutputDevice !== 'function') {
        return { success: false, error: 'getRealOutputDevice function not available' };
      }
      
      const deviceId = wasapiAddon.getRealOutputDevice();
      return { success: true, deviceId: deviceId || null };
    } catch (error) {
      console.error('[main] Failed to get real output device:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  console.log('WASAPI IPC handlers registered successfully');
}