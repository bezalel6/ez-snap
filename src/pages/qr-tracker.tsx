import Head from "next/head";
import { useState, useRef, useCallback } from "react";
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  Stack,
  Alert,
  Chip,
  Fab,
} from "@mui/material";
import {
  ArrowBack,
  QrCode,
  Settings,
  CameraAlt,
  Science,
} from "@mui/icons-material";
import Webcam from "react-webcam";
import { useRouter } from "next/router";
import QRTrackerOverlay from "@/components/QRTrackerOverlay";
import AutoCaptureOverlay from "@/components/AutoCaptureOverlay";
import { TrackerID, A4_DIMENSIONS } from "@/utils/config";
import type { AlignmentStatus, DetectedCone } from "@/utils/config";
import type { ScanSession } from "@/utils/autoCapture";
import { ImageProcessor } from "@/utils/imageProcessor";
import type { ProcessingResult } from "@/utils/imageProcessor";

export default function QRTracker() {
  const router = useRouter();
  const webcamRef = useRef<Webcam>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isTrackerActive, setIsTrackerActive] = useState(false);
  const [isAutoScanActive, setIsAutoScanActive] = useState(false);
  const [alignmentStatus, setAlignmentStatus] =
    useState<AlignmentStatus | null>(null);
  const [detectedCones, setDetectedCones] = useState<DetectedCone[]>([]);
  const [detectedTrackers, setDetectedTrackers] = useState<any[]>([]);
  const [currentScanSession, setCurrentScanSession] =
    useState<ScanSession | null>(null);
  const [processingResult, setProcessingResult] =
    useState<ProcessingResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "environment",
  };

  const handleAlignmentChange = useCallback(
    (status: AlignmentStatus, trackers?: any[]) => {
      setAlignmentStatus(status);
      if (trackers) {
        setDetectedTrackers(trackers);
      }
    },
    [],
  );

  const handleScanComplete = useCallback(async (session: ScanSession) => {
    setCurrentScanSession(session);

    if (session.isComplete) {
      setIsProcessing(true);
      try {
        const processor = new ImageProcessor();
        const result = await processor.processScanSession(session);
        setProcessingResult(result);
        setDetectedCones(result.cones);
      } catch (error) {
        console.error("Failed to process scan session:", error);
      } finally {
        setIsProcessing(false);
      }
    }
  }, []);

  const startCamera = useCallback(() => {
    setIsCameraActive(true);
    // Small delay to ensure webcam is ready
    setTimeout(() => {
      setIsTrackerActive(true);
    }, 1000);
  }, []);

  const stopCamera = useCallback(() => {
    setIsCameraActive(false);
    setIsTrackerActive(false);
    setIsAutoScanActive(false);
    setAlignmentStatus(null);
    setDetectedCones([]);
    setCurrentScanSession(null);
    setProcessingResult(null);
    setIsProcessing(false);
  }, []);

  const toggleAutoScan = () => {
    setIsAutoScanActive(!isAutoScanActive);
    if (isAutoScanActive) {
      setDetectedCones([]);
      setCurrentScanSession(null);
      setProcessingResult(null);
    }
  };

  const getAlignmentInstructions = () => {
    if (!alignmentStatus) return "🎯 Initializing QR tracker detection...";

    if (alignmentStatus.isAligned) {
      return "🎉 Perfect alignment achieved! Your camera is precisely positioned.";
    }

    if (alignmentStatus.staleTrackers.length > 0) {
      return `⚠️ Some QR trackers moved or became unreadable: ${alignmentStatus.staleTrackers.join(", ")}. Please reposition or ensure clear visibility.`;
    }

    if (alignmentStatus.missingTrackers.length > 0) {
      return `🔍 Position your camera to see the ${alignmentStatus.missingTrackers.join(" and ")} QR tracker(s). Follow the on-screen indicators.`;
    }

    return "📐 Follow the visual guides overlaid on your camera view to align perfectly.";
  };

  return (
    <>
      <Head>
        <title>QR Tracker Detection & Cone Scanning - EZ Snap</title>
        <meta
          name="description"
          content="Precise alignment using QR code trackers and cone position detection"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, user-scalable=no"
        />
      </Head>

      <Box
        sx={{ flexGrow: 1, minHeight: "100vh", bgcolor: "background.default" }}
      >
        <AppBar position="static" elevation={0}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => router.push("/")}
              sx={{ mr: 2 }}
            >
              <ArrowBack />
            </IconButton>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              QR Tracker & Cone Detection
            </Typography>
            <IconButton
              color="inherit"
              onClick={() => router.push("/qr-generator")}
            >
              <QrCode />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container maxWidth="md" sx={{ py: 2 }}>
          {!isCameraActive ? (
            // Welcome Screen
            <Box sx={{ textAlign: "center", mt: 4 }}>
              <Typography variant="h4" gutterBottom color="primary">
                🎯 QR Tracker & Cone Detection
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Use QR code trackers for precise alignment and scan magnetic
                cone positions with millimeter accuracy
              </Typography>

              <Card sx={{ maxWidth: 500, mx: "auto", mb: 4 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    System Configuration
                  </Typography>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography>QR Tracker Grid:</Typography>
                      <Chip label="4 corners (QR_01-04)" size="small" />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography>Surface Size:</Typography>
                      <Chip
                        label={`${A4_DIMENSIONS.PORTRAIT.width}×${A4_DIMENSIONS.PORTRAIT.height}px (A4)`}
                        size="small"
                      />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography>Cone Height:</Typography>
                      <Chip label="46.41mm" size="small" />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography>Coordinate System:</Typography>
                      <Chip label="Surface mm (X,Y)" size="small" />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Alert severity="info" sx={{ mb: 4, maxWidth: 500, mx: "auto" }}>
                <Typography variant="body2">
                  <strong>Scanning Workflow:</strong>
                  <br />
                  1. 📋 Generate and print QR tracker reference sheet
                  <br />
                  2. 📹 Start camera and achieve perfect QR alignment
                  <br />
                  3. 🎯 Initialize cone scanning mode
                  <br />
                  4. 🔺 Place magnetic pegs on surface for detection
                  <br />
                  5. 📊 Get precise X,Y coordinates in millimeters
                </Typography>
              </Alert>

              <Stack direction="row" spacing={2} justifyContent="center">
                <Button
                  variant="outlined"
                  onClick={() => router.push("/qr-generator")}
                  startIcon={<QrCode />}
                >
                  Generate QR Codes
                </Button>
                <Button
                  variant="contained"
                  size="large"
                  onClick={startCamera}
                  startIcon={<CameraAlt />}
                >
                  Start Tracking & Scanning
                </Button>
              </Stack>
            </Box>
          ) : (
            // Camera View with Tracker Overlay
            <Box>
              {/* Camera Controls */}
              <Paper sx={{ p: 2, mb: 2 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  flexWrap="wrap"
                  gap={1}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={isTrackerActive}
                          onChange={(e) => setIsTrackerActive(e.target.checked)}
                        />
                      }
                      label="QR Tracking"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={isAutoScanActive}
                          onChange={toggleAutoScan}
                          disabled={!alignmentStatus?.isAligned}
                        />
                      }
                      label="Auto-Scan"
                    />
                  </Stack>
                  <Button
                    variant="outlined"
                    onClick={stopCamera}
                    color="secondary"
                  >
                    Stop Camera
                  </Button>
                </Stack>
              </Paper>

              {/* Alignment Instructions */}
              {alignmentStatus && (
                <Alert
                  severity={
                    alignmentStatus.isAligned
                      ? "success"
                      : isAutoScanActive
                        ? "warning"
                        : "info"
                  }
                  sx={{ mb: 2 }}
                >
                  <Typography variant="body2">
                    {getAlignmentInstructions()}
                    {isAutoScanActive && alignmentStatus.isAligned && (
                      <span>
                        {" "}
                        🤖 Auto-scan is active - move device as guided for
                        automatic capture.
                      </span>
                    )}
                  </Typography>
                </Alert>
              )}

              {/* Detected Cones Summary */}
              {detectedCones.length > 0 && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    📍 Detected Cone Positions
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {detectedCones
                      .filter((cone) => cone.surfacePosition)
                      .map((cone, index) => (
                        <Chip
                          key={cone.id}
                          label={`Cone ${index + 1}: (${Math.round(cone.surfacePosition!.x)}, ${Math.round(cone.surfacePosition!.y)})mm`}
                          color="success"
                          size="small"
                          icon={<Science />}
                        />
                      ))}
                  </Stack>
                  {detectedCones.some((cone) => !cone.surfacePosition) && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      Note: Some cones don't have surface coordinates yet.
                      Ensure QR trackers are properly aligned.
                    </Typography>
                  )}
                </Paper>
              )}

              {/* Camera with Overlays */}
              <Paper
                sx={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 2,
                }}
              >
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  videoConstraints={videoConstraints}
                  style={{ width: "100%", height: "auto", display: "block" }}
                  onLoadedData={() => {
                    // Access the video element from the webcam
                    if (webcamRef.current?.video) {
                      videoRef.current = webcamRef.current.video;
                    }
                  }}
                />

                {/* QR Tracker Overlay */}
                {isTrackerActive && videoRef.current && (
                  <QRTrackerOverlay
                    videoRef={videoRef as React.RefObject<HTMLVideoElement>}
                    isActive={isTrackerActive}
                    targetDimensions={A4_DIMENSIONS.PORTRAIT}
                    onAlignmentChange={handleAlignmentChange}
                  />
                )}

                {/* Auto-Capture Overlay */}
                {isAutoScanActive && videoRef.current && alignmentStatus && (
                  <AutoCaptureOverlay
                    videoRef={videoRef as React.RefObject<HTMLVideoElement>}
                    detectedTrackers={detectedTrackers}
                    alignmentStatus={alignmentStatus}
                    isActive={isAutoScanActive}
                    onScanComplete={handleScanComplete}
                  />
                )}
              </Paper>

              {/* Status Information */}
              {alignmentStatus && (
                <Paper sx={{ p: 2, mt: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    System Status
                  </Typography>
                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <Chip
                      label={`Trackers: ${4 - alignmentStatus.missingTrackers.length}/4`}
                      color={
                        alignmentStatus.missingTrackers.length === 0
                          ? "success"
                          : "warning"
                      }
                      size="small"
                    />
                    <Chip
                      label={`Alignment: ${alignmentStatus.isAligned ? "Perfect" : "Needs adjustment"}`}
                      color={alignmentStatus.isAligned ? "success" : "warning"}
                      size="small"
                    />
                    <Chip
                      label={`Auto-Scan: ${isAutoScanActive ? "Active" : "Inactive"}`}
                      color={isAutoScanActive ? "success" : "default"}
                      size="small"
                    />
                    <Chip
                      label={`Detected Cones: ${detectedCones.length}`}
                      color={detectedCones.length > 0 ? "success" : "default"}
                      size="small"
                    />
                  </Stack>
                </Paper>
              )}
            </Box>
          )}
        </Container>

        {/* Floating Action Button for Quick Auto-Scan Toggle */}
        {isCameraActive && alignmentStatus?.isAligned && (
          <Fab
            color={isAutoScanActive ? "secondary" : "primary"}
            sx={{
              position: "fixed",
              bottom: 80,
              right: 20,
              zIndex: 1000,
            }}
            onClick={toggleAutoScan}
          >
            <Science />
          </Fab>
        )}
      </Box>
    </>
  );
}
