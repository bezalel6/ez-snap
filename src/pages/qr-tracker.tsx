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
} from "@mui/material";
import { ArrowBack, QrCode, Settings, CameraAlt } from "@mui/icons-material";
import Webcam from "react-webcam";
import { useRouter } from "next/router";
import QRTrackerOverlay from "@/components/QRTrackerOverlay";

interface AlignmentStatus {
  isAligned: boolean;
  translation: { x: number; y: number };
  rotation: number;
  scale: number;
  missingTrackers: string[];
}

export default function QRTracker() {
  const router = useRouter();
  const webcamRef = useRef<Webcam>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isTrackerActive, setIsTrackerActive] = useState(false);
  const [alignmentStatus, setAlignmentStatus] = useState<AlignmentStatus | null>(null);
  
  // Default tracker configuration for A4 page
  const [trackerConfig] = useState({
    topLeft: "TL_TRACKER_001",
    topRight: "TR_TRACKER_002",
    bottomLeft: "BL_TRACKER_003",
    targetRectangle: {
      width: 595,  // A4 width at 72 DPI (210mm)
      height: 842, // A4 height at 72 DPI (297mm)
    },
  });

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "environment",
  };

  const handleAlignmentChange = useCallback((status: AlignmentStatus) => {
    setAlignmentStatus(status);
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
    setAlignmentStatus(null);
  }, []);

  const getAlignmentInstructions = () => {
    if (!alignmentStatus) return "🎯 Initializing QR tracker detection...";
    
    if (alignmentStatus.isAligned) {
      return "🎉 Perfect alignment achieved! Your camera is precisely positioned.";
    }

    if (alignmentStatus.missingTrackers.length > 0) {
      return `🔍 Position your camera to see the ${alignmentStatus.missingTrackers.join(' and ')} QR tracker(s). Follow the on-screen indicators.`;
    }

    return "� Follow the visual guides overlaid on your camera view to align perfectly.";
  };

  return (
    <>
      <Head>
        <title>QR Tracker Detection - EZ Snap</title>
        <meta name="description" content="Precise alignment using QR code trackers" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
      </Head>

      <Box sx={{ flexGrow: 1, minHeight: "100vh", bgcolor: "background.default" }}>
        <AppBar position="static" elevation={0}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => router.push('/')}
              sx={{ mr: 2 }}
            >
              <ArrowBack />
            </IconButton>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              QR Tracker Detection
            </Typography>
            <IconButton
              color="inherit"
              onClick={() => router.push('/qr-generator')}
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
                 🎯 QR Tracker Detection
               </Typography>
               <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                 Use QR code trackers for precise A4 page alignment and camera positioning
               </Typography>

                              <Card sx={{ maxWidth: 500, mx: "auto", mb: 4 }}>
                 <CardContent>
                   <Typography variant="h6" gutterBottom>
                     A4 Page Tracker Configuration
                   </Typography>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography>Top Left:</Typography>
                      <Chip label={trackerConfig.topLeft} size="small" />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography>Top Right:</Typography>
                      <Chip label={trackerConfig.topRight} size="small" />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography>Bottom Left:</Typography>
                      <Chip label={trackerConfig.bottomLeft} size="small" />
                    </Stack>
                                         <Stack direction="row" justifyContent="space-between">
                       <Typography>A4 Page Size:</Typography>
                       <Chip 
                         label={`${trackerConfig.targetRectangle.width}×${trackerConfig.targetRectangle.height}px (210×297mm)`} 
                         size="small" 
                       />
                     </Stack>
                  </Stack>
                </CardContent>
              </Card>

                             <Alert severity="info" sx={{ mb: 4, maxWidth: 500, mx: "auto" }}>
                 <Typography variant="body2">
                   <strong>A4 Page Setup Instructions:</strong><br />
                   1. Generate and print the QR tracker reference sheet<br />
                   2. Place QR codes at corners of your A4 document<br />
                   3. Start camera and follow the real-time overlay guidance<br />
                   4. Achieve perfect alignment for precise document capture
                 </Typography>
               </Alert>

              <Stack direction="row" spacing={2} justifyContent="center">
                <Button
                  variant="outlined"
                  onClick={() => router.push('/qr-generator')}
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
                  Start Tracking
                </Button>
              </Stack>
            </Box>
          ) : (
            // Camera View with Tracker Overlay
            <Box>
              {/* Camera Controls */}
              <Paper sx={{ p: 2, mb: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isTrackerActive}
                        onChange={(e) => setIsTrackerActive(e.target.checked)}
                      />
                    }
                    label="QR Tracker Detection"
                  />
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
                  severity={alignmentStatus.isAligned ? "success" : "info"} 
                  sx={{ mb: 2 }}
                >
                  <Typography variant="body2">
                    {getAlignmentInstructions()}
                  </Typography>
                </Alert>
              )}

              {/* Camera with Overlay */}
              <Paper sx={{ position: "relative", overflow: "hidden", borderRadius: 2 }}>
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
                     config={trackerConfig}
                     onAlignmentChange={handleAlignmentChange}
                   />
                 )}
              </Paper>

              {/* Status Information */}
              {alignmentStatus && (
                <Paper sx={{ p: 2, mt: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Alignment Details
                  </Typography>
                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <Chip
                      label={`Trackers: ${3 - alignmentStatus.missingTrackers.length}/3`}
                      color={alignmentStatus.missingTrackers.length === 0 ? "success" : "warning"}
                      size="small"
                    />
                    <Chip
                      label={`Offset: ${Math.round(alignmentStatus.translation.x)}, ${Math.round(alignmentStatus.translation.y)}px`}
                      color={Math.abs(alignmentStatus.translation.x) < 50 && Math.abs(alignmentStatus.translation.y) < 50 ? "success" : "warning"}
                      size="small"
                    />
                    <Chip
                      label={`Rotation: ${Math.round(alignmentStatus.rotation)}°`}
                      color={Math.abs(alignmentStatus.rotation) < 10 ? "success" : "warning"}
                      size="small"
                    />
                    <Chip
                      label={`Scale: ${Math.round(alignmentStatus.scale * 100)}%`}
                      color={Math.abs(alignmentStatus.scale - 1) < 0.2 ? "success" : "warning"}
                      size="small"
                    />
                  </Stack>
                </Paper>
              )}
            </Box>
          )}
        </Container>
      </Box>
    </>
  );
}