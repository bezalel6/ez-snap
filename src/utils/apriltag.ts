/**
 * AprilTag Detection and Generation Utilities
 * 
 * This module provides utilities for:
 * - AprilTag detection using apriltag-js-standalone
 * - AprilTag image generation
 * - Camera parameter handling
 */

import { TrackerID, TRACKER_CONFIG, type AprilTagDetection } from "./config";

// Type definition for the AprilTag WASM module
declare global {
  interface Window {
    Apriltag: new (callback: () => void) => AprilTagDetector;
  }
}

interface AprilTagDetector {
  detect(grayscalePixels: Uint8Array, width: number, height: number): Promise<AprilTagDetection[]>;
  set_tag_size(tagId: number, size: number): void;
  set_camera_info(fx: number, fy: number, cx: number, cy: number): void;
  set_max_detections(maxDetections: number): void;
  set_return_pose(returnPose: number): void;
  set_return_solutions(returnSolutions: number): void;
}

// Default camera parameters (can be calibrated for better accuracy)
const DEFAULT_CAMERA_PARAMS = {
  fx: 800, // Focal length X
  fy: 800, // Focal length Y
  cx: 320, // Principal point X
  cy: 240, // Principal point Y
};

export class AprilTagDetectionManager {
  private detector: AprilTagDetector | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('AprilTag detection is only available in browser environment'));
        return;
      }

      // Load the WASM module
      const script = document.createElement('script');
      script.src = '/apriltag_wasm.js';
      script.onload = () => {
        if (!window.Apriltag) {
          reject(new Error('AprilTag WASM module failed to load'));
          return;
        }

        // Initialize the detector
        this.detector = new window.Apriltag(() => {
          console.log('AprilTag detector ready');
          this.setupDetector();
          this.isInitialized = true;
          resolve();
        });
      };
      script.onerror = () => {
        reject(new Error('Failed to load AprilTag WASM script'));
      };
      document.head.appendChild(script);
    });
  }

  private setupDetector(): void {
    if (!this.detector) return;

    // Configure camera parameters
    this.detector.set_camera_info(
      DEFAULT_CAMERA_PARAMS.fx,
      DEFAULT_CAMERA_PARAMS.fy,
      DEFAULT_CAMERA_PARAMS.cx,
      DEFAULT_CAMERA_PARAMS.cy
    );

    // Set tag sizes for each tracker
    Object.values(TrackerID).forEach(trackerId => {
      const tagId = parseInt(trackerId, 10);
      this.detector!.set_tag_size(tagId, TRACKER_CONFIG.tagSize);
    });

    // Configure detection parameters
    this.detector.set_max_detections(0); // Return all detections
    this.detector.set_return_pose(1); // Return pose estimates
    this.detector.set_return_solutions(0); // Don't return alternative solutions
  }

  async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  async detect(canvas: HTMLCanvasElement): Promise<AprilTagDetection[]> {
    await this.ensureInitialized();
    
    if (!this.detector) {
      throw new Error('AprilTag detector not initialized');
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Convert to grayscale
    const grayscalePixels = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
      const grayscale = Math.round((pixels[i]! + pixels[i + 1]! + pixels[i + 2]!) / 3);
      grayscalePixels[j] = grayscale;
    }

    // Detect AprilTags
    return await this.detector.detect(grayscalePixels, canvas.width, canvas.height);
  }

  async detectFromVideo(video: HTMLVideoElement): Promise<AprilTagDetection[]> {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot create canvas context');
    }

    ctx.drawImage(video, 0, 0);
    return await this.detect(canvas);
  }

  setCameraParameters(fx: number, fy: number, cx: number, cy: number): void {
    if (this.detector) {
      this.detector.set_camera_info(fx, fy, cx, cy);
    }
  }
}

// Global instance
let aprilTagManager: AprilTagDetectionManager | null = null;

export function getAprilTagManager(): AprilTagDetectionManager {
  if (!aprilTagManager) {
    aprilTagManager = new AprilTagDetectionManager();
  }
  return aprilTagManager;
}

/**
 * Generate AprilTag images using a simple black and white pattern
 * This is a placeholder implementation - in production you'd want to use
 * the official AprilTag generation algorithm or pre-generated images
 */
export function generateAprilTagSVG(tagId: number, size: number = 120): string {
  // This is a simplified representation - real AprilTags have specific patterns
  // In production, you should use pre-generated AprilTag images from:
  // https://github.com/arenaxr/apriltag-gen or similar
  
  const borderWidth = size * 0.1;
  const innerSize = size - (borderWidth * 2);
  const cellSize = innerSize / 6; // 6x6 grid for simplified representation
  
  let svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`;
  
  // White background
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;
  
  // Black border
  svg += `<rect width="${size}" height="${borderWidth}" fill="black"/>`;
  svg += `<rect width="${size}" height="${borderWidth}" y="${size - borderWidth}" fill="black"/>`;
  svg += `<rect width="${borderWidth}" height="${size}" fill="black"/>`;
  svg += `<rect width="${borderWidth}" height="${size}" x="${size - borderWidth}" fill="black"/>`;
  
  // Simple pattern based on tag ID (this is not a real AprilTag pattern)
  const pattern = getSimplePattern(tagId);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      if (pattern[i * 6 + j]) {
        const x = borderWidth + j * cellSize;
        const y = borderWidth + i * cellSize;
        svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
      }
    }
  }
  
  // Tag ID text (for reference)
  svg += `<text x="${size/2}" y="${size + 20}" text-anchor="middle" font-family="Arial" font-size="14" fill="black">Tag ${tagId}</text>`;
  
  svg += '</svg>';
  return svg;
}

function getSimplePattern(tagId: number): boolean[] {
  // Simple deterministic pattern based on tag ID
  // This is NOT a real AprilTag pattern - just for visualization
  const patterns: { [key: number]: boolean[] } = {
    1: [
      false, false, false, false, false, false,
      false, true, false, false, true, false,
      false, false, true, true, false, false,
      false, false, true, true, false, false,
      false, true, false, false, true, false,
      false, false, false, false, false, false,
    ],
    2: [
      false, false, false, false, false, false,
      false, true, true, true, true, false,
      false, true, false, false, true, false,
      false, true, false, false, true, false,
      false, true, true, true, true, false,
      false, false, false, false, false, false,
    ],
    3: [
      false, false, false, false, false, false,
      false, true, true, true, false, false,
      false, false, false, true, false, false,
      false, false, true, true, false, false,
      false, true, true, true, true, false,
      false, false, false, false, false, false,
    ],
    4: [
      false, false, false, false, false, false,
      false, true, false, true, false, false,
      false, true, false, true, false, false,
      false, true, true, true, false, false,
      false, false, false, true, false, false,
      false, false, false, false, false, false,
    ],
  };
  
  return patterns[tagId] || patterns[1]!;
}

/**
 * Convert SVG to PNG data URL for downloading
 */
export function svgToPngDataUrl(svgString: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Cannot create canvas context'));
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load SVG'));
    img.src = 'data:image/svg+xml;base64,' + btoa(svgString);
  });
}