#include <napi.h>
#include <CoreAudio/CoreAudio.h>
#include <AudioUnit/AudioUnit.h>
#include <AudioToolbox/AudioToolbox.h>
#include <libproc.h>
#include <CoreFoundation/CoreFoundation.h>

#include <thread>
#include <atomic>
#include <vector>
#include <string>
#include <map>
#include <cmath>
#include <cstring>
#include <memory>
#include <algorithm>
#include <unistd.h>
#include <sys/sysctl.h>
#include <chrono>
#include <thread>

class CoreAudioLoopbackCapture;

namespace {
	std::unique_ptr<CoreAudioLoopbackCapture> g_capture;
}

// Signal processing structures (ported from WASAPI)
struct BiquadHPF {
	float b0=0, b1=0, b2=0, a1=0, a2=0;
	float z1=0, z2=0;
	void setup(float fs, float fc, float Q=0.7071f) {
		const float PI = 3.14159265358979323846f;
		float w0 = 2.0f * PI * (fc / fs);
		float c  = cosf(w0);
		float s  = sinf(w0);
		float alpha = s / (2.0f * Q);
		float a0 = 1.0f + alpha;
		b0 =  (1.0f + c) * 0.5f / a0;
		b1 = -(1.0f + c)       / a0;
		b2 =  (1.0f + c) * 0.5f / a0;
		a1 =  (-2.0f * c)       / a0;
		a2 =  (1.0f - alpha)     / a0;
		z1 = z2 = 0.0f;
	}
	inline float process(float x) {
		float y = b0*x + z1;
		z1 = b1*x + z2 - a1*y;
		z2 = b2*x - a2*y;
		return y;
	}
};

class CoreAudioLoopbackCapture {
public:
	CoreAudioLoopbackCapture() : running_(false), targetPid_(0), excludeCurrentPid_(false), 
	                             audioUnit_(nullptr), aggregateDeviceId_(kAudioObjectUnknown),
	                             usingTap_(false) {}
	~CoreAudioLoopbackCapture() { Stop(); }

	bool Start(uint32_t pid, Napi::ThreadSafeFunction tsfn);
	void Stop();

private:
	static OSStatus InputCallback(void *inRefCon,
	                              AudioUnitRenderActionFlags *ioActionFlags,
	                              const AudioTimeStamp *inTimeStamp,
	                              UInt32 inBusNumber,
	                              UInt32 inNumberFrames,
	                              AudioBufferList *ioData);

	void ProcessAudioBuffer(AudioBufferList *ioData, UInt32 inNumberFrames, pid_t sourcePid = 0);
	
	bool CreateAggregateDeviceWithTap(AudioDeviceID defaultOutputDevice);
	bool TryProcessTapApproach(AudioDeviceID defaultOutputDevice);
	bool TryAudioUnitHALApproach(AudioDeviceID defaultOutputDevice);
	
	std::thread capture_thread_;
	std::atomic<bool> running_;
	Napi::ThreadSafeFunction tsfn_;
	uint32_t targetPid_;
	bool excludeCurrentPid_;  // When true, exclude current process PID from capture
	pid_t currentPid_;         // Current process PID for filtering
	AudioUnit audioUnit_;
	AudioDeviceID deviceId_;
	AudioDeviceID aggregateDeviceId_;  // Aggregate device with tap (if using tap approach)
	bool usingTap_;                    // True if using tap-based approach
	
	// Signal processing state
	BiquadHPF hpf_;
	float env_;
	float noiseFloor_;
	float gainSmooth_;
	float aEnv_, aRise_, aAtk_, aRel_;
	
	// Audio format
	AudioStreamBasicDescription inputFormat_;
	AudioStreamBasicDescription outputFormat_;
	
	// Buffer for resampling
	std::vector<float> resampleBuffer_;
};

OSStatus CoreAudioLoopbackCapture::InputCallback(void *inRefCon,
                                                 AudioUnitRenderActionFlags *ioActionFlags,
                                                 const AudioTimeStamp *inTimeStamp,
                                                 UInt32 inBusNumber,
                                                 UInt32 inNumberFrames,
                                                 AudioBufferList *ioData) {
	CoreAudioLoopbackCapture *capture = static_cast<CoreAudioLoopbackCapture*>(inRefCon);
	if (!capture || !capture->running_) {
		return noErr;
	}
	
	static int callbackCount = 0;
	callbackCount++;
	if (callbackCount % 100 == 0) { // Log every 100th callback to avoid spam
		printf("[addon] InputCallback called %d times, frames: %u\n", callbackCount, inNumberFrames);
		fflush(stdout);
	}
	
	AudioBufferList bufferList;
	bufferList.mNumberBuffers = 1;
	bufferList.mBuffers[0].mNumberChannels = capture->inputFormat_.mChannelsPerFrame;
	bufferList.mBuffers[0].mDataByteSize = inNumberFrames * capture->inputFormat_.mBytesPerFrame;
	bufferList.mBuffers[0].mData = nullptr;
	bufferList.mBuffers[0].mData = malloc(bufferList.mBuffers[0].mDataByteSize);
	
	if (!bufferList.mBuffers[0].mData) {
		printf("[addon] ERROR: Failed to allocate buffer in InputCallback\n");
		fflush(stdout);
		return -1;
	}
	
	OSStatus status = AudioUnitRender(capture->audioUnit_,
	                                  ioActionFlags,
	                                  inTimeStamp,
	                                  inBusNumber,
	                                  inNumberFrames,
	                                  &bufferList);
	
	if (status == noErr) {
		// Check if we're actually getting audio data
		static int debugCount = 0;
		static float maxSampleValue = 0.0f;
		
		if (bufferList.mBuffers[0].mDataByteSize >= 4) {
			// Calculate RMS to detect actual audio
			int16_t* samples = (int16_t*)bufferList.mBuffers[0].mData;
			int numSamples = bufferList.mBuffers[0].mDataByteSize / 2;
			
			float sum = 0.0f;
			for (int i = 0; i < numSamples; i++) {
				float sample = samples[i] / 32768.0f;
				sum += sample * sample;
				float absSample = sample < 0 ? -sample : sample;
				if (absSample > maxSampleValue) maxSampleValue = absSample;
			}
			float rms = sqrtf(sum / numSamples);
			
			if (debugCount++ % 50 == 0) {
				printf("[addon] 🔊 Audio check: size=%u bytes, samples=%d, RMS=%.4f, max=%.4f %s\n", 
				       bufferList.mBuffers[0].mDataByteSize, numSamples, rms, maxSampleValue,
				       rms > 0.01f ? "✅ AUDIO DETECTED" : "⚠️ silence");
				fflush(stdout);
				maxSampleValue = 0.0f;
			}
		}
		
		capture->ProcessAudioBuffer(&bufferList, inNumberFrames, 0);
	} else {
		if (callbackCount <= 5) { // Log first few errors
			printf("[addon] AudioUnitRender failed with status: %d\n", (int)status);
			fflush(stdout);
		}
	}
	
	free(bufferList.mBuffers[0].mData);
	return status;
}

void CoreAudioLoopbackCapture::ProcessAudioBuffer(AudioBufferList *ioData, UInt32 inNumberFrames, pid_t sourcePid) {
	// Note: sourcePid is currently always 0 because AudioUnit HAL doesn't provide PID metadata
	// In a full tap-based implementation, we would filter here: if (excludeCurrentPid_ && sourcePid == currentPid_) return;
	(void)sourcePid; // Suppress unused parameter warning
	
	if (!ioData || ioData->mNumberBuffers == 0) return;
	
	const uint32_t outRate = 16000;
	const uint32_t inRate = (uint32_t)inputFormat_.mSampleRate;
	const uint16_t inCh = inputFormat_.mChannelsPerFrame;
	
	// 1) Convert to mono float [-1,1]
	std::vector<float> mono;
	mono.reserve(inNumberFrames);
	
	// Track max amplitude for debugging
	static float maxAmplitude = 0.0f;
	static int sampleCount = 0;
	
	if (inputFormat_.mFormatFlags & kAudioFormatFlagIsFloat) {
		const float* f = reinterpret_cast<const float*>(ioData->mBuffers[0].mData);
		for (UInt32 i = 0; i < inNumberFrames; ++i) {
			float sum = 0.0f;
			for (uint16_t c = 0; c < inCh; ++c) {
				sum += f[i * inCh + c];
			}
			float m = sum / (float)inCh;
			if (m > 1.0f) m = 1.0f;
			else if (m < -1.0f) m = -1.0f;
			
			// Track max amplitude
			float absM = m < 0 ? -m : m;
			if (absM > maxAmplitude) maxAmplitude = absM;
			
			mono.push_back(m);
		}
	} else {
		// Assume 16-bit PCM
		const int16_t* s = reinterpret_cast<const int16_t*>(ioData->mBuffers[0].mData);
		for (UInt32 i = 0; i < inNumberFrames; ++i) {
			int sum = 0;
			for (uint16_t c = 0; c < inCh; ++c) {
				sum += s[i * inCh + c];
			}
			float m = (float)sum / (float)inCh / 32768.0f;
			if (m > 1.0f) m = 1.0f;
			else if (m < -1.0f) m = -1.0f;
			
			// Track max amplitude
			float absM = m < 0 ? -m : m;
			if (absM > maxAmplitude) maxAmplitude = absM;
			
			mono.push_back(m);
		}
	}
	
	// Log amplitude periodically
	sampleCount += inNumberFrames;
	if (sampleCount >= 16000) { // Every ~1 second at 16kHz
		printf("[addon] Audio level check - max amplitude: %.4f %s\n", 
		       maxAmplitude, maxAmplitude > 0.01f ? "(AUDIO DETECTED)" : "(silence)");
		fflush(stdout);
		maxAmplitude = 0.0f;
		sampleCount = 0;
	}
	
	// 2) Resample to 16k using linear interpolation
	size_t outLen = (size_t)((double)mono.size() * (double)outRate / (double)inRate);
	if (outLen == 0) outLen = 1;
	std::vector<float> resampled(outLen);
	for (size_t i = 0; i < outLen; ++i) {
		double pos = (double)i * (double)inRate / (double)outRate;
		size_t idx = (size_t)pos;
		double frac = pos - (double)idx;
		float a = mono[idx < mono.size() ? idx : (mono.size()-1)];
		float b = mono[(idx+1) < mono.size() ? (idx+1) : (mono.size()-1)];
		resampled[i] = (float)((1.0 - frac) * a + frac * b);
	}
	
	// 3) Lightweight noise suppression: high-pass + adaptive noise gate
	for (size_t i = 0; i < resampled.size(); ++i) {
		float x = resampled[i];
		// High-pass to remove steady LF rumble (wind/fans)
		x = hpf_.process(x);
		// Envelope follower
		float av = x < 0 ? -x : x;
		env_ = aEnv_ * env_ + (1.0f - aEnv_) * av;
		// Update noise floor: fast for drops, slow for rises
		if (env_ < noiseFloor_) noiseFloor_ = env_;
		else noiseFloor_ = noiseFloor_ + (env_ - noiseFloor_) * (1.0f - aRise_);
		if (noiseFloor_ < 1e-6f) noiseFloor_ = 1e-6f;
		// Dynamic threshold and soft-knee gate
		float thr = noiseFloor_ * 2.5f + 1e-6f;
		float tGain = (env_ > thr) ? 1.0f : (env_ / thr);
		// Soft knee shaping
		tGain = sqrtf(tGain);
		// Smooth gain changes (fast attack when attenuating, slower release)
		float a = (tGain < gainSmooth_) ? aAtk_ : aRel_;
		gainSmooth_ = tGain + (gainSmooth_ - tGain) * a;
		// Apply gain
		resampled[i] = x * gainSmooth_;
	}
	
	// 4) Mild voice boost with limiter
	float peak = 0.0f;
	for (float v : resampled) {
		float av2 = v < 0 ? -v : v;
		if (av2 > peak) peak = av2;
	}
	const float kVoiceBoost = 1.5f;
	float gain;
	if (peak < 1e-6f) gain = kVoiceBoost;
	else gain = (peak * kVoiceBoost > 0.99f) ? (0.99f / peak) : kVoiceBoost;
	
	// 5) Quantize to int16
	std::vector<int16_t> int16Samples;
	int16Samples.resize(resampled.size());
	for (size_t i = 0; i < resampled.size(); ++i) {
		float x = resampled[i] * gain;
		if (x > 1.0f) x = 1.0f;
		else if (x < -1.0f) x = -1.0f;
		int s = (int)(x * 32767.0f + (x >= 0 ? 0.5f : -0.5f));
		if (s > 32767) s = 32767;
		if (s < -32768) s = -32768;
		int16Samples[i] = (int16_t)s;
	}
	
	// 6) Build WAV header for 16kHz, mono, 16-bit PCM
	const uint16_t channels = 1;
	const uint32_t sampleRate = outRate;
	const uint32_t pcmDataSize = (uint32_t)(int16Samples.size() * sizeof(int16_t));
	const uint32_t totalSize = 36 + pcmDataSize;
	std::vector<uint8_t> wavBuffer(44 + pcmDataSize);
	uint8_t* header = wavBuffer.data();
	memcpy(header + 0, "RIFF", 4);
	*reinterpret_cast<uint32_t*>(header + 4) = totalSize;
	memcpy(header + 8, "WAVE", 4);
	memcpy(header + 12, "fmt ", 4);
	*reinterpret_cast<uint32_t*>(header + 16) = 16; // fmt chunk size
	*reinterpret_cast<uint16_t*>(header + 20) = 1;  // PCM format
	*reinterpret_cast<uint16_t*>(header + 22) = channels;
	*reinterpret_cast<uint32_t*>(header + 24) = sampleRate;
	*reinterpret_cast<uint32_t*>(header + 28) = sampleRate * channels * 2; // byte rate
	*reinterpret_cast<uint16_t*>(header + 32) = channels * 2; // block align
	*reinterpret_cast<uint16_t*>(header + 34) = 16; // bits per sample
	memcpy(header + 36, "data", 4);
	*reinterpret_cast<uint32_t*>(header + 40) = pcmDataSize;
	memcpy(header + 44, int16Samples.data(), pcmDataSize);
	
	// Send WAV buffer to callback
	tsfn_.BlockingCall([wavBuffer](Napi::Env env, Napi::Function cb) {
		auto buffer = Napi::Buffer<uint8_t>::Copy(env, wavBuffer.data(), wavBuffer.size());
		cb.Call({ buffer });
	});
}

// Find BlackHole 2ch INPUT device (for capturing audio routed to BlackHole)
AudioDeviceID FindBlackHoleInputDevice() {
	AudioDeviceID deviceId = kAudioDeviceUnknown;
	
	// Get all devices
	UInt32 propertySize = 0;
	AudioObjectPropertyAddress propertyAddress = {
		kAudioHardwarePropertyDevices,
		kAudioObjectPropertyScopeGlobal,
		kAudioObjectPropertyElementMain
	};
	
	OSStatus status = AudioObjectGetPropertyDataSize(kAudioObjectSystemObject,
	                                                  &propertyAddress,
	                                                  0,
	                                                  nullptr,
	                                                  &propertySize);
	if (status != noErr) {
		printf("[addon] Failed to get device list size\n");
		return kAudioDeviceUnknown;
	}
	
	UInt32 deviceCount = propertySize / sizeof(AudioDeviceID);
	std::vector<AudioDeviceID> devices(deviceCount);
	
	status = AudioObjectGetPropertyData(kAudioObjectSystemObject,
	                                    &propertyAddress,
	                                    0,
	                                    nullptr,
	                                    &propertySize,
	                                    devices.data());
	if (status != noErr) {
		printf("[addon] Failed to get device list\n");
		return kAudioDeviceUnknown;
	}
	
	// Search for BlackHole 2ch INPUT device
	for (UInt32 i = 0; i < deviceCount; ++i) {
		CFStringRef deviceName = nullptr;
		propertySize = sizeof(CFStringRef);
		propertyAddress.mSelector = kAudioDevicePropertyDeviceNameCFString;
		propertyAddress.mScope = kAudioObjectPropertyScopeInput;
		propertyAddress.mElement = kAudioObjectPropertyElementMain;
		
		status = AudioObjectGetPropertyData(devices[i],
		                                    &propertyAddress,
		                                    0,
		                                    nullptr,
		                                    &propertySize,
		                                    &deviceName);
		if (status == noErr && deviceName) {
			char nameBuffer[256];
			if (CFStringGetCString(deviceName, nameBuffer, sizeof(nameBuffer), kCFStringEncodingUTF8)) {
				std::string name(nameBuffer);
				std::transform(name.begin(), name.end(), name.begin(), ::tolower);
				// Look for BlackHole 2ch input device
				if (name.find("blackhole") != std::string::npos && name.find("2ch") != std::string::npos) {
					// Check if this device has INPUT channels
					propertySize = 0;
					propertyAddress.mSelector = kAudioDevicePropertyStreamConfiguration;
					propertyAddress.mScope = kAudioObjectPropertyScopeInput;
					status = AudioObjectGetPropertyDataSize(devices[i],
					                                        &propertyAddress,
					                                        0,
					                                        nullptr,
					                                        &propertySize);
					if (status == noErr && propertySize > 0) {
						printf("[addon] Found BlackHole 2ch INPUT device (ID: %u)\n", devices[i]);
						deviceId = devices[i];
						CFRelease(deviceName);
						break;
					}
				}
			}
			CFRelease(deviceName);
		}
	}
	
	return deviceId;
}

// Find BlackHole 2ch output device (for routing TTS audio to it)
AudioDeviceID FindBlackHoleOutputDevice() {
	AudioDeviceID deviceId = kAudioDeviceUnknown;
	
	// Get all devices
	UInt32 propertySize = 0;
	AudioObjectPropertyAddress propertyAddress = {
		kAudioHardwarePropertyDevices,
		kAudioObjectPropertyScopeGlobal,
		kAudioObjectPropertyElementMain
	};
	
	OSStatus status = AudioObjectGetPropertyDataSize(kAudioObjectSystemObject,
	                                                  &propertyAddress,
	                                                  0,
	                                                  nullptr,
	                                                  &propertySize);
	if (status != noErr) {
		printf("[addon] Failed to get device list size\n");
		return kAudioDeviceUnknown;
	}
	
	UInt32 deviceCount = propertySize / sizeof(AudioDeviceID);
	std::vector<AudioDeviceID> devices(deviceCount);
	
	status = AudioObjectGetPropertyData(kAudioObjectSystemObject,
	                                    &propertyAddress,
	                                    0,
	                                    nullptr,
	                                    &propertySize,
	                                    devices.data());
	if (status != noErr) {
		printf("[addon] Failed to get device list\n");
		return kAudioDeviceUnknown;
	}
	
	// Search for BlackHole 2ch output device
	for (UInt32 i = 0; i < deviceCount; ++i) {
		CFStringRef deviceName = nullptr;
		propertySize = sizeof(CFStringRef);
		propertyAddress.mSelector = kAudioDevicePropertyDeviceNameCFString;
		propertyAddress.mScope = kAudioObjectPropertyScopeOutput;
		propertyAddress.mElement = kAudioObjectPropertyElementMain;
		
		status = AudioObjectGetPropertyData(devices[i],
		                                    &propertyAddress,
		                                    0,
		                                    nullptr,
		                                    &propertySize,
		                                    &deviceName);
		if (status == noErr && deviceName) {
			char nameBuffer[256];
			if (CFStringGetCString(deviceName, nameBuffer, sizeof(nameBuffer), kCFStringEncodingUTF8)) {
				std::string name(nameBuffer);
				std::transform(name.begin(), name.end(), name.begin(), ::tolower);
				// Look for BlackHole 2ch output device
				if (name.find("blackhole") != std::string::npos && name.find("2ch") != std::string::npos) {
					// Check if this device has output channels
					propertySize = 0;
					propertyAddress.mSelector = kAudioDevicePropertyStreamConfiguration;
					propertyAddress.mScope = kAudioObjectPropertyScopeOutput;
					status = AudioObjectGetPropertyDataSize(devices[i],
					                                        &propertyAddress,
					                                        0,
					                                        nullptr,
					                                        &propertySize);
					if (status == noErr && propertySize > 0) {
						printf("[addon] Found BlackHole 2ch OUTPUT device (ID: %u)\n", devices[i]);
						deviceId = devices[i];
						CFRelease(deviceName);
						break;
					}
				}
			}
			CFRelease(deviceName);
		}
	}
	
	return deviceId;
}

// Find default output device for loopback capture (like WASAPI on Windows)
// This captures system audio from the default output device without changing it
AudioDeviceID FindDefaultOutputDevice() {
	AudioDeviceID deviceId = kAudioDeviceUnknown;
	UInt32 propertySize = sizeof(AudioDeviceID);
	AudioObjectPropertyAddress propertyAddress = {
		kAudioHardwarePropertyDefaultOutputDevice,
		kAudioObjectPropertyScopeGlobal,
		kAudioObjectPropertyElementMain
	};
	
	OSStatus status = AudioObjectGetPropertyData(kAudioObjectSystemObject,
	                                            &propertyAddress,
	                                            0,
	                                            nullptr,
	                                            &propertySize,
	                                            &deviceId);
	if (status != noErr) {
		printf("[addon] Failed to get default output device\n");
		return kAudioDeviceUnknown;
	}
	
	// Verify the device has output channels (it should, since it's the default output)
	propertySize = 0;
	propertyAddress.mSelector = kAudioDevicePropertyStreamConfiguration;
	propertyAddress.mScope = kAudioObjectPropertyScopeOutput;
	status = AudioObjectGetPropertyDataSize(deviceId,
	                                        &propertyAddress,
	                                        0,
	                                        nullptr,
	                                        &propertySize);
	if (status == noErr && propertySize > 0) {
		// Get device name for logging
		CFStringRef deviceName = nullptr;
		propertySize = sizeof(CFStringRef);
		propertyAddress.mSelector = kAudioDevicePropertyDeviceNameCFString;
		propertyAddress.mScope = kAudioObjectPropertyScopeOutput;
		propertyAddress.mElement = kAudioObjectPropertyElementMain;
		status = AudioObjectGetPropertyData(deviceId,
		                                    &propertyAddress,
		                                    0,
		                                    nullptr,
		                                    &propertySize,
		                                    &deviceName);
		if (status == noErr && deviceName) {
			char nameBuffer[256];
			if (CFStringGetCString(deviceName, nameBuffer, sizeof(nameBuffer), kCFStringEncodingUTF8)) {
				printf("[addon] Found default output device: %s\n", nameBuffer);
			}
			CFRelease(deviceName);
		}
		return deviceId;
	}
	
	printf("[addon] Default output device has no output channels\n");
	return kAudioDeviceUnknown;
}

bool CoreAudioLoopbackCapture::Start(uint32_t pid, Napi::ThreadSafeFunction tsfn) {
	if (running_) {
		printf("[addon] Capture already running\n");
		return false;
	}
	
	running_ = true;
	tsfn_ = tsfn;
	targetPid_ = pid;
	
	// Get current process PID for filtering
	currentPid_ = getpid();
	// When pid == 0, we're doing system-wide capture and should exclude our own PID
	excludeCurrentPid_ = (pid == 0);
	
	if (excludeCurrentPid_) {
		printf("[addon] Starting CoreAudio loopback capture (system-wide, excluding PID %d)\n", (int)currentPid_);
		printf("[addon] NOTE: AudioUnit HAL captures mixed output. For per-buffer PID filtering,\n");
		printf("[addon]       Process Tap API (macOS 14.4+) would be needed, but it has limitations.\n");
		printf("[addon]       Current approach: TTS should route to separate device to avoid capture.\n");
	} else if (pid > 0) {
		printf("[addon] Starting CoreAudio loopback capture for PID %u\n", pid);
	} else {
		printf("[addon] Starting CoreAudio loopback capture\n");
	}
	fflush(stdout);
	
	capture_thread_ = std::thread([this]() {
		// Find BlackHole INPUT device (this is what we capture from)
		AudioDeviceID blackHoleInput = FindBlackHoleInputDevice();
		if (blackHoleInput == kAudioDeviceUnknown) {
			printf("[addon] ❌ ERROR: BlackHole 2ch INPUT device not found\n");
			printf("[addon]    Please install BlackHole from: https://existential.audio/blackhole/\n");
			running_ = false;
			tsfn_.Release();
			return;
		}
		
		printf("[addon] ✅ BlackHole 2ch INPUT device found (ID: %u)\n", blackHoleInput);
		
		// Also find BlackHole OUTPUT device (for TTS routing info)
		AudioDeviceID blackHoleOutput = FindBlackHoleOutputDevice();
		if (blackHoleOutput != kAudioDeviceUnknown) {
			printf("[addon] ✅ BlackHole 2ch OUTPUT device found (ID: %u) - use this for TTS\n", blackHoleOutput);
		}
		
		// Get default output device info
		AudioDeviceID defaultOutput = FindDefaultOutputDevice();
		if (defaultOutput != kAudioDeviceUnknown) {
			CFStringRef deviceName = nullptr;
			UInt32 propertySize = sizeof(CFStringRef);
			AudioObjectPropertyAddress propertyAddress = {
				kAudioDevicePropertyDeviceNameCFString,
				kAudioObjectPropertyScopeOutput,
				kAudioObjectPropertyElementMain
			};
			
			OSStatus status = AudioObjectGetPropertyData(defaultOutput, &propertyAddress, 0, nullptr, &propertySize, &deviceName);
			if (status == noErr && deviceName) {
				char nameBuffer[256];
				if (CFStringGetCString(deviceName, nameBuffer, sizeof(nameBuffer), kCFStringEncodingUTF8)) {
					printf("[addon] Default output device: %s (ID: %u)\n", nameBuffer, defaultOutput);
					
					std::string name(nameBuffer);
					std::transform(name.begin(), name.end(), name.begin(), ::tolower);
					
					if (name.find("multi") != std::string::npos || name.find("aggregate") != std::string::npos) {
						printf("[addon] ✅ Multi-Output device detected\n");
					}
				}
				CFRelease(deviceName);
			}
		}
		
		// CAPTURE FROM BLACKHOLE INPUT DEVICE
		// Setup: Multi-Output Device (BlackHole + Real Speakers) as system default
		// System audio → Multi-Output → Goes to BOTH BlackHole OUTPUT and Speakers
		// BlackHole OUTPUT → BlackHole INPUT (loopback)
		// We capture from BlackHole INPUT to get system audio
		// Whispra TTS → Goes directly to Real Speakers (not BlackHole, avoids feedback)
		deviceId_ = blackHoleInput;
		printf("[addon] 📡 Capturing from BlackHole 2ch INPUT device (ID: %u)\n", blackHoleInput);
		printf("[addon] ℹ️  System audio routed through Multi-Output will be captured\n");
		printf("[addon] ℹ️  Whispra TTS should output to Real Speakers to avoid feedback\n");
		
		// Try AudioUnit HAL approach
		if (!TryAudioUnitHALApproach(deviceId_)) {
			printf("[addon] ❌ ERROR: Failed to start capture from BlackHole INPUT\n");
			running_ = false;
			tsfn_.Release();
			return;
		}
		
		printf("[addon] ✅ CoreAudio loopback capture started successfully\n");
		fflush(stdout);
		
		// Keep the thread alive while capturing
		while (running_) {
			std::this_thread::sleep_for(std::chrono::milliseconds(100));
		}
		
		// Cleanup when stopping
		if (audioUnit_ && !usingTap_) {
			AudioOutputUnitStop(audioUnit_);
			AudioUnitUninitialize(audioUnit_);
			AudioComponentInstanceDispose(audioUnit_);
			audioUnit_ = nullptr;
		}
		
		tsfn_.Release();
	});
	
	return true;
}

bool CoreAudioLoopbackCapture::TryAudioUnitHALApproach(AudioDeviceID blackHoleDevice) {
	// Capture from BlackHole as an input device
	// User must have a Multi-Output Device set up that routes to both speakers and BlackHole
	
	deviceId_ = blackHoleDevice;
	usingTap_ = false;

	printf("[addon] Setting up AudioUnit to capture from BlackHole (device ID: %u)\n", blackHoleDevice);

	AudioComponentDescription desc;
	desc.componentType = kAudioUnitType_Output;
	desc.componentSubType = kAudioUnitSubType_HALOutput;
	desc.componentFlags = 0;
	desc.componentFlagsMask = 0;
	desc.componentManufacturer = kAudioUnitManufacturer_Apple;

	AudioComponent comp = AudioComponentFindNext(nullptr, &desc);
	if (!comp) {
		printf("[addon] Failed to find HAL Output AudioUnit component\n");
		return false;
	}

	OSStatus status = AudioComponentInstanceNew(comp, &audioUnit_);
	if (status != noErr) {
		printf("[addon] Failed to create HAL Output AudioUnit: %d\n", (int)status);
		return false;
	}

	// Enable input on bus 1 (capture from BlackHole)
	UInt32 enableIO = 1;
	status = AudioUnitSetProperty(audioUnit_,
	                              kAudioOutputUnitProperty_EnableIO,
	                              kAudioUnitScope_Input,
	                              1, // Input bus
	                              &enableIO,
	                              sizeof(enableIO));
	if (status != noErr) {
		printf("[addon] Failed to enable input on HAL Output unit: %d\n", (int)status);
		AudioComponentInstanceDispose(audioUnit_);
		audioUnit_ = nullptr;
		return false;
	}

	// Disable output on bus 0 (we don't want to play audio, just capture)
	enableIO = 0;
	status = AudioUnitSetProperty(audioUnit_,
	                              kAudioOutputUnitProperty_EnableIO,
	                              kAudioUnitScope_Output,
	                              0, // Output bus
	                              &enableIO,
	                              sizeof(enableIO));
	if (status != noErr) {
		printf("[addon] Failed to disable output on HAL Output unit: %d\n", (int)status);
		AudioComponentInstanceDispose(audioUnit_);
		audioUnit_ = nullptr;
		return false;
	}

	// Set BlackHole as the input device
	status = AudioUnitSetProperty(audioUnit_,
	                              kAudioOutputUnitProperty_CurrentDevice,
	                              kAudioUnitScope_Global,
	                              0,
	                              &deviceId_,
	                              sizeof(deviceId_));
	if (status != noErr) {
		printf("[addon] Failed to set BlackHole device on HAL Output unit: %d\n", (int)status);
		AudioComponentInstanceDispose(audioUnit_);
		audioUnit_ = nullptr;
		return false;
	}

	// Get the input format from BlackHole
	UInt32 propertySize = sizeof(AudioStreamBasicDescription);
	status = AudioUnitGetProperty(audioUnit_,
	                              kAudioUnitProperty_StreamFormat,
	                              kAudioUnitScope_Input,
	                              1,
	                              &inputFormat_,
	                              &propertySize);
	if (status != noErr) {
		printf("[addon] Failed to get input format from BlackHole: %d\n", (int)status);
		AudioComponentInstanceDispose(audioUnit_);
		audioUnit_ = nullptr;
		return false;
	}

	// Set output format (we'll process to 16kHz mono)
	outputFormat_.mSampleRate = 16000.0;
	outputFormat_.mFormatID = kAudioFormatLinearPCM;
	outputFormat_.mFormatFlags = kAudioFormatFlagIsSignedInteger | kAudioFormatFlagIsPacked;
	outputFormat_.mBytesPerPacket = 2;
	outputFormat_.mFramesPerPacket = 1;
	outputFormat_.mBytesPerFrame = 2;
	outputFormat_.mChannelsPerFrame = 1;
	outputFormat_.mBitsPerChannel = 16;
	outputFormat_.mReserved = 0;

	// Set render callback on input scope to capture audio
	AURenderCallbackStruct callback;
	callback.inputProc = InputCallback;
	callback.inputProcRefCon = this;

	status = AudioUnitSetProperty(audioUnit_,
	                              kAudioOutputUnitProperty_SetInputCallback,
	                              kAudioUnitScope_Global,
	                              0,
	                              &callback,
	                              sizeof(callback));
	if (status != noErr) {
		printf("[addon] Failed to set input callback on HAL Output unit: %d\n", (int)status);
		AudioComponentInstanceDispose(audioUnit_);
		audioUnit_ = nullptr;
		return false;
	}

	// Initialize signal processing
	const float outFs = 16000.0f;
	hpf_.setup(outFs, 90.0f, 0.7071f);
	env_ = 0.0f;
	noiseFloor_ = 0.003f;
	gainSmooth_ = 1.0f;
	const float tauEnv = 0.010f;
	const float tauRise = 0.500f;
	const float tauAtk = 0.005f;
	const float tauRel = 0.050f;
	aEnv_ = expf(-1.0f / (tauEnv * outFs));
	aRise_ = expf(-1.0f / (tauRise * outFs));
	aAtk_ = expf(-1.0f / (tauAtk * outFs));
	aRel_ = expf(-1.0f / (tauRel * outFs));

	// Initialize the AudioUnit
	status = AudioUnitInitialize(audioUnit_);
	if (status != noErr) {
		printf("[addon] Failed to initialize HAL Output AudioUnit: %d\n", (int)status);
		AudioComponentInstanceDispose(audioUnit_);
		audioUnit_ = nullptr;
		return false;
	}

	// Start the AudioUnit
	status = AudioOutputUnitStart(audioUnit_);
	if (status != noErr) {
		printf("[addon] Failed to start HAL Output AudioUnit: %d\n", (int)status);
		AudioUnitUninitialize(audioUnit_);
		AudioComponentInstanceDispose(audioUnit_);
		audioUnit_ = nullptr;
		return false;
	}

	printf("[addon] HAL Output AudioUnit started successfully, format: %.0f Hz, %u channels\n",
	       inputFormat_.mSampleRate, inputFormat_.mChannelsPerFrame);
	fflush(stdout);

	return true;
}

bool CoreAudioLoopbackCapture::TryProcessTapApproach(AudioDeviceID defaultOutputDevice) {
	// Process Tap API implementation would go here for macOS 14.4+
	// For now, return false to fall back to AudioUnit HAL
	(void)defaultOutputDevice; // Suppress unused parameter warning
	return false;
}

// Create a multi-output aggregate device that routes to both BlackHole and real speakers
AudioDeviceID CreateMultiOutputDevice(AudioDeviceID realSpeakers, AudioDeviceID blackHole) {
	printf("[addon] Creating multi-output aggregate device...\n");
	fflush(stdout);
	
	// Get UIDs for both devices first
	CFStringRef blackHoleUID = nullptr;
	CFStringRef realSpeakersUID = nullptr;
	
	UInt32 propertySize = sizeof(CFStringRef);
	AudioObjectPropertyAddress propertyAddress = {
		kAudioDevicePropertyDeviceUID,
		kAudioObjectPropertyScopeGlobal,
		kAudioObjectPropertyElementMain
	};
	
	OSStatus status = AudioObjectGetPropertyData(blackHole, &propertyAddress, 0, nullptr, &propertySize, &blackHoleUID);
	if (status != noErr || !blackHoleUID) {
		printf("[addon] Failed to get BlackHole UID: %d\n", (int)status);
		return kAudioDeviceUnknown;
	}
	
	status = AudioObjectGetPropertyData(realSpeakers, &propertyAddress, 0, nullptr, &propertySize, &realSpeakersUID);
	if (status != noErr || !realSpeakersUID) {
		printf("[addon] Failed to get real speakers UID: %d\n", (int)status);
		CFRelease(blackHoleUID);
		return kAudioDeviceUnknown;
	}
	
	// Log the UIDs for debugging
	char blackHoleUIDStr[256];
	char realSpeakersUIDStr[256];
	CFStringGetCString(blackHoleUID, blackHoleUIDStr, sizeof(blackHoleUIDStr), kCFStringEncodingUTF8);
	CFStringGetCString(realSpeakersUID, realSpeakersUIDStr, sizeof(realSpeakersUIDStr), kCFStringEncodingUTF8);
	printf("[addon] BlackHole UID: %s\n", blackHoleUIDStr);
	printf("[addon] Real Speakers UID: %s\n", realSpeakersUIDStr);
	
	// Create aggregate device description
	CFMutableDictionaryRef aggregateDeviceDict = CFDictionaryCreateMutable(
		kCFAllocatorDefault, 0,
		&kCFTypeDictionaryKeyCallBacks,
		&kCFTypeDictionaryValueCallBacks
	);
	
	// Set device name
	CFStringRef deviceName = CFSTR("Whispra Multi-Output");
	CFDictionarySetValue(aggregateDeviceDict, CFSTR(kAudioAggregateDeviceNameKey), deviceName);
	
	// Set device UID (must be unique)
	CFStringRef deviceUID = CFSTR("com.whispra.multioutput.v1");
	CFDictionarySetValue(aggregateDeviceDict, CFSTR(kAudioAggregateDeviceUIDKey), deviceUID);
	
	// Create sub-device list (Real Speakers first as master, then BlackHole)
	CFMutableArrayRef subDevicesArray = CFArrayCreateMutable(kCFAllocatorDefault, 2, &kCFTypeArrayCallBacks);
	CFArrayAppendValue(subDevicesArray, realSpeakersUID);
	CFArrayAppendValue(subDevicesArray, blackHoleUID);
	
	CFDictionarySetValue(aggregateDeviceDict, CFSTR(kAudioAggregateDeviceSubDeviceListKey), subDevicesArray);
	
	// Set master device (real speakers for clock sync)
	CFDictionarySetValue(aggregateDeviceDict, CFSTR(kAudioAggregateDeviceMasterSubDeviceKey), realSpeakersUID);
	
	// Set as private (not visible in system preferences)
	int isPrivateValue = 1;
	CFNumberRef isPrivate = CFNumberCreate(kCFAllocatorDefault, kCFNumberIntType, &isPrivateValue);
	CFDictionarySetValue(aggregateDeviceDict, CFSTR(kAudioAggregateDeviceIsPrivateKey), isPrivate);
	CFRelease(isPrivate);
	
	// Create the aggregate device using the HAL plugin
	AudioObjectID pluginID = kAudioObjectUnknown;
	propertyAddress.mSelector = kAudioHardwarePropertyPlugInForBundleID;
	propertyAddress.mScope = kAudioObjectPropertyScopeGlobal;
	propertyAddress.mElement = kAudioObjectPropertyElementMain;
	
	CFStringRef bundleID = CFSTR("com.apple.audio.CoreAudio");
	AudioValueTranslation translation;
	translation.mInputData = &bundleID;
	translation.mInputDataSize = sizeof(CFStringRef);
	translation.mOutputData = &pluginID;
	translation.mOutputDataSize = sizeof(AudioObjectID);
	
	propertySize = sizeof(AudioValueTranslation);
	status = AudioObjectGetPropertyData(kAudioObjectSystemObject, &propertyAddress,
	                                    0, nullptr, &propertySize, &translation);
	
	if (status != noErr || pluginID == kAudioObjectUnknown) {
		printf("[addon] Failed to get CoreAudio plugin: %d\n", (int)status);
		CFRelease(blackHoleUID);
		CFRelease(realSpeakersUID);
		CFRelease(subDevicesArray);
		CFRelease(aggregateDeviceDict);
		return kAudioDeviceUnknown;
	}
	
	// Create the aggregate device
	AudioDeviceID aggregateDeviceID = kAudioDeviceUnknown;
	propertyAddress.mSelector = kAudioPlugInCreateAggregateDevice;
	propertyAddress.mScope = kAudioObjectPropertyScopeGlobal;
	propertyAddress.mElement = kAudioObjectPropertyElementMain;
	
	propertySize = sizeof(aggregateDeviceID);
	status = AudioObjectGetPropertyData(pluginID, &propertyAddress,
	                                    sizeof(aggregateDeviceDict), &aggregateDeviceDict,
	                                    &propertySize, &aggregateDeviceID);
	
	// Cleanup
	CFRelease(blackHoleUID);
	CFRelease(realSpeakersUID);
	CFRelease(subDevicesArray);
	CFRelease(aggregateDeviceDict);
	
	if (status != noErr || aggregateDeviceID == kAudioDeviceUnknown) {
		printf("[addon] Failed to create aggregate device: %d (0x%X)\n", (int)status, (unsigned int)status);
		return kAudioDeviceUnknown;
	}
	
	printf("[addon] ✅ Created multi-output aggregate device (ID: %u)\n", aggregateDeviceID);
	printf("[addon]    Audio will play through speakers AND be captured for translation\n");
	printf("[addon]    Volume keys will work normally\n");
	fflush(stdout);
	
	return aggregateDeviceID;
}

bool CoreAudioLoopbackCapture::CreateAggregateDeviceWithTap(AudioDeviceID defaultOutputDevice) {
	// This creates a multi-output device programmatically
	AudioDeviceID blackHole = FindBlackHoleOutputDevice();
	if (blackHole == kAudioDeviceUnknown) {
		printf("[addon] Cannot create aggregate device: BlackHole not found\n");
		return false;
	}
	
	aggregateDeviceId_ = CreateMultiOutputDevice(defaultOutputDevice, blackHole);
	return (aggregateDeviceId_ != kAudioDeviceUnknown);
}


void CoreAudioLoopbackCapture::Stop() {
	if (!running_) return;

	running_ = false;

	// Stop AudioUnit if using HAL approach
	if (audioUnit_ && !usingTap_) {
		AudioOutputUnitStop(audioUnit_);
		AudioUnitUninitialize(audioUnit_);
		AudioComponentInstanceDispose(audioUnit_);
		audioUnit_ = nullptr;
	}

	// Destroy aggregate device if we created one
	if (aggregateDeviceId_ != kAudioObjectUnknown) {
		printf("[addon] Cleaning up multi-output aggregate device...\n");
		
		// Restore original default output device
		AudioDeviceID originalOutput = FindDefaultOutputDevice();
		if (originalOutput != kAudioDeviceUnknown && originalOutput != aggregateDeviceId_) {
			AudioObjectPropertyAddress propertyAddress = {
				kAudioHardwarePropertyDefaultOutputDevice,
				kAudioObjectPropertyScopeGlobal,
				kAudioObjectPropertyElementMain
			};
			
			UInt32 propertySize = sizeof(AudioDeviceID);
			AudioObjectSetPropertyData(kAudioObjectSystemObject,
			                          &propertyAddress,
			                          0, nullptr,
			                          propertySize,
			                          &originalOutput);
		}
		
		// Destroy the aggregate device
		AudioObjectPropertyAddress propertyAddress = {
			kAudioPlugInDestroyAggregateDevice,
			kAudioObjectPropertyScopeGlobal,
			kAudioObjectPropertyElementMain
		};
		
		UInt32 propertySize = sizeof(aggregateDeviceId_);
		AudioObjectGetPropertyData(kAudioObjectSystemObject,
		                          &propertyAddress,
		                          0, nullptr,
		                          &propertySize,
		                          &aggregateDeviceId_);
		
		aggregateDeviceId_ = kAudioObjectUnknown;
		printf("[addon] Multi-output device cleaned up\n");
	}

	if (capture_thread_.joinable()) {
		capture_thread_.join();
	}

	tsfn_.Release();
	printf("[addon] CoreAudio loopback capture stopped\n");
	fflush(stdout);
}

// Helper functions for process enumeration (macOS equivalent)
std::string GetProcessName(pid_t pid) {
	char name[256];
	size_t size = sizeof(name);
	if (proc_name(pid, name, size) > 0) {
		return std::string(name);
	}
	return "";
}

std::vector<pid_t> EnumerateAllProcesses() {
	std::vector<pid_t> pids;
	int numberOfProcesses = proc_listpids(PROC_ALL_PIDS, 0, nullptr, 0);
	if (numberOfProcesses <= 0) {
		return pids;
	}
	
	std::vector<pid_t> buffer(numberOfProcesses);
	numberOfProcesses = proc_listpids(PROC_ALL_PIDS, 0, buffer.data(), (int)(buffer.size() * sizeof(pid_t)));
	
	pid_t currentPid = getpid();
	for (int i = 0; i < numberOfProcesses; ++i) {
		if (buffer[i] > 0 && buffer[i] != currentPid) {
			pids.push_back(buffer[i]);
		}
	}
	
	return pids;
}

pid_t FindPidForProcess(const std::string& processName) {
	std::vector<pid_t> allPids = EnumerateAllProcesses();
	
	// Try exact match
	for (pid_t pid : allPids) {
		std::string name = GetProcessName(pid);
		if (name == processName) {
			printf("[addon] Found exact match for '%s': PID %d\n", processName.c_str(), pid);
			fflush(stdout);
			return pid;
		}
	}
	
	// Try partial match
	std::string baseName = processName;
	size_t dotPos = baseName.find('.');
	if (dotPos != std::string::npos) {
		baseName = baseName.substr(0, dotPos);
	}
	
	for (pid_t pid : allPids) {
		std::string name = GetProcessName(pid);
		std::string nameBase = name;
		dotPos = nameBase.find('.');
		if (dotPos != std::string::npos) {
			nameBase = nameBase.substr(0, dotPos);
		}
		
		if (nameBase == baseName) {
			printf("[addon] Found partial match for '%s': PID %d (%s)\n", processName.c_str(), pid, name.c_str());
			fflush(stdout);
			return pid;
		}
	}
	
	printf("[addon] No process found matching '%s'\n", processName.c_str());
	fflush(stdout);
	return 0;
}

// N-API functions
Napi::Value StartCapture(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	uint32_t pid = 0;
	if (info.Length() > 0 && info[0].IsNumber()) {
		pid = info[0].As<Napi::Number>().Uint32Value();
	}
	if (info.Length() < 2 || !info[1].IsFunction()) {
		Napi::TypeError::New(env, "Callback required").ThrowAsJavaScriptException();
		return env.Null();
	}
	Napi::Function cb = info[1].As<Napi::Function>();
	auto tsfn = Napi::ThreadSafeFunction::New(env, cb, "PCMCallback", 0, 1);
	if (!g_capture) g_capture = std::make_unique<CoreAudioLoopbackCapture>();
	bool ok = g_capture->Start(pid, tsfn);
	return Napi::Boolean::New(env, ok);
}

Napi::Value StopCapture(const Napi::CallbackInfo& info) {
	if (g_capture) g_capture->Stop();
	return info.Env().Undefined();
}

Napi::Value StartCaptureExcludeCurrent(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	if (info.Length() < 1 || !info[0].IsFunction()) {
		Napi::TypeError::New(env, "Callback required").ThrowAsJavaScriptException();
		return env.Null();
	}
	
	Napi::Function cb = info[0].As<Napi::Function>();
	auto tsfn = Napi::ThreadSafeFunction::New(env, cb, "PCMCallback", 0, 1);
	
	if (!g_capture) g_capture = std::make_unique<CoreAudioLoopbackCapture>();
	bool ok = g_capture->Start(0, tsfn); // PID 0 means exclude current
	return Napi::Boolean::New(env, ok);
}

Napi::Value StartCaptureByProcessName(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	if (info.Length() < 2) {
		Napi::TypeError::New(env, "Process name and callback required").ThrowAsJavaScriptException();
		return env.Null();
	}
	
	std::string processName;
	if (info[0].IsString()) {
		processName = info[0].As<Napi::String>().Utf8Value();
	}
	
	if (!info[1].IsFunction()) {
		Napi::TypeError::New(env, "Callback required").ThrowAsJavaScriptException();
		return env.Null();
	}
	
	Napi::Function cb = info[1].As<Napi::Function>();
	auto tsfn = Napi::ThreadSafeFunction::New(env, cb, "PCMCallback", 0, 1);
	
	uint32_t pid = 0;
	if (!processName.empty()) {
		printf("[addon] StartCaptureByProcessName: Looking for process '%s'\n", processName.c_str());
		fflush(stdout);
		
		pid_t foundPid = FindPidForProcess(processName);
		if (foundPid == 0) {
			tsfn.Release();
			printf("[addon] StartCaptureByProcessName: Process '%s' not found\n", processName.c_str());
			fflush(stdout);
			Napi::Error::New(env, "Process not found: " + processName).ThrowAsJavaScriptException();
			return env.Null();
		}
		
		pid = (uint32_t)foundPid;
		printf("[addon] StartCaptureByProcessName: Found process '%s' with PID %u, starting capture...\n", processName.c_str(), pid);
		fflush(stdout);
	}
	
	if (!g_capture) g_capture = std::make_unique<CoreAudioLoopbackCapture>();
	bool ok = g_capture->Start(pid, tsfn);
	
	if (ok) {
		printf("[addon] StartCaptureByProcessName: Capture started successfully for PID %u\n", pid);
	} else {
		printf("[addon] StartCaptureByProcessName: Failed to start capture for PID %u\n", pid);
	}
	fflush(stdout);
	
	return Napi::Boolean::New(env, ok);
}

Napi::Value EnumerateAudioSessions(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	
	std::vector<pid_t> allPids = EnumerateAllProcesses();
	
	Napi::Array result = Napi::Array::New(env);
	size_t resultIndex = 0;
	
	for (pid_t pid : allPids) {
		std::string processName = GetProcessName(pid);
		if (processName.empty()) continue;
		
		// Filter out system processes
		if (processName == "kernel_task" ||
		    processName == "launchd" ||
		    processName == "WindowServer") {
			continue;
		}
		
		Napi::Object session = Napi::Object::New(env);
		session.Set("pid", Napi::Number::New(env, pid));
		session.Set("processName", Napi::String::New(env, processName));
		session.Set("hasActiveAudio", Napi::Boolean::New(env, false)); // macOS doesn't have equivalent
		result[resultIndex++] = session;
	}
	
	return result;
}

Napi::Value FindAudioPidForProcess(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	if (info.Length() < 1 || !info[0].IsString()) {
		Napi::TypeError::New(env, "Process name required").ThrowAsJavaScriptException();
		return env.Null();
	}
	
	std::string processName = info[0].As<Napi::String>().Utf8Value();
	pid_t pid = FindPidForProcess(processName);
	
	return Napi::Number::New(env, pid);
}

Napi::Value ResolvePidFromWindow(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	// macOS doesn't have HWND equivalent, return 0
	return Napi::Number::New(env, 0);
}

// Store original system output device
static AudioDeviceID g_originalOutputDevice = kAudioDeviceUnknown;

Napi::Value SetSystemOutputToBlackHole(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	
	// Get current default output device
	UInt32 propertySize = sizeof(AudioDeviceID);
	AudioObjectPropertyAddress propertyAddress = {
		kAudioHardwarePropertyDefaultOutputDevice,
		kAudioObjectPropertyScopeGlobal,
		kAudioObjectPropertyElementMain
	};
	
	OSStatus status = AudioObjectGetPropertyData(kAudioObjectSystemObject,
	                                            &propertyAddress,
	                                            0,
	                                            nullptr,
	                                            &propertySize,
	                                            &g_originalOutputDevice);
	if (status != noErr) {
		printf("[addon] Failed to get current output device\n");
		return Napi::Boolean::New(env, false);
	}
	
	// Find BlackHole output device
	AudioDeviceID blackHoleOutput = FindBlackHoleOutputDevice();
	if (blackHoleOutput == kAudioDeviceUnknown) {
		printf("[addon] BlackHole output device not found\n");
		return Napi::Boolean::New(env, false);
	}
	
	// Set BlackHole as default output device
	propertySize = sizeof(AudioDeviceID);
	status = AudioObjectSetPropertyData(kAudioObjectSystemObject,
	                                   &propertyAddress,
	                                   0,
	                                   nullptr,
	                                   propertySize,
	                                   &blackHoleOutput);
	if (status != noErr) {
		printf("[addon] Failed to set BlackHole as output device: %d\n", (int)status);
		return Napi::Boolean::New(env, false);
	}
	
	printf("[addon] System output changed to BlackHole (original saved)\n");
	return Napi::Boolean::New(env, true);
}

Napi::Value RestoreSystemOutput(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	
	if (g_originalOutputDevice == kAudioDeviceUnknown) {
		printf("[addon] No original output device to restore\n");
		return Napi::Boolean::New(env, false);
	}
	
	UInt32 propertySize = sizeof(AudioDeviceID);
	AudioObjectPropertyAddress propertyAddress = {
		kAudioHardwarePropertyDefaultOutputDevice,
		kAudioObjectPropertyScopeGlobal,
		kAudioObjectPropertyElementMain
	};
	
	OSStatus status = AudioObjectSetPropertyData(kAudioObjectSystemObject,
	                                            &propertyAddress,
	                                            0,
	                                            nullptr,
	                                            propertySize,
	                                            &g_originalOutputDevice);
	if (status != noErr) {
		printf("[addon] Failed to restore original output device: %d\n", (int)status);
		return Napi::Boolean::New(env, false);
	}
	
	printf("[addon] System output restored to original device\n");
	g_originalOutputDevice = kAudioDeviceUnknown; // Clear after restore
	return Napi::Boolean::New(env, true);
}

Napi::Value GetRealOutputDevice(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	
	// Return the original output device ID (or current if not changed)
	AudioDeviceID currentDevice = g_originalOutputDevice;
	if (currentDevice == kAudioDeviceUnknown) {
		// Get current default output device
		UInt32 propertySize = sizeof(AudioDeviceID);
		AudioObjectPropertyAddress propertyAddress = {
			kAudioHardwarePropertyDefaultOutputDevice,
			kAudioObjectPropertyScopeGlobal,
			kAudioObjectPropertyElementMain
		};
		
		OSStatus status = AudioObjectGetPropertyData(kAudioObjectSystemObject,
		                                            &propertyAddress,
		                                            0,
		                                            nullptr,
		                                            &propertySize,
		                                            &currentDevice);
		if (status != noErr) {
			return env.Null();
		}
	}
	
	// Get device name for identification
	CFStringRef deviceName = nullptr;
	UInt32 propertySize = sizeof(CFStringRef);
	AudioObjectPropertyAddress propertyAddress = {
		kAudioDevicePropertyDeviceNameCFString,
		kAudioObjectPropertyScopeOutput,
		kAudioObjectPropertyElementMain
	};
	
	OSStatus status = AudioObjectGetPropertyData(currentDevice,
	                                            &propertyAddress,
	                                            0,
	                                            nullptr,
	                                            &propertySize,
	                                            &deviceName);
	if (status == noErr && deviceName) {
		char nameBuffer[256];
		if (CFStringGetCString(deviceName, nameBuffer, sizeof(nameBuffer), kCFStringEncodingUTF8)) {
			std::string name(nameBuffer);
			std::transform(name.begin(), name.end(), name.begin(), ::tolower);
			// If it's BlackHole, we need to find the real device
			if (name.find("blackhole") != std::string::npos) {
				CFRelease(deviceName);
				// Return null - caller should use default device
				return env.Null();
			}
			CFRelease(deviceName);
		} else {
			CFRelease(deviceName);
		}
	}
	
	// Return device ID as string (we'll use it to find the device in JS)
	return Napi::String::New(env, std::to_string(currentDevice));
}

Napi::Value CheckMultiOutputSetup(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	Napi::Object result = Napi::Object::New(env);
	
	// Check if BlackHole is installed
	AudioDeviceID blackHole = FindBlackHoleOutputDevice();
	result.Set("blackHoleInstalled", Napi::Boolean::New(env, blackHole != kAudioDeviceUnknown));
	
	if (blackHole == kAudioDeviceUnknown) {
		result.Set("isConfigured", Napi::Boolean::New(env, false));
		result.Set("message", Napi::String::New(env, "BlackHole 2ch is not installed. Please install it from https://existential.audio/blackhole/"));
		return result;
	}
	
	// Check default output device
	AudioDeviceID defaultOutput = FindDefaultOutputDevice();
	if (defaultOutput == kAudioDeviceUnknown) {
		result.Set("isConfigured", Napi::Boolean::New(env, false));
		result.Set("message", Napi::String::New(env, "No default output device found"));
		return result;
	}
	
	// Get device name
	CFStringRef deviceName = nullptr;
	UInt32 propertySize = sizeof(CFStringRef);
	AudioObjectPropertyAddress propertyAddress = {
		kAudioDevicePropertyDeviceNameCFString,
		kAudioObjectPropertyScopeOutput,
		kAudioObjectPropertyElementMain
	};
	
	OSStatus status = AudioObjectGetPropertyData(defaultOutput, &propertyAddress, 0, nullptr, &propertySize, &deviceName);
	if (status == noErr && deviceName) {
		char nameBuffer[256];
		if (CFStringGetCString(deviceName, nameBuffer, sizeof(nameBuffer), kCFStringEncodingUTF8)) {
			std::string name(nameBuffer);
			result.Set("defaultOutputName", Napi::String::New(env, name));
			
			std::transform(name.begin(), name.end(), name.begin(), ::tolower);
			
			// Check if it's a multi-output device
			bool isMultiOutput = (name.find("multi") != std::string::npos || 
			                     name.find("aggregate") != std::string::npos);
			
			result.Set("isConfigured", Napi::Boolean::New(env, isMultiOutput));
			
			if (isMultiOutput) {
				result.Set("message", Napi::String::New(env, "Multi-Output device detected - setup is correct!"));
			} else if (defaultOutput == blackHole) {
				result.Set("message", Napi::String::New(env, "Default output is BlackHole - you won't hear audio. Please create a Multi-Output Device."));
			} else {
				result.Set("message", Napi::String::New(env, "Please create a Multi-Output Device in Audio MIDI Setup with your speakers and BlackHole 2ch, then set it as default output."));
			}
		}
		CFRelease(deviceName);
	}
	
	return result;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
	exports.Set("startCapture", Napi::Function::New(env, StartCapture));
	exports.Set("stopCapture", Napi::Function::New(env, StopCapture));
	exports.Set("startCaptureByProcessName", Napi::Function::New(env, StartCaptureByProcessName));
	exports.Set("startCaptureExcludeCurrent", Napi::Function::New(env, StartCaptureExcludeCurrent));
	exports.Set("enumerateAudioSessions", Napi::Function::New(env, EnumerateAudioSessions));
	exports.Set("findAudioPidForProcess", Napi::Function::New(env, FindAudioPidForProcess));
	exports.Set("resolvePidFromWindow", Napi::Function::New(env, ResolvePidFromWindow));
	exports.Set("setSystemOutputToBlackHole", Napi::Function::New(env, SetSystemOutputToBlackHole));
	exports.Set("restoreSystemOutput", Napi::Function::New(env, RestoreSystemOutput));
	exports.Set("getRealOutputDevice", Napi::Function::New(env, GetRealOutputDevice));
	exports.Set("checkMultiOutputSetup", Napi::Function::New(env, CheckMultiOutputSetup));
	return exports;
}

NODE_API_MODULE(coreaudio_loopback, Init)

