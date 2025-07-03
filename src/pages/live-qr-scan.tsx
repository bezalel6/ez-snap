import Head from "next/head";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Card,
  CardContent,
  Stack,
  Chip,
} from "@mui/material";
import {
  ArrowBack,
  QrCode2,
  PlayArrow,
  Stop,
  RotateRight,
  FlipToBack,
  Flip,
  RestartAlt,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import Webcam from "react-webcam";
import jsQR from "jsqr";

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

export default function LiveQRScan() {
  const router = useRouter();
  const webcamRef = useRef<Webcam>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const [isScanning, setIsScanning] = useState(false);
  const [detectedQRs, setDetectedQRs] = useState<DetectedQRCode[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);

  const fpsCounterRef = useRef(0);
  const lastFpsUpdate = useRef(Date.now());

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "environment",
  };

  const updateFPS = useCallback(() => {
    fpsCounterRef.current++;
    const now = Date.now();
    if (now - lastFpsUpdate.current >= 1000) {
      setFps(fpsCounterRef.current);
      fpsCounterRef.current = 0;
      lastFpsUpdate.current = now;
    }
  }, []);

  // Real QR detection using jsQR
  const detectQRPatterns = useCallback(
    (imageData: ImageData): DetectedQRCode | null => {
      const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (!qrResult) {
        return null;
      }

      // Convert jsQR result to our DetectedQRCode interface
      const detectedQR: DetectedQRCode = {
        id: `qr_${qrResult.data}_${Date.now()}`,
        data: qrResult.data,
        location: {
          topLeftCorner: qrResult.location.topLeftCorner,
          topRightCorner: qrResult.location.topRightCorner,
          bottomRightCorner: qrResult.location.bottomRightCorner,
          bottomLeftCorner: qrResult.location.bottomLeftCorner,
        },
        timestamp: Date.now(),
        confidence: 1.0, // jsQR doesn't provide confidence score
      };

      return detectedQR;
    },
    [],
  );

  const scanForQRCodes = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isScanning) {
      if (isScanning) {
        // If scanning is active but video isn't ready, keep trying
        animationFrameRef.current = requestAnimationFrame(scanForQRCodes);
      }
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanForQRCodes);
      return;
    }

    // Check if video dimensions are valid
    if (
      !video.videoWidth ||
      !video.videoHeight ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      animationFrameRef.current = requestAnimationFrame(scanForQRCodes);
      return;
    }

    // Set canvas size to match video (regardless of CSS transforms)
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Save the current canvas state
    ctx.save();

    // Apply transforms to the canvas context to match the video display
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Move to center for rotation
    ctx.translate(centerX, centerY);

    // Apply rotation
    if (rotation !== 0) {
      ctx.rotate((rotation * Math.PI) / 180);
    }

    // Apply flips
    ctx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);

    // Move back
    ctx.translate(-centerX, -centerY);

    // Draw video frame to canvas with transforms
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Restore the canvas state before getting image data
    ctx.restore();

    // Get image data for QR scanning - this should now work with the correct dimensions
    let imageData;
    try {
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (error) {
      console.warn("Failed to get image data, skipping frame:", error);
      animationFrameRef.current = requestAnimationFrame(scanForQRCodes);
      return;
    }

    // Detect QR patterns
    const qrCode = detectQRPatterns(imageData);

    // Clear previous overlay and redraw with transforms
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save state again for overlay drawing
    ctx.save();
    ctx.translate(centerX, centerY);
    if (rotation !== 0) {
      ctx.rotate((rotation * Math.PI) / 180);
    }
    ctx.scale(flipHorizontal ? -1 : 1, flipVertical ? -1 : 1);
    ctx.translate(-centerX, -centerY);

    // Draw video frame again
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (qrCode) {
      // Update detected QRs (keep only recent ones)
      setDetectedQRs((prev) => {
        const filtered = prev.filter((qr) => Date.now() - qr.timestamp < 2000);
        const existing = filtered.find((qr) => qr.data === qrCode.data);

        if (existing) {
          return filtered.map((qr) => (qr.data === qrCode.data ? qrCode : qr));
        } else {
          setScanCount((count) => count + 1);
          return [...filtered, qrCode];
        }
      });

      // Draw QR code overlay
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 3;
      ctx.fillStyle = "rgba(0, 255, 0, 0.2)";

      const {
        topLeftCorner,
        topRightCorner,
        bottomRightCorner,
        bottomLeftCorner,
      } = qrCode.location;

      ctx.beginPath();
      ctx.moveTo(topLeftCorner.x, topLeftCorner.y);
      ctx.lineTo(topRightCorner.x, topRightCorner.y);
      ctx.lineTo(bottomRightCorner.x, bottomRightCorner.y);
      ctx.lineTo(bottomLeftCorner.x, bottomLeftCorner.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw corner markers
      const drawCorner = (corner: { x: number; y: number }, size = 10) => {
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(corner.x - size / 2, corner.y - size / 2, size, size);
      };

      drawCorner(topLeftCorner);
      drawCorner(topRightCorner);
      drawCorner(bottomRightCorner);
      drawCorner(bottomLeftCorner);

      // Draw QR data text
      const centerX = (topLeftCorner.x + bottomRightCorner.x) / 2;
      const centerY = (topLeftCorner.y + bottomRightCorner.y) / 2;

      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.font = "16px Arial";
      ctx.textAlign = "center";

      const text =
        qrCode.data.length > 20
          ? qrCode.data.substring(0, 20) + "..."
          : qrCode.data;
      ctx.strokeText(text, centerX, centerY - 10);
      ctx.fillText(text, centerX, centerY - 10);
    }

    // Draw scanning grid overlay
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    const gridSize = 50;

    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Restore the canvas state
    ctx.restore();

    updateFPS();
    animationFrameRef.current = requestAnimationFrame(scanForQRCodes);
  }, [
    isScanning,
    updateFPS,
    detectQRPatterns,
    rotation,
    flipHorizontal,
    flipVertical,
  ]);

  const startScanning = useCallback(() => {
    setIsScanning(true);
    // Start scanning immediately and let the loop handle video readiness
    scanForQRCodes();
  }, [scanForQRCodes]);

  const stopScanning = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    setIsScanning(false);
    setDetectedQRs([]);
    setScanCount(0);
    setFps(0);
  }, []);

  const toggleRotation = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const toggleHorizontalFlip = useCallback(() => {
    setFlipHorizontal((prev) => !prev);
  }, []);

  const toggleVerticalFlip = useCallback(() => {
    setFlipVertical((prev) => !prev);
  }, []);

  const resetTransforms = useCallback(() => {
    setRotation(0);
    setFlipHorizontal(false);
    setFlipVertical(false);
  }, []);

  const getVideoTransform = useCallback(() => {
    const transforms = [];

    if (rotation !== 0) {
      transforms.push(`rotate(${rotation}deg)`);
    }

    if (flipHorizontal) {
      transforms.push("scaleX(-1)");
    }

    if (flipVertical) {
      transforms.push("scaleY(-1)");
    }

    return transforms.length > 0 ? transforms.join(" ") : "none";
  }, [rotation, flipHorizontal, flipVertical]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Start scanning when isScanning becomes true
  useEffect(() => {
    if (isScanning && videoRef.current) {
      // Ensure we start scanning when the flag is set
      scanForQRCodes();
    }
  }, [isScanning, scanForQRCodes]);

  return (
    <>
      <Head>
        <title>Live QR Scanner - EZ Snap</title>
        <meta
          name="description"
          content="High-performance live QR code scanner with real-time overlay"
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
              Live QR Scanner
            </Typography>
            <Chip
              label={`${fps} FPS`}
              color={fps > 15 ? "success" : fps > 10 ? "warning" : "error"}
              size="small"
              sx={{ mr: 1 }}
            />
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ py: 2 }}>
          {!isScanning ? (
            <Box sx={{ textAlign: "center", mt: 4 }}>
              <Typography variant="h4" gutterBottom color="primary">
                📱 Live QR Code Scanner
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                High-performance real-time QR code detection with smooth overlay
                tracking
              </Typography>

              <Card sx={{ maxWidth: 500, mx: "auto", mb: 4 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Scanner Features
                  </Typography>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography>Detection Rate:</Typography>
                      <Chip label="30+ FPS" size="small" color="success" />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography>QR Types:</Typography>
                      <Chip label="All standard QR codes" size="small" />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography>Overlay:</Typography>
                      <Chip label="Real-time bounding boxes" size="small" />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography>Performance:</Typography>
                      <Chip label="Hardware optimized" size="small" />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Button
                variant="contained"
                size="large"
                onClick={startScanning}
                startIcon={<PlayArrow />}
                sx={{ px: 4, py: 1.5 }}
              >
                Start Live Scanning
              </Button>
            </Box>
          ) : (
            <Box>
              <Paper sx={{ p: 2, mb: 2 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  flexWrap="wrap"
                  gap={1}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={`Scanning at ${fps} FPS`}
                      color={fps > 15 ? "success" : "warning"}
                      size="small"
                      icon={<QrCode2 />}
                    />
                    <Chip
                      label={`${scanCount} QR codes detected`}
                      color={scanCount > 0 ? "success" : "default"}
                      size="small"
                    />
                    <Chip
                      label={`${detectedQRs.length} active`}
                      color={detectedQRs.length > 0 ? "primary" : "default"}
                      size="small"
                    />
                    {rotation !== 0 && (
                      <Chip
                        label={`${rotation}° rotated`}
                        color="secondary"
                        size="small"
                      />
                    )}
                    {flipHorizontal && (
                      <Chip
                        label="↔ H-flipped"
                        color="secondary"
                        size="small"
                      />
                    )}
                    {flipVertical && (
                      <Chip
                        label="↕ V-flipped"
                        color="secondary"
                        size="small"
                      />
                    )}
                  </Stack>
                  <Button
                    variant="contained"
                    onClick={stopScanning}
                    color="error"
                    startIcon={<Stop />}
                  >
                    Stop Scanner
                  </Button>
                </Stack>
              </Paper>

              {detectedQRs.length > 0 && (
                <Paper sx={{ p: 2, mb: 2, bgcolor: "grey.50" }}>
                  <Typography variant="h6" gutterBottom>
                    📋 Detected QR Codes
                  </Typography>
                  <Stack spacing={1}>
                    {detectedQRs.map((qr, index) => (
                      <Box
                        key={qr.id}
                        sx={{
                          p: 1,
                          bgcolor: "background.paper",
                          borderRadius: 1,
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography variant="body2" fontWeight="bold">
                          QR #{index + 1}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ wordBreak: "break-all" }}
                        >
                          {qr.data}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Position: ({Math.round(qr.location.topLeftCorner.x)},{" "}
                          {Math.round(qr.location.topLeftCorner.y)}) • Age:{" "}
                          {Math.round((Date.now() - qr.timestamp) / 1000)}s
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              )}

              <Paper
                sx={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 2,
                  bgcolor: "#333",
                  minHeight: "50vh",
                  maxWidth: "100%",
                  mx: "auto",
                }}
              >
                {/* Video Transform Controls */}
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    zIndex: 10,
                  }}
                >
                  <IconButton
                    onClick={toggleRotation}
                    sx={{
                      bgcolor:
                        rotation !== 0
                          ? "rgba(76, 175, 80, 0.8)"
                          : "rgba(0, 0, 0, 0.6)",
                      color: "white",
                      "&:hover": {
                        bgcolor:
                          rotation !== 0
                            ? "rgba(76, 175, 80, 1)"
                            : "rgba(0, 0, 0, 0.8)",
                      },
                    }}
                    size="small"
                    title={`Rotate (${rotation}°)`}
                  >
                    <RotateRight />
                  </IconButton>

                  <IconButton
                    onClick={toggleHorizontalFlip}
                    sx={{
                      bgcolor: flipHorizontal
                        ? "rgba(76, 175, 80, 0.8)"
                        : "rgba(0, 0, 0, 0.6)",
                      color: "white",
                      "&:hover": {
                        bgcolor: flipHorizontal
                          ? "rgba(76, 175, 80, 1)"
                          : "rgba(0, 0, 0, 0.8)",
                      },
                    }}
                    size="small"
                    title="Flip Horizontal"
                  >
                    <Flip />
                  </IconButton>

                  <IconButton
                    onClick={toggleVerticalFlip}
                    sx={{
                      bgcolor: flipVertical
                        ? "rgba(76, 175, 80, 0.8)"
                        : "rgba(0, 0, 0, 0.6)",
                      color: "white",
                      "&:hover": {
                        bgcolor: flipVertical
                          ? "rgba(76, 175, 80, 1)"
                          : "rgba(0, 0, 0, 0.8)",
                      },
                    }}
                    size="small"
                    title="Flip Vertical"
                  >
                    <FlipToBack />
                  </IconButton>

                  {(rotation !== 0 || flipHorizontal || flipVertical) && (
                    <IconButton
                      onClick={resetTransforms}
                      sx={{
                        bgcolor: "rgba(244, 67, 54, 0.8)",
                        color: "white",
                        "&:hover": {
                          bgcolor: "rgba(244, 67, 54, 1)",
                        },
                      }}
                      size="small"
                      title="Reset Transforms"
                    >
                      <RestartAlt />
                    </IconButton>
                  )}
                </Stack>

                {/* Transform Status Indicator */}
                {(rotation !== 0 || flipHorizontal || flipVertical) && (
                  <Chip
                    label={`${rotation}° ${flipHorizontal ? "↔" : ""} ${flipVertical ? "↕" : ""}`}
                    size="small"
                    sx={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      zIndex: 10,
                      bgcolor: "rgba(76, 175, 80, 0.9)",
                      color: "white",
                    }}
                  />
                )}

                <Webcam
                  key={getVideoTransform()}
                  ref={webcamRef}
                  audio={false}
                  videoConstraints={videoConstraints}
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                    transform: getVideoTransform(),
                  }}
                  onLoadedData={() => {
                    // Access the video element from the webcam
                    if (webcamRef.current?.video) {
                      videoRef.current = webcamRef.current.video;
                      // If scanning is active, start the QR detection loop
                      if (isScanning && !animationFrameRef.current) {
                        scanForQRCodes();
                      }
                    }
                  }}
                />
                <canvas
                  ref={canvasRef}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                  }}
                />
              </Paper>
            </Box>
          )}
        </Container>
      </Box>
    </>
  );
}
