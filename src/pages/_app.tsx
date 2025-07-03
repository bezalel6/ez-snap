import type { AppProps } from "next/app";
import Head from "next/head";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { CacheProvider, type EmotionCache } from "@emotion/react";
import createEmotionCache from "@/utils/createEmotionCache";
import { SocketProvider } from "@/utils/socket";

import { api } from "@/utils/api";

// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();

interface MyAppProps extends AppProps {
  emotionCache?: EmotionCache;
}

// Create a theme instance.
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#90caf9",
      light: "#bbdefb",
      dark: "#42a5f5",
    },
    secondary: {
      main: "#ff7043",
      light: "#ffab91",
      dark: "#f4511e",
    },
    background: {
      default: "#121212",
      paper: "#1e1e1e",
    },
    text: {
      primary: "#ffffff",
      secondary: "rgba(255, 255, 255, 0.7)",
    },
    divider: "rgba(255, 255, 255, 0.12)",
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 8,
          fontWeight: 500,
        },
        contained: {
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          "&:hover": {
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          },
        },
        outlined: {
          borderColor: "rgba(255, 255, 255, 0.23)",
          "&:hover": {
            borderColor: "rgba(255, 255, 255, 0.5)",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundImage: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          transition: "transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
          backgroundImage: "none",
          backgroundColor: "#1e1e1e",
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          height: 8,
        },
        thumb: {
          height: 20,
          width: 20,
          backgroundColor: "#90caf9",
          "&:hover": {
            boxShadow: "0 0 0 8px rgba(144, 202, 249, 0.16)",
          },
        },
        track: {
          backgroundColor: "#90caf9",
        },
        rail: {
          backgroundColor: "rgba(255, 255, 255, 0.3)",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#1e1e1e",
          backgroundImage: "none",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          "&.MuiChip-colorWarning": {
            backgroundColor: "#ffd54f",
            color: "#000000",
          },
        },
      },
    },
  },
});

function MyApp({
  Component,
  pageProps,
  emotionCache = clientSideEmotionCache,
}: MyAppProps) {
  return (
    <CacheProvider value={emotionCache}>
      <Head>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
        <meta name="theme-color" content="#121212" />
      </Head>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SocketProvider>
          <Component {...pageProps} />
        </SocketProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}

export default api.withTRPC(MyApp);
