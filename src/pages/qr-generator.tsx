import Head from "next/head";
import { useState, useRef, useEffect } from "react";
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  Grid,
  AppBar,
  Toolbar,
  IconButton,
  TextField,
  Stack,
  Card,
  CardContent,
} from "@mui/material";
import { ArrowBack, Download, Print } from "@mui/icons-material";
import QRCode from "qrcode";
import { useRouter } from "next/router";

export default function QRGenerator() {
  const router = useRouter();
  const [qrData, setQrData] = useState({
    topLeft: "TL_TRACKER_001",
    topRight: "TR_TRACKER_002", 
    bottomLeft: "BL_TRACKER_003",
  });
  const [qrCodes, setQrCodes] = useState<{[key: string]: string}>({});
  const [rectangleDimensions, setRectangleDimensions] = useState({
    width: 400,
    height: 300,
  });

  const generateQRCodes = async () => {
    try{
      const codes: {[key: string]: string} = {};
      
      for (const [position, data] of Object.entries(qrData)){
        codes[position] = await QRCode.toDataURL(data, {
          width: 120,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
      }
      
      setQrCodes(codes);
    } catch (error) {
      console.error('Error generating QR codes:', error);
    }
  };

  const downloadReferenceSheet = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const padding = 50;
    const qrSize = 120;
    canvas.width = rectangleDimensions.width + qrSize + padding * 3;
    canvas.height = rectangleDimensions.height + qrSize + padding * 3;

    // Draw white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw reference rectangle outline
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(
      padding + qrSize/2, 
      padding + qrSize/2, 
      rectangleDimensions.width, 
      rectangleDimensions.height
    );

    // Draw corner markers
    ctx.setLineDash([]);
    ctx.strokeStyle = '#0000FF';
    ctx.lineWidth = 1;
    
    const corners = [
      { x: padding + qrSize/2, y: padding + qrSize/2, label: 'TL' },
      { x: padding + qrSize/2 + rectangleDimensions.width, y: padding + qrSize/2, label: 'TR' },
      { x: padding + qrSize/2, y: padding + qrSize/2 + rectangleDimensions.height, label: 'BL' }
    ];

    corners.forEach(corner => {
      ctx.strokeRect(corner.x - 10, corner.y - 10, 20, 20);
      ctx.fillStyle = '#0000FF';
      ctx.font = '12px Arial';
      ctx.fillText(corner.label, corner.x - 10, corner.y - 15);
    });

    // Load and draw QR codes
    const images = Object.entries(qrCodes).map(([position, dataUrl]) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          let x, y;
          switch(position){
            case 'topLeft':
              x = padding;
              y = padding;
              break;
            case 'topRight':
              x = padding + qrSize/2 + rectangleDimensions.width;
              y = padding;
              break;
            case 'bottomLeft':
              x = padding;
              y = padding + qrSize/2 + rectangleDimensions.height;
              break;
            default:
              return resolve();
          }
          ctx.drawImage(img, x, y, qrSize, qrSize);
          resolve();
        };
        img.src = dataUrl;
      });
    });

    Promise.all(images).then(() => {
      // Add title and instructions
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 16px Arial';
      ctx.fillText('QR Tracker Reference Sheet', padding, 30);
      
      ctx.font = '12px Arial';
      ctx.fillText(`Rectangle: ${rectangleDimensions.width}x${rectangleDimensions.height}px`, padding, canvas.height - 60);
      ctx.fillText('Position QR codes at the marked corners for alignment', padding, canvas.height - 40);
      ctx.fillText('Use this sheet with the QR Tracker Detection feature', padding, canvas.height - 20);

      // Download
      const link = document.createElement('a');
      link.download = `qr-tracker-reference-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  };

  useEffect(() => {
    generateQRCodes();
  }, [qrData]);

  return (
    <>
      <Head>
        <title>QR Tracker Generator - EZ Snap</title>
        <meta name="description" content="Generate QR codes for precise alignment tracking" />
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
              QR Tracker Generator
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth="md" sx={{ py: 3 }}>
          <Typography variant="h4" gutterBottom align="center" color="primary">
            🎯 QR Tracker Generator
          </Typography>
          <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
            Generate QR codes for precise alignment tracking. Print and position these at the corners of your target rectangle.
          </Typography>

          <Grid container spacing={3}>
            {/* Configuration Panel */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Tracker Configuration
                </Typography>
                
                <Stack spacing={2}>
                  <TextField
                    label="Top Left Tracker ID"
                    value={qrData.topLeft}
                    onChange={(e) => setQrData(prev => ({ ...prev, topLeft: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Top Right Tracker ID"
                    value={qrData.topRight}
                    onChange={(e) => setQrData(prev => ({ ...prev, topRight: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Bottom Left Tracker ID"
                    value={qrData.bottomLeft}
                    onChange={(e) => setQrData(prev => ({ ...prev, bottomLeft: e.target.value }))}
                    fullWidth
                  />
                </Stack>

                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                  Rectangle Dimensions
                </Typography>
                
                <Stack spacing={2}>
                  <TextField
                    label="Width (px)"
                    type="number"
                    value={rectangleDimensions.width}
                    onChange={(e) => setRectangleDimensions(prev => ({ ...prev, width: parseInt(e.target.value) || 400 }))}
                    fullWidth
                  />
                  <TextField
                    label="Height (px)"
                    type="number"
                    value={rectangleDimensions.height}
                    onChange={(e) => setRectangleDimensions(prev => ({ ...prev, height: parseInt(e.target.value) || 300 }))}
                    fullWidth
                  />
                </Stack>

                <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    onClick={downloadReferenceSheet}
                    startIcon={<Download />}
                    disabled={Object.keys(qrCodes).length === 0}
                    fullWidth
                  >
                    Download Reference Sheet
                  </Button>
                </Stack>
              </Paper>
            </Grid>

            {/* QR Code Preview */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Generated QR Codes
                </Typography>
                
                <Grid container spacing={2}>
                  {Object.entries(qrCodes).map(([position, dataUrl]) => (
                    <Grid size={4} key={position}>
                      <Card>
                        <CardContent sx={{ textAlign: 'center', p: 1 }}>
                          <img 
                            src={dataUrl} 
                            alt={`QR ${position}`}
                            style={{ width: '100%', height: 'auto' }}
                          />
                          <Typography variant="caption" display="block">
                            {position.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {qrData[position as keyof typeof qrData]}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>

                {Object.keys(qrCodes).length > 0 && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                    <Typography variant="body2" color="info.dark">
                      <strong>Instructions:</strong><br />
                      1. Download the reference sheet<br />
                      2. Print it or display on screen<br />
                      3. Position QR codes at marked corners<br />
                      4. Use QR Tracker Detection to align your camera
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
}