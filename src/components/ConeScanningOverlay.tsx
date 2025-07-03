import { useEffect, useRef, useState, useCallback } from "react";
import { Box, Typography, Chip, Button, Stack } from "@mui/material";
import type {
  DetectedTracker,
  DetectedCone,
  AlignmentStatus,
  CoordinateTransform,
} from "@/utils/config";
import { CONE_CONFIG } from "@/utils/config";
import { ConeDetector } from "@/utils/coneDetection";
import { HomographyTransform } from "@/utils/homography";

interface ConeScanningOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  detectedTrackers: DetectedTracker[];
  alignmentStatus: AlignmentStatus;
  isActive: boolean;
  onConesDetected?: (cones: DetectedCone[]) => void;
}

export default function ConeScanningOverlay({
  videoRef,
  detectedTrackers,
  alignmentStatus,
  isActive,
  onConesDetected,
}: ConeScanningOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [detectedCones, setDetectedCones] = useState<DetectedCone[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [coordinateTransform, setCoordinateTransform] = useState<CoordinateTransform | null>(null);
  
  // Initialize cone detector and homography transformer
  const coneDetectorRef = useRef<ConeDetector>(new ConeDetector());
  const homographyTransformRef = useRef<HomographyTransform>(new HomographyTransform());

  // Update coordinate transformation when trackers change
  useEffect(() => {
    if (alignmentStatus.isAligned && detectedTrackers.length >= 4) {
      const transform = homographyTransformRef.current.calculateHomography(detectedTrackers);
      setCoordinateTransform(transform);
    } else {
      setCoordinateTransform(null);
    }
  }, [detectedTrackers, alignmentStatus.isAligned]);

  // Cone detection function
  const detectCones = useCallback(() => {
    if (!isActive || !isScanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data for processing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Detect cones
    const cones = coneDetectorRef.current.detectCones(imageData, coordinateTransform || undefined);
    
    setDetectedCones(cones);
    onConesDetected?.(cones);
  }, [isActive, isScanning, videoRef, coordinateTransform, onConesDetected]);

  // Start/stop scanning
  useEffect(() => {
    if (!isActive || !isScanning) {
      return;
    }

    const interval = setInterval(detectCones, 200); // Scan 5 times per second
    return () => clearInterval(interval);
  }, [isActive, isScanning, detectCones]);

  const startScanning = () => {
    if (!alignmentStatus.isAligned) {
      return; // Don't start if not aligned
    }
    setIsScanning(true);
    coneDetectorRef.current.clearTrackedCones();
  };

  const stopScanning = () => {
    setIsScanning(false);
    setDetectedCones([]);
    coneDetectorRef.current.clearTrackedCones();
  };

  const canStartScanning = alignmentStatus.isAligned && detectedTrackers.length >= 4;

  if (!isActive) return null;

  return (
    <>
      {/* Hidden canvas for image processing */}
      <canvas
        ref={canvasRef}
        style={{ display: "none" }}
      />

      {/* Overlay UI */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 20,
        }}
      >
        {/* Cone detection indicators */}
        {detectedCones.map((cone) => {
          const canvasWidth = canvasRef.current?.width || 640;
          const canvasHeight = canvasRef.current?.height || 480;
          
          return (
            <Box
              key={cone.id}
              sx={{
                position: "absolute",
                left: `${(cone.center.x / canvasWidth) * 100}%`,
                top: `${(cone.center.y / canvasHeight) * 100}%`,
                transform: "translate(-50%, -50%)",
                width: cone.radius * 2,
                height: cone.radius * 2,
                border: "3px solid #FF6B35",
                borderRadius: "50%",
                bgcolor: "rgba(255, 107, 53, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontWeight: "bold",
                color: "white",
                textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                backdropFilter: "blur(2px)",
                animation: "pulse 1.5s infinite",
                zIndex: 25,
                "@keyframes pulse": {
                  "0%, 100%": { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
                  "50%": { opacity: 0.7, transform: "translate(-50%, -50%) scale(1.1)" },
                },
              }}
            >
              🔺
            </Box>
          );
        })}

        {/* Surface coordinates display for cones */}
        {detectedCones
          .filter(cone => cone.surfacePosition)
          .map((cone) => {
            const canvasWidth = canvasRef.current?.width || 640;
            const canvasHeight = canvasRef.current?.height || 480;
            
            return (
              <Box
                key={`${cone.id}-coords`}
                sx={{
                  position: "absolute",
                  left: `${(cone.center.x / canvasWidth) * 100}%`,
                  top: `${(cone.center.y / canvasHeight) * 100}%`,
                  transform: "translate(-50%, -120%)",
                  bgcolor: "rgba(0, 0, 0, 0.8)",
                  color: "white",
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: "10px",
                  fontWeight: "bold",
                  backdropFilter: "blur(3px)",
                  zIndex: 26,
                  textAlign: "center",
                  minWidth: "60px",
                }}
              >
                {cone.surfacePosition && (
                  <>
                    <div>X: {Math.round(cone.surfacePosition.x)}mm</div>
                    <div>Y: {Math.round(cone.surfacePosition.y)}mm</div>
                    <div>C: {Math.round(cone.confidence * 100)}%</div>
                  </>
                )}
              </Box>
            );
          })}

        {/* Control panel */}
        <Box
          sx={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            bgcolor: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(4px)",
            borderRadius: 2,
            p: 2,
            pointerEvents: "auto",
            zIndex: 30,
            minWidth: 250,
          }}
        >
          <Stack spacing={1} alignItems="center">
            <Typography variant="h6" color="white" sx={{ mb: 1 }}>
              🔺 Cone Scanner
            </Typography>
            
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
              <Chip
                label={`Trackers: ${detectedTrackers.length}/4`}
                color={alignmentStatus.isAligned ? "success" : "warning"}
                size="small"
              />
              <Chip
                label={`Cones: ${detectedCones.length}`}
                color={detectedCones.length > 0 ? "success" : "default"}
                size="small"
              />
              <Chip
                label={`Surface: ${coordinateTransform?.isValid ? "Ready" : "Not Ready"}`}
                color={coordinateTransform?.isValid ? "success" : "error"}
                size="small"
              />
            </Stack>

            {!canStartScanning && (
              <Typography variant="body2" color="warning.main" sx={{ textAlign: "center" }}>
                {!alignmentStatus.isAligned 
                  ? "⚠️ Align all QR trackers first"
                  : "⚠️ Need all 4 trackers visible"
                }
              </Typography>
            )}

            <Stack direction="row" spacing={1}>
              {!isScanning ? (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={startScanning}
                  disabled={!canStartScanning}
                  size="small"
                >
                  🎯 Start Cone Scan
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={stopScanning}
                  size="small"
                >
                  ⏹️ Stop Scanning
                </Button>
              )}
            </Stack>

            {isScanning && (
              <Typography variant="body2" color="success.main" sx={{ textAlign: "center" }}>
                📡 Scanning for cones... Place magnetic pegs on the surface
              </Typography>
            )}
          </Stack>
        </Box>
      </Box>
    </>
  );
} 
