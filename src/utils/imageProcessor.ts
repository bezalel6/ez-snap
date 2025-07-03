import type { ScanSession, CapturePosition } from './autoCapture';
import type { DetectedCone, CoordinateTransform } from './config';
import { ConeDetector } from './coneDetection';
import { HomographyTransform } from './homography';

/**
 * Image Processing Pipeline
 * 
 * Processes multiple captured images to extract cone positions with high accuracy.
 * Uses advanced computer vision techniques to combine data from different angles
 * and lighting conditions for robust cone detection.
 */

export interface ProcessingResult {
    cones: DetectedCone[];
    confidence: number;
    sourceImages: number;
    processingTime: number;
    details: {
        perImageResults: ImageProcessingResult[];
        consensusAnalysis: ConsensusAnalysis;
        qualityMetrics: QualityMetrics;
    };
}

export interface ImageProcessingResult {
    imageId: string;
    cones: DetectedCone[];
    quality: number;
    transformMatrix: CoordinateTransform;
    processingTime: number;
}

export interface ConsensusAnalysis {
    totalDetections: number;
    clusteredCones: ClusteredCone[];
    outlierDetections: DetectedCone[];
    spatialAccuracy: number;
}

export interface ClusteredCone {
    id: string;
    position: { x: number; y: number }; // Final consensus position in mm
    confidence: number;
    supportingDetections: DetectedCone[];
    positionVariance: number; // How much positions varied across images
}

export interface QualityMetrics {
    overallQuality: number;
    spatialConsistency: number;
    detectionReliability: number;
    imageQualityAverage: number;
}

export interface ProcessingConfig {
    clusteringRadius: number; // Max distance (mm) to consider detections as same cone
    minConsensus: number; // Minimum number of images that must detect a cone
    outlierThreshold: number; // Distance threshold for outlier rejection
    qualityWeightFactor: number; // How much to weight higher quality images
}

export const DEFAULT_PROCESSING_CONFIG: ProcessingConfig = {
    clusteringRadius: 15, // 15mm clustering radius
    minConsensus: 2, // At least 2 images must see the cone
    outlierThreshold: 25, // 25mm outlier threshold
    qualityWeightFactor: 0.3,
};

export class ImageProcessor {
    private config: ProcessingConfig;
    private coneDetector: ConeDetector;

    constructor(config: ProcessingConfig = DEFAULT_PROCESSING_CONFIG) {
        this.config = config;
        this.coneDetector = new ConeDetector();
    }

    /**
     * Process a completed scan session to extract final cone positions
     */
    async processScanSession(session: ScanSession): Promise<ProcessingResult> {
        const startTime = Date.now();

        if (!session.isComplete) {
            throw new Error('Scan session is not complete');
        }

        // Filter captured positions with valid image data
        const validCaptures = session.positions.filter(
            pos => pos.captured && pos.imageData && pos.trackers && pos.alignmentStatus
        );

        if (validCaptures.length === 0) {
            throw new Error('No valid captures found in session');
        }

        console.log(`Processing ${validCaptures.length} captured images...`);

        // Process each image individually
        const imageResults: ImageProcessingResult[] = [];
        for (const capture of validCaptures) {
            try {
                const result = await this.processIndividualImage(capture);
                imageResults.push(result);
            } catch (error) {
                console.warn(`Failed to process image ${capture.id}:`, error);
            }
        }

        if (imageResults.length === 0) {
            throw new Error('Failed to process any images');
        }

        // Perform consensus analysis
        const consensusAnalysis = this.performConsensusAnalysis(imageResults);

        // Calculate quality metrics
        const qualityMetrics = this.calculateQualityMetrics(imageResults, consensusAnalysis);

        // Generate final cone list
        const finalCones = consensusAnalysis.clusteredCones.map(cluster => ({
            id: cluster.id,
            center: { x: 0, y: 0 }, // Camera coordinates not relevant for final result
            surfacePosition: cluster.position,
            radius: 10, // Estimated
            confidence: cluster.confidence,
            lastSeen: Date.now(),
        }));

        const processingTime = Date.now() - startTime;

        return {
            cones: finalCones,
            confidence: qualityMetrics.overallQuality,
            sourceImages: imageResults.length,
            processingTime,
            details: {
                perImageResults: imageResults,
                consensusAnalysis,
                qualityMetrics,
            },
        };
    }

    /**
     * Process a single captured image
     */
    private async processIndividualImage(capture: CapturePosition): Promise<ImageProcessingResult> {
        const startTime = Date.now();

        if (!capture.imageData || !capture.trackers || !capture.alignmentStatus) {
            throw new Error('Invalid capture data');
        }

        // Create canvas from image data
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to create canvas context');

        // Load image
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = capture.imageData!;
        });

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Calculate coordinate transformation
        const homographyTransform = new HomographyTransform();
        const transformMatrix = homographyTransform.calculateHomography(capture.trackers);

        // Get image data for cone detection
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Detect cones in this image
        const cones = this.coneDetector.detectCones(imageData, transformMatrix);

        // Calculate image quality
        const quality = this.assessImageQuality(capture.alignmentStatus, capture.trackers, cones);

        return {
            imageId: capture.id,
            cones,
            quality,
            transformMatrix,
            processingTime: Date.now() - startTime,
        };
    }

    /**
     * Perform consensus analysis across all detected cones
     */
    private performConsensusAnalysis(imageResults: ImageProcessingResult[]): ConsensusAnalysis {
        // Collect all cone detections with surface positions
        const allDetections = imageResults.flatMap(result =>
            result.cones.filter(cone => cone.surfacePosition)
        );

        console.log(`Analyzing ${allDetections.length} total cone detections...`);

        // Cluster nearby detections
        const clusteredCones: ClusteredCone[] = [];
        const usedDetections = new Set<string>();

        for (const detection of allDetections) {
            if (usedDetections.has(detection.id) || !detection.surfacePosition) continue;

            // Find all detections within clustering radius
            const cluster = allDetections.filter(other => {
                if (usedDetections.has(other.id) || !other.surfacePosition) return false;

                const distance = this.calculateDistance(
                    detection.surfacePosition!,
                    other.surfacePosition!
                );
                return distance <= this.config.clusteringRadius;
            });

            // Only create cluster if we have minimum consensus
            if (cluster.length >= this.config.minConsensus) {
                // Calculate weighted average position
                const weightedPosition = this.calculateWeightedPosition(cluster);
                const variance = this.calculatePositionVariance(cluster);
                const confidence = this.calculateClusterConfidence(cluster);

                clusteredCones.push({
                    id: `cone_${clusteredCones.length + 1}`,
                    position: weightedPosition,
                    confidence,
                    supportingDetections: cluster,
                    positionVariance: variance,
                });

                // Mark detections as used
                cluster.forEach(det => usedDetections.add(det.id));
            }
        }

        // Identify outliers
        const outlierDetections = allDetections.filter(det => !usedDetections.has(det.id));

        // Calculate spatial accuracy
        const spatialAccuracy = this.calculateSpatialAccuracy(clusteredCones);

        return {
            totalDetections: allDetections.length,
            clusteredCones,
            outlierDetections,
            spatialAccuracy,
        };
    }

    /**
     * Calculate weighted average position for a cluster of detections
     */
    private calculateWeightedPosition(detections: DetectedCone[]): { x: number; y: number } {
        let totalWeight = 0;
        let weightedX = 0;
        let weightedY = 0;

        for (const detection of detections) {
            if (!detection.surfacePosition) continue;

            const weight = detection.confidence;
            totalWeight += weight;
            weightedX += detection.surfacePosition.x * weight;
            weightedY += detection.surfacePosition.y * weight;
        }

        return {
            x: weightedX / totalWeight,
            y: weightedY / totalWeight,
        };
    }

    /**
     * Calculate position variance within a cluster
     */
    private calculatePositionVariance(detections: DetectedCone[]): number {
        if (detections.length < 2) return 0;

        const positions = detections
            .map(d => d.surfacePosition)
            .filter((pos): pos is { x: number; y: number } => pos !== null);

        if (positions.length < 2) return 0;

        // Calculate centroid
        const centroid = {
            x: positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length,
            y: positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length,
        };

        // Calculate average distance from centroid
        const avgDistance = positions.reduce((sum, pos) => {
            return sum + this.calculateDistance(pos, centroid);
        }, 0) / positions.length;

        return avgDistance;
    }

    /**
     * Calculate confidence for a cluster of detections
     */
    private calculateClusterConfidence(detections: DetectedCone[]): number {
        if (detections.length === 0) return 0;

        // Base confidence from detection quality
        const avgConfidence = detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;

        // Bonus for multiple supporting detections
        const consensusBonus = Math.min(detections.length / 4, 0.3); // Max 30% bonus for 4+ detections

        // Penalty for high variance
        const variance = this.calculatePositionVariance(detections);
        const variancePenalty = Math.min(variance / 50, 0.2); // Max 20% penalty for 50mm+ variance

        return Math.max(0, avgConfidence + consensusBonus - variancePenalty);
    }

    /**
     * Calculate overall spatial accuracy
     */
    private calculateSpatialAccuracy(clusteredCones: ClusteredCone[]): number {
        if (clusteredCones.length === 0) return 0;

        const avgVariance = clusteredCones.reduce(
            (sum, cone) => sum + cone.positionVariance, 0
        ) / clusteredCones.length;

        // Convert variance to accuracy score (lower variance = higher accuracy)
        return Math.max(0, 1 - (avgVariance / 30)); // 30mm variance = 0% accuracy
    }

    /**
     * Calculate quality metrics for the entire processing result
     */
    private calculateQualityMetrics(
        imageResults: ImageProcessingResult[],
        consensusAnalysis: ConsensusAnalysis
    ): QualityMetrics {
        const avgImageQuality = imageResults.reduce(
            (sum, result) => sum + result.quality, 0
        ) / imageResults.length;

        const detectionReliability = consensusAnalysis.clusteredCones.length > 0 ?
            consensusAnalysis.clusteredCones.reduce((sum, cone) => sum + cone.confidence, 0) / consensusAnalysis.clusteredCones.length : 0;

        const overallQuality = (avgImageQuality + detectionReliability + consensusAnalysis.spatialAccuracy) / 3;

        return {
            overallQuality,
            spatialConsistency: consensusAnalysis.spatialAccuracy,
            detectionReliability,
            imageQualityAverage: avgImageQuality,
        };
    }

    /**
     * Assess quality of an individual image
     */
    private assessImageQuality(
        alignmentStatus: any,
        trackers: any[],
        cones: DetectedCone[]
    ): number {
        let score = 1.0;

        // Penalize poor alignment
        if (!alignmentStatus.isAligned) score *= 0.5;

        // Penalize missing trackers
        score -= (4 - trackers.length) * 0.1;

        // Bonus for cone detections
        score += Math.min(cones.length * 0.05, 0.2);

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Calculate distance between two points
     */
    private calculateDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }

    /**
     * Update processing configuration
     */
    updateConfig(newConfig: Partial<ProcessingConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
} 
