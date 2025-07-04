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
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
} from "@mui/material";
import {
  ArrowBack,
  CameraAlt,
  ExpandMore,
  BugReport,
  Visibility,
  ThreeDRotation,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import Webcam from "react-webcam";
import { useRouter } from "next/router";
import ArUcoDebugOverlay from "@/components/ArUcoDebugOverlay";
import type { ArUcoDebugSettings, DetectedArUcoMarker } from "@/types/aruco";

export default function ArUcoDebug() {
  const router = useRouter();
  const webcamRef = useRef<Webcam>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isDetectionActive, setIsDetectionActive] = useState(false);
  const [detectedMarkers, setDetectedMarkers] = useState<DetectedArUcoMarker[]>([]);
  const [debugSettings, setDebugSettings] = useState<ArUcoDebugSettings>({
    showMarkerIds: true,
    showMarkerCorners: true,
    showMarkerAxes: true,
    showThreshold: false,
    showContours: false,
    thresholdValue: 128,
    enablePoseEstimation: true,
    markerSize: 100, // mm
  });

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "environment",
  };

  const handleMarkersDetected = useCallback((markers: DetectedArUcoMarker[]) => {
    setDetectedMarkers(markers);
  }, []);

  const startCamera = useCallback(() => {
    setIsCameraActive(true);
    setTimeout(() => {
      setIsDetectionActive(true);
    }, 1000);
  }, []);

  const stopCamera = useCallback(() => {
    setIsCameraActive(false);
    setIsDetectionActive(false);
    setDetectedMarkers([]);
  }, []);

  const updateDebugSetting = useCallback(
    <K extends keyof ArUcoDebugSettings>(
      key: K,
      value: ArUcoDebugSettings[K]
    ) => {
      setDebugSettings(prev => ({ ...prev, [key]: value }));
    },
    []
  );

  const getDetectionStatus = () => {
    if (!isDetectionActive) return "⏸️ Detection paused";
    if (detectedMarkers.length === 0) return "🔍 Scanning for markers...";
    return `✅ ${detectedMarkers.length} marker${detectedMarkers.length !== 1 ? 's' : ''} detected`;
  };

  return (
    <>
      <Head>
        <title>ArUco Debug - EZ Snap</title>
        <meta
          name="description"
          content="Advanced ArUco marker detection and debugging interface"
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
              ArUco Debugger
            </Typography>
            <BugReport />
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ py: 2 }}>
          {!isCameraActive ? (
            // Welcome Screen
            <Box sx={{ textAlign: "center", mt: 4 }}>
              <Typography variant="h4" gutterBottom color="primary">
                🔬 ArUco Marker Debugger
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Advanced debugging interface for ArUco marker detection and pose estimation
              </Typography>

              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        📐 Detection Features
                      </Typography>
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography>Dictionary:</Typography>
                          <Chip label="ARUCO_MIP_36h12" size="small" />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography>Marker Range:</Typography>
                          <Chip label="ID 0-249" size="small" />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography>Grid Size:</Typography>
                          <Chip label="8×8 bits" size="small" />
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography>Error Correction:</Typography>
                          <Chip label="Hamming 12" size="small" />
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        🎯 Debug Capabilities
                      </Typography>
                      <Stack spacing={1}>
                        <Chip
                          icon={<Visibility />}
                          label="Real-time marker detection"
                          variant="outlined"
                          size="small"
                        />
                        <Chip
                          icon={<ThreeDRotation />}
                          label="3D pose estimation"
                          variant="outlined"
                          size="small"
                        />
                        <Chip
                          icon={<BugReport />}
                          label="Visual debugging overlays"
                          variant="outlined"
                          size="small"
                        />
                        <Chip
                          icon={<SettingsIcon />}
                          label="Threshold visualization"
                          variant="outlined"
                          size="small"
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Alert severity="info" sx={{ mb: 4, maxWidth: 600, mx: "auto" }}>
                <Typography variant="body2">
                  <strong>Usage Instructions:</strong>
                  <br />
                  1. Print ArUco markers from online generators
                  <br />
                  2. Start camera and enable detection
                  <br />
                  3. Point camera at printed markers
                  <br />
                  4. Use debug controls to analyze detection pipeline
                </Typography>
              </Alert>

              <Button
                variant="contained"
                size="large"
                onClick={startCamera}
                startIcon={<CameraAlt />}
                sx={{ py: 1.5, px: 4 }}
              >
                Start ArUco Detection
              </Button>
            </Box>
          ) : (
            // Debug Interface
            <Grid container spacing={2}>
              {/* Main Camera View */}
              <Grid size={{ xs: 12, lg: 8 }}>
                <Stack spacing={2}>
                  {/* Camera Controls */}
                  <Paper sx={{ p: 2 }}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <FormControlLabel
                        control={
                          <Switch
                            checked={isDetectionActive}
                            onChange={(e) => setIsDetectionActive(e.target.checked)}
                          />
                        }
                        label="ArUco Detection"
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

                  {/* Detection Status */}
                  <Alert
                    severity={
                      detectedMarkers.length > 0 ? "success" : isDetectionActive ? "info" : "warning"
                    }
                  >
                    <Typography variant="body2">
                      {getDetectionStatus()}
                    </Typography>
                  </Alert>

                  {/* Camera with ArUco Overlay */}
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
                        if (webcamRef.current?.video) {
                          videoRef.current = webcamRef.current.video;
                        }
                      }}
                    />

                    {isDetectionActive && videoRef.current && (
                      <ArUcoDebugOverlay
                        videoRef={videoRef as React.RefObject<HTMLVideoElement>}
                        isActive={isDetectionActive}
                        settings={debugSettings}
                        onMarkersDetected={handleMarkersDetected}
                      />
                    )}
                  </Paper>
                </Stack>
              </Grid>

              {/* Debug Controls Sidebar */}
              <Grid size={{ xs: 12, lg: 4 }}>
                <Stack spacing={2}>
                  {/* Detection Results */}
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      📊 Detection Results
                    </Typography>
                    {detectedMarkers.length > 0 ? (
                      <Stack spacing={1}>
                        {detectedMarkers.map((marker, index) => (
                          <Card key={`result-${marker.id}-${index}`} variant="outlined">
                            <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body2" fontWeight="bold">
                                  Marker {marker.id}
                                </Typography>
                                <Chip
                                  label={`${Math.round(marker.confidence * 100)}%`}
                                  size="small"
                                  color="success"
                                />
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                Center: ({Math.round(marker.center.x)}, {Math.round(marker.center.y)})
                              </Typography>
                              {marker.pose && (
                                <Typography variant="caption" display="block" color="text.secondary">
                                  Pose Error: {marker.pose.bestError.toFixed(2)}
                                </Typography>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No markers detected
                      </Typography>
                    )}
                  </Paper>

                  {/* Debug Settings */}
                  <Paper sx={{ p: 0 }}>
                    <Accordion defaultExpanded>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Typography variant="h6">🔧 Visual Debug Settings</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Stack spacing={2}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={debugSettings.showMarkerIds}
                                onChange={(e) =>
                                  updateDebugSetting("showMarkerIds", e.target.checked)
                                }
                              />
                            }
                            label="Show Marker IDs"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={debugSettings.showMarkerCorners}
                                onChange={(e) =>
                                  updateDebugSetting("showMarkerCorners", e.target.checked)
                                }
                              />
                            }
                            label="Show Marker Corners"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={debugSettings.showMarkerAxes}
                                onChange={(e) =>
                                  updateDebugSetting("showMarkerAxes", e.target.checked)
                                }
                              />
                            }
                            label="Show 3D Axes"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={debugSettings.showThreshold}
                                onChange={(e) =>
                                  updateDebugSetting("showThreshold", e.target.checked)
                                }
                              />
                            }
                            label="Show Threshold"
                          />
                        </Stack>
                      </AccordionDetails>
                    </Accordion>

                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Typography variant="h6">⚙️ Detection Parameters</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Stack spacing={3}>
                          <Box>
                            <Typography gutterBottom>
                              Threshold: {debugSettings.thresholdValue}
                            </Typography>
                            <Slider
                              value={debugSettings.thresholdValue}
                              onChange={(_, value) =>
                                updateDebugSetting("thresholdValue", value as number)
                              }
                              min={50}
                              max={200}
                              sx={{ color: "primary.main" }}
                            />
                          </Box>

                          <Box>
                            <Typography gutterBottom>
                              Marker Size: {debugSettings.markerSize}mm
                            </Typography>
                            <Slider
                              value={debugSettings.markerSize}
                              onChange={(_, value) =>
                                updateDebugSetting("markerSize", value as number)
                              }
                              min={10}
                              max={500}
                              sx={{ color: "primary.main" }}
                            />
                          </Box>

                          <FormControlLabel
                            control={
                              <Switch
                                checked={debugSettings.enablePoseEstimation}
                                onChange={(e) =>
                                  updateDebugSetting("enablePoseEstimation", e.target.checked)
                                }
                              />
                            }
                            label="Enable Pose Estimation"
                          />
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  </Paper>
                </Stack>
              </Grid>
            </Grid>
          )}
        </Container>
      </Box>
    </>
  );
}