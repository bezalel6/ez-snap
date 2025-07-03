import { useRef, useCallback, useEffect } from 'react';

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

interface QRWorkerResponse {
    type: 'QR_DETECTED' | 'QR_NOT_FOUND';
    workerId: string;
    qrResult?: {
        data: string;
        location: {
            topLeftCorner: { x: number; y: number };
            topRightCorner: { x: number; y: number };
            bottomRightCorner: { x: number; y: number };
            bottomLeftCorner: { x: number; y: number };
        };
    };
    error?: string;
}

export function useQRWorker() {
    const workerRef = useRef<Worker | null>(null);
    const pendingCallbacks = useRef<Map<string, (qr: DetectedQRCode | null) => void>>(new Map());
    const qrTrackingCache = useRef<Map<string, DetectedQRCode>>(new Map());
    const lastDetectionTime = useRef<Map<string, number>>(new Map());
    const smoothedPositions = useRef<Map<string, DetectedQRCode["location"]>>(new Map());

    // Initialize worker
    useEffect(() => {
        try {
            // Create worker from inline code with fallback to main thread
            const workerCode = `
        importScripts('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js');

        self.onmessage = function(event) {
          const { type, imageData, workerId } = event.data;
          
          if (type === 'DETECT_QR') {
            try {
              const qrResult = self.jsQR(
                imageData.data,
                imageData.width,
                imageData.height,
                {
                  inversionAttempts: "dontInvert",
                }
              );

              if (qrResult && qrResult.data) {
                const response = {
                  type: 'QR_DETECTED',
                  workerId: workerId,
                  qrResult: {
                    data: qrResult.data,
                    location: qrResult.location
                  }
                };
                self.postMessage(response);
              } else {
                const response = {
                  type: 'QR_NOT_FOUND',
                  workerId: workerId
                };
                self.postMessage(response);
              }
            } catch (error) {
              const response = {
                type: 'QR_NOT_FOUND',
                workerId: workerId,
                error: (error && error.message) ? error.message : 'Unknown error'
              };
              self.postMessage(response);
            }
          }
        };
      `;

            const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
            workerRef.current = new Worker(URL.createObjectURL(workerBlob));

            workerRef.current.onmessage = (event: MessageEvent<QRWorkerResponse>) => {
                const { type, workerId, qrResult, error } = event.data;
                const callback = pendingCallbacks.current.get(workerId);

                if (callback) {
                    pendingCallbacks.current.delete(workerId);

                    if (type === 'QR_DETECTED' && qrResult) {
                        const now = Date.now();
                        const qrData = qrResult.data;

                        // Position smoothing for stable tracking
                        const existingQR = qrTrackingCache.current.get(qrData);
                        const lastSeen = lastDetectionTime.current.get(qrData) ?? 0;
                        const lastPosition = smoothedPositions.current.get(qrData);

                        let smoothedLocation = qrResult.location;
                        if (lastPosition && now - lastSeen < 500) {
                            const smoothingFactor = 0.3;
                            smoothedLocation = {
                                topLeftCorner: {
                                    x: lastPosition.topLeftCorner.x * (1 - smoothingFactor) + qrResult.location.topLeftCorner.x * smoothingFactor,
                                    y: lastPosition.topLeftCorner.y * (1 - smoothingFactor) + qrResult.location.topLeftCorner.y * smoothingFactor,
                                },
                                topRightCorner: {
                                    x: lastPosition.topRightCorner.x * (1 - smoothingFactor) + qrResult.location.topRightCorner.x * smoothingFactor,
                                    y: lastPosition.topRightCorner.y * (1 - smoothingFactor) + qrResult.location.topRightCorner.y * smoothingFactor,
                                },
                                bottomRightCorner: {
                                    x: lastPosition.bottomRightCorner.x * (1 - smoothingFactor) + qrResult.location.bottomRightCorner.x * smoothingFactor,
                                    y: lastPosition.bottomRightCorner.y * (1 - smoothingFactor) + qrResult.location.bottomRightCorner.y * smoothingFactor,
                                },
                                bottomLeftCorner: {
                                    x: lastPosition.bottomLeftCorner.x * (1 - smoothingFactor) + qrResult.location.bottomLeftCorner.x * smoothingFactor,
                                    y: lastPosition.bottomLeftCorner.y * (1 - smoothingFactor) + qrResult.location.bottomLeftCorner.y * smoothingFactor,
                                },
                            };
                        }

                        const detectedQR: DetectedQRCode = {
                            id: existingQR?.id ?? `qr_${qrData}_${now}`,
                            data: qrData,
                            location: smoothedLocation,
                            timestamp: now,
                            confidence: 1.0,
                        };

                        // Update tracking cache
                        qrTrackingCache.current.set(qrData, detectedQR);
                        lastDetectionTime.current.set(qrData, now);
                        smoothedPositions.current.set(qrData, smoothedLocation);

                        callback(detectedQR);
                    } else {
                        if (error) {
                            console.warn('QR Worker error:', error);
                        }
                        callback(null);
                    }
                }
            };

            workerRef.current.onerror = (error) => {
                console.error('QR Worker error:', error);
            };

        } catch (error) {
            console.error('Failed to create QR Worker:', error);
        }

        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
            pendingCallbacks.current.clear();
        };
    }, []);

    const detectQRPatterns = useCallback((imageData: ImageData): Promise<DetectedQRCode | null> => {
        return new Promise((resolve) => {
            if (!workerRef.current) {
                resolve(null);
                return;
            }

            const workerId = `qr_${Date.now()}_${Math.random()}`;
            pendingCallbacks.current.set(workerId, resolve);

            try {
                workerRef.current.postMessage({
                    type: 'DETECT_QR',
                    imageData,
                    workerId
                });
            } catch (error) {
                console.warn('Failed to send message to worker:', error);
                pendingCallbacks.current.delete(workerId);
                resolve(null);
            }
        });
    }, []);

    const cleanup = useCallback(() => {
        const now = Date.now();
        const maxAge = 5000; // 5 seconds

        for (const [key, qr] of qrTrackingCache.current.entries()) {
            if (now - qr.timestamp > maxAge) {
                qrTrackingCache.current.delete(key);
                lastDetectionTime.current.delete(key);
                smoothedPositions.current.delete(key);
            }
        }
    }, []);

    return {
        detectQRPatterns,
        cleanup,
        isWorkerReady: !!workerRef.current
    };
} 
