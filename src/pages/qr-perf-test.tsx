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
} from "@mui/material";
import { ArrowBack, Computer, Memory, Compare } from "@mui/icons-material";
import { useRouter } from "next/router";
import { useQRWorkerGPU } from "../utils/useQRWorkerGPU";
import Navigation from "../components/Navigation";

interface TestResult {
  mode: string;
  gpuSupported: boolean;
  recommendations: {
    shouldUseGPU: boolean;
    performanceGain: string;
  };
  gpuAverage: number;
  cpuAverage: number;
  frameCount: number;
  gpuFrames: number;
  cpuFrames: number;
}

export default function QRPerfTest() {
  const router = useRouter();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isGPUSupported, setIsGPUSupported] = useState(false);
  const [isUsingGPU, setIsUsingGPU] = useState(false);

  const { getPerformanceInfo, forceCPUMode, forceGPUMode, isWorkerReady } =
    useQRWorkerGPU();

  const runTest = useCallback(() => {
    const info = getPerformanceInfo();
    setTestResults([info]);
  }, [getPerformanceInfo]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      setIsGPUSupported(!!gl);
    }
  }, []);

  return (
    <>
      <Head>
        <title>QR GPU Performance Test</title>
      </Head>

      <Box sx={{ flexGrow: 1, minHeight: "100vh" }}>
        <Navigation title="GPU Performance Test" />

        <Container maxWidth="md" sx={{ py: 3 }}>
          <Typography variant="h4" gutterBottom align="center">
            GPU vs CPU QR Detection
          </Typography>

          <Grid container spacing={3}>
            <Grid size={12}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  System Status
                </Typography>

                <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                  <Chip
                    icon={isGPUSupported ? <Memory /> : <Computer />}
                    label={isGPUSupported ? "GPU Available" : "CPU Only"}
                    color={isGPUSupported ? "success" : "warning"}
                  />
                  <Chip
                    label={`Current: ${isUsingGPU ? "GPU" : "CPU"}`}
                    color={isUsingGPU ? "primary" : "default"}
                  />
                </Stack>

                <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                  <Button
                    variant="outlined"
                    onClick={forceCPUMode}
                    startIcon={<Computer />}
                  >
                    Force CPU
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={forceGPUMode}
                    disabled={!isGPUSupported}
                    startIcon={<Memory />}
                  >
                    Force GPU
                  </Button>
                  <Button
                    variant="contained"
                    onClick={runTest}
                    startIcon={<Compare />}
                  >
                    Get Performance Info
                  </Button>
                </Stack>

                {testResults.length > 0 && (
                  <Card>
                    <CardContent>
                      <Typography variant="h6">Results</Typography>
                      <pre>{JSON.stringify(testResults[0], null, 2)}</pre>
                    </CardContent>
                  </Card>
                )}

                {!isGPUSupported && (
                  <Alert severity="info">
                    WebGL2 not supported. GPU acceleration unavailable.
                  </Alert>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
}
