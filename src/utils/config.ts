/**
 * AprilTag Tracker Configuration
 * 
 * The rotation of the tracked surface is not predictable, and thus it would be silly 
 * to try to assign directions to specific trackers. Trackers are labeled according 
 * to this arbitrary format in a cartesian grid:
 *              
 *    ┌─────────────┬─────────────┐
 *    │             │             │
 *    │   TAG_01    │   TAG_02    │
 *    │             │             │
 *    │             │             │
 *    ├─────────────┼─────────────┤
 *    │             │             │
 *    │   TAG_04    │   TAG_03    │
 *    │             │             │
 *    │             │             │
 *    └─────────────┴─────────────┘
 * 
 * IMPORTANT: These trackers have NO inherent directional meaning!
 * The grid can be rotated arbitrarily. Only the relative positions matter.
 * TAG_01, TAG_02, TAG_03, TAG_04 maintain their grid pattern regardless of orientation.
 */

export enum TrackerID {
    TAG_01 = "1",   // AprilTag ID 1
    TAG_02 = "2",   // AprilTag ID 2
    TAG_03 = "3",   // AprilTag ID 3
    TAG_04 = "4",   // AprilTag ID 4
}

export interface AprilTagCorners {
    x: number;
    y: number;
}

export interface AprilTagDetection {
    id: number;
    size: number;
    corners: AprilTagCorners[];
    center: { x: number; y: number };
    pose?: {
        R: number[][];
        t: number[];
        e: number;
    };
}

export interface DetectedTracker {
    id: TrackerID;
    detection: AprilTagDetection;
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
    tagSize: 0.05, // 5cm physical size of tags
    staleThreshold: 2000, // 2 seconds
    cleanupThreshold: 3000, // 3 seconds
    family: "tag36h11", // AprilTag family
} as const;

// Standard A4 dimensions at 72 DPI
export const A4_DIMENSIONS = {
    PORTRAIT: { width: 595, height: 842 },
    LANDSCAPE: { width: 842, height: 595 },
} as const;

// Grid utilities for working with tracker positions
export const GridUtils = {
    /**
     * Calculate center point from AprilTag detection corners
     */
    calculateCenter(corners: AprilTagCorners[]): { x: number; y: number } {
        const sumX = corners.reduce((sum, corner) => sum + corner.x, 0);
        const sumY = corners.reduce((sum, corner) => sum + corner.y, 0);
        return {
            x: sumX / corners.length,
            y: sumY / corners.length,
        };
    },

    /**
     * Calculate dimensions from AprilTag detection corners
     */
    calculateDimensions(corners: AprilTagCorners[]): { width: number; height: number } {
        if (corners.length < 4) return { width: 0, height: 0 };
        
        // Calculate width as distance between first two corners
        const width = Math.sqrt(
            Math.pow(corners[1]!.x - corners[0]!.x, 2) +
            Math.pow(corners[1]!.y - corners[0]!.y, 2)
        );
        
        // Calculate height as distance between first and last corners
        const height = Math.sqrt(
            Math.pow(corners[3]!.x - corners[0]!.x, 2) +
            Math.pow(corners[3]!.y - corners[0]!.y, 2)
        );
        
        return { width, height };
    },

    /**
     * Identify tracker from AprilTag ID
     */
    identifyTracker(tagId: number): TrackerID | null {
        const idStr = tagId.toString();
        return Object.values(TrackerID).includes(idStr as TrackerID) ? (idStr as TrackerID) : null;
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
     * Create a detected tracker from AprilTag detection
     */
    createDetectedTracker(id: TrackerID, detection: AprilTagDetection): DetectedTracker {
        const center = this.calculateCenter(detection.corners);
        const dims = this.calculateDimensions(detection.corners);
        
        return {
            id,
            detection,
            center,
            dims,
            lastSeen: Date.now(),
        };
    },
};

// Export the default configuration
export default TRACKER_CONFIG;
