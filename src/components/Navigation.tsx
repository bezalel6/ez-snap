import { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Button,
  Box,
  Chip,
  Stack,
  Divider,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Home,
  QrCode2,
  CameraAlt,
  Speed,
  Memory,
  Science,
  PhotoCamera,
  QrCodeScanner,
  Engineering,
} from "@mui/icons-material";
import { useRouter } from "next/router";

interface NavigationProps {
  title?: string;
  showFPS?: boolean;
  fps?: number;
  additionalInfo?: React.ReactNode;
}

export default function Navigation({
  title = "EZ Snap",
  showFPS = false,
  fps = 0,
  additionalInfo,
}: NavigationProps) {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const navigateTo = (path: string) => {
    router.push(path);
    handleMenuClose();
  };

  const currentPath = router.pathname;

  const menuItems = [
    {
      path: "/",
      label: "Home",
      icon: <Home />,
      description: "Photo capture & editing",
      category: "Main",
    },
    {
      path: "/qr-generator",
      label: "QR Generator",
      icon: <QrCode2 />,
      description: "Generate optimized QR tracker codes",
      category: "QR Tools",
    },
    {
      path: "/live-qr-scan",
      label: "Live QR Scanner",
      icon: <QrCodeScanner />,
      description: "High-performance real-time QR detection",
      category: "QR Tools",
      badge: "GPU Accelerated",
    },
    {
      path: "/qr-tracker",
      label: "QR Tracker & Cone Scanner",
      icon: <Engineering />,
      description: "Precise alignment & magnetic peg detection",
      category: "QR Tools",
    },
    {
      path: "/qr-perf-test",
      label: "Performance Test",
      icon: <Speed />,
      description: "Compare GPU vs CPU detection speed",
      category: "Development",
    },
  ];

  const categories = ["Main", "QR Tools", "Development"];

  return (
    <AppBar position="static" elevation={0}>
      <Toolbar>
        <IconButton
          edge="start"
          color="inherit"
          onClick={handleMenuOpen}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>

        {/* Additional info in center */}
        {additionalInfo && (
          <Box sx={{ display: "flex", alignItems: "center", mr: 2 }}>
            {additionalInfo}
          </Box>
        )}

        {/* FPS indicator */}
        {showFPS && (
          <Chip
            label={`${fps} FPS`}
            color={fps > 20 ? "success" : fps > 10 ? "warning" : "error"}
            size="small"
            sx={{ mr: 1 }}
            icon={<Speed />}
          />
        )}

        {/* Quick actions */}
        <Stack direction="row" spacing={1}>
          {currentPath !== "/" && (
            <IconButton
              color="inherit"
              onClick={() => navigateTo("/")}
              title="Home"
            >
              <Home />
            </IconButton>
          )}

          {currentPath !== "/live-qr-scan" && (
            <IconButton
              color="inherit"
              onClick={() => navigateTo("/live-qr-scan")}
              title="Quick QR Scan"
            >
              <CameraAlt />
            </IconButton>
          )}
        </Stack>

        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleMenuClose}
          PaperProps={{
            sx: {
              minWidth: 350,
              maxHeight: 500,
              mt: 1,
            },
          }}
        >
          <Box sx={{ p: 2, pb: 1 }}>
            <Typography variant="h6" color="primary">
              🚀 EZ Snap Navigation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Choose your tool or feature
            </Typography>
          </Box>

          {categories.map((category) => {
            const categoryItems = menuItems.filter(
              (item) => item.category === category,
            );

            return (
              <Box key={category}>
                <Divider sx={{ my: 1 }} />
                <Typography
                  variant="caption"
                  sx={{
                    px: 2,
                    py: 1,
                    display: "block",
                    fontWeight: "bold",
                    color: "text.secondary",
                  }}
                >
                  {category}
                </Typography>

                {categoryItems.map((item) => (
                  <MenuItem
                    key={item.path}
                    onClick={() => navigateTo(item.path)}
                    selected={currentPath === item.path}
                    sx={{
                      py: 1.5,
                      px: 2,
                      "&.Mui-selected": {
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        "&:hover": {
                          bgcolor: "primary.dark",
                        },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: "inherit" }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" fontWeight="medium">
                            {item.label}
                          </Typography>
                          {item.badge && (
                            <Chip
                              label={item.badge}
                              size="small"
                              color="success"
                              sx={{ height: 20, fontSize: "10px" }}
                            />
                          )}
                        </Stack>
                      }
                      secondary={item.description}
                    />
                  </MenuItem>
                ))}
              </Box>
            );
          })}

          <Divider sx={{ my: 1 }} />
          <Box sx={{ p: 2, pt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              💡 Tip: Use GPU-accelerated Live QR Scanner for best performance!
            </Typography>
          </Box>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
