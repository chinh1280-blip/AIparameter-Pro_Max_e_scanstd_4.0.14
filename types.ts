
// Add ZoneId type for machine zones
export type ZoneId = 'zone1' | 'zone2' | 'zone3' | 'zone4';

export interface ImageProcessingProfile {
  id: string;
  name: string;
  resizeMaxWidth: number;
  jpegQuality: number;
  enableGrayscale: boolean;
  enableAdaptiveThreshold: boolean;
  adaptiveBlockSize: number;
  adaptiveC: number;
  contrast: number;
  brightness: number;
  enableReferenceImage?: boolean;
  referenceImageUrl?: string;
}

export interface ZoneImageConfig {
  id: string;
  label: string;
  guideImage?: string;
  processingProfileId?: string; // Replaces captureMode
}

export const DEFAULT_PROCESSING_PROFILES: ImageProcessingProfile[] = [
  {
    id: 'digital_meter',
    name: 'Mặc định (Gốc)',
    resizeMaxWidth: 1200,
    jpegQuality: 80,
    enableGrayscale: false,
    enableAdaptiveThreshold: false,
    adaptiveBlockSize: 31,
    adaptiveC: 8,
    contrast: 0,
    brightness: 0,
    enableReferenceImage: false
  }
];

export interface ZoneDefinition {
  id: string;
  name: string;
  prompt: string;
  schema: string; // JSON string
  images?: ZoneImageConfig[];
  modelId?: string; // Optional override for specific zone
}

export interface ScanConfig {
  machineId: string;
  prompt: string;
  schema: string; // JSON string
  processingProfileId?: string; // Add processingProfileId
}

export interface Machine {
  id: string;
  name: string;
  zones: ZoneDefinition[];
}

export interface ProcessingState {
  isAnalyzing: boolean;
  error: string | null;
  imageUrl: string | null; // Keep for backward compatibility or single image
  imageUrls?: Record<string, string>; // Map of image config ID to base64 URL (Display)
  processedImageUrls?: Record<string, string>; // Map of image config ID to base64 URL (Processed for AI)
}

export interface StandardDataMap {
  [key: string]: number | undefined;
}

export interface ProductPreset {
  id: string;
  productName: string;
  structure: string;
  data: StandardDataMap;
  tolerances?: StandardDataMap;
  machineId?: string; // Link preset to a specific machine
}

export interface ApiKeyConfig {
  id: string;
  name: string;
  key: string;
}

export interface ModelConfig {
  id: string;
  name: string;
}

export interface LogEntry {
  timestamp: string;
  product?: string;        // Manual Input
  structure?: string;      // Manual Input
  productStd?: string;     // From Standard
  structureStd?: string;   // From Standard
  productName?: string;    // Legacy fallback
  productionOrder?: string;
  uploadedBy?: string;
  machineId: string;
  [key: string]: any;
}

export interface User {
  username: string;
  email: string;
  role: 'admin' | 'user';
}

export interface UIConfig {
  themeMode: 'dark' | 'light' | 'light_2';
  showProcessedImage?: boolean;
}

export const DEFAULT_UI_CONFIG: UIConfig = {
  themeMode: 'dark',
  showProcessedImage: false,
};

export const FIELD_LABELS: Record<string, string> = {
  unwind2: "Unwind 2 (Kg)",
  rewind: "Rewind (Kg)",
  unwind1: "Unwind 1 (Kg)",
  infeed: "Infeed (Kg)",
  oven: "Oven (Kg)",
  speed: "Speed (M/Min)",
  dryer1: "Buồng sấy 1 (°C)",
  dryer2: "Buồng sấy 2 (°C)",
  dryer3: "Buồng sấy 3 (°C)",
  chillerTemp: "Máy lạnh (°C)",
  axisTemp: "Trục ghép (°C)"
};

export const getDefaultTolerance = (fieldKey: string): number => {
  if (fieldKey === 'speed') return 5;
  if (['unwind2', 'rewind', 'unwind1', 'infeed', 'oven'].includes(fieldKey)) return 2;
  if (['dryer1', 'dryer2', 'dryer3', 'chillerTemp', 'axisTemp'].includes(fieldKey)) return 5;
  return 2;
};
