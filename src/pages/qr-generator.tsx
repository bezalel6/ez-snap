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
    width: 595,  // A4 width at 72 DPI
    height: 842, // A4 height at 72 DPI (595 × √2)
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
      ctx.fillText('A4 QR Tracker Reference Sheet', padding, 30);
      
      ctx.font = '12px Arial';
      const isA4Portrait = rectangleDimensions.width === 595 && rectangleDimensions.height === 842;
      const isA4Landscape = rectangleDimensions.width === 842 && rectangleDimensions.height === 595;
      
      ctx.fillText(`A4 Page: ${rectangleDimensions.width}x${rectangleDimensions.height}px`, padding, canvas.height - 80);
      ctx.fillText(`Physical: ${isA4Portrait ? '210x297mm (Portrait)' : isA4Landscape ? '297x210mm (Landscape)' : 'Custom dimensions'}`, padding, canvas.height - 60);
      ctx.fillText('Position QR codes at the marked corners of your A4 document', padding, canvas.height - 40);
      ctx.fillText('Use this with QR Tracker Detection for perfect alignment', padding, canvas.height - 20);

      // Download
      const link = document.createElement('a');
      const orientation = isA4Portrait ? 'portrait' : isA4Landscape ? 'landscape' : 'custom';
      link.download = `a4-qr-tracker-${orientation}-${Date.now()}.png`;
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
            Generate QR codes for precise A4 page alignment tracking. Print the reference sheet and use it for perfect camera positioning.
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
                  A4 Page Dimensions
                </Typography>
                
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} justifyContent="center">
                    <Button
                      size="small"
                      variant={rectangleDimensions.width === 595 && rectangleDimensions.height === 842 ? "contained" : "outlined"}
                      onClick={() => setRectangleDimensions({ width: 595, height: 842 })}
                    >
                      A4 Portrait
                    </Button>
                    <Button
                      size="small"
                      variant={rectangleDimensions.width === 842 && rectangleDimensions.height === 595 ? "contained" : "outlined"}
                      onClick={() => setRectangleDimensions({ width: 842, height: 595 })}
                    >
                      A4 Landscape
                    </Button>
                  </Stack>
                  
                  <TextField
                    label="Width (px) - A4: 210mm = 595px"
                    type="number"
                    value={rectangleDimensions.width}
                    onChange={(e) => setRectangleDimensions(prev => ({ ...prev, width: parseInt(e.target.value) || 595 }))}
                    fullWidth
                    helperText="At 72 DPI: 210mm = 595px, 297mm = 842px"
                  />
                  <TextField
                    label="Height (px) - A4: 297mm = 842px"
                    type="number"
                    value={rectangleDimensions.height}
                    onChange={(e) => setRectangleDimensions(prev => ({ ...prev, height: parseInt(e.target.value) || 842 }))}
                    fullWidth
                    helperText={`Current ratio: ${(rectangleDimensions.width / rectangleDimensions.height).toFixed(3)} ${rectangleDimensions.width === 595 && rectangleDimensions.height === 842 ? '(Perfect A4 Portrait!)' : rectangleDimensions.width === 842 && rectangleDimensions.height === 595 ? '(Perfect A4 Landscape!)' : ''}`}
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
                       <strong>A4 Usage Instructions:</strong><br />
                       1. Download the A4 reference sheet<br />
                       2. Print on standard A4 paper (210×297mm)<br />
                       3. Cut out and position QR codes at document corners<br />
                       4. Use QR Tracker Detection for perfect alignment
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