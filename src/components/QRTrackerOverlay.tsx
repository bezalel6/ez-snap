import { useEffect, useRef, useState, useCallback } from "react";
import { Box } from "@mui/material";
import jsQR from "jsqr";

interface QRCode {
  data: string;
  location: {
    topLeftCorner: { x: number; y: number };
    topRightCorner: { x: number; y: number };
    bottomLeftCorner: { x: number; y: number };
    bottomRightCorner: { x: number; y: number };
  };
}

interface DetectedTracker {
  id: string;
  position: "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
  location: QRCode["location"];
  center: { x: number; y: number };
  lastSeen: number;
}

interface TrackerConfig {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  targetRectangle: {
    width: number;
    height: number;
  };
}

interface AlignmentStatus {
  isAligned: boolean;
  translation: { x: number; y: number };
  rotation: number;
  scale: number;
  missingTrackers: string[];
  staleTrackers: string[];
}

interface QRTrackerOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  config: TrackerConfig;
  onAlignmentChange?: (status: AlignmentStatus) => void;
}

export default function QRTrackerOverlay({
  videoRef,
  isActive,
  config,
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
    missingTrackers: ["topLeft", "topRight", "bottomLeft", "bottomRight"],
    staleTrackers: [],
  });

  const calculateCenter = (location: QRCode["location"]) => {
    const {
      topLeftCorner,
      topRightCorner,
      bottomLeftCorner,
      bottomRightCorner,
    } = location;
    return {
      x:
        (topLeftCorner.x +
          topRightCorner.x +
          bottomLeftCorner.x +
          bottomRightCorner.x) /
        4,
      y:
        (topLeftCorner.y +
          topRightCorner.y +
          bottomLeftCorner.y +
          bottomRightCorner.y) /
        4,
    };
  };

  const identifyTrackerPosition = (
    data: string,
  ): "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | null => {
    if (data === config.topLeft) return "topLeft";
    if (data === config.topRight) return "topRight";
    if (data === config.bottomLeft) return "bottomLeft";
    if (data === config.bottomRight) return "bottomRight";
    return null;
  };

  const calculateAlignment = useCallback(
    (trackers: DetectedTracker[]): AlignmentStatus => {
      const currentTime = Date.now();
      const STALE_THRESHOLD = 2000; // 2 seconds

      const foundTrackers = new Set(trackers.map((t) => t.position));
      const staleTrackers = trackers
        .filter((t) => currentTime - t.lastSeen > STALE_THRESHOLD)
        .map((t) => t.position);

      const missingTrackers = (
        ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const
      ).filter((pos) => !foundTrackers.has(pos));

      if (trackers.length < 3) {
        return {
          isAligned: false,
          translation: { x: 0, y: 0 },
          rotation: 0,
          scale: 1,
          missingTrackers,
          staleTrackers,
        };
      }

      // Find expected positions based on target rectangle
      const { width: targetWidth, height: targetHeight } =
        config.targetRectangle;

      // Calculate current rectangle from detected trackers
      const topLeft = trackers.find((t) => t.position === "topLeft");
      const topRight = trackers.find((t) => t.position === "topRight");
      const bottomLeft = trackers.find((t) => t.position === "bottomLeft");
      const bottomRight = trackers.find((t) => t.position === "bottomRight");

      if (!topLeft) {
        return {
          isAligned: false,
          translation: { x: 0, y: 0 },
          rotation: 0,
          scale: 1,
          missingTrackers,
          staleTrackers,
        };
      }

      let currentWidth = 0;
      let currentHeight = 0;
      let rotation = 0;

      // Calculate dimensions and rotation based on available corners
      if (topRight && bottomLeft && bottomRight) {
        // All four corners detected - best case
        currentWidth = Math.sqrt(
          Math.pow(topRight.center.x - topLeft.center.x, 2) +
            Math.pow(topRight.center.y - topLeft.center.y, 2),
        );
        currentHeight = Math.sqrt(
          Math.pow(bottomLeft.center.x - topLeft.center.x, 2) +
            Math.pow(bottomLeft.center.y - topLeft.center.y, 2),
        );

        // Calculate rotation from top edge
        rotation =
          (Math.atan2(
            topRight.center.y - topLeft.center.y,
            topRight.center.x - topLeft.center.x,
          ) *
            180) /
          Math.PI;
      } else if (topRight && bottomLeft) {
        // Three corners: missing bottomRight
        currentWidth = Math.sqrt(
          Math.pow(topRight.center.x - topLeft.center.x, 2) +
            Math.pow(topRight.center.y - topLeft.center.y, 2),
        );
        currentHeight = Math.sqrt(
          Math.pow(bottomLeft.center.x - topLeft.center.x, 2) +
            Math.pow(bottomLeft.center.y - topLeft.center.y, 2),
        );
        rotation =
          (Math.atan2(
            topRight.center.y - topLeft.center.y,
            topRight.center.x - topLeft.center.x,
          ) *
            180) /
          Math.PI;
      } else if (topRight) {
        // Two corners: topLeft and topRight
        currentWidth = Math.sqrt(
          Math.pow(topRight.center.x - topLeft.center.x, 2) +
            Math.pow(topRight.center.y - topLeft.center.y, 2),
        );
        rotation =
          (Math.atan2(
            topRight.center.y - topLeft.center.y,
            topRight.center.x - topLeft.center.x,
          ) *
            180) /
          Math.PI;
      } else if (bottomLeft) {
        // Two corners: topLeft and bottomLeft
        currentHeight = Math.sqrt(
          Math.pow(bottomLeft.center.x - topLeft.center.x, 2) +
            Math.pow(bottomLeft.center.y - topLeft.center.y, 2),
        );
        rotation =
          (Math.atan2(
            bottomLeft.center.x - topLeft.center.x,
            bottomLeft.center.y - topLeft.center.y,
          ) *
            180) /
            Math.PI -
          90;
      }

      const scale =
        currentWidth > 0
          ? currentWidth / targetWidth
          : currentHeight > 0
            ? currentHeight / targetHeight
            : 1;

      // Calculate center offset
      const canvasCenter = {
        x: (canvasRef.current?.width ?? 0) / 2,
        y: (canvasRef.current?.height ?? 0) / 2,
      };

      const detectedCenter = topLeft.center;
      const translation = {
        x: detectedCenter.x - canvasCenter.x,
        y: detectedCenter.y - canvasCenter.y,
      };

      // Determine if aligned (within thresholds)
      const isAligned =
        Math.abs(translation.x) < 50 &&
        Math.abs(translation.y) < 50 &&
        Math.abs(rotation) < 10 &&
        Math.abs(scale - 1) < 0.2 &&
        missingTrackers.length === 0 &&
        staleTrackers.length === 0;

      return {
        isAligned,
        translation,
        rotation,
        scale,
        missingTrackers,
        staleTrackers,
      };
    },
    [config],
  );

  const scanForQRCodes = useCallback(() => {
    if (!isActive || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      const position = identifyTrackerPosition(code.data);
      if (position) {
        const center = calculateCenter(code.location);
        const tracker: DetectedTracker = {
          id: code.data,
          position,
          location: code.location,
          center,
          lastSeen: Date.now(),
        };

        setDetectedTrackers((prev) => {
          const filtered = prev.filter((t) => t.position !== position);
          return [...filtered, tracker];
        });
      }
    }

    // Clean up old detections (remove trackers not seen for 3 seconds)
    setDetectedTrackers((prev) => {
      const currentTime = Date.now();
      const CLEANUP_THRESHOLD = 3000; // 3 seconds
      return prev.filter((t) => currentTime - t.lastSeen < CLEANUP_THRESHOLD);
    });
  }, [isActive, videoRef, config]);

  useEffect(() => {
    if (!isActive) {
      setDetectedTrackers([]);
      return;
    }

    const interval = setInterval(scanForQRCodes, 100); // Scan 10 times per second
    return () => clearInterval(interval);
  }, [isActive, scanForQRCodes]);

  useEffect(() => {
    const newAlignment = calculateAlignment(detectedTrackers);
    setAlignmentStatus(newAlignment);
    onAlignmentChange?.(newAlignment);
  }, [detectedTrackers, calculateAlignment, onAlignmentChange]);

  const renderOverlay = () => {
    if (!isActive || !canvasRef.current) return null;

    const canvasWidth = canvasRef.current.width || 640;
    const canvasHeight = canvasRef.current.height || 480;

    // Calculate target positions for QR trackers optimized for A4 page detection
    // A4 aspect ratio is 1:√2 (≈1:1.414), so we adjust positioning accordingly
    const aspectRatio = canvasWidth / canvasHeight;
    const isLandscape = aspectRatio > 1;

    // For A4 pages, QR codes should be positioned with proper margins
    const marginX = isLandscape ? 0.15 : 0.18; // Adjust for A4 proportions
    const marginY = isLandscape ? 0.18 : 0.15;

    const targetPositions = {
      topLeft: { x: canvasWidth * marginX, y: canvasHeight * marginY },
      topRight: { x: canvasWidth * (1 - marginX), y: canvasHeight * marginY },
      bottomLeft: { x: canvasWidth * marginX, y: canvasHeight * (1 - marginY) },
      bottomRight: {
        x: canvasWidth * (1 - marginX),
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
        {/* Target positions (ghost indicators where QR codes should be) */}
        {Object.entries(targetPositions).map(([position, targetPos]) => {
          const tracker = detectedTrackers.find((t) => t.position === position);
          const isDetected = !!tracker;
          const isStale = tracker && Date.now() - tracker.lastSeen > 2000;

          return (
            <Box
              key={`target-${position}`}
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
              {position === "topLeft" &&
                (isStale ? "⚠" : isDetected ? "✓" : "TL")}
              {position === "topRight" &&
                (isStale ? "⚠" : isDetected ? "✓" : "TR")}
              {position === "bottomLeft" &&
                (isStale ? "⚠" : isDetected ? "✓" : "BL")}
              {position === "bottomRight" &&
                (isStale ? "⚠" : isDetected ? "✓" : "BR")}
            </Box>
          );
        })}

        {/* Real-time tracker indicators - show current position and movement direction */}
        {detectedTrackers.map((tracker) => {
          const targetPos = targetPositions[tracker.position];
          const currentPos = tracker.center;

          // Calculate direction vector from current to target
          const dx = targetPos.x - currentPos.x;
          const dy = targetPos.y - currentPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const isAligned = distance < 25; // Within 25px is considered aligned

          // Calculate angle for arrow direction
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

          return (
            <Box key={`tracker-${tracker.position}`}>
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
                {tracker.position === "topLeft" && "TL"}
                {tracker.position === "topRight" && "TR"}
                {tracker.position === "bottomLeft" && "BL"}
                {tracker.position === "bottomRight" && "BR"}
              </Box>

              {/* Movement direction arrow - only show if not aligned */}
              {!isAligned && (
                <Box
                  sx={{
                    position: "absolute",
                    left: `${(currentPos.x / canvasWidth) * 100}%`,
                    top: `${(currentPos.y / canvasHeight) * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                    width: Math.min(distance * 0.6, 80), // Arrow length based on distance, max 80px
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

              {/* Connection line from current to target position */}
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

        {/* Connection lines between detected trackers */}
        {detectedTrackers.length >= 3 && (
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            {(() => {
              const topLeft = detectedTrackers.find(
                (t) => t.position === "topLeft",
              );
              const topRight = detectedTrackers.find(
                (t) => t.position === "topRight",
              );
              const bottomLeft = detectedTrackers.find(
                (t) => t.position === "bottomLeft",
              );
              const bottomRight = detectedTrackers.find(
                (t) => t.position === "bottomRight",
              );

              const lines = [];

              if (topLeft && topRight) {
                lines.push(
                  <line
                    key="top-line"
                    x1={`${(topLeft.center.x / canvasWidth) * 100}%`}
                    y1={`${(topLeft.center.y / canvasHeight) * 100}%`}
                    x2={`${(topRight.center.x / canvasWidth) * 100}%`}
                    y2={`${(topRight.center.y / canvasHeight) * 100}%`}
                    stroke="#4CAF50"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />,
                );
              }

              if (topLeft && bottomLeft) {
                lines.push(
                  <line
                    key="left-line"
                    x1={`${(topLeft.center.x / canvasWidth) * 100}%`}
                    y1={`${(topLeft.center.y / canvasHeight) * 100}%`}
                    x2={`${(bottomLeft.center.x / canvasWidth) * 100}%`}
                    y2={`${(bottomLeft.center.y / canvasHeight) * 100}%`}
                    stroke="#4CAF50"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />,
                );
              }

              if (topRight && bottomRight) {
                lines.push(
                  <line
                    key="right-line"
                    x1={`${(topRight.center.x / canvasWidth) * 100}%`}
                    y1={`${(topRight.center.y / canvasHeight) * 100}%`}
                    x2={`${(bottomRight.center.x / canvasWidth) * 100}%`}
                    y2={`${(bottomRight.center.y / canvasHeight) * 100}%`}
                    stroke="#4CAF50"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />,
                );
              }

              if (bottomLeft && bottomRight) {
                lines.push(
                  <line
                    key="bottom-line"
                    x1={`${(bottomLeft.center.x / canvasWidth) * 100}%`}
                    y1={`${(bottomLeft.center.y / canvasHeight) * 100}%`}
                    x2={`${(bottomRight.center.x / canvasWidth) * 100}%`}
                    y2={`${(bottomRight.center.y / canvasHeight) * 100}%`}
                    stroke="#4CAF50"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />,
                );
              }

              return lines;
            })()}
          </svg>
        )}

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

        {/* Top notification area - alignment status */}
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
              ⚠ Trackers moved: {alignmentStatus.staleTrackers.join(", ")}
            </Box>
          ) : alignmentStatus.missingTrackers.length > 0 ? (
            <Box
              sx={{
                bgcolor: "rgba(255, 152, 0, 0.9)",
                color: "white",
                px: 2,
                py: 1,
                borderRadius: 1,
                fontSize: "12px",
                fontWeight: "bold",
                backdropFilter: "blur(4px)",
                textAlign: "center",
              }}
            >
              🔍 Missing: {alignmentStatus.missingTrackers.join(", ")}
              <br />
              <span style={{ fontSize: "10px" }}>
                Detected: {detectedTrackers.length}/4
              </span>
            </Box>
          ) : (
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
              }}
            >
              🔄 Tracking... ({detectedTrackers.length}/4)
            </Box>
          )}
        </Box>

        {/* Bottom instruction area - movement guidance */}
        {!alignmentStatus.isAligned && (
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              bottom: "20px",
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              bgcolor: "rgba(0, 0, 0, 0.7)",
              color: "white",
              px: 2,
              py: 1,
              borderRadius: 1,
              backdropFilter: "blur(4px)",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            {Math.abs(alignmentStatus.translation.x) > 50 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                {alignmentStatus.translation.x > 0 ? "←" : "→"}
                <span>
                  Move {alignmentStatus.translation.x > 0 ? "left" : "right"}
                </span>
              </Box>
            )}

            {Math.abs(alignmentStatus.translation.y) > 50 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                {alignmentStatus.translation.y > 0 ? "↑" : "↓"}
                <span>
                  Move {alignmentStatus.translation.y > 0 ? "up" : "down"}
                </span>
              </Box>
            )}

            {Math.abs(alignmentStatus.rotation) > 10 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                ↻
                <span>
                  Rotate {alignmentStatus.rotation > 0 ? "left" : "right"}
                </span>
              </Box>
            )}

            {Math.abs(alignmentStatus.scale - 1) > 0.2 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                {alignmentStatus.scale > 1 ? "🔍−" : "🔍+"}
                <span>
                  {alignmentStatus.scale > 1 ? "Move back" : "Move closer"}
                </span>
              </Box>
            )}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box
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
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {renderOverlay()}
    </Box>
  );
}
