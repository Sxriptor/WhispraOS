export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
  groupId?: string;
}

export interface AudioSegment {
  id: string;
  data: Float32Array;
  sampleRate: number;
  channelCount: number;
  duration: number;
  timestamp: number;
}

export interface AudioCaptureService {
  startCapture(deviceId?: string): Promise<void>;
  stopCapture(): Promise<void>;
  isActive(): boolean;
}