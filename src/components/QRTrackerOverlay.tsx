import { useEffect, useRef, useState, useCallback } from "react";
import { Box } from "@mui/material";
import {
  TrackerID,
  GridUtils,
  A4_DIMENSIONS,
  TRACKER_CONFIG,
} from "@/utils/config";
import type {
  DetectedTracker,
  AlignmentStatus,
  AprilTagDetection,
} from "@/utils/config";
import { getAprilTagManager } from "@/utils/apriltag";

interface QRTrackerOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  targetDimensions?: { width: number; height: number };
  onAlignmentChange?: (status: AlignmentStatus) => void;
}

export default function QRTrackerOverlay({
  videoRef,
  isActive,
  targetDimensions = A4_DIMENSIONS.PORTRAIT,
  onAlignmentChange,
}: QRTrackerOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [detectedTrackers, setDetectedTrackers] = useState<DetectedTracker[]>(
    [],
  );
  const [alignmentStatus, setAlignmentStatus] = useState<AlignmentStatus>({
    isAligned: false,
    translation: { x: 0, y: 0 },
    rotation: 0,
    scale: 1,
    missingTrackers: GridUtils.getAllTrackers(),
    staleTrackers: [],
    detectedCount: 0,
  });

  const calculateAlignment = useCallback(
    (trackers: DetectedTracker[]): AlignmentStatus => {
      const currentTime = Date.now();
      const { fresh, stale } = GridUtils.filterStaleTrackers(
        trackers,
        currentTime,
      );

      const foundTrackerIds = new Set(fresh.map((t) => t.id));
      const allTrackers = GridUtils.getAllTrackers();
      const missingTrackers = allTrackers.filter(
        (id) => !foundTrackerIds.has(id),
      );
      const staleTrackerIds = stale.map((t) => t.id);

      if (!GridUtils.hasMinimumTrackers(fresh)) {
        return {
          isAligned: false,
          translation: { x: 0, y: 0 },
          rotation: 0,
          scale: 1,
          missingTrackers,
          staleTrackers: staleTrackerIds,
          detectedCount: fresh.length,
        };
      }

      // For simplicity, use the first detected tracker as reference point
      const referenceTracker = fresh?.[0];
      if (!referenceTracker) {
        return {
          isAligned: false,
          translation: { x: 0, y: 0 },
          rotation: 0,
          scale: 1,
          missingTrackers,
          staleTrackers: staleTrackerIds,
          detectedCount: fresh.length,
        };
      }

      // Calculate scale based on average tracker size vs expected size
      const averageWidth =
        fresh.reduce((sum, t) => sum + t.dims.width, 0) / fresh.length;
      const expectedSize = TRACKER_CONFIG.size;
      const scale = averageWidth / expectedSize;

      // Calculate center offset (translation)
      const canvasCenter = {
        x: (canvasRef.current?.width ?? 0) / 2,
        y: (canvasRef.current?.height ?? 0) / 2,
      };

      const translation = {
        x: referenceTracker.center.x - canvasCenter.x,
        y: referenceTracker.center.y - canvasCenter.y,
      };

      // Calculate rotation from pose data if available
      let rotation = 0;
      if (referenceTracker.detection.pose?.R) {
        // Extract rotation from rotation matrix (simplified)
        const R = referenceTracker.detection.pose.R;
        rotation = Math.atan2(R[1]![0]!, R[0]![0]!) * (180 / Math.PI);
      }

      // Determine if aligned (within thresholds)
      const isAligned =
        Math.abs(translation.x) < 50 &&
        Math.abs(translation.y) < 50 &&
        Math.abs(rotation) < 10 &&
        Math.abs(scale - 1) < 0.2 &&
        missingTrackers.length === 0 &&
        staleTrackerIds.length === 0;

      return {
        isAligned,
        translation,
        rotation,
        scale,
        missingTrackers,
        staleTrackers: staleTrackerIds,
        detectedCount: fresh.length,
      };
    },
    [targetDimensions],
  );

  const scanForAprilTags = useCallback(async () => {
    if (!isActive || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const aprilTagManager = getAprilTagManager();
      const detections = await aprilTagManager.detect(canvas);

      if (detections && detections.length > 0) {
        setDetectedTrackers((prev) => {
          const newTrackers: DetectedTracker[] = [];

          detections.forEach((detection: AprilTagDetection) => {
            const trackerId = GridUtils.identifyTracker(detection.id);
            if (trackerId) {
              const newTracker = GridUtils.createDetectedTracker(
                trackerId,
                detection,
              );
              newTrackers.push(newTracker);
            }
          });

          // Merge with existing trackers, removing duplicates
          const filtered = prev.filter(
            (t) => !newTrackers.some((nt) => nt.id === t.id),
          );
          return [...filtered, ...newTrackers];
        });
      }

      // Clean up old detections
      setDetectedTrackers((prev) => {
        const currentTime = Date.now();
        return prev.filter(
          (t) => currentTime - t.lastSeen < TRACKER_CONFIG.cleanupThreshold,
        );
      });
    } catch (error) {
      console.error("AprilTag detection error:", error);
    }
  }, [isActive, videoRef]);

  useEffect(() => {
    if (!isActive) {
      setDetectedTrackers([]);
      return;
    }

    const interval = setInterval(scanForAprilTags, 100); // Scan 10 times per second
    return () => clearInterval(interval);
  }, [isActive, scanForAprilTags]);

  useEffect(() => {
    const newAlignment = calculateAlignment(detectedTrackers);
    setAlignmentStatus(newAlignment);
    onAlignmentChange?.(newAlignment);
  }, [detectedTrackers, calculateAlignment, onAlignmentChange]);

  const renderOverlay = () => {
    if (!isActive || !canvasRef.current) return null;

    const canvasWidth = canvasRef.current?.width || 640;
    const canvasHeight = canvasRef.current?.height || 480;

    // Calculate target grid positions based on A4 proportions
    const aspectRatio = canvasWidth / canvasHeight;
    const isLandscape = aspectRatio > 1;
    const marginX = isLandscape ? 0.15 : 0.18;
    const marginY = isLandscape ? 0.18 : 0.15;

    // Grid positions for AprilTag trackers (following the cartesian grid pattern)
    const gridPositions = {
      [TrackerID.TAG_01]: {
        x: canvasWidth * marginX,
        y: canvasHeight * marginY,
      },
      [TrackerID.TAG_02]: {
        x: canvasWidth * (1 - marginX),
        y: canvasHeight * marginY,
      },
      [TrackerID.TAG_03]: {
        x: canvasWidth * (1 - marginX),
        y: canvasHeight * (1 - marginY),
      },
      [TrackerID.TAG_04]: {
        x: canvasWidth * marginX,
        y: canvasHeight * (1 - marginY),
      },
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
          "& @keyframes pulse": {
            "0%, 100%": { opacity: 1 },
            "50%": { opacity: 0.7 },
          },
          "& @keyframes bounce": {
            "0%, 20%, 50%, 80%, 100%": { transform: "translateY(0)" },
            "40%": { transform: "translateY(-5px)" },
            "60%": { transform: "translateY(-3px)" },
          },
        }}
      >
        {/* Grid position indicators */}
        {Object.entries(gridPositions).map(([trackerId, targetPos]) => {
          const tracker = detectedTrackers.find(
            (t) => t.id === (trackerId as TrackerID),
          );
          const isDetected = !!tracker;
          const isStale =
            tracker &&
            Date.now() - tracker.lastSeen > TRACKER_CONFIG.staleThreshold;

          return (
            <Box
              key={`target-${trackerId}`}
              sx={{
                position: "absolute",
                left: `${(targetPos.x / canvasWidth) * 100}%`,
                top: `${(targetPos.y / canvasHeight) * 100}%`,
                transform: "translate(-50%, -50%)",
                width: 50,
                height: 50,
                border: isStale
                  ? "2px solid #FF5722"
                  : isDetected
                    ? "2px solid #4CAF50"
                    : "2px dashed #FF9800",
                borderRadius: "8px",
                bgcolor: isStale
                  ? "rgba(255, 87, 34, 0.3)"
                  : isDetected
                    ? "rgba(76, 175, 80, 0.3)"
                    : "rgba(255, 152, 0, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                fontWeight: "bold",
                color: "white",
                textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                backdropFilter: "blur(2px)",
                animation: isStale
                  ? "pulse 1s infinite"
                  : !isDetected
                    ? "pulse 2s infinite"
                    : "none",
              }}
            >
              {isStale ? "⚠" : isDetected ? "✓" : trackerId}
            </Box>
          );
        })}

        {/* Real-time tracker indicators */}
        {detectedTrackers.map((tracker) => {
          const targetPos = gridPositions[tracker.id];
          const currentPos = tracker.center;

          if (!targetPos) return null;

          // Calculate direction vector from current to target
          const dx = targetPos.x - currentPos.x;
          const dy = targetPos.y - currentPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const isAligned = distance < 25;

          // Calculate angle for arrow direction
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

          return (
            <Box key={`tracker-${tracker.id}`}>
              {/* Current tracker position indicator */}
              <Box
                sx={{
                  position: "absolute",
                  left: `${(currentPos.x / canvasWidth) * 100}%`,
                  top: `${(currentPos.y / canvasHeight) * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: 40,
                  height: 40,
                  border: isAligned ? "3px solid #4CAF50" : "3px solid #2196F3",
                  borderRadius: "50%",
                  bgcolor: isAligned
                    ? "rgba(76, 175, 80, 0.8)"
                    : "rgba(33, 150, 243, 0.8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: "white",
                  textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                  backdropFilter: "blur(3px)",
                  animation: isAligned ? "none" : "pulse 1.5s infinite",
                  zIndex: 15,
                }}
              >
                {tracker.id}
              </Box>

              {/* Movement direction arrow */}
              {!isAligned && (
                <Box
                  sx={{
                    position: "absolute",
                    left: `${(currentPos.x / canvasWidth) * 100}%`,
                    top: `${(currentPos.y / canvasHeight) * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                    width: Math.min(distance * 0.6, 80),
                    height: 3,
                    bgcolor: "#FF9800",
                    transformOrigin: "left center",
                    borderRadius: "2px",
                    zIndex: 12,
                    animation: "pulse 1s infinite",
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      right: "-6px",
                      top: "-3px",
                      width: 0,
                      height: 0,
                      borderLeft: "8px solid #FF9800",
                      borderTop: "4px solid transparent",
                      borderBottom: "4px solid transparent",
                    },
                  }}
                />
              )}

              {/* Distance indicator */}
              {!isAligned && (
                <Box
                  sx={{
                    position: "absolute",
                    left: `${(currentPos.x / canvasWidth) * 100}%`,
                    top: `${(currentPos.y / canvasHeight) * 100}%`,
                    transform: "translate(-50%, -70px)",
                    bgcolor: "rgba(0, 0, 0, 0.8)",
                    color: "white",
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: "10px",
                    fontWeight: "bold",
                    backdropFilter: "blur(3px)",
                    zIndex: 16,
                    animation: "bounce 2s infinite",
                  }}
                >
                  {Math.round(distance)}px
                </Box>
              )}

              {/* Connection line */}
              {!isAligned && (
                <svg
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    zIndex: 11,
                  }}
                >
                  <line
                    x1={`${(currentPos.x / canvasWidth) * 100}%`}
                    y1={`${(currentPos.y / canvasHeight) * 100}%`}
                    x2={`${(targetPos.x / canvasWidth) * 100}%`}
                    y2={`${(targetPos.y / canvasHeight) * 100}%`}
                    stroke="#FF9800"
                    strokeWidth="2"
                    strokeDasharray="3,3"
                    opacity="0.7"
                  />
                </svg>
              )}
            </Box>
          );
        })}

        {/* Center crosshair */}
        <Box
          sx={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 20,
            height: 20,
            border: "1px solid rgba(255,255,255,0.8)",
            borderRadius: "50%",
            "&::before, &::after": {
              content: '""',
              position: "absolute",
              bgcolor: "rgba(255,255,255,0.8)",
            },
            "&::before": {
              left: "50%",
              top: "20%",
              width: "1px",
              height: "60%",
              transform: "translateX(-50%)",
            },
            "&::after": {
              left: "20%",
              top: "50%",
              width: "60%",
              height: "1px",
              transform: "translateY(-50%)",
            },
          }}
        />

        {/* Status notifications */}
        <Box
          sx={{
            position: "absolute",
            left: "50%",
            top: "20px",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
          }}
        >
          {alignmentStatus.isAligned ? (
            <Box
              sx={{
                bgcolor: "rgba(76, 175, 80, 0.9)",
                color: "white",
                px: 2,
                py: 1,
                borderRadius: 1,
                fontSize: "14px",
                fontWeight: "bold",
                backdropFilter: "blur(4px)",
                animation: "bounce 1s infinite",
              }}
            >
              🎯 PERFECTLY ALIGNED!
            </Box>
          ) : alignmentStatus.staleTrackers.length > 0 ? (
            <Box
              sx={{
                bgcolor: "rgba(255, 87, 34, 0.9)",
                color: "white",
                px: 2,
                py: 1,
                borderRadius: 1,
                fontSize: "12px",
                fontWeight: "bold",
                backdropFilter: "blur(4px)",
                textAlign: "center",
                animation: "pulse 1s infinite",
              }}
            >
              ⚠ Tags moved: {alignmentStatus.staleTrackers.join(", ")}
            </Box>
          ) : alignmentStatus.missingTrackers.length > 0 ? (
            <Box
              sx={{
                bgcolor: "rgba(33, 150, 243, 0.9)",
                color: "white",
                px: 2,
                py: 1,
                borderRadius: 1,
                fontSize: "12px",
                fontWeight: "bold",
                backdropFilter: "blur(4px)",
                textAlign: "center",
                animation: "pulse 2s infinite",
              }}
            >
              � Find tags: {alignmentStatus.missingTrackers.join(", ")}
            </Box>
          ) : null}
        </Box>
      </Box>
    );
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ display: "none" }}
        width={640}
        height={480}
      />
      {renderOverlay()}
    </>
  );
}
