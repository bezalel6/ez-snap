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
  Tag,
  Camera,
  Info,
} from "@mui/icons-material";
import Webcam from "react-webcam";
import { useSocket } from "@/utils/socket";
import type {
  CapturedImage,
  FilterOptions,
  ConnectedUser,
} from "../utils/types";
import { useRouter } from "next/router";

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
  const router = useRouter();

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
        <title>EZ Snap - AprilTag Tracker System</title>
        <meta
          name="description"
          content="Precise camera alignment using AprilTag trackers for perfect document capture"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Container maxWidth="md" sx={{ py: 8, flex: 1 }}>
          <Box sx={{ textAlign: "center", mb: 6 }}>
            <Typography
              variant="h2"
              component="h1"
              gutterBottom
              color="primary"
              sx={{ fontWeight: "bold" }}
            >
              📸 EZ Snap
            </Typography>
            <Typography
              variant="h5"
              color="text.secondary"
              sx={{ mb: 4, maxWidth: 600, mx: "auto" }}
            >
              Professional camera alignment using AprilTag trackers for perfect
              document capture with superior consistency
            </Typography>

            <Paper sx={{ p: 4, mb: 4, bgcolor: "success.light" }}>
              <Typography variant="h6" color="success.dark" gutterBottom>
                🎯 Why AprilTags over QR Codes?
              </Typography>
              <Stack spacing={1} sx={{ textAlign: "left", maxWidth: 500, mx: "auto" }}>
                <Typography variant="body2" color="success.dark">
                  ✅ <strong>Much more consistent detection</strong> - Designed specifically for camera tracking
                </Typography>
                <Typography variant="body2" color="success.dark">
                  ✅ <strong>Better low-light performance</strong> - Optimized for various lighting conditions
                </Typography>
                <Typography variant="body2" color="success.dark">
                  ✅ <strong>More robust to occlusion</strong> - Works even when partially covered
                </Typography>
                <Typography variant="body2" color="success.dark">
                  ✅ <strong>Superior pose estimation</strong> - Accurate 3D position and orientation
                </Typography>
                <Typography variant="body2" color="success.dark">
                  ✅ <strong>Professional grade</strong> - Used in robotics and AR applications
                </Typography>
              </Stack>
            </Paper>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={3}
              justifyContent="center"
              sx={{ mb: 6 }}
            >
              <Button
                variant="contained"
                size="large"
                startIcon={<Tag />}
                onClick={() => router.push("/qr-generator")}
                sx={{ minWidth: 200 }}
              >
                Generate AprilTags
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<Camera />}
                onClick={() => router.push("/qr-tracker")}
                sx={{ minWidth: 200 }}
              >
                Start Tracking
              </Button>
            </Stack>
          </Box>

          <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { md: "1fr 1fr" } }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                🎯 AprilTag Generator
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Create printable AprilTag reference sheets for A4 documents. 
                Our tags are optimized for camera tracking with much better 
                detection consistency than traditional QR codes.
              </Typography>
              <Button
                variant="contained"
                startIcon={<Tag />}
                onClick={() => router.push("/qr-generator")}
                fullWidth
              >
                Generate Tags
              </Button>
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                📹 Tracker Detection
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Real-time AprilTag detection with live alignment feedback. 
                Position your camera perfectly using our advanced tracking 
                overlay system for professional results.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<Camera />}
                onClick={() => router.push("/qr-tracker")}
                fullWidth
              >
                Start Detection
              </Button>
            </Paper>
          </Box>

          <Paper sx={{ p: 3, mt: 4, bgcolor: "info.light" }}>
            <Typography variant="h6" gutterBottom color="info.dark">
              📋 How it Works
            </Typography>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" color="info.dark">
                  1. Generate AprilTag Reference Sheet
                </Typography>
                <Typography variant="body2" color="info.dark">
                  Create a printable A4 sheet with four AprilTags positioned at the corners
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="info.dark">
                  2. Print and Position Tags
                </Typography>
                <Typography variant="body2" color="info.dark">
                  Print the sheet and place the AprilTags at your document corners
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="info.dark">
                  3. Start Camera Tracking
                </Typography>
                <Typography variant="body2" color="info.dark">
                  Use the detection system to get real-time alignment feedback
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="info.dark">
                  4. Perfect Alignment
                </Typography>
                <Typography variant="body2" color="info.dark">
                  Follow the visual guides to achieve perfect camera positioning
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Container>

        <Box
          component="footer"
          sx={{
            py: 3,
            px: 2,
            mt: "auto",
            backgroundColor: "background.paper",
            borderTop: 1,
            borderColor: "divider",
          }}
        >
          <Container maxWidth="sm">
            <Typography variant="body2" color="text.secondary" align="center">
              EZ Snap - Professional AprilTag Camera Alignment System
            </Typography>
          </Container>
        </Box>
      </Box>
    </>
  );
}

function CarouselImage({
  image,
  uid,
  selectedImage,
  onImageClick,
}: {
  image: CapturedImage;
  uid: string;
  selectedImage: CapturedImage | null;
  onImageClick: (image: CapturedImage) => void;
}) {
  const isOwnImage = uid === image.uid;
  const isSelected = selectedImage?.id === image.id;

  return (
    <Card
      onClick={() => onImageClick(image)}
      sx={{
        minWidth: 280,
        height: 200,
        position: "relative",
        cursor: "pointer",
        transition: "all 0.3s ease",
        border: isSelected
          ? "3px solid #90caf9"
          : isOwnImage
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
      {isSelected && (
        <Chip
          label="Selected"
          size="small"
          color="primary"
          sx={{
            position: "absolute",
            top: 8,
            left: 8,
            bgcolor: "#90caf9",
            color: "black",
            fontWeight: "bold",
          }}
        />
      )}
      {isOwnImage && !isSelected && (
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

function Carousel({
  images,
  uid,
  selectedImage,
  onImageClick,
}: {
  images: CapturedImage[];
  uid: string;
  selectedImage: CapturedImage | null;
  onImageClick: (image: CapturedImage) => void;
}) {
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
            <CarouselImage
              image={img}
              uid={uid}
              key={img.id}
              selectedImage={selectedImage}
              onImageClick={onImageClick}
            />
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
