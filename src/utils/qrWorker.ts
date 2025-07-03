import jsQR from "jsqr";

interface QRWorkerMessage {
    type: 'DETECT_QR';
    imageData: ImageData;
    workerId: string;
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

self.onmessage = function (event: MessageEvent<QRWorkerMessage>) {
    const { type, imageData, workerId } = event.data;

    if (type === 'DETECT_QR') {
        try {
            const qrResult = jsQR(
                imageData.data,
                imageData.width,
                imageData.height,
                {
                    inversionAttempts: "dontInvert",
                }
            );

            if (qrResult) {
                const response: QRWorkerResponse = {
                    type: 'QR_DETECTED',
                    workerId,
                    qrResult: {
                        data: qrResult.data,
                        location: qrResult.location
                    }
                };
                self.postMessage(response);
            } else {
                const response: QRWorkerResponse = {
                    type: 'QR_NOT_FOUND',
                    workerId
                };
                self.postMessage(response);
            }
        } catch (error) {
            const response: QRWorkerResponse = {
                type: 'QR_NOT_FOUND',
                workerId,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
            self.postMessage(response);
        }
    }
}; 
