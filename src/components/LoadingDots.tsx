import React, { useEffect, useState } from 'react'

export const LoadingDots = React.memo(() => {
  const [dotCount, setDotCount] = useState(1)

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prevCount) => (prevCount % 3) + 1)
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="loading-dots"
      style={{
        fontSize: '18px',
        fontWeight: 'bold',
        minWidth: '100px',
        display: 'inlineBlock'
      }}
    >
      {'.'.repeat(dotCount)}
    </div>
  )
})
