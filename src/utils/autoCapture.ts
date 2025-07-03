import type { AlignmentStatus, DetectedTracker } from './config';

/**
 * Auto-Capture System
 * 
 * Automatically captures images when QR tracker alignment is optimal,
 * guides user through different positions, and manages the scanning workflow
 * for a fluid, human-oriented experience.
 */

export interface CapturePosition {
    id: string;
    name: string;
    description: string;
    priority: number;
    captured: boolean;
    timestamp?: number;
    imageData?: string;
    trackers?: DetectedTracker[];
    alignmentStatus?: AlignmentStatus;
}

export interface ScanSession {
    id: string;
    startTime: number;
    positions: CapturePosition[];
    totalCapturesNeeded: number;
    capturesCompleted: number;
    isComplete: boolean;
    userInstructions: string;
    confidenceScore: number;
    lastCaptureTime?: number;
}

export interface AutoCaptureConfig {
    minAlignmentQuality: number; // 0-1, minimum alignment score to trigger capture
    timeBetweenCaptures: number; // Minimum ms between auto-captures
    movementThreshold: number; // Minimum movement to consider new position
    qualityThreshold: number; // Minimum image quality score
}

export const DEFAULT_AUTO_CAPTURE_CONFIG: AutoCaptureConfig = {
    minAlignmentQuality: 0.8,
    timeBetweenCaptures: 2000, // 2 seconds
    movementThreshold: 50, // pixels
    qualityThreshold: 0.7,
};

// Predefined optimal capture positions
export const OPTIMAL_POSITIONS: Omit<CapturePosition, 'captured' | 'timestamp' | 'imageData' | 'trackers' | 'alignmentStatus'>[] = [
    {
        id: 'center_top',
        name: 'Center Overview',
        description: 'Hold camera directly above center of surface',
        priority: 1,
    },
    {
        id: 'angle_ne',
        name: 'Northeast Angle',
        description: 'Move to upper-right, slight angle for depth',
        priority: 2,
    },
    {
        id: 'angle_nw',
        name: 'Northwest Angle',
        description: 'Move to upper-left, slight angle for depth',
        priority: 2,
    },
    {
        id: 'angle_se',
        name: 'Southeast Angle',
        description: 'Move to lower-right, slight angle for depth',
        priority: 3,
    },
    {
        id: 'angle_sw',
        name: 'Southwest Angle',
        description: 'Move to lower-left, slight angle for depth',
        priority: 3,
    },
    {
        id: 'center_close',
        name: 'Center Close-up',
        description: 'Move closer to center for detail capture',
        priority: 4,
    },
];

export class AutoCaptureManager {
    private config: AutoCaptureConfig;
    private currentSession: ScanSession | null = null;
    private lastCapturePosition: { x: number; y: number } | null = null;
    private captureCallbacks: ((session: ScanSession) => void)[] = [];

    constructor(config: AutoCaptureConfig = DEFAULT_AUTO_CAPTURE_CONFIG) {
        this.config = config;
    }

    startSession(): ScanSession {
        const positions: CapturePosition[] = OPTIMAL_POSITIONS.map(pos => ({
            ...pos,
            captured: false,
        }));

        this.currentSession = {
            id: `session_${Date.now()}`,
            startTime: Date.now(),
            positions,
            totalCapturesNeeded: positions.length,
            capturesCompleted: 0,
            isComplete: false,
            userInstructions: this.getNextInstruction(positions),
            confidenceScore: 0,
        };

        this.lastCapturePosition = null;
        return this.currentSession;
    }

    /**
     * Process current alignment and potentially trigger auto-capture
     */
    processAlignment(
        alignmentStatus: AlignmentStatus,
        trackers: DetectedTracker[],
        videoElement: HTMLVideoElement
    ): { shouldCapture: boolean; reason: string } {
        if (!this.currentSession || this.currentSession.isComplete) {
            return { shouldCapture: false, reason: 'No active session' };
        }

        // Check if alignment is good enough
        const alignmentQuality = this.calculateAlignmentQuality(alignmentStatus);
        if (alignmentQuality < this.config.minAlignmentQuality) {
            return {
                shouldCapture: false,
                reason: `Alignment quality ${(alignmentQuality * 100).toFixed(0)}% < ${(this.config.minAlignmentQuality * 100).toFixed(0)}% required`
            };
        }

        // Check time since last capture
        const now = Date.now();
        if (this.currentSession.lastCaptureTime &&
            (now - this.currentSession.lastCaptureTime) < this.config.timeBetweenCaptures) {
            const remaining = Math.ceil((this.config.timeBetweenCaptures - (now - this.currentSession.lastCaptureTime)) / 1000);
            return {
                shouldCapture: false,
                reason: `Wait ${remaining}s before next capture`
            };
        }

        // Check if this position is significantly different from previous captures
        const currentPosition = this.estimateCurrentPosition(trackers);
        if (this.lastCapturePosition && currentPosition) {
            const distance = this.calculateDistance(currentPosition, this.lastCapturePosition);
            if (distance < this.config.movementThreshold) {
                return {
                    shouldCapture: false,
                    reason: `Move ${Math.ceil(this.config.movementThreshold - distance)}px for new angle`
                };
            }
        }

        return { shouldCapture: true, reason: 'Perfect conditions for capture!' };
    }

    /**
     * Execute auto-capture
     */
    async executeCapture(
        videoElement: HTMLVideoElement,
        alignmentStatus: AlignmentStatus,
        trackers: DetectedTracker[]
    ): Promise<boolean> {
        if (!this.currentSession) return false;

        try {
            // Capture image from video
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return false;

            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            ctx.drawImage(videoElement, 0, 0);

            const imageData = canvas.toDataURL('image/jpeg', 0.9);

            // Find next uncaptured position
            const targetPosition = this.currentSession.positions.find(pos => !pos.captured);
            if (!targetPosition) return false;

            // Update position with capture data
            targetPosition.captured = true;
            targetPosition.timestamp = Date.now();
            targetPosition.imageData = imageData;
            targetPosition.trackers = [...trackers];
            targetPosition.alignmentStatus = { ...alignmentStatus };

            // Update session
            this.currentSession.capturesCompleted++;
            this.currentSession.lastCaptureTime = Date.now();
            this.currentSession.confidenceScore = this.calculateSessionConfidence();
            this.currentSession.userInstructions = this.getNextInstruction(this.currentSession.positions);

            // Check if session is complete
            if (this.currentSession.capturesCompleted >= this.currentSession.totalCapturesNeeded) {
                this.currentSession.isComplete = true;
                this.currentSession.userInstructions = '🎉 Scanning complete! Processing images...';
            }

            // Update last capture position
            const currentPos = this.estimateCurrentPosition(trackers);
            if (currentPos) {
                this.lastCapturePosition = currentPos;
            }

            // Notify callbacks
            this.captureCallbacks.forEach(callback => callback(this.currentSession!));

            return true;
        } catch (error) {
            console.error('Auto-capture failed:', error);
            return false;
        }
    }

    /**
     * Calculate alignment quality score
     */
    private calculateAlignmentQuality(alignmentStatus: AlignmentStatus): number {
        if (!alignmentStatus.isAligned) return 0;

        let score = 1.0;

        // Penalize missing trackers
        const trackerPenalty = (alignmentStatus.missingTrackers.length / 4) * 0.5;
        score -= trackerPenalty;

        // Penalize stale trackers  
        const stalePenalty = (alignmentStatus.staleTrackers.length / 4) * 0.3;
        score -= stalePenalty;

        return Math.max(0, score);
    }

    /**
     * Estimate current camera position relative to surface
     */
    private estimateCurrentPosition(trackers: DetectedTracker[]): { x: number; y: number } | null {
        if (trackers.length === 0) return null;

        // Calculate centroid of all trackers
        let sumX = 0, sumY = 0;
        for (const tracker of trackers) {
            sumX += tracker.center.x;
            sumY += tracker.center.y;
        }

        return {
            x: sumX / trackers.length,
            y: sumY / trackers.length,
        };
    }

    /**
     * Calculate distance between two positions
     */
    private calculateDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
        return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
    }

    /**
     * Calculate overall session confidence
     */
    private calculateSessionConfidence(): number {
        if (!this.currentSession) return 0;

        const completed = this.currentSession.positions.filter(p => p.captured);
        if (completed.length === 0) return 0;

        const avgQuality = completed.reduce((sum, pos) => {
            if (!pos.alignmentStatus) return sum;
            return sum + this.calculateAlignmentQuality(pos.alignmentStatus);
        }, 0) / completed.length;

        const completionRatio = completed.length / this.currentSession.totalCapturesNeeded;

        return avgQuality * completionRatio;
    }

    /**
     * Get next instruction for user
     */
    private getNextInstruction(positions: CapturePosition[]): string {
        const uncaptured = positions.filter(p => !p.captured);

        if (uncaptured.length === 0) {
            return '🎉 All positions captured! Processing...';
        }

        const next = uncaptured.sort((a, b) => a.priority - b.priority)[0];
        if (!next) return 'Keep camera stable and aligned';

        return `📍 ${next.name}: ${next.description}`;
    }

    /**
     * Subscribe to capture events
     */
    onCapture(callback: (session: ScanSession) => void): void {
        this.captureCallbacks.push(callback);
    }

    getCurrentSession(): ScanSession | null {
        return this.currentSession;
    }

    updateConfig(newConfig: Partial<AutoCaptureConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    reset(): void {
        this.currentSession = null;
        this.lastCapturePosition = null;
    }
} 
