/**
 * Shared RefreshButton Component
 * 
 * Standardized refresh button used across all dashboard pages.
 * Shows spinning animation while refreshing, with consistent styling.
 * 
 * @module components/common/RefreshButton
 * @version 1.0.0
 */

import React, { useCallback, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface RefreshButtonProps {
  /** Function to call when refresh is triggered. Can be async. */
  onRefresh: () => void | Promise<void>;
  /** Whether data is currently loading/refreshing */
  isRefreshing?: boolean;
  /** Button size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional label text next to the icon */
  label?: string;
  /** Optional additional CSS classes */
  className?: string;
  /** Tooltip text */
  title?: string;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  onRefresh,
  isRefreshing = false,
  size = 'md',
  label,
  className = '',
  title = 'Refresh data',
}) => {
  const [spinning, setSpinning] = useState(false);

  const handleClick = useCallback(async () => {
    if (spinning || isRefreshing) return;
    setSpinning(true);
    try {
      await onRefresh();
    } finally {
      // Minimum spin duration for visual feedback
      setTimeout(() => setSpinning(false), 600);
    }
  }, [onRefresh, spinning, isRefreshing]);

  const isActive = spinning || isRefreshing;

  const sizeConfig = {
    sm: { icon: 14, px: 'px-2', py: 'py-1', text: 'text-xs' },
    md: { icon: 16, px: 'px-3', py: 'py-1.5', text: 'text-sm' },
    lg: { icon: 18, px: 'px-4', py: 'py-2', text: 'text-sm' },
  };

  const cfg = sizeConfig[size];

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isActive}
      title={title}
      className={`
        inline-flex items-center gap-1.5 ${cfg.px} ${cfg.py} ${cfg.text}
        font-medium rounded-lg border
        transition-all duration-200
        ${isActive
          ? 'bg-blue-50 text-blue-400 border-blue-200 cursor-not-allowed'
          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-blue-600 hover:border-blue-300 active:bg-blue-50'
        }
        ${className}
      `}
    >
      <RefreshCw
        size={cfg.icon}
        className={`transition-transform duration-500 ${isActive ? 'animate-spin' : ''}`}
      />
      {label && <span>{label}</span>}
    </button>
  );
};

export default RefreshButton;
