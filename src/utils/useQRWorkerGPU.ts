import { useRef, useCallback, useEffect, useState } from 'react';
import { QRGPUDetector } from './qrGPUDetector';
import jsQR from 'jsqr';

interface DetectedQRCode {
    id: string;
    data: string;
    location: {
        topLeftCorner: { x: number; y: number };
        topRightCorner: { x: number; y: number };
        bottomRightCorner: { x: number; y: number };
        bottomLeftCorner: { x: number; y: number };
    };
    timestamp: number;
    confidence: number;
}

export function useQRWorkerGPU() {
    const gpuDetector = useRef<QRGPUDetector | null>(null);
    const [useGPU, setUseGPU] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [performanceStats, setPerformanceStats] = useState({
        gpuAverage: 0,
        cpuAverage: 0,
        frameCount: 0,
        gpuFrames: 0,
        cpuFrames: 0
    });

    // Performance tracking
    const performanceBuffer = useRef<{ gpu: number[], cpu: number[] }>({
        gpu: [],
        cpu: []
    });

    // Initialize GPU detector
    useEffect(() => {
        const initGPU = async () => {
            try {
                gpuDetector.current = new QRGPUDetector();
                const success = await gpuDetector.current.initialize();

                if (success) {
                    console.log('🚀 GPU acceleration enabled!');
                    setUseGPU(true);
                } else {
                    console.log('💻 Using CPU detection (GPU unavailable)');
                    setUseGPU(false);
                }

                setIsReady(true);
            } catch (error) {
                console.error('GPU initialization failed:', error);
                setUseGPU(false);
                setIsReady(true);
            }
        };

        void initGPU();

        return () => {
            if (gpuDetector.current) {
                gpuDetector.current.cleanup();
            }
        };
    }, []);

    // GPU detection with fallback
    const detectQRGPU = useCallback(async (imageData: ImageData): Promise<DetectedQRCode | null> => {
        if (!gpuDetector.current) return null;

        const startTime = performance.now();

        try {
            const results = await gpuDetector.current.detectQRCodes(imageData);
            const endTime = performance.now();

            // Track performance
            const duration = endTime - startTime;
            performanceBuffer.current.gpu.push(duration);
            if (performanceBuffer.current.gpu.length > 20) {
                performanceBuffer.current.gpu.shift();
            }

            if (results.length > 0) {
                const result = results[0]; // Take first result
                if (result?.data && result?.location) {
                    return {
                        id: `gpu_${result.data}_${Date.now()}`,
                        data: result.data,
                        location: result.location,
                        timestamp: Date.now(),
                        confidence: result.confidence
                    };
                }
            }

            return null;
        } catch (error) {
            console.warn('GPU detection failed, falling back to CPU:', error);
            return null;
        }
    }, []);

    // CPU detection (fallback)
    const detectQRCPU = useCallback(async (imageData: ImageData): Promise<DetectedQRCode | null> => {
        const startTime = performance.now();

        try {
            const qrResult = jsQR(
                imageData.data,
                imageData.width,
                imageData.height,
                {
                    inversionAttempts: "dontInvert",
                }
            );

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Track performance
            performanceBuffer.current.cpu.push(duration);
            if (performanceBuffer.current.cpu.length > 20) {
                performanceBuffer.current.cpu.shift();
            }

            if (qrResult?.data) {
                return {
                    id: `cpu_${qrResult.data}_${Date.now()}`,
                    data: qrResult.data,
                    location: qrResult.location,
                    timestamp: Date.now(),
                    confidence: 1.0
                };
            }

            return null;
        } catch (error) {
            console.error('CPU detection failed:', error);
            return null;
        }
    }, []);

    // Adaptive detection that chooses best method
    const detectQRPatterns = useCallback(async (imageData: ImageData): Promise<DetectedQRCode | null> => {
        if (!isReady) return null;

        // Adaptive switching based on performance
        let result: DetectedQRCode | null = null;

        if (useGPU && gpuDetector.current?.isReady()) {
            result = await detectQRGPU(imageData);

            // If GPU fails, fallback to CPU
            result ??= await detectQRCPU(imageData);
        } else {
            result = await detectQRCPU(imageData);
        }

        // Update performance statistics
        setPerformanceStats(prev => {
            const gpuTimes = performanceBuffer.current.gpu;
            const cpuTimes = performanceBuffer.current.cpu;

            return {
                gpuAverage: gpuTimes.length > 0 ? gpuTimes.reduce((a, b) => a + b, 0) / gpuTimes.length : 0,
                cpuAverage: cpuTimes.length > 0 ? cpuTimes.reduce((a, b) => a + b, 0) / cpuTimes.length : 0,
                frameCount: prev.frameCount + 1,
                gpuFrames: prev.gpuFrames + (useGPU && gpuDetector.current?.isReady() ? 1 : 0),
                cpuFrames: prev.cpuFrames + (useGPU && gpuDetector.current?.isReady() ? 0 : 1)
            };
        });

        return result;
    }, [isReady, useGPU, detectQRGPU, detectQRCPU]);

    // Force CPU mode (for testing/comparison)
    const forceCPUMode = useCallback(() => {
        setUseGPU(false);
        console.log('🔄 Forced CPU detection mode');
    }, []);

    // Force GPU mode (if available)
    const forceGPUMode = useCallback(() => {
        if (gpuDetector.current?.isReady()) {
            setUseGPU(true);
            console.log('🚀 Forced GPU detection mode');
        } else {
            console.warn('GPU not available, staying in CPU mode');
        }
    }, []);

    // Auto-select best mode based on performance
    const autoSelectMode = useCallback(() => {
        const { gpuAverage, cpuAverage } = performanceStats;

        if (gpuAverage > 0 && cpuAverage > 0 && gpuDetector.current?.isReady()) {
            // Switch to GPU if it's significantly faster (>25% improvement)
            if (gpuAverage < cpuAverage * 0.75) {
                setUseGPU(true);
                console.log('🚀 Auto-switched to GPU mode (faster)');
            } else if (cpuAverage < gpuAverage * 0.75) {
                setUseGPU(false);
                console.log('💻 Auto-switched to CPU mode (faster)');
            }
        }
    }, [performanceStats]);

    const cleanup = useCallback(() => {
        if (gpuDetector.current) {
            gpuDetector.current.cleanup();
        }
        performanceBuffer.current = { gpu: [], cpu: [] };
    }, []);

    const getPerformanceInfo = useCallback(() => {
        return {
            ...performanceStats,
            mode: useGPU ? 'GPU' : 'CPU',
            gpuSupported: gpuDetector.current?.isReady() ?? false,
            recommendations: {
                shouldUseGPU: performanceStats.gpuAverage > 0 &&
                    performanceStats.cpuAverage > 0 &&
                    performanceStats.gpuAverage < performanceStats.cpuAverage * 0.8,
                performanceGain: performanceStats.cpuAverage > 0 && performanceStats.gpuAverage > 0
                    ? `${(((performanceStats.cpuAverage - performanceStats.gpuAverage) / performanceStats.cpuAverage) * 100).toFixed(1)}%`
                    : 'Unknown'
            }
        };
    }, [performanceStats, useGPU]);

    return {
        detectQRPatterns,
        cleanup,
        forceCPUMode,
        forceGPUMode,
        autoSelectMode,
        getPerformanceInfo,
        isWorkerReady: isReady,
        isUsingGPU: useGPU,
        isGPUSupported: gpuDetector.current?.isReady() ?? false
    };
} 
