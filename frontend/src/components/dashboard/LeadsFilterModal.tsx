/**
 * LeadsFilterModal Component
 * 
 * Displays filtered leads when stats cards are clicked.
 */

import React from 'react';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import type { LeadTableRow } from '../../types/lead';
import type { StatsFilterType } from '../../types/analytics';

interface LeadsFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterType: StatsFilterType;
  leads: LeadTableRow[];
  isLoading: boolean;
  onViewLead: (id: string) => void;
}

const filterTitles: Record<StatsFilterType, string> = {
  all: 'All Leads',
  high_priority: 'High Priority Leads',
  converted: 'Converted Leads',
  response_time: 'Pending Response Leads',
};

const filterDescriptions: Record<StatsFilterType, string> = {
  all: 'Complete list of all leads in the system',
  high_priority: 'Leads marked as hot priority requiring immediate attention',
  converted: 'Leads that have scheduled or completed treatment',
  response_time: 'Leads awaiting first contact response',
};

export const LeadsFilterModal: React.FC<LeadsFilterModalProps> = ({
  isOpen,
  onClose,
  filterType,
  leads,
  isLoading,
  onViewLead,
}) => {
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={filterTitles[filterType]} 
      size="xl"
    >
      {/* Description */}
      <p className="text-sm text-gray-500 mb-4">
        {filterDescriptions[filterType]}
      </p>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No leads found</p>
          <p className="text-sm mt-1">No leads match this filter criteria</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex items-center justify-between text-sm text-gray-500 pb-2 border-b">
            <span>{leads.length} lead{leads.length !== 1 ? 's' : ''} found</span>
          </div>

          {/* Lead List */}
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {leads.map((lead) => (
              <div 
                key={lead.id}
                className="py-3 flex items-center justify-between hover:bg-gray-50 px-2 rounded-lg cursor-pointer transition-colors"
                onClick={() => onViewLead(lead.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {lead.firstName} {lead.lastName}
                    </p>
                    <span className="text-xs text-gray-400 font-mono">
                      {lead.leadId}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-500">{lead.email}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500 capitalize">{lead.condition}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-4">
                  <Badge variant="priority" value={lead.priority} />
                  <Badge variant="status" value={lead.status} />
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatDate(lead.submittedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* View All hint */}
          <p className="text-xs text-gray-400 text-center pt-2">
            Click any lead to view full details
          </p>
        </div>
      )}
    </Modal>
  );
};
