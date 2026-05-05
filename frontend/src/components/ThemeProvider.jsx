import { createContext, useContext, useState, useMemo } from 'react'
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

const ThemeContext = createContext()

export function useThemeMode() {
  return useContext(ThemeContext)
}

export default function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('themeMode') || 'light')

  const toggleTheme = () => {
    const next = mode === 'light' ? 'dark' : 'light'
    setMode(next)
    localStorage.setItem('themeMode', next)
  }

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
      secondary: { main: '#ec4899', light: '#f472b6', dark: '#db2777' },
      success: { main: '#10b981', light: '#34d399', dark: '#059669' },
      warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
      error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
      ...(mode === 'light' ? {
        background: { default: '#f8fafc', paper: '#ffffff' },
        text: { primary: '#1e293b', secondary: '#475569' },
      } : {
        background: { default: '#0f172a', paper: '#1e293b' },
        text: { primary: '#f1f5f9', secondary: '#94a3b8' },
      }),
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: { fontWeight: 700 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, borderRadius: 10, padding: '8px 20px' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { borderRadius: 0 },
        },
      },
    },
  }), [mode])

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  )
}
