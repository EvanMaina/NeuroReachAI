/**
 * CallActivityTab — Recent call activity + callback reminders
 */
import React, { useState } from 'react';
import { PhoneIncoming, PhoneOutgoing, Play, Star, PhoneMissed, CheckCircle2, Inbox } from 'lucide-react';
import type { CallsResponse, CallRailCall } from '../../services/callrail';
import { formatDuration, timeAgo, maskPhone } from '../../services/callrail';

interface Props {
  data: CallsResponse | undefined;
  isLoading: boolean;
}

const SkeletonCard: React.FC = () => (
  <div className="animate-pulse flex items-center gap-4 p-4 border-b border-gray-50">
    <div className="w-10 h-10 bg-gray-200 rounded-xl" />
    <div className="flex-1">
      <div className="h-4 bg-gray-200 rounded w-36 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-24" />
    </div>
    <div className="w-16 h-6 bg-gray-200 rounded-full" />
  </div>
);

function CallCard({ call }: { call: CallRailCall }) {
  const isInbound = call.direction !== 'outbound';
  const answered = call.answered;
  const name = call.caller_name || 'Unknown Caller';
  const location = [call.city, call.state].filter(Boolean).join(', ');
  const source = call.source_name || call.source || '';
  const campaign = call.campaign || '';

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0 group">
      {/* Direction icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
        !answered ? 'bg-red-50 text-red-500' :
        isInbound ? 'bg-blue-50 text-blue-500' : 'bg-violet-50 text-violet-500'
      }`}>
        {!answered ? <PhoneMissed size={18} /> :
         isInbound ? <PhoneIncoming size={18} /> : <PhoneOutgoing size={18} />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 text-sm truncate">{name}</span>
          {call.first_call && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-full">
              <Star size={10} /> NEW
            </span>
          )}
        </div>
        {location && <p className="text-xs text-gray-400 truncate">{location}</p>}
        <div className="flex items-center gap-2 mt-1">
          {source && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">{source}</span>}
          {campaign && <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded font-medium truncate max-w-[120px]">{campaign}</span>}
        </div>
      </div>

      {/* Duration badge */}
      <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
        answered ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
      }`}>
        {answered ? formatDuration(call.duration) : '0:00'}
      </div>

      {/* Recording + time */}
      <div className="flex items-center gap-2 text-right">
        {call.recording && (
          <button className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-blue-100 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100">
            <Play size={12} />
          </button>
        )}
        <span className="text-xs text-gray-400 w-16 text-right">{timeAgo(call.start_time)}</span>
      </div>
    </div>
  );
}

export const CallActivityTab: React.FC<Props> = ({ data, isLoading }) => {
  const [showCount, setShowCount] = useState(10);

  const calls = data?.calls || [];
  const recentCalls = calls.slice(0, showCount);
  const missedCalls = calls.filter(c => !c.answered);

  return (
    <div className="grid grid-cols-5 gap-6">
      {/* Left: Recent Activity (60%) */}
      <div className="col-span-3 bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900">Recent Call Activity</h3>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-emerald-600 font-medium">Live</span>
            </span>
          </div>
          <span className="text-xs text-gray-400">{data?.total_records ?? 0} total</span>
        </div>

        {isLoading ? (
          <div>{[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}</div>
        ) : recentCalls.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No calls in this period</p>
            <p className="text-sm text-gray-400">Try selecting a wider date range</p>
          </div>
        ) : (
          <>
            {recentCalls.map((call, i) => <CallCard key={`${call.start_time}-${i}`} call={call} />)}
            {calls.length > showCount && (
              <button
                onClick={() => setShowCount(s => s + 10)}
                className="w-full py-3 text-sm text-blue-600 font-medium hover:bg-blue-50 transition-colors"
              >
                Load more ({calls.length - showCount} remaining)
              </button>
            )}
          </>
        )}
      </div>

      {/* Right: Callback Reminders (40%) */}
      <div className="col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <PhoneMissed size={16} className="text-red-500" />
            <h3 className="font-semibold text-gray-900">Callback Reminders</h3>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{missedCalls.length} missed call{missedCalls.length !== 1 ? 's' : ''} pending</p>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="animate-pulse flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 bg-gray-200 rounded-lg" />
                <div className="flex-1"><div className="h-3 bg-gray-200 rounded w-28 mb-1" /><div className="h-3 bg-gray-200 rounded w-20" /></div>
              </div>
            ))}
          </div>
        ) : missedCalls.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-3" />
            <p className="text-gray-600 font-medium">All caught up!</p>
            <p className="text-sm text-gray-400">No missed calls pending</p>
          </div>
        ) : (
          <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
            {missedCalls.slice(0, 15).map((call, i) => (
              <div key={`missed-${i}`} className="flex items-center gap-3 p-3 bg-red-50/50 rounded-xl hover:bg-red-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-500">
                  <PhoneMissed size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{call.caller_name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{maskPhone(call.caller_number)}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(call.start_time)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
