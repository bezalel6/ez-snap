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
  Alert,
  Grid,
  LinearProgress,
} from "@mui/material";
import {
  ArrowBack,
  Speed,
  Memory,
  Computer,
  Gpu,
  PlayArrow,
  Stop,
  Compare,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import Webcam from "react-webcam";
import { useQRWorkerGPU } from "../utils/useQRWorkerGPU";
import Navigation from "../components/Navigation";

export default function QRPerformanceTest() {
  const router = useRouter();
  const webcamRef = useRef<Webcam>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const [isScanning, setIsScanning] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [testProgress, setTestProgress] = useState(0);

  const {
    detectQRPatterns,
    cleanup,
    forceCPUMode,
    forceGPUMode,
    getPerformanceInfo,
    isWorkerReady,
    isUsingGPU,
    isGPUSupported,
  } = useQRWorkerGPU();

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "environment",
  };

  const runPerformanceTest = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isWorkerReady) return;

    setIsScanning(true);
    setTestResults([]);
    setTestProgress(0);

    const testDuration = 10000; // 10 seconds
    const frameCount = { cpu: 0, gpu: 0 };
    const frameTimes = { cpu: [], gpu: [] };

    // Test CPU mode
    setCurrentTest("CPU");
    forceCPUMode();
    await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for mode switch

    const cpuStartTime = Date.now();
    let cpuEndTime = cpuStartTime;

    const cpuTestLoop = async () => {
      const now = Date.now();
      if (now - cpuStartTime >= testDuration) {
        cpuEndTime = now;
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
        requestAnimationFrame(cpuTestLoop);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const frameStart = performance.now();
      await detectQRPatterns(imageData);
      const frameEnd = performance.now();

      frameTimes.cpu.push(frameEnd - frameStart);
      frameCount.cpu++;

      setTestProgress(((now - cpuStartTime) / testDuration) * 50); // First 50%
      requestAnimationFrame(cpuTestLoop);
    };

    await new Promise<void>((resolve) => {
      const runTest = async () => {
        await cpuTestLoop();
        resolve();
      };
      runTest();
    });

    // Test GPU mode (if available)
    if (isGPUSupported) {
      setCurrentTest("GPU");
      forceGPUMode();
      await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for mode switch

      const gpuStartTime = Date.now();
      let gpuEndTime = gpuStartTime;

      const gpuTestLoop = async () => {
        const now = Date.now();
        if (now - gpuStartTime >= testDuration) {
          gpuEndTime = now;
          return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
          requestAnimationFrame(gpuTestLoop);
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const frameStart = performance.now();
        await detectQRPatterns(imageData);
        const frameEnd = performance.now();

        frameTimes.gpu.push(frameEnd - frameStart);
        frameCount.gpu++;

        setTestProgress(50 + ((now - gpuStartTime) / testDuration) * 50); // Second 50%
        requestAnimationFrame(gpuTestLoop);
      };

      await new Promise<void>((resolve) => {
        const runTest = async () => {
          await gpuTestLoop();
          resolve();
        };
        runTest();
      });
    }

    // Calculate results
    const cpuAvgTime =
      frameTimes.cpu.reduce((a, b) => a + b, 0) / frameTimes.cpu.length;
    const cpuFPS = frameCount.cpu / ((cpuEndTime - cpuStartTime) / 1000);

    const results = [
      {
        mode: "CPU",
        fps: cpuFPS.toFixed(1),
        avgFrameTime: cpuAvgTime.toFixed(2),
        totalFrames: frameCount.cpu,
        supported: true,
      },
    ];

    if (isGPUSupported && frameTimes.gpu.length > 0) {
      const gpuAvgTime =
        frameTimes.gpu.reduce((a, b) => a + b, 0) / frameTimes.gpu.length;
      const gpuFPS = frameCount.gpu / (testDuration / 1000);

      results.push({
        mode: "GPU",
        fps: gpuFPS.toFixed(1),
        avgFrameTime: gpuAvgTime.toFixed(2),
        totalFrames: frameCount.gpu,
        supported: true,
        improvement: `${(((cpuAvgTime - gpuAvgTime) / cpuAvgTime) * 100).toFixed(1)}%`,
      });
    }

    setTestResults(results);
    setCurrentTest(null);
    setIsScanning(false);
    setTestProgress(100);
  }, [
    detectQRPatterns,
    forceCPUMode,
    forceGPUMode,
    isWorkerReady,
    isGPUSupported,
  ]);

  const stopTest = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsScanning(false);
    setCurrentTest(null);
    setTestProgress(0);
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cleanup]);

  return (
    <>
      <Head>
        <title>QR Performance Test - GPU vs CPU</title>
        <meta
          name="description"
          content="Test GPU vs CPU QR detection performance"
        />
      </Head>

      <Box
        sx={{ flexGrow: 1, minHeight: "100vh", bgcolor: "background.default" }}
      >
        <Navigation title="QR Performance Test" />

        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Typography variant="h4" gutterBottom align="center" color="primary">
            🚀 GPU vs CPU Performance Test
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            align="center"
            sx={{ mb: 4 }}
          >
            Compare QR detection performance between GPU and CPU processing
          </Typography>

          <Grid container spacing={3}>
            {/* Camera Feed */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  📹 Test Camera Feed
                </Typography>

                <Box sx={{ position: "relative", mb: 2 }}>
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
                  <canvas
                    ref={canvasRef}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      pointerEvents: "none",
                      opacity: 0.3,
                    }}
                  />
                </Box>

                <Stack spacing={2}>
                  <Alert severity="info">
                    <strong>Setup:</strong> Point camera at QR codes for
                    accurate testing
                  </Alert>

                  {currentTest && (
                    <Box>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        Testing {currentTest} mode... {testProgress.toFixed(0)}%
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={testProgress}
                      />
                    </Box>
                  )}

                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="contained"
                      onClick={runPerformanceTest}
                      disabled={isScanning || !isWorkerReady}
                      startIcon={<Compare />}
                    >
                      Run Performance Test
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={stopTest}
                      disabled={!isScanning}
                      startIcon={<Stop />}
                    >
                      Stop Test
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            </Grid>

            {/* Results */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  📊 Performance Results
                </Typography>

                <Stack spacing={2}>
                  <Card>
                    <CardContent>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Computer />
                        <Typography variant="subtitle1">System Info</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Chip
                          icon={<Gpu />}
                          label={
                            isGPUSupported
                              ? "GPU Supported"
                              : "GPU Not Available"
                          }
                          color={isGPUSupported ? "success" : "warning"}
                          size="small"
                        />
                        <Chip
                          icon={<Memory />}
                          label={`Mode: ${isUsingGPU ? "GPU" : "CPU"}`}
                          color={isUsingGPU ? "primary" : "default"}
                          size="small"
                        />
                      </Stack>
                    </CardContent>
                  </Card>

                  {testResults.length > 0 ? (
                    testResults.map((result, index) => (
                      <Card key={index}>
                        <CardContent>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{ mb: 2 }}
                          >
                            {result.mode === "GPU" ? <Gpu /> : <Computer />}
                            <Typography variant="h6">
                              {result.mode} Results
                            </Typography>
                            {result.improvement && (
                              <Chip
                                label={`${result.improvement} faster`}
                                color="success"
                                size="small"
                              />
                            )}
                          </Stack>

                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                FPS
                              </Typography>
                              <Typography variant="h5" color="primary">
                                {result.fps}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Avg Frame Time
                              </Typography>
                              <Typography variant="h5" color="primary">
                                {result.avgFrameTime}ms
                              </Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Total Frames: {result.totalFrames}
                              </Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Alert severity="info">
                      Run a performance test to see results. The test will
                      measure QR detection speed for both CPU and GPU (if
                      available) over 10 seconds each.
                    </Alert>
                  )}

                  {!isGPUSupported && (
                    <Alert severity="warning">
                      <strong>GPU acceleration not available.</strong> Your
                      browser or device doesn't support WebGL2. CPU mode will be
                      used.
                    </Alert>
                  )}
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
}
