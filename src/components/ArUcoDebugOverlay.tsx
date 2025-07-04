import { useEffect, useRef, useState, useCallback } from "react";
import { Box, Typography } from "@mui/material";
import type {
  ArUcoDebugSettings,
  DetectedArUcoMarker,
  ArUcoMarker,
  PoseResult,
} from "@/types/aruco";

interface ArUcoDebugOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  settings: ArUcoDebugSettings;
  onMarkersDetected?: (markers: DetectedArUcoMarker[]) => void;
  clearMarkers?: boolean;
}

export default function ArUcoDebugOverlay({
  videoRef,
  isActive,
  settings,
  onMarkersDetected,
  clearMarkers = false,
}: ArUcoDebugOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [detectedMarkers, setDetectedMarkers] = useState<DetectedArUcoMarker[]>([]);
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);

  // Load ArUco libraries
  useEffect(() => {
    const loadLibraries = async () => {
      if (typeof window === 'undefined') return;
      
      // Check if already loaded
      if (window.AR && window.CV && window.POS) {
        setIsLibraryLoaded(true);
        return;
      }

      try {
        // Load CV.js first
        await new Promise<void>((resolve, reject) => {
          const cvScript = document.createElement('script');
          cvScript.src = '/cv.js';
          cvScript.onload = () => resolve();
          cvScript.onerror = reject;
          document.head.appendChild(cvScript);
        });

        // Then load ArUco.js
        await new Promise<void>((resolve, reject) => {
          const arucoScript = document.createElement('script');
          arucoScript.src = '/aruco.js';
          arucoScript.onload = () => resolve();
          arucoScript.onerror = reject;
          document.head.appendChild(arucoScript);
        });

        // Finally load Posit.js
        await new Promise<void>((resolve, reject) => {
          const positScript = document.createElement('script');
          positScript.src = '/posit1.js';
          positScript.onload = () => resolve();
          positScript.onerror = reject;
          document.head.appendChild(positScript);
        });

        setIsLibraryLoaded(true);
      } catch (error) {
        console.error('Failed to load ArUco libraries:', error);
      }
    };

    loadLibraries();
  }, []);

  const calculateMarkerCenter = useCallback((corners: Array<{ x: number; y: number }>) => {
    const centerX = corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length;
    const centerY = corners.reduce((sum, corner) => sum + corner.y, 0) / corners.length;
    return { x: centerX, y: centerY };
  }, []);

  const estimateMarkerPose = useCallback((marker: ArUcoMarker): PoseResult | undefined => {
    if (!settings.enablePoseEstimation || !window.POS || !canvasRef.current) return undefined;

    try {
      const canvas = canvasRef.current;
      const posit = new window.POS.Posit(settings.markerSize, canvas.width);
      
      // Center corners on canvas
      const centeredCorners = marker.corners.map(corner => ({
        x: corner.x - (canvas.width / 2),
        y: (canvas.height / 2) - corner.y
      }));

      return posit.pose(centeredCorners);
    } catch (error) {
      console.warn('Pose estimation failed:', error);
      return undefined;
    }
  }, [settings.enablePoseEstimation, settings.markerSize]);

  const detectMarkers = useCallback(() => {
    if (!isActive || !isLibraryLoaded || !videoRef.current || !canvasRef.current || !window.AR) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw current video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Create ArUco detector
      const detector = new window.AR.Detector({
        dictionaryName: 'ARUCO_MIP_36h12'
      });

      // Detect markers
      const rawMarkers: ArUcoMarker[] = detector.detect(imageData);
      
      // Process detected markers
      const currentTime = Date.now();
      const processedMarkers: DetectedArUcoMarker[] = rawMarkers.map(marker => {
        const center = calculateMarkerCenter(marker.corners);
        const pose = estimateMarkerPose(marker);
        
        return {
          ...marker,
          center,
          lastDetected: currentTime,
          pose,
          confidence: 0.9 // Simplified confidence calculation
        };
      });

      setDetectedMarkers(processedMarkers);
      onMarkersDetected?.(processedMarkers);

      // Draw debug visualization if enabled
      if (settings.showThreshold || settings.showContours) {
        drawDebugVisualization(imageData);
      }
    } catch (error) {
      console.warn('ArUco detection failed:', error);
    }
  }, [
    isActive,
    isLibraryLoaded,
    videoRef,
    settings,
    calculateMarkerCenter,
    estimateMarkerPose,
    onMarkersDetected
  ]);

  const drawDebugVisualization = useCallback((imageData: ImageData) => {
    if (!debugCanvasRef.current || !window.CV) return;

    const debugCanvas = debugCanvasRef.current;
    const debugCtx = debugCanvas.getContext("2d");
    if (!debugCtx) return;

    debugCanvas.width = imageData.width;
    debugCanvas.height = imageData.height;

    if (settings.showThreshold) {
      // Create threshold visualization
      const thresholdData = new ImageData(imageData.width, imageData.height);
      try {
        window.CV.threshold(imageData, thresholdData, settings.thresholdValue, 255);
        debugCtx.putImageData(thresholdData, 0, 0);
      } catch (error) {
        console.warn('Threshold visualization failed:', error);
      }
    }
  }, [settings.showThreshold, settings.thresholdValue]);

  // Detection loop
  useEffect(() => {
    if (!isActive || !isLibraryLoaded) {
      return;
    }

    const interval = setInterval(detectMarkers, 100); // 10 FPS
    return () => clearInterval(interval);
  }, [isActive, isLibraryLoaded, detectMarkers]);

  // Clear markers when explicitly requested
  useEffect(() => {
    if (clearMarkers) {
      setDetectedMarkers([]);
    }
  }, [clearMarkers]);

  // Clear markers only when component unmounts
  useEffect(() => {
    return () => {
      setDetectedMarkers([]);
    };
  }, []);

  const renderMarkerOverlay = () => {
    if (!canvasRef.current || detectedMarkers.length === 0) return null;

    const canvasWidth = canvasRef.current.width || 640;
    const canvasHeight = canvasRef.current.height || 480;

    return (
      <>
        {detectedMarkers.map((marker, index) => (
          <Box key={`marker-${marker.id}-${index}`}>
            {/* Marker ID at center */}
            {settings.showMarkerIds && (
              <Box
                sx={{
                  position: "absolute",
                  left: `${(marker.center.x / canvasWidth) * 100}%`,
                  top: `${(marker.center.y / canvasHeight) * 100}%`,
                  transform: "translate(-50%, -50%)",
                  bgcolor: "rgba(76, 175, 80, 0.9)",
                  color: "white",
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: "14px",
                  fontWeight: "bold",
                  backdropFilter: "blur(2px)",
                  zIndex: 20,
                  border: "2px solid #4CAF50",
                }}
              >
                ID: {marker.id}
              </Box>
            )}

            {/* Marker corners */}
            {settings.showMarkerCorners && marker.corners.map((corner, cornerIndex) => (
              <Box
                key={`corner-${marker.id}-${cornerIndex}`}
                sx={{
                  position: "absolute",
                  left: `${(corner.x / canvasWidth) * 100}%`,
                  top: `${(corner.y / canvasHeight) * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: 8,
                  height: 8,
                  bgcolor: ["#F44336", "#FF9800", "#FFEB3B", "#4CAF50"][cornerIndex],
                  borderRadius: "50%",
                  border: "2px solid white",
                  zIndex: 18,
                }}
              />
            ))}

            {/* Marker boundary */}
            {settings.showMarkerCorners && (
              <svg
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  zIndex: 15,
                }}
              >
                <polygon
                  points={marker.corners.map(corner => 
                    `${(corner.x / canvasWidth) * 100},${(corner.y / canvasHeight) * 100}`
                  ).join(" ")}
                  fill="none"
                  stroke="#4CAF50"
                  strokeWidth="3"
                  strokeDasharray="5,5"
                />
              </svg>
            )}

            {/* 3D Axes */}
            {settings.showMarkerAxes && marker.pose && (
              <Box
                sx={{
                  position: "absolute",
                  left: `${(marker.center.x / canvasWidth) * 100}%`,
                  top: `${(marker.center.y / canvasHeight) * 100}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 19,
                }}
              >
                {/* X-axis (red) */}
                <Box
                  sx={{
                    position: "absolute",
                    width: 30,
                    height: 3,
                    bgcolor: "#F44336",
                    transformOrigin: "left center",
                  }}
                />
                {/* Y-axis (green) */}
                <Box
                  sx={{
                    position: "absolute",
                    width: 3,
                    height: 30,
                    bgcolor: "#4CAF50",
                    transformOrigin: "center top",
                  }}
                />
                {/* Z-axis indicator */}
                <Box
                  sx={{
                    position: "absolute",
                    width: 6,
                    height: 6,
                    bgcolor: "#2196F3",
                    borderRadius: "50%",
                    transform: "translate(-3px, -3px)",
                  }}
                />
              </Box>
            )}

            {/* Pose information */}
            {settings.enablePoseEstimation && marker.pose && (
              <Box
                sx={{
                  position: "absolute",
                  left: `${(marker.center.x / canvasWidth) * 100}%`,
                  top: `${(marker.center.y / canvasHeight) * 100}%`,
                  transform: "translate(-50%, -150%)",
                  bgcolor: "rgba(0, 0, 0, 0.8)",
                  color: "white",
                  p: 1,
                  borderRadius: 1,
                  fontSize: "10px",
                  backdropFilter: "blur(4px)",
                  zIndex: 21,
                  maxWidth: 120,
                }}
              >
                <Typography variant="caption" sx={{ display: "block", fontWeight: "bold" }}>
                  Pose (ID {marker.id})
                </Typography>
                <Typography variant="caption" sx={{ display: "block" }}>
                  Error: {marker.pose.bestError.toFixed(2)}
                </Typography>
                <Typography variant="caption" sx={{ display: "block" }}>
                  T: [{marker.pose.bestTranslation.map(t => t.toFixed(1)).join(", ")}]
                </Typography>
              </Box>
            )}
          </Box>
        ))}
      </>
    );
  };

  return (
    <Box
      ref={overlayRef}
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      {/* Hidden canvases for processing */}
      <canvas
        ref={canvasRef}
        style={{ display: "none" }}
      />
      
      {settings.showThreshold && (
        <canvas
          ref={debugCanvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            opacity: 0.3,
            zIndex: 5,
          }}
        />
      )}

      {/* Library loading indicator */}
      {!isLibraryLoaded && (
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: "rgba(0, 0, 0, 0.8)",
            color: "white",
            p: 2,
            borderRadius: 1,
            textAlign: "center",
            zIndex: 30,
          }}
        >
          <Typography variant="body2">
            🔄 Loading ArUco libraries...
          </Typography>
        </Box>
      )}

      {/* Marker overlays */}
      {renderMarkerOverlay()}

      {/* Status indicator */}
      <Box
        sx={{
          position: "absolute",
          top: "10px",
          left: "10px",
          bgcolor: isLibraryLoaded 
            ? detectedMarkers.length > 0 
              ? "rgba(76, 175, 80, 0.9)" 
              : "rgba(255, 152, 0, 0.9)"
            : "rgba(244, 67, 54, 0.9)",
          color: "white",
          px: 2,
          py: 1,
          borderRadius: 1,
          fontSize: "12px",
          fontWeight: "bold",
          backdropFilter: "blur(4px)",
          zIndex: 25,
        }}
      >
        {!isLibraryLoaded 
          ? "🔄 Loading..."
          : detectedMarkers.length > 0 
            ? `✅ ${detectedMarkers.length} marker${detectedMarkers.length !== 1 ? 's' : ''} detected`
            : "🔍 Scanning for ArUco markers..."
        }
      </Box>
    </Box>
  );
}