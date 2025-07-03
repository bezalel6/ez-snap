import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, Chip, Paper, Stack } from '@mui/material';
import jsQR from 'jsqr';

interface QRCode {
  data: string;
  location: {
    topLeftCorner: { x: number; y: number };
    topRightCorner: { x: number; y: number };
    bottomLeftCorner: { x: number; y: number };
    bottomRightCorner: { x: number; y: number };
  };
}

interface DetectedTracker {
  id: string;
  position: 'topLeft' | 'topRight' | 'bottomLeft';
  location: QRCode['location'];
  center: { x: number; y: number };
}

interface TrackerConfig {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  targetRectangle: {
    width: number;
    height: number;
  };
}

interface AlignmentStatus {
  isAligned: boolean;
  translation: { x: number; y: number };
  rotation: number;
  scale: number;
  missingTrackers: string[];
}

interface QRTrackerOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  config: TrackerConfig;
  onAlignmentChange?: (status: AlignmentStatus) => void;
}

export default function QRTrackerOverlay({ 
  videoRef, 
  isActive, 
  config,
  onAlignmentChange 
}: QRTrackerOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [detectedTrackers, setDetectedTrackers] = useState<DetectedTracker[]>([]);
  const [alignmentStatus, setAlignmentStatus] = useState<AlignmentStatus>({
    isAligned: false,
    translation: { x: 0, y: 0 },
    rotation: 0,
    scale: 1,
    missingTrackers: Object.values(config)
  });

  const calculateCenter = (location: QRCode['location']) => {
    const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } = location;
    return {
      x: (topLeftCorner.x + topRightCorner.x + bottomLeftCorner.x + bottomRightCorner.x) / 4,
      y: (topLeftCorner.y + topRightCorner.y + bottomLeftCorner.y + bottomRightCorner.y) / 4
    };
  };

  const identifyTrackerPosition = (data: string): 'topLeft' | 'topRight' | 'bottomLeft' | null => {
    if (data === config.topLeft) return 'topLeft';
    if (data === config.topRight) return 'topRight';
    if (data === config.bottomLeft) return 'bottomLeft';
    return null;
  };

  const calculateAlignment = useCallback((trackers: DetectedTracker[]): AlignmentStatus => {
    const foundTrackers = new Set(trackers.map(t => t.position));
    const missingTrackers = ['topLeft', 'topRight', 'bottomLeft'].filter(
      pos => !foundTrackers.has(pos as any)
    );

    if (trackers.length < 2) {
      return {
        isAligned: false,
        translation: { x: 0, y: 0 },
        rotation: 0,
        scale: 1,
        missingTrackers
      };
    }

    // Find expected positions based on target rectangle
    const { width: targetWidth, height: targetHeight } = config.targetRectangle;
    
    // Calculate current rectangle from detected trackers
    const topLeft = trackers.find(t => t.position === 'topLeft');
    const topRight = trackers.find(t => t.position === 'topRight');
    const bottomLeft = trackers.find(t => t.position === 'bottomLeft');

    if (!topLeft || (!topRight && !bottomLeft)) {
      return {
        isAligned: false,
        translation: { x: 0, y: 0 },
        rotation: 0,
        scale: 1,
        missingTrackers
      };
    }

    let currentWidth = 0;
    let currentHeight = 0;
    let rotation = 0;

    if (topRight && bottomLeft) {
      // All three corners detected - best case
      currentWidth = Math.sqrt(
        Math.pow(topRight.center.x - topLeft.center.x, 2) + 
        Math.pow(topRight.center.y - topLeft.center.y, 2)
      );
      currentHeight = Math.sqrt(
        Math.pow(bottomLeft.center.x - topLeft.center.x, 2) + 
        Math.pow(bottomLeft.center.y - topLeft.center.y, 2)
      );
      
      // Calculate rotation from top edge
      rotation = Math.atan2(
        topRight.center.y - topLeft.center.y,
        topRight.center.x - topLeft.center.x
      ) * 180 / Math.PI;
    } else if (topRight) {
      // Two corners: topLeft and topRight
      currentWidth = Math.sqrt(
        Math.pow(topRight.center.x - topLeft.center.x, 2) + 
        Math.pow(topRight.center.y - topLeft.center.y, 2)
      );
      rotation = Math.atan2(
        topRight.center.y - topLeft.center.y,
        topRight.center.x - topLeft.center.x
      ) * 180 / Math.PI;
    } else if (bottomLeft) {
      // Two corners: topLeft and bottomLeft
      currentHeight = Math.sqrt(
        Math.pow(bottomLeft.center.x - topLeft.center.x, 2) + 
        Math.pow(bottomLeft.center.y - topLeft.center.y, 2)
      );
      rotation = Math.atan2(
        bottomLeft.center.x - topLeft.center.x,
        bottomLeft.center.y - topLeft.center.y
      ) * 180 / Math.PI - 90;
    }

    const scale = currentWidth > 0 ? currentWidth / targetWidth : 
                 currentHeight > 0 ? currentHeight / targetHeight : 1;

    // Calculate center offset
    const canvasCenter = { 
      x: canvasRef.current?.width || 0 / 2, 
      y: canvasRef.current?.height || 0 / 2 
    };
    
    const detectedCenter = topLeft.center;
    const translation = {
      x: detectedCenter.x - canvasCenter.x,
      y: detectedCenter.y - canvasCenter.y
    };

    // Determine if aligned (within thresholds)
    const isAligned = 
      Math.abs(translation.x) < 50 && 
      Math.abs(translation.y) < 50 && 
      Math.abs(rotation) < 10 && 
      Math.abs(scale - 1) < 0.2 &&
      missingTrackers.length === 0;

    return {
      isAligned,
      translation,
      rotation,
      scale,
      missingTrackers
    };
  }, [config]);

  const scanForQRCodes = useCallback(() => {
    if (!isActive || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    
    if (code) {
      const position = identifyTrackerPosition(code.data);
      if (position) {
        const center = calculateCenter(code.location);
        const tracker: DetectedTracker = {
          id: code.data,
          position,
          location: code.location,
          center
        };
        
        setDetectedTrackers(prev => {
          const filtered = prev.filter(t => t.position !== position);
          return [...filtered, tracker];
        });
      }
    }

    // Clean up old detections (remove trackers not seen for 1 second)
    setDetectedTrackers(prev => {
      // For simplicity, we'll keep all detected trackers for now
      // In a real implementation, you'd add timestamps and clean up old ones
      return prev;
    });
  }, [isActive, videoRef, config]);

  useEffect(() => {
    if (!isActive) {
      setDetectedTrackers([]);
      return;
    }

    const interval = setInterval(scanForQRCodes, 100); // Scan 10 times per second
    return () => clearInterval(interval);
  }, [isActive, scanForQRCodes]);

  useEffect(() => {
    const newAlignment = calculateAlignment(detectedTrackers);
    setAlignmentStatus(newAlignment);
    onAlignmentChange?.(newAlignment);
  }, [detectedTrackers, calculateAlignment, onAlignmentChange]);

  const renderOverlay = () => {
    if (!isActive || !canvasRef.current) return null;

    return (
      <Box
        ref={overlayRef}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10
        }}
      >
        {/* Detected tracker indicators */}
        {detectedTrackers.map((tracker) => (
          <Box
            key={tracker.id}
            sx={{
              position: 'absolute',
              left: `${(tracker.center.x / (canvasRef.current?.width || 1)) * 100}%`,
              top: `${(tracker.center.y / (canvasRef.current?.height || 1)) * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 20,
              height: 20,
              borderRadius: '50%',
              bgcolor: 'success.main',
              border: '2px solid white',
              boxShadow: 2
            }}
          />
        ))}

        {/* Center crosshair */}
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 40,
            height: 40,
            border: '2px solid',
            borderColor: alignmentStatus.isAligned ? 'success.main' : 'warning.main',
            borderRadius: '50%',
            '&::before, &::after': {
              content: '""',
              position: 'absolute',
              bgcolor: 'currentColor',
            },
            '&::before': {
              left: '50%',
              top: '10%',
              width: 2,
              height: '80%',
              transform: 'translateX(-50%)',
            },
            '&::after': {
              left: '10%',
              top: '50%',
              width: '80%',
              height: 2,
              transform: 'translateY(-50%)',
            }
          }}
        />

        {/* Target rectangle outline */}
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '60%',
            height: '45%',
            border: '2px dashed',
            borderColor: alignmentStatus.isAligned ? 'success.main' : 'info.main',
            borderRadius: 1,
            opacity: 0.7
          }}
        />
      </Box>
    );
  };

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />
      
      {renderOverlay()}
      
      {/* Status panel */}
      {isActive && (
        <Paper
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            p: 2,
            minWidth: 200,
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            zIndex: 20
          }}
        >
          <Typography variant="h6" gutterBottom>
            QR Tracker Status
          </Typography>
          
          <Stack spacing={1}>
            <Chip
              label={alignmentStatus.isAligned ? 'ALIGNED ✓' : 'ALIGNING...'}
              color={alignmentStatus.isAligned ? 'success' : 'warning'}
              size="small"
            />
            
            <Typography variant="body2">
              Detected: {detectedTrackers.length}/3 trackers
            </Typography>
            
            {alignmentStatus.missingTrackers.length > 0 && (
              <Typography variant="body2" color="warning.main">
                Missing: {alignmentStatus.missingTrackers.join(', ')}
              </Typography>
            )}
            
            <Typography variant="body2">
              Offset: {Math.round(alignmentStatus.translation.x)}, {Math.round(alignmentStatus.translation.y)}
            </Typography>
            
            <Typography variant="body2">
              Rotation: {Math.round(alignmentStatus.rotation)}°
            </Typography>
            
            <Typography variant="body2">
              Scale: {Math.round(alignmentStatus.scale * 100)}%
            </Typography>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}