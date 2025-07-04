declare global {
  interface Window {
    AR: typeof AR;
    CV: typeof CV;
    POS: typeof POS;
  }
}

export interface ArUcoMarker {
  id: number;
  corners: Array<{
    x: number;
    y: number;
  }>;
}

export interface ArUcoDetector {
  detect(imageData: ImageData): ArUcoMarker[];
  detect(width: number, height: number, data: Uint8ClampedArray): ArUcoMarker[];
}

export interface ArUcoDetectorOptions {
  dictionaryName?: 'ARUCO' | 'ARUCO_MIP_36h12';
  maxHammingDistance?: number;
}

export interface PoseResult {
  bestError: number;
  bestRotation: number[][];
  bestTranslation: number[];
  alternativeError: number;
  alternativeRotation: number[][];
  alternativeTranslation: number[];
}

export interface PositEstimator {
  pose(corners: Array<{ x: number; y: number }>): PoseResult;
}

declare namespace AR {
  class Detector {
    constructor(options?: ArUcoDetectorOptions);
    detect(imageData: ImageData): ArUcoMarker[];
    detect(width: number, height: number, data: Uint8ClampedArray): ArUcoMarker[];
  }

  interface Marker {
    id: number;
    corners: Array<{ x: number; y: number }>;
  }

  const DICTIONARIES: {
    [key: string]: {
      nBits: number;
      tau: number;
      codeList: string[];
    };
  };
}

declare namespace CV {
  function blur(
    imageSrc: ImageData,
    imageDst: ImageData,
    ksize: number
  ): void;

  function threshold(
    imageSrc: ImageData,
    imageDst: ImageData,
    threshold: number,
    maxValue: number
  ): void;

  function findContours(
    image: ImageData,
    mode: number,
    method: number
  ): any[];
}

declare namespace POS {
  class Posit {
    constructor(modelSize: number, focalLength: number);
    pose(corners: Array<{ x: number; y: number }>): PoseResult;
  }
}

export interface ArUcoDebugSettings {
  showMarkerIds: boolean;
  showMarkerCorners: boolean;
  showMarkerAxes: boolean;
  showThreshold: boolean;
  showContours: boolean;
  thresholdValue: number;
  enablePoseEstimation: boolean;
  markerSize: number;
}

export interface DetectedArUcoMarker extends ArUcoMarker {
  center: { x: number; y: number };
  lastDetected: number;
  pose?: PoseResult;
  confidence: number;
}

export {};