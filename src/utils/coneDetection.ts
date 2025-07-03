import type { DetectedCone, CoordinateTransform } from './config';
import { CONE_CONFIG, ConeUtils } from './config';

/**
 * Cone Detection Utilities
 * 
 * This module provides computer vision algorithms to detect cone-shaped objects
 * in camera feed. Uses circle detection (Hough circles) as cones appear as
 * circles when viewed from above.
 */

export interface ConeDetectionParams {
    minRadius: number;
    maxRadius: number;
    confidenceThreshold: number;
    blurKernel: number;
    cannyLower: number;
    cannyUpper: number;
}

export const DEFAULT_DETECTION_PARAMS: ConeDetectionParams = {
    minRadius: CONE_CONFIG.minRadius,
    maxRadius: CONE_CONFIG.maxRadius,
    confidenceThreshold: CONE_CONFIG.detectionThreshold,
    blurKernel: 9,
    cannyLower: 50,
    cannyUpper: 150,
};

export class ConeDetector {
    private params: ConeDetectionParams;
    private trackedCones: DetectedCone[] = [];

    constructor(params: ConeDetectionParams = DEFAULT_DETECTION_PARAMS) {
        this.params = params;
    }

    /**
     * Detect cones in the provided image data
     */
    detectCones(
        imageData: ImageData,
        coordinateTransform?: CoordinateTransform
    ): DetectedCone[] {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return [];

        canvas.width = imageData.width;
        canvas.height = imageData.height;
        ctx.putImageData(imageData, 0, 0);

        // Convert to grayscale for processing
        const grayImageData = this.convertToGrayscale(imageData);

        // Apply Gaussian blur to reduce noise
        const blurredData = this.applyGaussianBlur(grayImageData, this.params.blurKernel);

        // Detect circles using simplified Hough circle detection
        const circles = this.detectCircles(blurredData);

        // Convert circles to cone detections
        const newDetections = circles.map(circle => ({
            center: { x: circle.x, y: circle.y },
            radius: circle.radius,
            confidence: circle.confidence,
        }));

        // Track and update existing cones
        return this.updateTrackedCones(newDetections, coordinateTransform);
    }

    /**
     * Convert image data to grayscale
     */
    private convertToGrayscale(imageData: ImageData): ImageData {
        const data = new Uint8ClampedArray(imageData.data);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i] ?? 0;
            const g = data[i + 1] ?? 0;
            const b = data[i + 2] ?? 0;
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            data[i] = gray;     // R
            data[i + 1] = gray; // G
            data[i + 2] = gray; // B
            // Alpha channel stays the same
        }

        return new ImageData(data, imageData.width, imageData.height);
    }

    /**
     * Apply Gaussian blur to reduce noise
     */
    private applyGaussianBlur(imageData: ImageData, kernelSize: number): ImageData {
        // Simplified blur implementation
        const data = new Uint8ClampedArray(imageData.data);
        const width = imageData.width;
        const height = imageData.height;
        const output = new Uint8ClampedArray(data.length);

        const kernel = this.generateGaussianKernel(kernelSize);
        const radius = Math.floor(kernelSize / 2);

        for (let y = radius; y < height - radius; y++) {
            for (let x = radius; x < width - radius; x++) {
                let r = 0, g = 0, b = 0, a = 0;

                for (let ky = -radius; ky <= radius; ky++) {
                    for (let kx = -radius; kx <= radius; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4;
                        const kernelRow = kernel[ky + radius];
                        const weight = kernelRow?.[kx + radius] ?? 0;

                        r += (data[idx] ?? 0) * weight;
                        g += (data[idx + 1] ?? 0) * weight;
                        b += (data[idx + 2] ?? 0) * weight;
                        a += (data[idx + 3] ?? 0) * weight;
                    }
                }

                const outputIdx = (y * width + x) * 4;
                output[outputIdx] = Math.round(r);
                output[outputIdx + 1] = Math.round(g);
                output[outputIdx + 2] = Math.round(b);
                output[outputIdx + 3] = Math.round(a);
            }
        }

        return new ImageData(output, width, height);
    }

    /**
     * Generate Gaussian kernel for blur
     */
    private generateGaussianKernel(size: number): number[][] {
        const kernel: number[][] = [];
        const sigma = size / 3;
        const twoSigmaSquare = 2 * sigma * sigma;
        const radius = Math.floor(size / 2);
        let sum = 0;

        for (let y = -radius; y <= radius; y++) {
            kernel[y + radius] = [];
            for (let x = -radius; x <= radius; x++) {
                const value = Math.exp(-(x * x + y * y) / twoSigmaSquare);
                kernel[y + radius][x + radius] = value;
                sum += value;
            }
        }

        // Normalize kernel
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                kernel[y][x] /= sum;
            }
        }

        return kernel;
    }

    /**
     * Simplified circle detection using edge detection and geometric analysis
     */
    private detectCircles(imageData: ImageData): Array<{
        x: number;
        y: number;
        radius: number;
        confidence: number;
    }> {
        const circles: Array<{
            x: number;
            y: number;
            radius: number;
            confidence: number;
        }> = [];

        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        // Apply edge detection (simplified Canny)
        const edges = this.applyCannyEdgeDetection(imageData);

        // Look for circular patterns in the edges
        const stepSize = 5; // Skip pixels for performance

        for (let y = this.params.maxRadius; y < height - this.params.maxRadius; y += stepSize) {
            for (let x = this.params.maxRadius; x < width - this.params.maxRadius; x += stepSize) {

                for (let r = this.params.minRadius; r <= this.params.maxRadius; r += 2) {
                    const confidence = this.calculateCircleConfidence(edges, x, y, r);

                    if (confidence > this.params.confidenceThreshold) {
                        // Check if this circle overlaps with existing ones
                        const isOverlapping = circles.some(existing => {
                            const distance = Math.sqrt(
                                Math.pow(x - existing.x, 2) + Math.pow(y - existing.y, 2)
                            );
                            return distance < (r + existing.radius) * 0.7;
                        });

                        if (!isOverlapping) {
                            circles.push({ x, y, radius: r, confidence });
                        }
                    }
                }
            }
        }

        // Sort by confidence and return top detections
        return circles
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 10); // Limit to top 10 detections
    }

    /**
     * Simplified Canny edge detection
     */
    private applyCannyEdgeDetection(imageData: ImageData): Uint8ClampedArray {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const edges = new Uint8ClampedArray(width * height);

        // Sobel operators for gradient calculation
        const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
        const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gx = 0, gy = 0;

                // Apply Sobel operators
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4;
                        const intensity = data[idx]; // Use red channel of grayscale

                        gx += intensity * sobelX[ky + 1][kx + 1];
                        gy += intensity * sobelY[ky + 1][kx + 1];
                    }
                }

                const gradient = Math.sqrt(gx * gx + gy * gy);
                edges[y * width + x] = gradient > this.params.cannyLower ? 255 : 0;
            }
        }

        return edges;
    }

    /**
     * Calculate confidence that a circle exists at given position
     */
    private calculateCircleConfidence(
        edges: Uint8ClampedArray,
        centerX: number,
        centerY: number,
        radius: number
    ): number {
        const width = Math.sqrt(edges.length);
        const circumference = 2 * Math.PI * radius;
        const stepAngle = (2 * Math.PI) / Math.max(8, circumference / 2); // Sample points around circle

        let edgeCount = 0;
        let totalSamples = 0;

        for (let angle = 0; angle < 2 * Math.PI; angle += stepAngle) {
            const x = Math.round(centerX + radius * Math.cos(angle));
            const y = Math.round(centerY + radius * Math.sin(angle));

            if (x >= 0 && x < width && y >= 0 && y < width) {
                totalSamples++;
                if (edges[y * width + x] > 0) {
                    edgeCount++;
                }
            }
        }

        return totalSamples > 0 ? edgeCount / totalSamples : 0;
    }

    /**
     * Update tracked cones with new detections
     */
    private updateTrackedCones(
        newDetections: Array<{
            center: { x: number; y: number };
            radius: number;
            confidence: number;
        }>,
        coordinateTransform?: CoordinateTransform
    ): DetectedCone[] {
        const currentTime = Date.now();

        // Clean up stale cones
        const { fresh: freshCones } = ConeUtils.filterStaleCones(this.trackedCones, currentTime);
        this.trackedCones = freshCones;

        // Process new detections
        for (const detection of newDetections) {
            const existingCone = ConeUtils.matchCone(detection, this.trackedCones);

            if (existingCone) {
                // Update existing cone
                existingCone.center = detection.center;
                existingCone.radius = detection.radius;
                existingCone.confidence = detection.confidence;
                existingCone.lastSeen = currentTime;
                existingCone.surfacePosition = coordinateTransform
                    ? ConeUtils.transformToSurface(detection.center, coordinateTransform)
                    : null;
            } else {
                // Create new cone
                const newCone = ConeUtils.createDetectedCone(
                    detection.center,
                    detection.radius,
                    detection.confidence,
                    coordinateTransform
                );
                this.trackedCones.push(newCone);
            }
        }

        return [...this.trackedCones];
    }

    /**
     * Get current tracked cones
     */
    getTrackedCones(): DetectedCone[] {
        return [...this.trackedCones];
    }

    /**
     * Clear all tracked cones
     */
    clearTrackedCones(): void {
        this.trackedCones = [];
    }

    /**
     * Update detection parameters
     */
    updateParams(params: Partial<ConeDetectionParams>): void {
        this.params = { ...this.params, ...params };
    }
} 
