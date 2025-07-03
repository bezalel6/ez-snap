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

    const canvasWidth = canvasRef.current.width || 640;
    const canvasHeight = canvasRef.current.height || 480;

    // Calculate target positions for QR trackers (where they should be)
    const targetPositions = {
      topLeft: { x: canvasWidth * 0.2, y: canvasHeight * 0.2 },
      topRight: { x: canvasWidth * 0.8, y: canvasHeight * 0.2 },
      bottomLeft: { x: canvasWidth * 0.2, y: canvasHeight * 0.8 }
    };

    const getMovementIndicators = () => {
      if (alignmentStatus.isAligned) return null;

      const indicators = [];

      // Movement arrows based on translation
      if (Math.abs(alignmentStatus.translation.x) > 50) {
        const direction = alignmentStatus.translation.x > 0 ? 'left' : 'right';
        const arrow = direction === 'left' ? '◀◀◀' : '▶▶▶';
        indicators.push(
          <Box
            key="horizontal-arrow"
            sx={{
              position: 'absolute',
              left: '50%',
              top: '20%',
              transform: 'translateX(-50%)',
              fontSize: '2rem',
              color: 'warning.main',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              animation: 'pulse 1.5s infinite'
            }}
          >
            {arrow}
          </Box>
        );
      }

      if (Math.abs(alignmentStatus.translation.y) > 50) {
        const direction = alignmentStatus.translation.y > 0 ? 'up' : 'down';
        const arrow = direction === 'up' ? '▲▲▲' : '▼▼▼';
        indicators.push(
          <Box
            key="vertical-arrow"
            sx={{
              position: 'absolute',
              left: '80%',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '2rem',
              color: 'warning.main',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              animation: 'pulse 1.5s infinite'
            }}
          >
            {arrow}
          </Box>
        );
      }

      // Rotation indicator
      if (Math.abs(alignmentStatus.rotation) > 10) {
        const rotateIcon = alignmentStatus.rotation > 0 ? '↺' : '↻';
        indicators.push(
          <Box
            key="rotation-indicator"
            sx={{
              position: 'absolute',
              left: '50%',
              top: '80%',
              transform: 'translateX(-50%)',
              fontSize: '3rem',
              color: 'info.main',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              animation: 'spin 2s linear infinite'
            }}
          >
            {rotateIcon}
          </Box>
        );
      }

      // Scale indicator
      if (Math.abs(alignmentStatus.scale - 1) > 0.2) {
        const scaleIcon = alignmentStatus.scale > 1 ? '🔍➖' : '🔍➕';
        const instruction = alignmentStatus.scale > 1 ? 'MOVE BACK' : 'MOVE CLOSER';
        indicators.push(
          <Box
            key="scale-indicator"
            sx={{
              position: 'absolute',
              left: '50%',
              bottom: '20%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              color: 'secondary.main',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              animation: 'bounce 1s infinite'
            }}
          >
            <Box sx={{ fontSize: '2rem' }}>{scaleIcon}</Box>
            <Box sx={{ fontSize: '1rem' }}>{instruction}</Box>
          </Box>
        );
      }

      return indicators;
    };

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
          zIndex: 10,
          '& @keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.5 }
          },
          '& @keyframes spin': {
            '0%': { transform: 'translateX(-50%) rotate(0deg)' },
            '100%': { transform: 'translateX(-50%) rotate(360deg)' }
          },
          '& @keyframes bounce': {
            '0%, 20%, 50%, 80%, 100%': { transform: 'translateX(-50%) translateY(0)' },
            '40%': { transform: 'translateX(-50%) translateY(-10px)' },
            '60%': { transform: 'translateX(-50%) translateY(-5px)' }
          }
        }}
      >
        {/* Target positions (ghost indicators where QR codes should be) */}
        {Object.entries(targetPositions).map(([position, targetPos]) => {
          const isDetected = detectedTrackers.some(t => t.position === position);
          const tracker = detectedTrackers.find(t => t.position === position);
          
          return (
            <Box
              key={`target-${position}`}
              sx={{
                position: 'absolute',
                left: `${(targetPos.x / canvasWidth) * 100}%`,
                top: `${(targetPos.y / canvasHeight) * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: 60,
                height: 60,
                border: isDetected ? '3px solid' : '3px dashed',
                borderColor: isDetected ? 'success.main' : 'warning.main',
                borderRadius: '12px',
                bgcolor: isDetected ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                color: isDetected ? 'success.main' : 'warning.main',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                animation: !isDetected ? 'pulse 2s infinite' : 'none'
              }}
            >
              {position === 'topLeft' && (isDetected ? '✓ TL' : 'TL')}
              {position === 'topRight' && (isDetected ? '✓ TR' : 'TR')}
              {position === 'bottomLeft' && (isDetected ? '✓ BL' : 'BL')}
            </Box>
          );
        })}

        {/* Connection lines between detected trackers */}
        {detectedTrackers.length >= 2 && (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
          >
            {detectedTrackers.length >= 2 && (() => {
              const topLeft = detectedTrackers.find(t => t.position === 'topLeft');
              const topRight = detectedTrackers.find(t => t.position === 'topRight');
              const bottomLeft = detectedTrackers.find(t => t.position === 'bottomLeft');
              
              const lines = [];
              
              if (topLeft && topRight) {
                lines.push(
                  <line
                    key="top-line"
                    x1={`${(topLeft.center.x / canvasWidth) * 100}%`}
                    y1={`${(topLeft.center.y / canvasHeight) * 100}%`}
                    x2={`${(topRight.center.x / canvasWidth) * 100}%`}
                    y2={`${(topRight.center.y / canvasHeight) * 100}%`}
                    stroke="#4CAF50"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />
                );
              }
              
              if (topLeft && bottomLeft) {
                lines.push(
                  <line
                    key="left-line"
                    x1={`${(topLeft.center.x / canvasWidth) * 100}%`}
                    y1={`${(topLeft.center.y / canvasHeight) * 100}%`}
                    x2={`${(bottomLeft.center.x / canvasWidth) * 100}%`}
                    y2={`${(bottomLeft.center.y / canvasHeight) * 100}%`}
                    stroke="#4CAF50"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />
                );
              }
              
              if (topRight && bottomLeft && topLeft) {
                lines.push(
                  <line
                    key="diagonal-line"
                    x1={`${(topRight.center.x / canvasWidth) * 100}%`}
                    y1={`${(topRight.center.y / canvasHeight) * 100}%`}
                    x2={`${(bottomLeft.center.x / canvasWidth) * 100}%`}
                    y2={`${(bottomLeft.center.y / canvasHeight) * 100}%`}
                    stroke="#4CAF50"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                    opacity="0.5"
                  />
                );
              }
              
              return lines;
            })()}
          </svg>
        )}

        {/* Movement indicators */}
        {getMovementIndicators()}

        {/* Center alignment indicator */}
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 30,
            height: 30,
            border: '2px solid',
            borderColor: alignmentStatus.isAligned ? 'success.main' : 'rgba(255,255,255,0.8)',
            borderRadius: '50%',
            bgcolor: alignmentStatus.isAligned ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            color: alignmentStatus.isAligned ? 'success.main' : 'white',
            fontWeight: 'bold'
          }}
        >
          {alignmentStatus.isAligned ? '✓' : '⊕'}
        </Box>

        {/* Alignment success indicator */}
        {alignmentStatus.isAligned && (
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: '30%',
              transform: 'translateX(-50%)',
              bgcolor: 'rgba(76, 175, 80, 0.9)',
              color: 'white',
              px: 3,
              py: 1,
              borderRadius: 2,
              fontSize: '1.2rem',
              fontWeight: 'bold',
              textAlign: 'center',
              animation: 'bounce 1s infinite'
            }}
          >
            🎯 PERFECTLY ALIGNED!
            <br />
            <span style={{ fontSize: '0.9rem' }}>Ready to capture</span>
          </Box>
        )}

        {/* Missing trackers indicator */}
        {alignmentStatus.missingTrackers.length > 0 && (
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: '10%',
              transform: 'translateX(-50%)',
              bgcolor: 'rgba(255, 152, 0, 0.9)',
              color: 'white',
              px: 2,
              py: 1,
              borderRadius: 1,
              fontSize: '0.9rem',
              fontWeight: 'bold',
              textAlign: 'center',
              animation: 'pulse 2s infinite'
            }}
          >
            🔍 Look for: {alignmentStatus.missingTrackers.join(', ')}
          </Box>
        )}
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