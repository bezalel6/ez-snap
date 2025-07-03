/**
 * QR Tracker Configuration
 * 
 * The rotation of the tracked surface is not predictable, and thus it would be silly 
 * to try to assign directions to specific trackers. Trackers are labeled according 
 * to this arbitrary format in a cartesian grid:
 *              
 *    ┌─────────────┬─────────────┐
 *    │             │             │
 *    │    QR_01    │    QR_02    │
 *    │             │             │
 *    │             │             │
 *    ├─────────────┼─────────────┤
 *    │             │             │
 *    │    QR_04    │    QR_03    │
 *    │             │             │
 *    │             │             │
 *    └─────────────┴─────────────┘
 * 
 * IMPORTANT: These trackers have NO inherent directional meaning!
 * The grid can be rotated arbitrarily. Only the relative positions matter.
 * QR_01, QR_02, QR_03, QR_04 maintain their grid pattern regardless of orientation.
 */

export enum TrackerID {
    QR_01 = "QR_01",
    QR_02 = "QR_02",
    QR_03 = "QR_03",
    QR_04 = "QR_04",
}

export interface QRCodeLocation {
    topLeftCorner: { x: number; y: number };
    topRightCorner: { x: number; y: number };
    bottomLeftCorner: { x: number; y: number };
    bottomRightCorner: { x: number; y: number };
}

export interface DetectedTracker {
    id: TrackerID;
    location: QRCodeLocation;
    center: { x: number; y: number };
    dims: {
        width: number;
        height: number;
    };
    lastSeen: number;
}

export interface AlignmentStatus {
    isAligned: boolean;
    translation: { x: number; y: number };
    rotation: number;
    scale: number;
    missingTrackers: TrackerID[];
    staleTrackers: TrackerID[];
    detectedCount: number;
}

// Cone Detection Types
export interface DetectedCone {
    id: string; // Unique identifier for tracking
    center: { x: number; y: number }; // Position in camera coordinates
    surfacePosition: { x: number; y: number } | null; // Position on tracked surface (mm)
    radius: number; // Detected radius in pixels
    confidence: number; // Detection confidence (0-1)
    lastSeen: number; // Timestamp
}

export interface ConeDetectionResult {
    cones: DetectedCone[];
    surfaceCoordinatesAvailable: boolean;
    detectionTimestamp: number;
}

export interface ConeSpecs {
    height: number; // Height in mm
    estimatedRadius: number; // Estimated base radius in mm (calculated from geometry)
    detectionThreshold: number; // Minimum confidence for valid detection
}

export interface CoordinateTransform {
    isValid: boolean;
    homographyMatrix: number[][] | null; // 3x3 transformation matrix
    surfaceDimensions: { width: number; height: number }; // in mm
}

export const TRACKER_CONFIG = {
    trackers: Object.values(TrackerID) as TrackerID[],
    size: 120,
    staleThreshold: 2000, // 2 seconds
    cleanupThreshold: 3000, // 3 seconds
} as const;

// Cone detection configuration
export const CONE_CONFIG = {
    height: 46.41, // mm - exact height provided by user
    estimatedRadius: 8, // mm - estimated base radius (can be calibrated)
    detectionThreshold: 0.6, // Minimum confidence for detection
    staleThreshold: 1000, // 1 second for cone tracking
    cleanupThreshold: 2000, // 2 seconds cleanup
    maxDetectionDistance: 50, // Max distance in pixels for cone tracking
    minRadius: 5, // Minimum radius in pixels
    maxRadius: 50, // Maximum radius in pixels
} as const;

// Standard A4 dimensions at 72 DPI
export const A4_DIMENSIONS = {
    PORTRAIT: { width: 595, height: 842 },
    LANDSCAPE: { width: 842, height: 595 },
} as const;

// Physical A4 dimensions in mm
export const A4_PHYSICAL_MM = {
    PORTRAIT: { width: 210, height: 297 },
    LANDSCAPE: { width: 297, height: 210 },
} as const;

// Grid utilities for working with tracker positions
export const GridUtils = {
    /**
     * Calculate center point from QR code location corners
     */
    calculateCenter(location: QRCodeLocation): { x: number; y: number } {
        const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } = location;
        return {
            x: (topLeftCorner.x + topRightCorner.x + bottomLeftCorner.x + bottomRightCorner.x) / 4,
            y: (topLeftCorner.y + topRightCorner.y + bottomLeftCorner.y + bottomRightCorner.y) / 4,
        };
    },

    /**
     * Calculate dimensions from QR code location corners
     */
    calculateDimensions(location: QRCodeLocation): { width: number; height: number } {
        const { topLeftCorner, topRightCorner, bottomLeftCorner } = location;
        const width = Math.sqrt(
            Math.pow(topRightCorner.x - topLeftCorner.x, 2) +
            Math.pow(topRightCorner.y - topLeftCorner.y, 2)
        );
        const height = Math.sqrt(
            Math.pow(bottomLeftCorner.x - topLeftCorner.x, 2) +
            Math.pow(bottomLeftCorner.y - topLeftCorner.y, 2)
        );
        return { width, height };
    },

    /**
     * Identify tracker from QR code data
     */
    identifyTracker(data: string): TrackerID | null {
        return Object.values(TrackerID).includes(data as TrackerID) ? (data as TrackerID) : null;
    },

    /**
     * Get all tracker IDs as array
     */
    getAllTrackers(): TrackerID[] {
        return Object.values(TrackerID);
    },

    /**
     * Check if we have minimum trackers for alignment calculation
     */
    hasMinimumTrackers(trackers: DetectedTracker[]): boolean {
        return trackers.length >= 3;
    },

    /**
     * Filter stale trackers based on time threshold
     */
    filterStaleTrackers(trackers: DetectedTracker[], currentTime: number = Date.now()): {
        fresh: DetectedTracker[];
        stale: DetectedTracker[];
    } {
        const fresh: DetectedTracker[] = [];
        const stale: DetectedTracker[] = [];

        trackers.forEach(tracker => {
            if (currentTime - tracker.lastSeen > TRACKER_CONFIG.staleThreshold) {
                stale.push(tracker);
            } else {
                fresh.push(tracker);
            }
        });

        return { fresh, stale };
    },

    /**
     * Create a detected tracker from QR code detection
     */
    createDetectedTracker(id: TrackerID, location: QRCodeLocation): DetectedTracker {
        return {
            id,
            location,
            center: this.calculateCenter(location),
            dims: this.calculateDimensions(location),
            lastSeen: Date.now(),
        };
    },
};

// Cone detection utilities
export const ConeUtils = {
    /**
     * Calculate coordinate transformation matrix from QR trackers to surface coordinates
     */
    calculateCoordinateTransform(trackers: DetectedTracker[]): CoordinateTransform {
        if (trackers.length < 4) {
            return {
                isValid: false,
                homographyMatrix: null,
                surfaceDimensions: A4_PHYSICAL_MM.PORTRAIT,
            };
        }

        // Find the four corner trackers
        const trackerMap = new Map(trackers.map(t => [t.id, t]));
        const qr01 = trackerMap.get(TrackerID.QR_01);
        const qr02 = trackerMap.get(TrackerID.QR_02);
        const qr03 = trackerMap.get(TrackerID.QR_03);
        const qr04 = trackerMap.get(TrackerID.QR_04);

        if (!qr01 || !qr02 || !qr03 || !qr04) {
            return {
                isValid: false,
                homographyMatrix: null,
                surfaceDimensions: A4_PHYSICAL_MM.PORTRAIT,
            };
        }

        // Create transformation matrix (simplified homography)
        // This would need a proper homography calculation for production
        const srcPoints = [
            qr01.center, // Top-left
            qr02.center, // Top-right  
            qr03.center, // Bottom-right
            qr04.center, // Bottom-left
        ];

        const dstPoints = [
            { x: 0, y: 0 },
            { x: A4_PHYSICAL_MM.PORTRAIT.width, y: 0 },
            { x: A4_PHYSICAL_MM.PORTRAIT.width, y: A4_PHYSICAL_MM.PORTRAIT.height },
            { x: 0, y: A4_PHYSICAL_MM.PORTRAIT.height },
        ];

        // Simplified transformation - in production, use proper homography
        return {
            isValid: true,
            homographyMatrix: this.calculateSimpleHomography(srcPoints, dstPoints),
            surfaceDimensions: A4_PHYSICAL_MM.PORTRAIT,
        };
    },

    /**
     * Simplified homography calculation (placeholder for proper implementation)
     */
    calculateSimpleHomography(src: { x: number; y: number }[], dst: { x: number; y: number }[]): number[][] {
        // This is a simplified transformation - in production, implement proper homography
        return [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
        ];
    },

    /**
     * Transform camera coordinates to surface coordinates
     * Note: This now uses the HomographyTransform utility for proper coordinate transformation
     */
    transformToSurface(
        cameraPoint: { x: number; y: number },
        transform: CoordinateTransform
    ): { x: number; y: number } | null {
        if (!transform.isValid || !transform.homographyMatrix) {
            return null;
        }

        // Use the CoordinateTransformUtils for proper transformation
        // This will be imported from homography.ts when used
        const H = transform.homographyMatrix;
        const { x, y } = cameraPoint;

        const h11 = H[0]?.[0] ?? 0, h12 = H[0]?.[1] ?? 0, h13 = H[0]?.[2] ?? 0;
        const h21 = H[1]?.[0] ?? 0, h22 = H[1]?.[1] ?? 0, h23 = H[1]?.[2] ?? 0;
        const h31 = H[2]?.[0] ?? 0, h32 = H[2]?.[1] ?? 0, h33 = H[2]?.[2] ?? 0;

        const u = h11 * x + h12 * y + h13;
        const v = h21 * x + h22 * y + h23;
        const w = h31 * x + h32 * y + h33;

        if (Math.abs(w) < 1e-8) {
            return null;
        }

        return {
            x: u / w,
            y: v / w,
        };
    },

    /**
     * Filter stale cones based on time threshold
     */
    filterStaleCones(cones: DetectedCone[], currentTime: number = Date.now()): {
        fresh: DetectedCone[];
        stale: DetectedCone[];
    } {
        const fresh: DetectedCone[] = [];
        const stale: DetectedCone[] = [];

        cones.forEach(cone => {
            if (currentTime - cone.lastSeen > CONE_CONFIG.staleThreshold) {
                stale.push(cone);
            } else {
                fresh.push(cone);
            }
        });

        return { fresh, stale };
    },

    /**
     * Generate unique ID for cone tracking
     */
    generateConeId(): string {
        return `cone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Match detected cone to existing tracked cone
     */
    matchCone(newCone: Omit<DetectedCone, 'id' | 'lastSeen'>, existingCones: DetectedCone[]): DetectedCone | null {
        const maxDistance = CONE_CONFIG.maxDetectionDistance;

        for (const existing of existingCones) {
            const distance = Math.sqrt(
                Math.pow(newCone.center.x - existing.center.x, 2) +
                Math.pow(newCone.center.y - existing.center.y, 2)
            );

            if (distance < maxDistance) {
                return existing;
            }
        }

        return null;
    },

    /**
     * Create a new detected cone
     */
    createDetectedCone(
        center: { x: number; y: number },
        radius: number,
        confidence: number,
        transform?: CoordinateTransform
    ): DetectedCone {
        const surfacePosition = transform ? this.transformToSurface(center, transform) : null;

        return {
            id: this.generateConeId(),
            center,
            surfacePosition,
            radius,
            confidence,
            lastSeen: Date.now(),
        };
    },
};

// Export the default configuration
export default TRACKER_CONFIG;
