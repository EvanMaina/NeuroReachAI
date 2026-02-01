/**
 * EmbedWidgetApp - Top-level embed widget wrapper
 * 
 * Renders a professional floating "Free Assessment" launcher button and the
 * widget panel. All styles use inline CSS for maximum isolation from host.
 * 
 * @module components/widget-embed/EmbedWidgetApp
 * @version 2.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { EmbedIntakeWidget } from './EmbedIntakeWidget';

// Import widget-scoped CSS (Tailwind + custom styles)
import './widget-embed.css';

interface EmbedWidgetAppProps {
  apiUrl: string;
  position?: string;
}

/** Brand colors */
const BRAND = {
  purple: '#7C3AED',
  purpleDark: '#6D28D9',
  purpleDeep: '#5B21B6',
  purpleLight: '#8B5CF6',
  purpleGlow: 'rgba(124, 58, 237, 0.4)',
  white: '#FFFFFF',
};

export const EmbedWidgetApp: React.FC<EmbedWidgetAppProps> = ({
  apiUrl,
  position = 'bottom-right',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleToggle = useCallback(() => {
    if (isOpen) {
      setIsClosing(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
      }, 280);
    } else {
      setIsOpen(true);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleToggle();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleToggle]);

  const isLeft = position === 'bottom-left';

  return (
    <div className="nr-widget-root">
      {/* Backdrop when widget is open (subtle overlay) */}
      {isOpen && (
        <div
          onClick={handleToggle}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483640,
            background: 'rgba(0,0,0,0.08)',
            opacity: isClosing ? 0 : 1,
            transition: 'opacity 0.28s ease',
          }}
        />
      )}

      {/* Main widget container */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: isLeft ? 'auto' : '24px',
          left: isLeft ? '24px' : 'auto',
          zIndex: 2147483647,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {/* Widget Panel */}
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: '64px',
              right: isLeft ? 'auto' : '0',
              left: isLeft ? '0' : 'auto',
              width: '400px',
              maxWidth: 'calc(100vw - 48px)',
              maxHeight: 'calc(100vh - 140px)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.06)',
              transformOrigin: isLeft ? 'bottom left' : 'bottom right',
              animation: isClosing
                ? 'nr-widget-slide-out 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                : 'nr-widget-slide-in 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <EmbedIntakeWidget
              apiUrl={apiUrl}
              onClose={handleToggle}
            />
          </div>
        )}

        {/* ====================================================
            FLOATING LAUNCHER BUTTON — Professional Pill Design
            ==================================================== */}
        <button
          onClick={handleToggle}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label={isOpen ? 'Close assessment' : 'Take a free TMS assessment'}
          style={{
            // Layout
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            // Size - pill shape
            padding: isOpen ? '14px' : '14px 24px',
            minWidth: isOpen ? '52px' : 'auto',
            height: '52px',
            // Shape
            borderRadius: isOpen ? '50%' : '26px',
            border: 'none',
            // Color — brand purple gradient
            background: isHovered
              ? `linear-gradient(135deg, ${BRAND.purpleDeep}, ${BRAND.purple})`
              : `linear-gradient(135deg, ${BRAND.purpleDark}, ${BRAND.purpleLight})`,
            color: BRAND.white,
            // Shadow
            boxShadow: isHovered
              ? `0 12px 40px -8px ${BRAND.purpleGlow}, 0 4px 12px -4px rgba(0,0,0,0.15)`
              : `0 8px 30px -8px ${BRAND.purpleGlow}, 0 2px 8px -4px rgba(0,0,0,0.1)`,
            // Typography
            fontFamily: 'inherit',
            fontSize: '15px',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            // Interaction
            cursor: 'pointer',
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            // Animation
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: mounted
              ? isHovered ? 'translateY(-2px)' : 'translateY(0)'
              : 'translateY(20px) scale(0.9)',
            opacity: mounted ? 1 : 0,
          }}
        >
          {isOpen ? (
            /* Close X icon when panel is open */
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <>
              {/* Sparkle / Assessment icon */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="M12 3v2" />
                <path d="M12 19v2" />
                <path d="M3 12h2" />
                <path d="M19 12h2" />
                <circle cx="12" cy="12" r="4" />
                <path d="M18.364 5.636l-1.414 1.414" />
                <path d="M7.05 16.95l-1.414 1.414" />
                <path d="M5.636 5.636l1.414 1.414" />
                <path d="M16.95 16.95l1.414 1.414" />
              </svg>
              <span>Free Assessment</span>
            </>
          )}
        </button>

        {/* Subtle pulse ring when button is idle (closed) */}
        {!isOpen && mounted && (
          <div
            style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
              width: '100%',
              height: '52px',
              borderRadius: '26px',
              border: `2px solid ${BRAND.purple}`,
              pointerEvents: 'none',
              animation: 'nr-launcher-pulse 3s ease-in-out infinite',
              opacity: 0,
            }}
          />
        )}
      </div>

      {/* Inline keyframe styles for the pulse animation */}
      <style>{`
        @keyframes nr-launcher-pulse {
          0%, 100% { opacity: 0; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
};
