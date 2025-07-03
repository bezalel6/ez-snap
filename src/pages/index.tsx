import Head from "next/head";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  Box,
  Button,
  Container,
  Typography,
  Slider,
  Card,
  CardMedia,
  Grid,
  AppBar,
  Toolbar,
  IconButton,
  Fab,
  Paper,
  Stack,
  Chip,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  CameraAlt,
  Close,
  Save,
  Refresh,
  ArrowBack,
  PhotoLibrary,
  Tune,
} from "@mui/icons-material";
import Webcam from "react-webcam";
import { useSocket } from "@/utils/socket";
import type { CapturedImage, FilterOptions, ConnectedUser } from "./types";

export default function Home() {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<CapturedImage | null>(
    null,
  );
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
  });

  const webcamRef = useRef<Webcam>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const socket = useSocket();
  const carouselImages = useCallback(() => {
    const localImages = capturedImages;
    const sharedImages = socket.sharedPhotos
      .filter((p) => p.fromClient !== socket.currentUserUid)
      .map((photo) => ({
        id: `shared-${Date.now()}-${Math.random()}`,
        dataUrl: photo.dataUrl,
        timestamp: new Date(photo.timestamp),
        uid: photo.fromClient || "unknown",
      }));

    return [...localImages, ...sharedImages];
  }, [capturedImages, socket.sharedPhotos, socket.currentUserUid]);

  const videoConstraints = {
    width: isMobile ? 360 : 480,
    height: isMobile ? 640 : 720,
    facingMode: "environment",
  };

  const captureImage = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;

    const newImage: CapturedImage = {
      id: Date.now().toString(),
      dataUrl: imageSrc,
      timestamp: new Date(),
      uid: socket.currentUserUid ?? "anonymous",
    };
    setCapturedImages((prev) => [newImage, ...prev]);
    socket.sharePhoto(newImage.dataUrl);
    setSelectedImage(newImage);
    setIsCameraActive(false);
  }, [socket]);

  const applyFilters = useCallback(() => {
    if (!selectedImage || !processedCanvasRef.current) return;

    const canvas = processedCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) blur(${filters.blur}px)`;
      ctx.drawImage(img, 0, 0);
    };
    img.src = selectedImage.dataUrl;
  }, [selectedImage, filters]);

  const downloadProcessedImage = useCallback(() => {
    if (!processedCanvasRef.current) return;

    const link = document.createElement("a");
    link.download = `ez-snap-${Date.now()}.jpg`;
    link.href = processedCanvasRef.current.toDataURL("image/jpeg", 0.9);
    link.click();
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
    });
  }, []);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  return (
    <>
      <Head>
        <title>EZ Snap - Photo Capture & Edit</title>
        <meta
          name="description"
          content="Capture, process and preview photos easily"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, user-scalable=no"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Box
        sx={{ flexGrow: 1, minHeight: "100vh", bgcolor: "background.default" }}
      >
        <AppBar position="static" elevation={0}>
          <Toolbar>
            {selectedImage && (
              <IconButton
                edge="start"
                color="inherit"
                onClick={() => setSelectedImage(null)}
                sx={{ mr: 2 }}
              >
                <ArrowBack />
              </IconButton>
            )}
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              EZ Snap
            </Typography>
            {selectedImage && (
              <IconButton
                color="inherit"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Tune />
              </IconButton>
            )}
          </Toolbar>
        </AppBar>

        <Container maxWidth="sm" sx={{ py: 2, px: 1 }}>
          {/* Welcome Screen */}
          {!isCameraActive && !selectedImage && (
            <Box sx={{ textAlign: "center", mt: 4 }}>
              <Typography variant="h4" gutterBottom color="primary">
                📸 EZ Snap
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Capture • Process • Preview
              </Typography>

              <Button
                variant="contained"
                size="large"
                startIcon={<CameraAlt />}
                onClick={() => setIsCameraActive(true)}
                sx={{ mb: 4, py: 1.5, px: 3 }}
              >
                Start Camera
              </Button>

              {/* Connected Users Section */}
              <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  👥 Session Info
                </Typography>
                <Stack spacing={1}>
                  <Chip
                    label={`Your UID: ${socket.currentUserUid ?? "Not connected"}`}
                    color={socket.isConnected ? "success" : "default"}
                    variant="outlined"
                  />
                  <Chip
                    label={`Status: ${socket.isConnected ? "Connected" : "Disconnected"}`}
                    color={socket.isConnected ? "success" : "error"}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Connected Users: {socket.connectedUsers?.length ?? 0}
                  </Typography>
                  {socket.connectedUsers &&
                    socket.connectedUsers.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        {socket.connectedUsers.map((user: ConnectedUser) => (
                          <Chip
                            key={user.uid}
                            label={`${user.uid}`}
                            size="small"
                            sx={{ mr: 1, mb: 1 }}
                            color={
                              user.uid === socket.currentUserUid
                                ? "primary"
                                : "default"
                            }
                          />
                        ))}
                      </Box>
                    )}
                </Stack>
              </Paper>

              {capturedImages.length > 0 && (
                <Paper sx={{ p: 2, mt: 3 }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ mb: 2 }}
                  >
                    <PhotoLibrary color="primary" />
                    <Typography variant="h6">Recent Photos</Typography>
                  </Stack>

                  <Grid container spacing={1}>
                    {capturedImages.slice(0, 6).map((image) => (
                      <Grid key={image.id} size={4}>
                        <Card
                          sx={{
                            cursor: "pointer",
                            "&:hover": { transform: "scale(1.05)" },
                          }}
                          onClick={() => setSelectedImage(image)}
                        >
                          <CardMedia
                            component="img"
                            height="120"
                            image={image.dataUrl}
                            alt="Captured"
                            sx={{ objectFit: "cover" }}
                          />
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              )}
            </Box>
          )}

          {/* Camera View */}
          {isCameraActive && (
            <Box sx={{ position: "relative" }}>
              <Paper sx={{ overflow: "hidden", borderRadius: 2 }}>
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  style={{ width: "100%", height: "auto" }}
                />
              </Paper>

              <Box
                sx={{
                  position: "fixed",
                  bottom: 20,
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  gap: 2,
                  alignItems: "center",
                }}
              >
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => setIsCameraActive(false)}
                  startIcon={<Close />}
                  sx={{ bgcolor: "background.paper" }}
                >
                  Close
                </Button>

                <Fab
                  color="primary"
                  size="large"
                  onClick={captureImage}
                  sx={{
                    width: 70,
                    height: 70,
                    boxShadow: 3,
                  }}
                >
                  <CameraAlt sx={{ fontSize: 30 }} />
                </Fab>
              </Box>
            </Box>
          )}

          {/* Image Editor */}
          {selectedImage && (
            <Box>
              <Paper sx={{ mb: 2, overflow: "hidden", borderRadius: 2 }}>
                <Box sx={{ position: "relative", width: "100%" }}>
                  <canvas
                    ref={processedCanvasRef}
                    style={{
                      width: "100%",
                      height: "auto",
                      display: "block",
                      maxHeight: "60vh",
                      objectFit: "contain",
                    }}
                  />
                </Box>
              </Paper>

              {showFilters && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Adjust Filters
                  </Typography>

                  <Stack spacing={3}>
                    <Box>
                      <Typography gutterBottom>
                        Brightness: {filters.brightness}%
                      </Typography>
                      <Slider
                        value={filters.brightness}
                        onChange={(_, value) =>
                          setFilters((prev) => ({
                            ...prev,
                            brightness:
                              typeof value === "number" ? value : value[0],
                          }))
                        }
                        min={50}
                        max={200}
                        sx={{ color: "primary.main" }}
                      />
                    </Box>

                    <Box>
                      <Typography gutterBottom>
                        Contrast: {filters.contrast}%
                      </Typography>
                      <Slider
                        value={filters.contrast}
                        onChange={(_, value) =>
                          setFilters((prev) => ({
                            ...prev,
                            contrast:
                              typeof value === "number" ? value : value[0],
                          }))
                        }
                        min={50}
                        max={200}
                        sx={{ color: "primary.main" }}
                      />
                    </Box>

                    <Box>
                      <Typography gutterBottom>
                        Saturation: {filters.saturation}%
                      </Typography>
                      <Slider
                        value={filters.saturation}
                        onChange={(_, value) =>
                          setFilters((prev) => ({
                            ...prev,
                            saturation:
                              typeof value === "number" ? value : value[0],
                          }))
                        }
                        min={0}
                        max={200}
                        sx={{ color: "primary.main" }}
                      />
                    </Box>

                    <Box>
                      <Typography gutterBottom>
                        Blur: {filters.blur}px
                      </Typography>
                      <Slider
                        value={filters.blur}
                        onChange={(_, value) =>
                          setFilters((prev) => ({
                            ...prev,
                            blur: typeof value === "number" ? value : value[0],
                          }))
                        }
                        min={0}
                        max={10}
                        sx={{ color: "primary.main" }}
                      />
                    </Box>
                  </Stack>
                </Paper>
              )}

              <Stack direction="row" spacing={1} justifyContent="center">
                <Button
                  variant="outlined"
                  onClick={resetFilters}
                  startIcon={<Refresh />}
                >
                  Reset
                </Button>
                <Button
                  variant="contained"
                  onClick={downloadProcessedImage}
                  startIcon={<Save />}
                  sx={{ flexGrow: 1 }}
                >
                  Save Image
                </Button>
              </Stack>

              <Box sx={{ mt: 2, textAlign: "center" }}>
                <Chip
                  label={`Captured: ${selectedImage.timestamp.toLocaleTimeString()}`}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </Box>
          )}
        </Container>

        {/* Global Carousel - Shows all captured images */}
        {carouselImages().length > 0 && (
          <Carousel
            images={carouselImages()}
            uid={socket.currentUserUid ?? "anonymous"}
          />
        )}
      </Box>
    </>
  );
}

function CarouselImage({ image, uid }: { image: CapturedImage; uid: string }) {
  const isOwnImage = uid === image.uid;

  return (
    <Card
      sx={{
        minWidth: 280,
        height: 200,
        position: "relative",
        cursor: "pointer",
        transition: "all 0.3s ease",
        border: isOwnImage
          ? "2px solid gold"
          : "1px solid rgba(255,255,255,0.1)",
        "&:hover": {
          transform: "scale(1.02)",
          boxShadow: 3,
        },
      }}
    >
      <CardMedia
        component="img"
        src={image.dataUrl}
        height="100%"
        sx={{
          objectFit: "cover",
        }}
      />
      {isOwnImage && (
        <Chip
          label="Your Photo"
          size="small"
          color="warning"
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            bgcolor: "gold",
            color: "black",
            fontWeight: "bold",
          }}
        />
      )}
      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
          p: 1,
        }}
      >
        <Typography variant="caption" color="white" sx={{ fontSize: "0.7rem" }}>
          {image.timestamp.toLocaleTimeString()}
        </Typography>
      </Box>
    </Card>
  );
}

function Carousel({ images, uid }: { images: CapturedImage[]; uid: string }) {
  const theme = useTheme();

  if (images.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        borderTop: `1px solid ${theme.palette.divider}`,
        py: 2,
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ mb: 2, px: 2 }}>
          <Typography variant="h6" color="primary" gutterBottom>
            📷 Photo Stream
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Latest captures from all connected users
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            gap: 2,
            overflowX: "auto",
            pb: 1,
            px: 2,
            "&::-webkit-scrollbar": {
              height: 8,
            },
            "&::-webkit-scrollbar-track": {
              bgcolor: "rgba(0,0,0,0.1)",
              borderRadius: 4,
            },
            "&::-webkit-scrollbar-thumb": {
              bgcolor: theme.palette.primary.main,
              borderRadius: 4,
              "&:hover": {
                bgcolor: theme.palette.primary.dark,
              },
            },
          }}
        >
          {images.map((img) => (
            <CarouselImage image={img} uid={uid} key={img.id} />
          ))}
        </Box>

        <Box sx={{ textAlign: "center", mt: 2 }}>
          <Chip
            label={`${images.length} photo${images.length !== 1 ? "s" : ""} captured`}
            variant="outlined"
            size="small"
            color="primary"
          />
        </Box>
      </Container>
    </Box>
  );
}
