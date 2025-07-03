import { useEffect, useRef, useState, useCallback } from "react";
import { Box, Typography, Chip, Button, Stack, LinearProgress, Alert } from "@mui/material";
import { AutoCaptureManager } from "@/utils/autoCapture";
import type { ScanSession } from "@/utils/autoCapture";
import type {
  DetectedTracker,
  AlignmentStatus,
} from "@/utils/config";

interface AutoCaptureOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  detectedTrackers: DetectedTracker[];
  alignmentStatus: AlignmentStatus;
  isActive: boolean;
  onScanComplete?: (session: ScanSession) => void;
}

export default function AutoCaptureOverlay({
  videoRef,
  detectedTrackers,
  alignmentStatus,
  isActive,
  onScanComplete,
}: AutoCaptureOverlayProps) {
  const [currentSession, setCurrentSession] = useState<ScanSession | null>(null);
  const [captureStatus, setCaptureStatus] = useState<{ shouldCapture: boolean; reason: string }>({
    shouldCapture: false,
    reason: 'Initializing...'
  });
  const [isFlashing, setIsFlashing] = useState(false);
  
  // Auto-capture manager
  const autoCaptureManager = useRef<AutoCaptureManager>(new AutoCaptureManager());

  // Subscribe to capture events
  useEffect(() => {
    const manager = autoCaptureManager.current;
    
    const handleCapture = (session: ScanSession) => {
      setCurrentSession({ ...session });
      
      // Flash effect for capture
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 200);
      
      if (session.isComplete && onScanComplete) {
        onScanComplete(session);
      }
    };

    manager.onCapture(handleCapture);
    
    return () => {
      // Cleanup would go here if manager supported unsubscribe
    };
  }, [onScanComplete]);

  // Auto-capture processing loop
  useEffect(() => {
    if (!isActive || !videoRef.current || !currentSession) return;

    const interval = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      const manager = autoCaptureManager.current;
      const status = manager.processAlignment(alignmentStatus, detectedTrackers, video);
      setCaptureStatus(status);

      if (status.shouldCapture) {
        const success = await manager.executeCapture(video, alignmentStatus, detectedTrackers);
        if (success) {
          const updatedSession = manager.getCurrentSession();
          if (updatedSession) {
            setCurrentSession({ ...updatedSession });
          }
        }
      }
    }, 100); // Check 10 times per second

    return () => clearInterval(interval);
  }, [isActive, videoRef, alignmentStatus, detectedTrackers, currentSession]);

  const startScanning = () => {
    if (!alignmentStatus.isAligned) return;
    
    const session = autoCaptureManager.current.startSession();
    setCurrentSession(session);
  };

  const stopScanning = () => {
    autoCaptureManager.current.reset();
    setCurrentSession(null);
    setCaptureStatus({ shouldCapture: false, reason: 'Scanning stopped' });
  };

  const canStartScanning = alignmentStatus.isAligned && detectedTrackers.length >= 4;
  const isScanning = currentSession && !currentSession.isComplete;

  if (!isActive) return null;

  return (
    <>
      {/* Flash overlay for captures */}
      {isFlashing && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            bgcolor: "rgba(255, 255, 255, 0.8)",
            zIndex: 100,
            pointerEvents: "none",
            animation: "flash 0.2s ease-out",
            "@keyframes flash": {
              "0%": { opacity: 0 },
              "50%": { opacity: 1 },
              "100%": { opacity: 0 },
            },
          }}
        />
      )}

      {/* Main overlay UI */}
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
        {/* Movement guidance indicator */}
        {isScanning && (
          <Box
            sx={{
              position: "absolute",
              top: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              bgcolor: "rgba(0, 0, 0, 0.8)",
              color: "white",
              px: 3,
              py: 2,
              borderRadius: 2,
              backdropFilter: "blur(4px)",
              textAlign: "center",
              maxWidth: "80%",
              zIndex: 25,
            }}
          >
            <Typography variant="h6" gutterBottom>
              📸 Auto-Capture Active
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {currentSession?.userInstructions || 'Loading...'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Status: {captureStatus.reason}
            </Typography>
          </Box>
        )}

        {/* Progress indicator */}
        {currentSession && (
          <Box
            sx={{
              position: "absolute",
              top: "120px",
              left: "50%",
              transform: "translateX(-50%)",
              bgcolor: "rgba(0, 0, 0, 0.8)",
              color: "white",
              px: 2,
              py: 1.5,
              borderRadius: 1,
              backdropFilter: "blur(4px)",
              minWidth: "200px",
              zIndex: 25,
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">Progress</Typography>
                <Typography variant="body2">
                  {currentSession.capturesCompleted}/{currentSession.totalCapturesNeeded}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={(currentSession.capturesCompleted / currentSession.totalCapturesNeeded) * 100}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: "rgba(255,255,255,0.2)",
                  "& .MuiLinearProgress-bar": {
                    bgcolor: currentSession.isComplete ? "#4CAF50" : "#2196F3",
                  },
                }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "10px" }}>
                Confidence: {Math.round(currentSession.confidenceScore * 100)}%
              </Typography>
            </Stack>
          </Box>
        )}

        {/* Capture positions visualization */}
        {currentSession && (
          <Box
            sx={{
              position: "absolute",
              bottom: "120px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 1,
              flexWrap: "wrap",
              justifyContent: "center",
              zIndex: 25,
            }}
          >
            {currentSession.positions.map((position) => (
              <Chip
                key={position.id}
                label={position.name}
                size="small"
                color={position.captured ? "success" : "default"}
                variant={position.captured ? "filled" : "outlined"}
                sx={{
                  bgcolor: position.captured ? "rgba(76, 175, 80, 0.8)" : "rgba(0, 0, 0, 0.6)",
                  color: "white",
                  backdropFilter: "blur(2px)",
                  "& .MuiChip-label": {
                    fontSize: "10px",
                  },
                }}
              />
            ))}
          </Box>
        )}

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
            minWidth: 280,
          }}
        >
          <Stack spacing={1} alignItems="center">
            <Typography variant="h6" color="white" sx={{ mb: 1 }}>
              🤖 Auto-Capture System
            </Typography>
            
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
              <Chip
                label={`Trackers: ${detectedTrackers.length}/4`}
                color={alignmentStatus.isAligned ? "success" : "warning"}
                size="small"
              />
              {currentSession && (
                <Chip
                  label={`Captures: ${currentSession.capturesCompleted}/${currentSession.totalCapturesNeeded}`}
                  color={currentSession.isComplete ? "success" : "primary"}
                  size="small"
                />
              )}
              <Chip
                label={captureStatus.shouldCapture ? "Ready to Capture" : "Waiting"}
                color={captureStatus.shouldCapture ? "success" : "default"}
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

            {currentSession?.isComplete && (
              <Alert severity="success" sx={{ width: "100%" }}>
                <Typography variant="body2">
                  🎉 Scan complete! {currentSession.capturesCompleted} images captured with {Math.round(currentSession.confidenceScore * 100)}% confidence.
                </Typography>
              </Alert>
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
                  🚀 Start Auto-Scan
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
                📱 Move your device as guided - the system will capture automatically when conditions are optimal!
              </Typography>
            )}
          </Stack>
        </Box>
      </Box>
    </>
  );
} 
