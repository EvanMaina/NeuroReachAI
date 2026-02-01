/**
 * Leads Trend Chart Component
 * 
 * High-performance line chart showing lead trends over time.
 * Supports both DAILY and MONTHLY aggregation with instant switching.
 * 
 * Performance optimizations:
 * - Local caching to prevent redundant API calls
 * - Memoized calculations with useMemo and useCallback
 * - Debounced API calls to prevent request flooding
 * - Smooth CSS transitions for instant visual feedback
 * - Optimistic UI updates with background data fetching
 * 
 * @module components/dashboard/LeadsTrendChart
 */

import React, { useMemo, useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  TrendingUp,
  Calendar,
  ChevronDown,
  BarChart3,
} from 'lucide-react';
import { 
  getMonthlyTrends, 
  getDailyTrends,
  type TrendPeriod, 
  type DailyTrendPeriod,
  type IMonthlyTrendsResponse,
  type IDailyTrendsResponse 
} from '../../services/leads';

// =============================================================================
// Types & Constants
// =============================================================================

interface LeadsTrendChartProps {
  title?: string;
  subtitle?: string;
}

type ViewMode = 'daily' | 'monthly';

interface ChartPoint {
  x: number;
  y: number;
  value: number;
  label: string;
  identifier: string;
  dayOfWeek?: string;
  hotLeads: number;
  mediumLeads: number;
  lowLeads: number;
  conversionRate: number;
}

interface ChartData {
  points: ChartPoint[];
  min: number;
  max: number;
  total: number;
  avg: number;
  peakLabel: string;
  peakCount: number;
  avgLabel: string;
  peakTypeLabel: string;
}

// Cache key generator
type CacheKey = `monthly_${TrendPeriod}` | `daily_${DailyTrendPeriod}`;

const MONTHLY_RANGE_OPTIONS: { value: TrendPeriod; label: string }[] = [
  { value: '6m', label: 'Last 6 months' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'all', label: 'All Time' },
];

const DAILY_RANGE_OPTIONS: { value: DailyTrendPeriod; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '60d', label: 'Last 60 days' },
];

// Chart dimensions (constant to avoid recalculation)
const CHART_HEIGHT = 200;
const CHART_PADDING = { top: 20, right: 20, bottom: 40, left: 50 };
const CHART_WIDTH = 600 - CHART_PADDING.left - CHART_PADDING.right;
const CHART_INNER_HEIGHT = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

// =============================================================================
// Memoized SVG Path Generators (outside component to avoid recreation)
// =============================================================================

const generateLinePath = (points: { x: number; y: number }[]): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1] || curr;
    const prev2 = points[i - 2] || prev;

    const cp1x = prev.x + (curr.x - prev2.x) / 6;
    const cp1y = prev.y + (curr.y - prev2.y) / 6;
    const cp2x = curr.x - (next.x - prev.x) / 6;
    const cp2y = curr.y - (next.y - prev.y) / 6;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
  }

  return path;
};

const generateAreaPath = (points: { x: number; y: number }[]): string => {
  if (points.length === 0) return '';
  
  const linePath = generateLinePath(points);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const bottomY = CHART_HEIGHT - CHART_PADDING.bottom;
  
  return `${linePath} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`;
};

// =============================================================================
// Memoized Sub-Components for Optimal Re-rendering
// =============================================================================

interface DataPointProps {
  point: ChartPoint;
  index: number;
  isHovered: boolean;
  color: string;
  onHover: (index: number | null) => void;
}

const DataPoint = memo<DataPointProps>(({ point, index, isHovered, color, onHover }) => (
  <g>
    <circle
      cx={point.x}
      cy={point.y}
      r="15"
      fill="transparent"
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'pointer' }}
    />
    <circle
      cx={point.x}
      cy={point.y}
      r={isHovered ? 6 : 4}
      fill="#fff"
      stroke={color}
      strokeWidth="2"
      style={{ transition: 'r 0.15s ease-out' }}
    />
  </g>
));
DataPoint.displayName = 'DataPoint';

interface TooltipProps {
  point: ChartPoint;
  color: string;
}

const Tooltip = memo<TooltipProps>(({ point, color }) => (
  <g style={{ transition: 'all 0.15s ease-out' }}>
    <line
      x1={point.x}
      y1={CHART_PADDING.top}
      x2={point.x}
      y2={CHART_HEIGHT - CHART_PADDING.bottom}
      stroke={color}
      strokeWidth="1"
      strokeDasharray="4,4"
      opacity="0.5"
    />
    <rect
      x={Math.max(70, Math.min(point.x - 70, 530))}
      y={Math.max(10, point.y - 75)}
      width="140"
      height="65"
      rx="6"
      fill="#1F2937"
    />
    <text
      x={Math.max(140, Math.min(point.x, 460))}
      y={Math.max(27, point.y - 58)}
      textAnchor="middle"
      fill="white"
      fontSize="12"
      fontWeight="bold"
    >
      {point.value.toLocaleString()} leads
    </text>
    <text
      x={Math.max(140, Math.min(point.x, 460))}
      y={Math.max(42, point.y - 43)}
      textAnchor="middle"
      fill="#9CA3AF"
      fontSize="10"
    >
      🔥 {point.hotLeads} | ⚡ {point.mediumLeads} | 💤 {point.lowLeads}
    </text>
    <text
      x={Math.max(140, Math.min(point.x, 460))}
      y={Math.max(57, point.y - 28)}
      textAnchor="middle"
      fill="#9CA3AF"
      fontSize="10"
    >
      {point.label}
      {point.dayOfWeek && ` (${point.dayOfWeek})`}
    </text>
    <text
      x={Math.max(140, Math.min(point.x, 460))}
      y={Math.max(72, point.y - 13)}
      textAnchor="middle"
      fill="#9CA3AF"
      fontSize="10"
    >
      {point.conversionRate}% converted
    </text>
  </g>
));
Tooltip.displayName = 'Tooltip';

// =============================================================================
// Skeleton Loader for smooth loading states
// =============================================================================

const ChartSkeleton = memo(() => (
  <div className="animate-pulse">
    <div className="grid grid-cols-3 gap-4 mb-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="text-center p-3 bg-gray-100 rounded-lg">
          <div className="h-8 bg-gray-200 rounded w-20 mx-auto mb-1" />
          <div className="h-3 bg-gray-200 rounded w-16 mx-auto" />
        </div>
      ))}
    </div>
    <div className="h-[200px] bg-gray-100 rounded-lg flex items-center justify-center">
      <svg className="w-12 h-12 text-gray-300" viewBox="0 0 24 24" fill="none">
        <path d="M3 12L7 8L11 14L15 6L21 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  </div>
));
ChartSkeleton.displayName = 'ChartSkeleton';

// =============================================================================
// Main Component
// =============================================================================

export const LeadsTrendChart: React.FC<LeadsTrendChartProps> = memo(({
  title = 'Leads Trend',
  subtitle,
}) => {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [monthlyTimeRange, setMonthlyTimeRange] = useState<TrendPeriod>('12m');
  const [dailyTimeRange, setDailyTimeRange] = useState<DailyTrendPeriod>('30d');
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache ref for instant view switching (persists across renders)
  const cacheRef = useRef<Map<CacheKey, IMonthlyTrendsResponse | IDailyTrendsResponse>>(new Map());
  const [cachedData, setCachedData] = useState<IMonthlyTrendsResponse | IDailyTrendsResponse | null>(null);
  
  // Debounce ref for API calls
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Current cache key
  const currentCacheKey: CacheKey = viewMode === 'monthly' 
    ? `monthly_${monthlyTimeRange}` 
    : `daily_${dailyTimeRange}`;

  // Dynamic subtitle
  const displaySubtitle = subtitle || (viewMode === 'daily' ? 'Daily lead volume' : 'Monthly lead volume over time');
  
  // Chart color based on view mode
  const chartColor = viewMode === 'daily' ? '#10B981' : '#3B82F6';

  // Memoized hover handler
  const handleHover = useCallback((index: number | null) => {
    setHoveredPoint(index);
  }, []);

  // Fetch data with caching, debouncing, and RETRY LOGIC (3 attempts, exponential backoff)
  const fetchTrends = useCallback(async (key: CacheKey, mode: ViewMode, range: string) => {
    // Check cache first - instant return if available
    const cached = cacheRef.current.get(key);
    if (cached) {
      setCachedData(cached);
      return;
    }

    // Abort any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    // Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        let data: IMonthlyTrendsResponse | IDailyTrendsResponse;
        
        if (mode === 'monthly') {
          data = await getMonthlyTrends(range as TrendPeriod);
        } else {
          data = await getDailyTrends(range as DailyTrendPeriod);
        }
        
        // Store in cache
        cacheRef.current.set(key, data);
        setCachedData(data);
        setError(null);
        setIsLoading(false);
        return; // Success - exit retry loop
        
      } catch (err: any) {
        lastError = err;
        
        // Don't retry if request was aborted
        if (err.name === 'AbortError') {
          setIsLoading(false);
          return;
        }
        
        console.warn(`[LeadsTrendChart] Attempt ${attempt + 1}/${MAX_RETRIES} failed:`, err.message);
        
        // Wait before retry (exponential backoff)
        if (attempt < MAX_RETRIES - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries exhausted
    console.error('[LeadsTrendChart] All retry attempts failed:', lastError);
    setError('Failed to load trend data. Please try refreshing.');
    setIsLoading(false);
  }, []);

  // Effect to fetch data (debounced)
  useEffect(() => {
    // Clear any pending fetch
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Check cache immediately for instant switching
    const cached = cacheRef.current.get(currentCacheKey);
    if (cached) {
      setCachedData(cached);
      setIsLoading(false);
      return;
    }

    // Show skeleton only if no cached data
    setIsLoading(true);

    // Debounce the actual API call (50ms)
    fetchTimeoutRef.current = setTimeout(() => {
      const range = viewMode === 'monthly' ? monthlyTimeRange : dailyTimeRange;
      fetchTrends(currentCacheKey, viewMode, range);
    }, 50);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [viewMode, monthlyTimeRange, dailyTimeRange, currentCacheKey, fetchTrends]);

  // Memoized chart data calculation
  const chartData = useMemo<ChartData>(() => {
    const defaultData: ChartData = { 
      points: [], 
      min: 0, 
      max: 0, 
      total: 0, 
      avg: 0, 
      peakLabel: 'N/A', 
      peakCount: 0,
      avgLabel: viewMode === 'monthly' ? 'Monthly Average' : 'Daily Average',
      peakTypeLabel: viewMode === 'monthly' ? 'Peak Month' : 'Peak Day',
    };

    if (!cachedData || !cachedData.data || cachedData.data.length === 0) {
      return defaultData;
    }

    const values = cachedData.data.map((d) => d.total_leads);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const dataLength = cachedData.data.length;

    const points: ChartPoint[] = cachedData.data.map((d, i) => ({
      x: CHART_PADDING.left + (i / (dataLength - 1 || 1)) * CHART_WIDTH,
      y: CHART_PADDING.top + CHART_INNER_HEIGHT - ((d.total_leads - min) / range) * CHART_INNER_HEIGHT,
      value: d.total_leads,
      label: d.label,
      identifier: viewMode === 'monthly' ? (d as any).month : (d as any).date,
      dayOfWeek: viewMode === 'daily' ? (d as any).day_of_week : undefined,
      hotLeads: d.hot_leads,
      mediumLeads: d.medium_leads,
      lowLeads: d.low_leads,
      conversionRate: d.conversion_rate,
    }));

    const summary = cachedData.summary;
    const avg = viewMode === 'monthly' 
      ? (summary as any).monthly_average 
      : (summary as any).daily_average;
    const peakLabel = viewMode === 'monthly'
      ? (summary as any).peak_month
      : (summary as any).peak_day;

    return { 
      points, 
      min, 
      max, 
      total: summary.total_leads,
      avg,
      peakLabel,
      peakCount: summary.peak_count,
      avgLabel: viewMode === 'monthly' ? 'Monthly Average' : 'Daily Average',
      peakTypeLabel: viewMode === 'monthly' ? 'Peak Month' : 'Peak Day',
    };
  }, [cachedData, viewMode]);

  // Memoized Y-axis labels
  const yAxisLabels = useMemo(() => {
    const { min, max } = chartData;
    const steps = 5;
    const range = max - min || 1;
    const stepValue = range / (steps - 1);
    
    return Array.from({ length: steps }, (_, i) => ({
      value: Math.round(max - i * stepValue),
      y: CHART_PADDING.top + (i / (steps - 1)) * CHART_INNER_HEIGHT,
    }));
  }, [chartData.min, chartData.max]);

  // Memoized X-axis label indices
  const xAxisLabelIndices = useMemo(() => {
    const maxLabels = viewMode === 'daily' ? 10 : 12;
    const pointCount = chartData.points.length;
    const showEvery = pointCount > maxLabels ? Math.ceil(pointCount / maxLabels) : 1;
    
    return chartData.points
      .map((_, i) => i)
      .filter((i) => i % showEvery === 0 || i === pointCount - 1);
  }, [chartData.points.length, viewMode]);

  // Memoized SVG paths
  const linePath = useMemo(() => generateLinePath(chartData.points), [chartData.points]);
  const areaPath = useMemo(() => generateAreaPath(chartData.points), [chartData.points]);

  // Range options and handlers
  const currentRangeOptions = viewMode === 'monthly' ? MONTHLY_RANGE_OPTIONS : DAILY_RANGE_OPTIONS;
  const currentTimeRange = viewMode === 'monthly' ? monthlyTimeRange : dailyTimeRange;
  
  const handleRangeChange = useCallback((value: string) => {
    if (viewMode === 'monthly') {
      setMonthlyTimeRange(value as TrendPeriod);
    } else {
      setDailyTimeRange(value as DailyTrendPeriod);
    }
    setShowRangeDropdown(false);
  }, [viewMode]);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setHoveredPoint(null);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showRangeDropdown) return;
    
    const handleClickOutside = () => setShowRangeDropdown(false);
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showRangeDropdown]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg transition-colors duration-200"
            style={{ backgroundColor: viewMode === 'daily' ? '#D1FAE5' : '#DBEAFE', color: chartColor }}
          >
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{displaySubtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleViewModeChange('daily')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                viewMode === 'daily'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar size={14} />
              Daily
            </button>
            <button
              onClick={() => handleViewModeChange('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                viewMode === 'monthly'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 size={14} />
              Monthly
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowRangeDropdown(!showRangeDropdown);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors duration-150"
            >
              <Calendar size={16} />
              <span>
                {currentRangeOptions.find((o) => o.value === currentTimeRange)?.label}
              </span>
              <ChevronDown 
                size={16} 
                className="transition-transform duration-150" 
                style={{ transform: showRangeDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {showRangeDropdown && (
              <div className="absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                {currentRangeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRangeChange(option.value);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors duration-100 ${
                      currentTimeRange === option.value
                        ? 'text-blue-600 font-medium bg-blue-50'
                        : 'text-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content with smooth transition */}
      <div 
        className="transition-opacity duration-200" 
        style={{ opacity: isLoading && !cachedData ? 0.6 : 1 }}
      >
        {isLoading && !cachedData ? (
          <ChartSkeleton />
        ) : error ? (
          <div className="h-[260px] flex items-center justify-center text-red-500">
            {error}
          </div>
        ) : (
          <>
            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {chartData.total.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">Total Leads</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {Math.round(chartData.avg).toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">{chartData.avgLabel}</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {chartData.peakLabel}
                </div>
                <div className="text-xs text-gray-500">{chartData.peakTypeLabel} ({chartData.peakCount})</div>
              </div>
            </div>

            {/* Chart */}
            <div className="relative">
              {chartData.points.length > 0 ? (
                <svg
                  viewBox={`0 0 600 ${CHART_HEIGHT}`}
                  className="w-full h-auto"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Gradient Definition */}
                  <defs>
                    <linearGradient id={`areaGradient-${viewMode}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColor} stopOpacity="0.3" />
                      <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Grid Lines */}
                  {yAxisLabels.map((label, i) => (
                    <g key={i}>
                      <line
                        x1={CHART_PADDING.left}
                        y1={label.y}
                        x2={600 - CHART_PADDING.right}
                        y2={label.y}
                        stroke="#E5E7EB"
                        strokeWidth="1"
                        strokeDasharray="4,4"
                      />
                      <text
                        x={CHART_PADDING.left - 10}
                        y={label.y + 4}
                        textAnchor="end"
                        fill="#9CA3AF"
                        fontSize="12"
                      >
                        {label.value}
                      </text>
                    </g>
                  ))}

                  {/* Area Fill with transition */}
                  <path
                    d={areaPath}
                    fill={`url(#areaGradient-${viewMode})`}
                    style={{ transition: 'd 0.3s ease-out, fill 0.2s ease-out' }}
                  />

                  {/* Line with transition */}
                  <path
                    d={linePath}
                    fill="none"
                    stroke={chartColor}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glow)"
                    style={{ transition: 'd 0.3s ease-out, stroke 0.2s ease-out' }}
                  />

                  {/* Data Points */}
                  {chartData.points.map((point, i) => (
                    <DataPoint
                      key={`${point.identifier}-${i}`}
                      point={point}
                      index={i}
                      isHovered={hoveredPoint === i}
                      color={chartColor}
                      onHover={handleHover}
                    />
                  ))}

                  {/* X-axis Labels */}
                  {xAxisLabelIndices.map((i) => (
                    <text
                      key={`x-${i}`}
                      x={chartData.points[i].x}
                      y={CHART_HEIGHT - 10}
                      textAnchor="middle"
                      fill="#9CA3AF"
                      fontSize="11"
                    >
                      {chartData.points[i].label}
                    </text>
                  ))}

                  {/* Tooltip */}
                  {hoveredPoint !== null && chartData.points[hoveredPoint] && (
                    <Tooltip 
                      point={chartData.points[hoveredPoint]} 
                      color={chartColor} 
                    />
                  )}
                </svg>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-500">
                  No data available for the selected period
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
});

LeadsTrendChart.displayName = 'LeadsTrendChart';

export default LeadsTrendChart;
