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

export const TRACKER_CONFIG = {
    trackers: Object.values(TrackerID) as TrackerID[],
    size: 120,
    staleThreshold: 2000, // 2 seconds
    cleanupThreshold: 3000, // 3 seconds
} as const;

// Standard A4 dimensions at 72 DPI
export const A4_DIMENSIONS = {
    PORTRAIT: { width: 595, height: 842 },
    LANDSCAPE: { width: 842, height: 595 },
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

// Export the default configuration
export default TRACKER_CONFIG;
