/**
 * CallsTableTab — All Calls table with search, filters, sorting, pagination
 */
import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Play, MoreHorizontal, Inbox } from 'lucide-react';
import { useCalls, useSources } from '../../hooks/useCallRailData';
import type { DateRangeType } from '../../services/callrail';
import { formatDuration, formatCallDate } from '../../services/callrail';

interface Props { dateRange: DateRangeType; startDate?: string; endDate?: string; }

export const CallsTableTab: React.FC<Props> = ({ dateRange, startDate, endDate }) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortBy, setSortBy] = useState('start_time');
  const [sortDir, setSortDir] = useState('desc');
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useCalls({
    dateRange, startDate, endDate, page, perPage: 25,
    status: statusFilter || undefined, source: sourceFilter || undefined,
    search: search || undefined, sortBy, sortDir,
  });
  const { data: sourcesData } = useSources(dateRange);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
    setPage(1);
  };

  const calls = data?.calls || [];
  const totalRecords = data?.total_records || 0;
  const totalPages = data?.total_pages || 1;
  const from = (page - 1) * 25 + 1;
  const to = Math.min(page * 25, totalRecords);

  const SortIcon = ({ col }: { col: string }) => (
    <span className={`ml-1 text-[10px] ${sortBy === col ? 'text-blue-600' : 'text-gray-300'}`}>
      {sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
    </span>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Search + Filters */}
      <div className="p-4 border-b border-gray-100 space-y-3">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" placeholder="Search by name or number..."
              value={searchInput} onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">Search</button>
        </form>
        <div className="flex gap-3">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Status</option>
            <option value="answered">Answered</option>
            <option value="missed">Missed</option>
          </select>
          <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Sources</option>
            {sourcesData?.sources.map(s => <option key={s.name} value={s.name}>{s.name} ({s.count})</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="p-4 space-y-3">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="animate-pulse flex items-center gap-4 py-3">
              <div className="w-32 h-4 bg-gray-200 rounded" />
              <div className="w-40 h-4 bg-gray-200 rounded" />
              <div className="w-16 h-4 bg-gray-200 rounded" />
              <div className="w-20 h-6 bg-gray-200 rounded-full" />
              <div className="w-24 h-4 bg-gray-200 rounded" />
              <div className="flex-1" />
            </div>
          ))}
        </div>
      ) : calls.length === 0 ? (
        <div className="p-16 text-center">
          <Inbox size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium text-lg">No calls match your filters</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filter criteria</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th onClick={() => toggleSort('start_time')} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-700 select-none">
                  Date/Time<SortIcon col="start_time" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Caller</th>
                <th onClick={() => toggleSort('duration')} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-700 select-none">
                  Duration<SortIcon col="duration" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Source / Campaign</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">First Call</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call, i) => {
                const loc = [call.city, call.state].filter(Boolean).join(', ');
                return (
                  <tr key={`${call.start_time}-${i}`} className="border-t border-gray-50 hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatCallDate(call.start_time)}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{call.caller_name || 'Unknown'}</p>
                      {loc && <p className="text-xs text-gray-400">{loc}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-mono">{formatDuration(call.duration)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        call.answered ? 'bg-emerald-50 text-emerald-600' :
                        call.voicemail ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {call.answered ? 'Answered' : call.voicemail ? 'Voicemail' : 'Missed'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-600">{call.source_name || call.source || '—'}</p>
                      {call.campaign && <p className="text-xs text-gray-400">{call.campaign}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {call.first_call ? (
                        <span className="inline-flex px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-xs font-semibold">Yes</span>
                      ) : (
                        <span className="text-xs text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {call.recording && (
                          <button className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-blue-100 hover:text-blue-600 transition-colors">
                            <Play size={12} />
                          </button>
                        )}
                        <button className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors">
                          <MoreHorizontal size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalRecords > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-500">Showing {from}–{to} of {totalRecords} calls</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page + i - 2;
              if (p < 1 || p > totalPages) return null;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    p === page ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>{p}</button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
