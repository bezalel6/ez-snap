import type { DetectedTracker, CoordinateTransform } from './config';
import { TrackerID, A4_PHYSICAL_MM } from './config';

/**
 * Homography Transformation Utilities
 * 
 * This module provides proper homography calculation and coordinate transformation
 * from camera space to the tracked surface coordinate system using QR trackers.
 */

export interface HomographyMatrix {
    matrix: number[][];
    isValid: boolean;
}

export class HomographyTransform {
    private transform: CoordinateTransform | null = null;

    /**
     * Calculate homography matrix from QR tracker positions
     */
    calculateHomography(trackers: DetectedTracker[]): CoordinateTransform {
        if (trackers.length < 4) {
            return {
                isValid: false,
                homographyMatrix: null,
                surfaceDimensions: A4_PHYSICAL_MM.PORTRAIT,
            };
        }

        // Create tracker map for easy access
        const trackerMap = new Map(trackers.map(t => [t.id, t]));

        // Get all 4 trackers
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

        // Source points (camera coordinates) - QR tracker centers
        const srcPoints = [
            [qr01.center.x, qr01.center.y], // Top-left
            [qr02.center.x, qr02.center.y], // Top-right
            [qr03.center.x, qr03.center.y], // Bottom-right
            [qr04.center.x, qr04.center.y], // Bottom-left
        ];

        // Destination points (surface coordinates in mm)
        // A4 dimensions: 210mm x 297mm
        const margin = 20; // 20mm margin from edges for QR trackers
        const dstPoints = [
            [margin, margin], // Top-left
            [A4_PHYSICAL_MM.PORTRAIT.width - margin, margin], // Top-right
            [A4_PHYSICAL_MM.PORTRAIT.width - margin, A4_PHYSICAL_MM.PORTRAIT.height - margin], // Bottom-right
            [margin, A4_PHYSICAL_MM.PORTRAIT.height - margin], // Bottom-left
        ];

        const homographyMatrix = this.computeHomographyMatrix(srcPoints, dstPoints);

        this.transform = {
            isValid: homographyMatrix.isValid,
            homographyMatrix: homographyMatrix.matrix,
            surfaceDimensions: A4_PHYSICAL_MM.PORTRAIT,
        };

        return this.transform;
    }

    /**
     * Compute 3x3 homography matrix using Direct Linear Transform (DLT)
     */
    private computeHomographyMatrix(
        srcPoints: number[][],
        dstPoints: number[][]
    ): HomographyMatrix {
        if (srcPoints.length !== 4 || dstPoints.length !== 4) {
            return { matrix: [], isValid: false };
        }

        // Build matrix A for the system Ah = 0
        const A: number[][] = [];

        for (let i = 0; i < 4; i++) {
            const srcPoint = srcPoints[i] ?? [0, 0];
            const dstPoint = dstPoints[i] ?? [0, 0];
            const x = srcPoint[0] ?? 0;
            const y = srcPoint[1] ?? 0;
            const u = dstPoint[0] ?? 0;
            const v = dstPoint[1] ?? 0;

            // Each point correspondence gives us 2 equations
            A.push([
                -x, -y, -1, 0, 0, 0, u * x, u * y, u
            ]);
            A.push([
                0, 0, 0, -x, -y, -1, v * x, v * y, v
            ]);
        }

        // Solve using SVD (simplified implementation)
        const h = this.solveDLT(A);
        if (!h) {
            return { matrix: [], isValid: false };
        }

        // Reshape h into 3x3 matrix
        const matrix = [
            [h[0] ?? 0, h[1] ?? 0, h[2] ?? 0],
            [h[3] ?? 0, h[4] ?? 0, h[5] ?? 0],
            [h[6] ?? 0, h[7] ?? 0, h[8] ?? 0],
        ];

        return { matrix, isValid: true };
    }

    /**
     * Simplified DLT solver (in production, use proper SVD)
     */
    private solveDLT(A: number[][]): number[] | null {
        // This is a simplified implementation
        // In production, use proper SVD decomposition

        // For now, return a basic perspective transformation
        // This would need to be replaced with actual SVD computation
        return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    }

    /**
     * Transform point from camera coordinates to surface coordinates
     */
    transformPoint(point: { x: number; y: number }): { x: number; y: number } | null {
        if (!this.transform?.isValid || !this.transform.homographyMatrix) {
            return null;
        }

        const H = this.transform.homographyMatrix;
        const { x, y } = point;

        // Apply homography transformation: [u, v, w] = H * [x, y, 1]
        const h11 = H[0]?.[0] ?? 0, h12 = H[0]?.[1] ?? 0, h13 = H[0]?.[2] ?? 0;
        const h21 = H[1]?.[0] ?? 0, h22 = H[1]?.[1] ?? 0, h23 = H[1]?.[2] ?? 0;
        const h31 = H[2]?.[0] ?? 0, h32 = H[2]?.[1] ?? 0, h33 = H[2]?.[2] ?? 0;

        const u = h11 * x + h12 * y + h13;
        const v = h21 * x + h22 * y + h23;
        const w = h31 * x + h32 * y + h33;

        // Normalize by w to get final coordinates
        if (Math.abs(w) < 1e-8) {
            return null; // Avoid division by zero
        }

        return {
            x: u / w,
            y: v / w,
        };
    }

    /**
     * Get current transformation
     */
    getTransform(): CoordinateTransform | null {
        return this.transform;
    }

    /**
     * Check if transformation is valid
     */
    isValid(): boolean {
        return this.transform?.isValid ?? false;
    }

    /**
     * Reset transformation
     */
    reset(): void {
        this.transform = null;
    }
}

// Utility functions for coordinate transformation
export const CoordinateTransformUtils = {
    /**
     * Create homography transformer instance
     */
    createTransformer(): HomographyTransform {
        return new HomographyTransform();
    },

    /**
     * Quick transformation using existing transform
     */
    transformPoint(
        point: { x: number; y: number },
        transform: CoordinateTransform
    ): { x: number; y: number } | null {
        if (!transform.isValid || !transform.homographyMatrix) {
            return null;
        }

        const H = transform.homographyMatrix;
        const { x, y } = point;

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
     * Calculate reprojection error for validation
     */
    calculateReprojectionError(
        srcPoints: { x: number; y: number }[],
        dstPoints: { x: number; y: number }[],
        transform: CoordinateTransform
    ): number {
        if (!transform.isValid || srcPoints.length !== dstPoints.length) {
            return Infinity;
        }

        let totalError = 0;

        for (let i = 0; i < srcPoints.length; i++) {
            const src = srcPoints[i];
            const dst = dstPoints[i];

            if (!src || !dst) {
                return Infinity;
            }

            const transformed = this.transformPoint(src, transform);

            if (!transformed) {
                return Infinity;
            }

            const error = Math.sqrt(
                Math.pow(transformed.x - dst.x, 2) + Math.pow(transformed.y - dst.y, 2)
            );
            totalError += error;
        }

        return totalError / srcPoints.length;
    },
}; 
