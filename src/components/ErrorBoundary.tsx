import { logger } from '@/utils'
import React, { type ErrorInfo } from 'react'
import { Box, Button, Typography } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
          gap={2}
          p={3}
        >
          <ErrorOutlineIcon sx={{ fontSize: 64, color: 'error.main' }} />
          <Typography variant="h5" color="error" align="center">
            Error
          </Typography>
          <Typography variant="body1" color="text.secondary" align="center">
            Sorry, something went wrong.
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            reload
          </Button>
        </Box>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
