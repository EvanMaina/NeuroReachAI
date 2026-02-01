/**
 * CallMetricsCards — Top 5 metric cards for Call Analytics
 */
import React, { useEffect, useRef, useState } from 'react';
import { Phone, CheckCircle, Clock, UserPlus, PhoneMissed, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { SummaryResponse } from '../../services/callrail';
import { formatDuration, formatNumber } from '../../services/callrail';

interface Props { data: SummaryResponse | undefined; isLoading: boolean; }

// Animated count-up
function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0);
  const ref = useRef<number>();
  useEffect(() => {
    if (!target) { setVal(0); return; }
    const start = performance.now();
    const from = 0;
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (progress < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration]);
  return val;
}

const Skeleton: React.FC = () => (
  <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
    <div className="flex items-center justify-between mb-4">
      <div className="w-11 h-11 bg-gray-200 rounded-xl" />
      <div className="w-16 h-6 bg-gray-200 rounded-full" />
    </div>
    <div className="w-20 h-9 bg-gray-200 rounded mb-2" />
    <div className="w-32 h-4 bg-gray-200 rounded" />
  </div>
);

function ChangeIndicator({ value, suffix = '%' }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-xs text-gray-400">—</span>;
  const positive = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${positive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
      {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

export const CallMetricsCards: React.FC<Props> = ({ data, isLoading }) => {
  const c = data?.current;
  const ch = data?.changes;

  const totalCalls = useCountUp(c?.total_calls ?? 0);
  const answeredRate = useCountUp(Math.round(c?.answered_rate ?? 0));
  const firstTime = useCountUp(c?.first_time_callers ?? 0);
  const missed = useCountUp(c?.missed ?? 0);

  if (isLoading) {
    return <div className="grid grid-cols-5 gap-4 mb-8">{[1,2,3,4,5].map(i => <Skeleton key={i} />)}</div>;
  }

  const cards = [
    {
      label: 'Total Calls', sublabel: 'All inbound & outbound',
      value: formatNumber(totalCalls), icon: <Phone size={20} />,
      gradient: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/20',
      change: ch?.total_calls ?? 0, accent: false, alert: false,
    },
    {
      label: 'Answered Rate', sublabel: 'Calls answered',
      value: `${answeredRate}%`, icon: <CheckCircle size={20} />,
      gradient: 'from-emerald-500 to-green-500', shadow: 'shadow-emerald-500/20',
      change: ch?.answered_rate ?? 0, accent: false, alert: false,
    },
    {
      label: 'Avg Duration', sublabel: 'Minutes per call',
      value: formatDuration(c?.avg_duration_seconds ?? 0), icon: <Clock size={20} />,
      gradient: 'from-violet-500 to-purple-500', shadow: 'shadow-violet-500/20',
      change: ch?.avg_duration ?? 0, accent: false, alert: false,
    },
    {
      label: 'First-Time Callers', sublabel: 'New potential patients',
      value: formatNumber(firstTime), icon: <UserPlus size={20} />,
      gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/20',
      change: ch?.first_time_callers ?? 0, accent: true, alert: false,
    },
    {
      label: 'Missed Calls', sublabel: 'Need follow-up',
      value: formatNumber(missed), icon: <PhoneMissed size={20} />,
      gradient: 'from-red-500 to-rose-500', shadow: 'shadow-red-500/20',
      change: ch?.missed ?? 0, accent: false, alert: (c?.missed ?? 0) > 0,
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-4 mb-8">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className={`relative bg-white rounded-2xl border p-6 hover:shadow-lg transition-all duration-300 ${
            card.accent ? 'border-amber-200 ring-1 ring-amber-100' :
            card.alert ? 'border-red-200' : 'border-gray-100'
          }`}
          style={{ animationDelay: `${i * 60}ms`, animation: 'fadeInUp 0.4s ease-out forwards', opacity: 0 }}
        >
          {card.accent && (
            <div className="absolute -top-2.5 left-4 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">
              KEY METRIC
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white ${card.shadow} shadow-lg`}>
              {card.icon}
            </div>
            <ChangeIndicator value={card.change} />
          </div>
          <p className="text-3xl font-bold text-gray-900 tracking-tight">{card.value}</p>
          <p className="text-sm text-gray-500 mt-1">{card.label}</p>
          <p className="text-xs text-gray-400">{card.sublabel}</p>
        </div>
      ))}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
