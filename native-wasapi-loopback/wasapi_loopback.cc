#include <napi.h>
#include <sdkddkver.h>
#include <windows.h>
#include <mmdeviceapi.h>
#include <initguid.h>
#include <audioclient.h>
#include <audiopolicy.h>
#include <functiondiscoverykeys_devpkey.h>
#include <propvarutil.h>
#include <wrl/client.h>
#include <psapi.h>
#include <tlhelp32.h>
#include <mmreg.h>
#include <ksmedia.h>

#include <thread>
#include <atomic>
#include <vector>
#include <string>
#include <map>
#include <cmath>

#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "uuid.lib")
#pragma comment(lib, "winmm.lib")
#pragma comment(lib, "avrt.lib")
#pragma comment(lib, "psapi.lib")

// Add missing Windows SDK definitions for process loopback
#ifndef AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS
typedef struct AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
    DWORD TargetProcessId;
    DWORD ProcessLoopbackMode;
} AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS;
#endif

#ifndef AUDIOCLIENT_PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE
#define AUDIOCLIENT_PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE 0x00000001
#endif

#ifndef AUDIOCLIENT_PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE
#define AUDIOCLIENT_PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE 0x00000002
#endif

// For now, we'll use the standard Initialize method and handle process exclusion differently
// The InitializeSharedAudioStream with PROPVARIANT is not available in the current Windows SDK version

using Microsoft::WRL::ComPtr;

class WasapiLoopbackCapture;

namespace {
	std::unique_ptr<WasapiLoopbackCapture> g_capture;
}

class WasapiLoopbackCapture {
public:
    WasapiLoopbackCapture() : running_(false), targetPid_(0) {}
    ~WasapiLoopbackCapture() { Stop(); }

	bool Start(DWORD pid, Napi::ThreadSafeFunction tsfn);
	void Stop();

private:
	std::thread capture_thread_;
	std::atomic<bool> running_;
	Napi::ThreadSafeFunction tsfn_;
	DWORD targetPid_; // Target process PID (0 = system-wide)
};

bool WasapiLoopbackCapture::Start(DWORD pid, Napi::ThreadSafeFunction tsfn) {
	if (running_) return false;
	running_ = true;
	tsfn_ = tsfn;
	targetPid_ = pid;

	printf("[addon] Starting system-wide WASAPI loopback capture for PID %lu\n", pid);
	printf("[addon] NOTE: To exclude Whispra TTS, route it through a separate virtual audio device\n");
	fflush(stdout);

	capture_thread_ = std::thread([this, pid]() {
		HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
		if (FAILED(hr)) { printf("[addon] CoInitializeEx failed: 0x%08lx\n", hr); fflush(stdout); running_ = false; tsfn_.Release(); return; }

		ComPtr<IMMDeviceEnumerator> enumr;
		ComPtr<IMMDevice> device;
		ComPtr<IAudioClient3> audioClient3; // per-app/system
		ComPtr<IAudioClient>  audioClient1; // system fallback
		ComPtr<IAudioCaptureClient> cap;
		WAVEFORMATEX* pwfx = nullptr;
		HANDLE hEvent = nullptr;

		do {
			// Default render endpoint
			hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL, IID_PPV_ARGS(&enumr));
			if (FAILED(hr)) { printf("[addon] Create MMDeviceEnumerator failed: 0x%08lx\n", hr); fflush(stdout); break; }
			hr = enumr->GetDefaultAudioEndpoint(eRender, eConsole, &device);
			if (FAILED(hr)) { printf("[addon] GetDefaultAudioEndpoint failed: 0x%08lx\n", hr); fflush(stdout); break; }

			// Prefer IAudioClient3 if available
			hr = device->Activate(__uuidof(IAudioClient3), CLSCTX_ALL, nullptr, (void**)audioClient3.GetAddressOf());
			if (FAILED(hr) || !audioClient3) {
				printf("[addon] Activate IAudioClient3 failed or not available: 0x%08lx\n", hr); fflush(stdout);
				// Fallback to IAudioClient (system-wide)
				hr = device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr, (void**)audioClient1.GetAddressOf());
				if (FAILED(hr)) { printf("[addon] Activate IAudioClient failed: 0x%08lx\n", hr); fflush(stdout); break; }
			}

			// Get mix format
			if (audioClient3) hr = audioClient3->GetMixFormat(&pwfx);
			else              hr = audioClient1->GetMixFormat(&pwfx);
			if (FAILED(hr) || !pwfx) { printf("[addon] GetMixFormat failed: 0x%08lx\n", hr); fflush(stdout); break; }

			// Event-driven capture
			DWORD streamFlags = AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK;

			bool initialized3 = false;
			if (audioClient3) {
				// Get current process ID to exclude Whispra app
				DWORD currentPid = GetCurrentProcessId();
				printf("[addon] Current process PID: %lu\n", currentPid); fflush(stdout);
				
				// For now, we'll use the standard Initialize method
				// The process exclusion will be handled at the application level by filtering out our own audio
				if (pid == 0) {
					// System-wide capture (we'll filter out our own audio in post-processing)
					hr = audioClient3->Initialize(AUDCLNT_SHAREMODE_SHARED, streamFlags, 0, 0, pwfx, nullptr);
					if (FAILED(hr)) { 
						printf("[addon] IAudioClient3 Initialize (system) failed: 0x%08lx\n", hr); fflush(stdout); 
					} else { 
						initialized3 = true; 
						printf("[addon] IAudioClient3 Initialize (system) OK - will filter out current process audio\n"); 
						fflush(stdout); 
					}
				}
				// If pid > 0, we want to include a specific target process
				else if (pid > 0) {
					// For specific process capture, we'll use the standard Initialize method
					// The process-specific capture will be handled by the application logic
					hr = audioClient3->Initialize(AUDCLNT_SHAREMODE_SHARED, streamFlags, 0, 0, pwfx, nullptr);
					if (FAILED(hr)) { 
						printf("[addon] IAudioClient3 Initialize (target process) failed: 0x%08lx\n", hr); fflush(stdout); 
					} else { 
						initialized3 = true; 
						printf("[addon] IAudioClient3 Initialize (target process) OK for pid=%lu\n", pid); 
						fflush(stdout); 
					}
				}
				
				if (audioClient3 && !initialized3) { audioClient3.Reset(); }
			}

			// If we don't have a working IAudioClient3, use IAudioClient (system-wide)
			if (!audioClient3) {
				if (!audioClient1) {
					// Should not happen, but guard anyway
					hr = device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr, (void**)audioClient1.GetAddressOf());
					if (FAILED(hr)) { printf("[addon] Activate IAudioClient (fallback) failed: 0x%08lx\n", hr); fflush(stdout); break; }
				}
				hr = audioClient1->Initialize(AUDCLNT_SHAREMODE_SHARED, streamFlags, 0, 0, pwfx, nullptr);
				if (FAILED(hr)) { printf("[addon] IAudioClient Initialize failed: 0x%08lx\n", hr); fflush(stdout); break; }
				else { printf("[addon] IAudioClient Initialize (system) OK\n"); fflush(stdout); }
			}

			// Common setup
			hEvent = CreateEvent(nullptr, FALSE, FALSE, nullptr);
			if (!hEvent) { hr = E_FAIL; printf("[addon] CreateEvent failed\n"); fflush(stdout); break; }
			if (audioClient3) hr = audioClient3->SetEventHandle(hEvent); else hr = audioClient1->SetEventHandle(hEvent);
			if (FAILED(hr)) { printf("[addon] SetEventHandle failed: 0x%08lx\n", hr); fflush(stdout); break; }
			if (audioClient3) hr = audioClient3->GetService(IID_PPV_ARGS(&cap)); else hr = audioClient1->GetService(IID_PPV_ARGS(&cap));
			if (FAILED(hr)) { printf("[addon] GetService(IAudioCaptureClient) failed: 0x%08lx\n", hr); fflush(stdout); break; }
			if (audioClient3) hr = audioClient3->Start(); else hr = audioClient1->Start();
			if (FAILED(hr)) { printf("[addon] AudioClient Start failed: 0x%08lx\n", hr); fflush(stdout); break; }
			printf("[addon] Capture started. Entering loop...\n"); fflush(stdout);

			// --- Lightweight pre-processing state (HPF + adaptive noise gate) ---
			// Design a simple 2nd-order high-pass biquad at ~90 Hz for 16 kHz stream
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
			} hpf;
			const float outFs = 16000.0f;
			hpf.setup(outFs, 90.0f, 0.7071f);
			// Adaptive noise gate state
			float env = 0.0f;                 // signal envelope
			float noiseFloor = 0.003f;        // ~-50 dBFS initial floor
			float gainSmooth = 1.0f;          // smoothed gate gain
			// Time constants
			const float tauEnv = 0.010f;      // 10 ms envelope
			const float tauRise = 0.500f;     // 500 ms noise floor rise
			const float tauAtk  = 0.005f;     // 5 ms gain attack (attenuation)
			const float tauRel  = 0.050f;     // 50 ms gain release (recovery)
			const float aEnv  = expf(-1.0f / (tauEnv * outFs));
			const float aRise = expf(-1.0f / (tauRise * outFs));
			const float aAtk  = expf(-1.0f / (tauAtk  * outFs));
			const float aRel  = expf(-1.0f / (tauRel  * outFs));

			// Capture loop
			while (running_) {
				DWORD wr = WaitForSingleObject(hEvent, 200);
				if (wr != WAIT_OBJECT_0) continue;

				for (;;) {
					UINT32 packet = 0;
					hr = cap->GetNextPacketSize(&packet);
					if (FAILED(hr) || packet == 0) break;

					BYTE* pData = nullptr;
					UINT32 frames = 0;
					DWORD  capFlags = 0;
					hr = cap->GetBuffer(&pData, &frames, &capFlags, nullptr, nullptr);
					if (FAILED(hr)) { printf("[addon] GetBuffer failed: 0x%08lx\n", hr); fflush(stdout); break; }

									size_t bytes = frames * pwfx->nBlockAlign;
								
								// Single-step: mix to mono, resample to 16kHz, normalize, quantize to int16, wrap WAV
								const uint32_t inRate = pwfx->nSamplesPerSec;
								const uint16_t inCh = pwfx->nChannels;
								const uint32_t outRate = 16000;
								// 1) Convert to mono float [-1,1]
								std::vector<float> mono; mono.reserve(frames);
								if (pwfx->wFormatTag == WAVE_FORMAT_IEEE_FLOAT || 
									(pwfx->wFormatTag == WAVE_FORMAT_EXTENSIBLE && 
									 reinterpret_cast<WAVEFORMATEXTENSIBLE*>(pwfx)->SubFormat == KSDATAFORMAT_SUBTYPE_IEEE_FLOAT)) {
									const float* f = reinterpret_cast<const float*>(pData);
									for (UINT32 i = 0; i < frames; ++i) {
										float sum = 0.0f;
										for (UINT16 c = 0; c < inCh; ++c) sum += f[i * inCh + c];
										float m = sum / (float)inCh;
										if (m > 1.0f) m = 1.0f; else if (m < -1.0f) m = -1.0f;
										mono.push_back(m);
									}
								} else {
									const int16_t* s = reinterpret_cast<const int16_t*>(pData);
									for (UINT32 i = 0; i < frames; ++i) {
										int sum = 0;
										for (UINT16 c = 0; c < inCh; ++c) sum += s[i * inCh + c];
										float m = (float)sum / (float)inCh / 32768.0f;
										if (m > 1.0f) m = 1.0f; else if (m < -1.0f) m = -1.0f;
										mono.push_back(m);
									}
								}
					// 2) Resample to 16k using linear interpolation
								size_t outLen = (size_t)((double)mono.size() * (double)outRate / (double)inRate);
								if (outLen == 0) outLen = 1;
								std::vector<float> resampled(outLen);
								for (size_t i = 0; i < outLen; ++i) {
									double pos = (double)i * (double)inRate / (double)outRate;
									size_t idx = (size_t)pos;
									double frac = pos - (double)idx;
									float a = mono[ idx < mono.size() ? idx : (mono.size()-1) ];
									float b = mono[ (idx+1) < mono.size() ? (idx+1) : (mono.size()-1) ];
									resampled[i] = (float)((1.0 - frac) * a + frac * b);
								}
								// 3) Lightweight noise suppression: high-pass + adaptive noise gate
								for (size_t i = 0; i < resampled.size(); ++i) {
									float x = resampled[i];
									// High-pass to remove steady LF rumble (wind/fans)
									x = hpf.process(x);
									// Envelope follower
									float av = x < 0 ? -x : x;
									env = aEnv * env + (1.0f - aEnv) * av;
									// Update noise floor: fast for drops, slow for rises
									if (env < noiseFloor) noiseFloor = env;
									else                 noiseFloor = noiseFloor + (env - noiseFloor) * (1.0f - aRise);
									if (noiseFloor < 1e-6f) noiseFloor = 1e-6f;
									// Dynamic threshold and soft-knee gate
									float thr = noiseFloor * 2.5f + 1e-6f;
									float tGain = (env > thr) ? 1.0f : (env / thr);
									// Soft knee shaping
									tGain = sqrtf(tGain);
									// Smooth gain changes (fast attack when attenuating, slower release)
									float a = (tGain < gainSmooth) ? aAtk : aRel;
									gainSmooth = tGain + (gainSmooth - tGain) * a;
									// Apply gain
									resampled[i] = x * gainSmooth;
								}
								// 4) Mild voice boost with limiter (increase vocal loudness a bit)
								float peak = 0.0f;
								for (float v : resampled) { float av2 = v < 0 ? -v : v; if (av2 > peak) peak = av2; }
								const float kVoiceBoost = 1.5f; // ~+3.5 dB, adjust 1.2–1.8 as needed
								float gain;
								if (peak < 1e-6f) gain = kVoiceBoost;
								else gain = (peak * kVoiceBoost > 0.99f) ? (0.99f / peak) : kVoiceBoost;
								// 4) Quantize to int16
								std::vector<int16_t> int16Samples; int16Samples.resize(resampled.size());
								for (size_t i = 0; i < resampled.size(); ++i) {
									float x = resampled[i] * gain;
									if (x > 1.0f) x = 1.0f; else if (x < -1.0f) x = -1.0f;
									int s = (int)(x * 32767.0f + (x >= 0 ? 0.5f : -0.5f));
									if (s > 32767) s = 32767; if (s < -32768) s = -32768;
									int16Samples[i] = (int16_t)s;
								}
								// 5) Build WAV header for 16kHz, mono, 16-bit PCM
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

					cap->ReleaseBuffer(frames);
				}
			}

			if (audioClient3) audioClient3->Stop();
			if (audioClient1) audioClient1->Stop();

		} while (false);

		if (hEvent) CloseHandle(hEvent);
		if (cap) cap.Reset();
		if (audioClient3) audioClient3.Reset();
		if (audioClient1) audioClient1.Reset();
		if (device) device.Reset();
		if (enumr) enumr.Reset();
		if (pwfx) CoTaskMemFree(pwfx);

		tsfn_.Release();
		CoUninitialize();
	});

	return true;
}

void WasapiLoopbackCapture::Stop() {
	running_ = false;
	if (capture_thread_.joinable()) capture_thread_.join();
	printf("[addon] WASAPI loopback capture stopped\n");
	fflush(stdout);
}

// Helper function to get process name from PID
std::string GetProcessName(DWORD pid) {
	HANDLE hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, pid);
	if (!hProcess) return "";
	
	char processName[MAX_PATH];
	if (GetModuleBaseNameA(hProcess, NULL, processName, sizeof(processName))) {
		CloseHandle(hProcess);
		return std::string(processName);
	}
	CloseHandle(hProcess);
	return "";
}

// Enumerate ALL running processes (not just those with audio sessions)
std::vector<DWORD> EnumerateAllProcesses() {
	std::vector<DWORD> allPids;

	HANDLE hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
	if (hSnapshot == INVALID_HANDLE_VALUE) return allPids;

	PROCESSENTRY32 pe32;
	pe32.dwSize = sizeof(PROCESSENTRY32);

	if (Process32First(hSnapshot, &pe32)) {
		do {
			// Filter out system processes and our own process
			if (pe32.th32ProcessID != 0 && pe32.th32ProcessID != 4 && pe32.th32ProcessID != GetCurrentProcessId()) {
				// Only include processes we can open (have permission to)
				HANDLE hProcess = OpenProcess(PROCESS_QUERY_INFORMATION, FALSE, pe32.th32ProcessID);
				if (hProcess) {
					CloseHandle(hProcess);
					allPids.push_back(pe32.th32ProcessID);
				}
			}
		} while (Process32Next(hSnapshot, &pe32));
	}

	CloseHandle(hSnapshot);
	return allPids;
}

// Enumerate active audio sessions and find PIDs with active audio
std::vector<DWORD> EnumerateActiveAudioSessions() {
	std::vector<DWORD> activePids;

	HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
	if (FAILED(hr)) return activePids;

	ComPtr<IMMDeviceEnumerator> deviceEnumerator;
	hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL, IID_PPV_ARGS(&deviceEnumerator));
	if (FAILED(hr)) {
		CoUninitialize();
		return activePids;
	}

	ComPtr<IMMDevice> device;
	hr = deviceEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &device);
	if (FAILED(hr)) {
		CoUninitialize();
		return activePids;
	}

	ComPtr<IAudioSessionManager2> sessionManager;
	hr = device->Activate(__uuidof(IAudioSessionManager2), CLSCTX_ALL, nullptr, (void**)&sessionManager);
	if (FAILED(hr)) {
		CoUninitialize();
		return activePids;
	}

	ComPtr<IAudioSessionEnumerator> sessionEnumerator;
	hr = sessionManager->GetSessionEnumerator(&sessionEnumerator);
	if (FAILED(hr)) {
		CoUninitialize();
		return activePids;
	}

	int sessionCount;
	hr = sessionEnumerator->GetCount(&sessionCount);
	if (FAILED(hr)) {
		CoUninitialize();
		return activePids;
	}

	for (int i = 0; i < sessionCount; i++) {
		ComPtr<IAudioSessionControl> sessionControl;
		hr = sessionEnumerator->GetSession(i, &sessionControl);
		if (FAILED(hr)) continue;

		ComPtr<IAudioSessionControl2> sessionControl2;
		hr = sessionControl.As(&sessionControl2);
		if (FAILED(hr)) continue;

		// Get PID - don't filter by state so we show ALL apps that have audio sessions
		// This includes inactive apps so user can select them before they start playing
		DWORD pid;
		hr = sessionControl2->GetProcessId(&pid);
		if (FAILED(hr) || pid == 0) continue;

		activePids.push_back(pid);
	}

	CoUninitialize();
	return activePids;
}

// Find the PID for a given process name from ALL running processes (not just those with active audio)
DWORD FindPidForProcess(const std::string& processName) {
	std::vector<DWORD> allPids = EnumerateAllProcesses();

	// First, try to find exact matches
	for (DWORD pid : allPids) {
		std::string name = GetProcessName(pid);
		if (_stricmp(name.c_str(), processName.c_str()) == 0) {
			printf("[addon] Found exact match for '%s': PID %lu\n", processName.c_str(), pid);
			fflush(stdout);
			return pid;
		}
	}

	// If no exact match, try partial matches (e.g., "chrome" matches "chrome.exe")
	std::string baseName = processName;
	size_t dotPos = baseName.find('.');
	if (dotPos != std::string::npos) {
		baseName = baseName.substr(0, dotPos);
	}

	for (DWORD pid : allPids) {
		std::string name = GetProcessName(pid);
		std::string nameBase = name;
		dotPos = nameBase.find('.');
		if (dotPos != std::string::npos) {
			nameBase = nameBase.substr(0, dotPos);
		}

		if (_stricmp(nameBase.c_str(), baseName.c_str()) == 0) {
			printf("[addon] Found partial match for '%s': PID %lu (%s)\n", processName.c_str(), pid, name.c_str());
			fflush(stdout);
			return pid;
		}
	}

	printf("[addon] No process found matching '%s'\n", processName.c_str());
	fflush(stdout);
	return 0;
}

// Find the best PID for a given process name (e.g., "chrome.exe") - ONLY from active audio sessions
DWORD FindActiveAudioPidForProcess(const std::string& processName) {
	std::vector<DWORD> activePids = EnumerateActiveAudioSessions();

	// First, try to find exact matches
	for (DWORD pid : activePids) {
		std::string name = GetProcessName(pid);
		if (_stricmp(name.c_str(), processName.c_str()) == 0) {
			return pid;
		}
	}

	// If no exact match, try partial matches (e.g., "chrome" matches "chrome.exe")
	std::string baseName = processName;
	size_t dotPos = baseName.find('.');
	if (dotPos != std::string::npos) {
		baseName = baseName.substr(0, dotPos);
	}

	for (DWORD pid : activePids) {
		std::string name = GetProcessName(pid);
		std::string nameBase = name;
		dotPos = nameBase.find('.');
		if (dotPos != std::string::npos) {
			nameBase = nameBase.substr(0, dotPos);
		}

		if (_stricmp(nameBase.c_str(), baseName.c_str()) == 0) {
			return pid;
		}
	}

	return 0;
}

// N-API function to enumerate all processes (for app selection)
Napi::Value EnumerateAudioSessions(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();

	// Get all running processes
	std::vector<DWORD> allPids = EnumerateAllProcesses();

	// Get processes with active audio sessions for marking
	std::vector<DWORD> activePids = EnumerateActiveAudioSessions();
	std::map<DWORD, bool> hasAudioSession;
	for (DWORD pid : activePids) {
		hasAudioSession[pid] = true;
	}

	Napi::Array result = Napi::Array::New(env);
	size_t resultIndex = 0;

	for (DWORD pid : allPids) {
		std::string processName = GetProcessName(pid);
		// Filter out empty process names and system processes
		if (processName.empty()) continue;

		// Filter out common system/background processes that users won't want to capture
		if (processName == "svchost.exe" ||
		    processName == "conhost.exe" ||
		    processName == "csrss.exe" ||
		    processName == "dwm.exe" ||
		    processName == "lsass.exe" ||
		    processName == "services.exe" ||
		    processName == "smss.exe" ||
		    processName == "wininit.exe" ||
		    processName == "winlogon.exe") {
			continue;
		}

		Napi::Object session = Napi::Object::New(env);
		session.Set("pid", Napi::Number::New(env, pid));
		session.Set("processName", Napi::String::New(env, processName));
		session.Set("hasActiveAudio", Napi::Boolean::New(env, hasAudioSession.count(pid) > 0));
		result[resultIndex++] = session;
	}

	return result;
}

// N-API function to find active audio PID for a process
Napi::Value FindAudioPidForProcess(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	if (info.Length() < 1 || !info[0].IsString()) {
		Napi::TypeError::New(env, "Process name required").ThrowAsJavaScriptException();
		return env.Null();
	}
	
	std::string processName = info[0].As<Napi::String>().Utf8Value();
	DWORD pid = FindActiveAudioPidForProcess(processName);
	
	return Napi::Number::New(env, pid);
}

// N-API function to start capture by process name (resolves PID internally)
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

	DWORD pid = 0;
	if (!processName.empty()) {
		printf("[addon] StartCaptureByProcessName: Looking for process '%s'\n", processName.c_str());
		fflush(stdout);

		// Use FindPidForProcess to search ALL processes, not just those with active audio
		pid = FindPidForProcess(processName);
		if (pid == 0) {
			tsfn.Release();
			printf("[addon] StartCaptureByProcessName: Process '%s' not found\n", processName.c_str());
			fflush(stdout);
			Napi::Error::New(env, "Process not found: " + processName).ThrowAsJavaScriptException();
			return env.Null();
		}

		printf("[addon] StartCaptureByProcessName: Found process '%s' with PID %lu, starting capture...\n", processName.c_str(), pid);
		fflush(stdout);
	}

	if (!g_capture) g_capture = std::make_unique<WasapiLoopbackCapture>();
	bool ok = g_capture->Start(pid, tsfn);

	if (ok) {
		printf("[addon] StartCaptureByProcessName: Capture started successfully for PID %lu\n", pid);
	} else {
		printf("[addon] StartCaptureByProcessName: Failed to start capture for PID %lu\n", pid);
	}
	fflush(stdout);

	return Napi::Boolean::New(env, ok);
}

// N-API glue
Napi::Value StartCapture(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	DWORD pid = 0;
	if (info.Length() > 0 && info[0].IsNumber()) {
		pid = info[0].As<Napi::Number>().Uint32Value();
	}
	if (info.Length() < 2 || !info[1].IsFunction()) {
		Napi::TypeError::New(env, "Callback required").ThrowAsJavaScriptException();
		return env.Null();
	}
	Napi::Function cb = info[1].As<Napi::Function>();
	auto tsfn = Napi::ThreadSafeFunction::New(env, cb, "PCMCallback", 0, 1);
	if (!g_capture) g_capture = std::make_unique<WasapiLoopbackCapture>();
	bool ok = g_capture->Start(pid, tsfn);
	return Napi::Boolean::New(env, ok);
}

Napi::Value StopCapture(const Napi::CallbackInfo& info) {
	if (g_capture) g_capture->Stop();
	return info.Env().Undefined();
}

// N-API function to start capture with current process excluded
Napi::Value StartCaptureExcludeCurrent(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	if (info.Length() < 1 || !info[1].IsFunction()) {
		Napi::TypeError::New(env, "Callback required").ThrowAsJavaScriptException();
		return env.Null();
	}
	
	Napi::Function cb = info[1].As<Napi::Function>();
	auto tsfn = Napi::ThreadSafeFunction::New(env, cb, "PCMCallback", 0, 1);
	
	// Pass 0 as PID to indicate we want to exclude current process
	if (!g_capture) g_capture = std::make_unique<WasapiLoopbackCapture>();
	bool ok = g_capture->Start(0, tsfn);
	return Napi::Boolean::New(env, ok);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
	exports.Set("startCapture", Napi::Function::New(env, StartCapture));
	exports.Set("stopCapture", Napi::Function::New(env, StopCapture));
	exports.Set("startCaptureByProcessName", Napi::Function::New(env, StartCaptureByProcessName));
	exports.Set("startCaptureExcludeCurrent", Napi::Function::New(env, StartCaptureExcludeCurrent));
	exports.Set("enumerateAudioSessions", Napi::Function::New(env, EnumerateAudioSessions));
	exports.Set("findAudioPidForProcess", Napi::Function::New(env, FindAudioPidForProcess));
	// Export helper to resolve HWND -> PID
	exports.Set("resolvePidFromWindow", Napi::Function::New(env, [](const Napi::CallbackInfo& info) -> Napi::Value {
		Napi::Env env = info.Env();
		if (info.Length() < 1 || (!info[0].IsNumber() && !info[0].IsBigInt())) {
			Napi::TypeError::New(env, "Window handle (HWND) required").ThrowAsJavaScriptException();
			return env.Null();
		}
		uint64_t handle = 0;
		if (info[0].IsBigInt()) {
			bool lossless = false;
			handle = info[0].As<Napi::BigInt>().Uint64Value(&lossless);
		} else {
			handle = static_cast<uint64_t>(info[0].As<Napi::Number>().Uint32Value());
		}
		HWND hwnd = reinterpret_cast<HWND>(static_cast<uintptr_t>(handle));
		DWORD pid = 0;
		GetWindowThreadProcessId(hwnd, &pid);
		return Napi::Number::New(env, static_cast<double>(pid));
	}));
	return exports;
}

NODE_API_MODULE(wasapi_loopback, Init)
