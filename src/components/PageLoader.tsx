import logo from '@/assets/img/candyhouse_logo.png'
import React from 'react'

export const PageLoader: React.FC = () => {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa'
      }}
    >
      <style>
        {`
          @keyframes candyPulse {
            0%, 100% {
              transform: scale(1) rotate(0deg);
              opacity: 1;
            }
            50% {
              transform: scale(1.1) rotate(5deg);
              opacity: 0.8;
            }
          }
        `}
      </style>
      <img
        src={logo}
        alt="Loading..."
        style={{
          width: '120px',
          height: '120px',
          animation: 'candyPulse 1.5s ease-in-out infinite'
        }}
      />
    </div>
  )
}
