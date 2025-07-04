import React, { useRef, useEffect, useState } from "react";
import { Button, Container, Typography, Box } from "@mui/material";

import cvReadyPromise from "@techstark/opencv-js";

type OpenCVInstance = Awaited<typeof cvReadyPromise>;

const markerLength = 0.04; // 4cm markers
const Z_HEIGHT_MM = 46;

const ArucoPoseTracker = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [cvReady, setCvReady] = useState(false);
  const [cv, setCv] = useState<OpenCVInstance | null>(null);

  useEffect(() => {
    // Initialize OpenCV
    const initOpenCV = async () => {
      try {
        const cvInstance = await cvReadyPromise;
        setCv(cvInstance);
        setCvReady(true);
        console.log("OpenCV.js is ready!");
        console.log(cvInstance.getBuildInformation());
      } catch (error) {
        console.error("Failed to load OpenCV:", error);
      }
    };

    void initOpenCV();

    // Initialize camera
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          return videoRef.current.play();
        }
      });
  }, []);

  const detect = async () => {
    if (!cvReady || !cv) {
      console.warn("OpenCV is not ready yet");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    const src = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    const dictionary = new cv.aruco.getPredefinedDictionary(
      cv.aruco.DICT_4X4_50,
    );
    const corners = new cv.MatVector();
    const ids = new cv.Mat();
    const rejected = new cv.MatVector();

    const parameters = new cv.aruco.DetectorParameters();
    cv.aruco.detectMarkers(
      gray,
      dictionary,
      corners,
      ids,
      parameters,
      rejected,
    );

    if (ids.rows >= 4) {
      const cameraMatrix = cv.matFromArray(3, 3, cv.CV_64F, [
        800,
        0,
        width / 2,
        0,
        800,
        height / 2,
        0,
        0,
        1,
      ]);
      const distCoeffs = cv.Mat.zeros(1, 5, cv.CV_64F);

      const rvec = new cv.Mat();
      const tvec = new cv.Mat();
      cv.aruco.estimatePoseBoard(
        corners,
        ids,
        new cv.aruco.Board(),
        dictionary,
        cameraMatrix,
        distCoeffs,
        rvec,
        tvec,
      );

      // simulate selecting a cylinder center manually
      const point2D = new cv.Mat([[width / 2, height / 2]], cv.CV_32FC2);
      const undistorted = new cv.Mat();
      cv.undistortPoints(point2D, undistorted, cameraMatrix, distCoeffs);

      const normalized = undistorted.data32F;
      const xn = normalized?.[0] ?? 0;
      const yn = normalized?.[1] ?? 0;
      const ray = cv.matFromArray(3, 1, cv.CV_64F, [xn, yn, 1.0]);

      const R = new cv.Mat();
      cv.Rodrigues(rvec, R);
      const Rt = new cv.Mat();
      cv.transpose(R, Rt);

      const camOrigin = cv.matFromArray(3, 1, cv.CV_64F, [
        -(Rt.data64F?.[0] ?? 0) * (tvec.data64F?.[0] ?? 0) -
          (Rt.data64F?.[1] ?? 0) * (tvec.data64F?.[1] ?? 0) -
          (Rt.data64F?.[2] ?? 0) * (tvec.data64F?.[2] ?? 0),
        -(Rt.data64F?.[3] ?? 0) * (tvec.data64F?.[0] ?? 0) -
          (Rt.data64F?.[4] ?? 0) * (tvec.data64F?.[1] ?? 0) -
          (Rt.data64F?.[5] ?? 0) * (tvec.data64F?.[2] ?? 0),
        -(Rt.data64F?.[6] ?? 0) * (tvec.data64F?.[0] ?? 0) -
          (Rt.data64F?.[7] ?? 0) * (tvec.data64F?.[1] ?? 0) -
          (Rt.data64F?.[8] ?? 0) * (tvec.data64F?.[2] ?? 0),
      ]);

      const dir = cv.matMul(Rt, ray);
      const lambda =
        (Z_HEIGHT_MM - (camOrigin.data64F?.[2] ?? 0)) / (dir.data64F?.[2] ?? 1);
      const X =
        (camOrigin.data64F?.[0] ?? 0) + lambda * (dir.data64F?.[0] ?? 0);
      const Y =
        (camOrigin.data64F?.[1] ?? 0) + lambda * (dir.data64F?.[1] ?? 0);

      setPosition({ x: X, y: Y });

      point2D.delete();
      undistorted.delete();
      ray.delete();
      R.delete();
      Rt.delete();
      camOrigin.delete();
      dir.delete();
    }

    src.delete();
    gray.delete();
    corners.delete();
    ids.delete();
    rejected.delete();
  };

  return (
    <Container sx={{ textAlign: "center", py: 4 }}>
      <Typography variant="h4" gutterBottom>
        PCB Mount Tracker
      </Typography>
      <video
        ref={videoRef}
        style={{ width: "100%", maxWidth: 500 }}
        playsInline
        muted
      ></video>
      <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
      <Box my={2}>
        <Button variant="contained" onClick={detect} disabled={!cvReady}>
          {cvReady ? "Detect Cylinder Center" : "Loading OpenCV..."}
        </Button>
      </Box>
      {position && (
        <Typography variant="h6">
          Cylinder Top Position: X = {position.x.toFixed(2)} mm, Y ={" "}
          {position.y.toFixed(2)} mm
        </Typography>
      )}
      {!cvReady && (
        <Typography variant="body2" color="text.secondary">
          OpenCV is initializing...
        </Typography>
      )}
    </Container>
  );
};

export default ArucoPoseTracker;
