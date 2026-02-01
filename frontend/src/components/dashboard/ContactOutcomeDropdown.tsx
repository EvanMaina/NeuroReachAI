/**
 * ContactOutcomeDropdown Component
 *
 * Premium, production-ready selector for coordinators to update lead contact outcomes.
 *
 * Key UX goal (Kanban): Never cover adjacent columns/leads.
 *
 * Therefore, the default behavior is:
 * - open an inline, in-card panel (same width as the card)
 * - render options in a compact grid of “chips”
 * - no absolute positioning
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Phone,
  Sparkles,
  CheckCircle2,
  PhoneMissed,
  PhoneOff,
  Clock,
  Ban,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { CONTACT_OUTCOME_CONFIG, type ContactOutcome } from '../../types/lead';
import { updateContactOutcome } from '../../services/leads';

const OUTCOME_ICONS: Record<string, LucideIcon> = {
  Sparkles,
  CheckCircle2,
  PhoneMissed,
  PhoneOff,
  Clock,
  Ban,
};

export interface ContactOutcomeDropdownProps {
  leadId: string;
  currentOutcome: ContactOutcome;
  contactAttempts?: number;
  onOutcomeChange?: (newOutcome: ContactOutcome) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';

  /**
   * Render mode:
   * - `inline`: expands below the button (safe for Kanban)
   * - `overlay`: legacy absolute dropdown
   */
  menuPlacement?: 'inline' | 'overlay';

  /**
   * Default true: compact grid of options inside the card width.
   * Set false to use legacy list.
   */
  useCompactMenu?: boolean;
}

export const ContactOutcomeDropdown: React.FC<ContactOutcomeDropdownProps> = ({
  leadId,
  currentOutcome,
  contactAttempts = 0,
  onOutcomeChange,
  disabled = false,
  size = 'sm',
  menuPlacement = 'inline',
  useCompactMenu = true,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [outcome, setOutcome] = useState<ContactOutcome>(currentOutcome);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const outcomes = useMemo(
    () => Object.keys(CONTACT_OUTCOME_CONFIG) as ContactOutcome[],
    []
  );

  useEffect(() => {
    setOutcome(currentOutcome);
  }, [currentOutcome]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    async (newOutcome: ContactOutcome) => {
      if (newOutcome === outcome || isUpdating) return;

      setIsUpdating(true);
      setIsOpen(false);
      setHighlightedIndex(-1);

      try {
        await updateContactOutcome(leadId, {
          contact_outcome: newOutcome,
        });
        setOutcome(newOutcome);
        onOutcomeChange?.(newOutcome);
      } catch (error) {
        console.error('Failed to update contact outcome:', error);
      } finally {
        setIsUpdating(false);
      }
    },
    [leadId, isUpdating, onOutcomeChange, outcome]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setIsOpen(true);
          setHighlightedIndex(0);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev + 1) % outcomes.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev - 1 + outcomes.length) % outcomes.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0) {
            void handleSelect(outcomes[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setHighlightedIndex(-1);
          buttonRef.current?.focus();
          break;
      }
    },
    [handleSelect, highlightedIndex, isOpen, outcomes]
  );

  const config = CONTACT_OUTCOME_CONFIG[outcome] || CONTACT_OUTCOME_CONFIG.NEW;
  const IconComponent = OUTCOME_ICONS[config.iconName];

  const sizeConfig = {
    sm: {
      button: 'text-xs px-2 py-1 gap-1',
      icon: 12,
      phoneIcon: 10,
      chevron: 10,
      dropdown: 'min-w-[220px]',
      optionIcon: 14,
    },
    md: {
      button: 'text-sm px-2.5 py-1.5 gap-1.5',
      icon: 14,
      phoneIcon: 12,
      chevron: 12,
      dropdown: 'min-w-[240px]',
      optionIcon: 16,
    },
    lg: {
      button: 'text-sm px-3 py-2 gap-2',
      icon: 16,
      phoneIcon: 14,
      chevron: 14,
      dropdown: 'min-w-[260px]',
      optionIcon: 18,
    },
  }[size];

  const renderCompactOptions = (): React.ReactNode => (
    <div className="p-2">
      <div className="grid grid-cols-2 gap-2">
        {outcomes.map((key, index) => {
          const optionConfig = CONTACT_OUTCOME_CONFIG[key];
          const OptionIcon = OUTCOME_ICONS[optionConfig.iconName];
          const isSelected = key === outcome;
          const isHighlighted = index === highlightedIndex;

          return (
            <button
              key={key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleSelect(key);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              role="option"
              aria-selected={isSelected}
              className={
                `w-full rounded-lg border px-2.5 py-2 text-left transition-all duration-150 ` +
                `${isHighlighted ? 'ring-2 ring-blue-200' : ''} ` +
                `${isSelected ? `${optionConfig.bgColor} ${optionConfig.borderColor}` : 'bg-white border-gray-200 hover:bg-gray-50'}`
              }
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-7 h-7 rounded-md flex items-center justify-center border ${optionConfig.bgColor} ${optionConfig.borderColor}`}
                >
                  {OptionIcon && <OptionIcon size={14} className={optionConfig.iconColor} />}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${optionConfig.color}`}>{optionConfig.label}</p>
                  <p className="text-[10px] text-gray-500 truncate">{optionConfig.description}</p>
                </div>
                {isSelected && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check size={12} className="text-emerald-600" />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderLegacyListOptions = (): React.ReactNode => (
    <div className="py-1 max-h-[260px] overflow-y-auto scrollbar-thin">
      {outcomes.map((key, index) => {
        const optionConfig = CONTACT_OUTCOME_CONFIG[key];
        const OptionIcon = OUTCOME_ICONS[optionConfig.iconName];
        const isSelected = key === outcome;
        const isHighlighted = index === highlightedIndex;

        return (
          <button
            key={key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleSelect(key);
            }}
            onMouseEnter={() => setHighlightedIndex(index)}
            role="option"
            aria-selected={isSelected}
            className={
              `w-full px-3 py-2.5 text-left flex items-center gap-3 transition-all duration-150 ease-out ` +
              `${isHighlighted ? 'bg-gray-50' : ''} ` +
              `${isSelected ? `${optionConfig.bgColor} border-l-4 ${optionConfig.borderColor}` : 'border-l-4 border-transparent'} ` +
              `hover:bg-gray-50`
            }
          >
            <div
              className={
                `w-8 h-8 rounded-lg flex items-center justify-center border ` +
                `${optionConfig.bgColor} ${optionConfig.borderColor} ` +
                `${isHighlighted ? 'scale-110' : ''} transition-transform duration-150`
              }
            >
              {OptionIcon && <OptionIcon size={sizeConfig.optionIcon} className={optionConfig.iconColor} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${optionConfig.color}`}>{optionConfig.label}</p>
              <p className="text-xs text-gray-500 truncate">{optionConfig.description}</p>
            </div>
            {isSelected && (
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check size={12} className="text-emerald-600" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={dropdownRef} className="block w-full" onKeyDown={handleKeyDown}>
      <div className="flex justify-end">
        <button
          ref={buttonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled && !isUpdating) {
              setIsOpen((v) => !v);
              if (!isOpen) setHighlightedIndex(0);
            }
          }}
          disabled={disabled || isUpdating}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`Contact outcome: ${config.label}`}
          className={
            `inline-flex items-center rounded-lg border font-medium transition-all duration-200 ease-out ` +
            `${config.bgColor} ${config.color} ${config.borderColor} ${sizeConfig.button} ` +
            `${disabled || isUpdating ? 'opacity-50 cursor-not-allowed' : `hover:shadow-md hover:ring-2 hover:${config.ringColor} hover:ring-opacity-50 cursor-pointer active:scale-95`} ` +
            `focus:outline-none focus:ring-2 focus:${config.ringColor} focus:ring-opacity-50`
          }
        >
          {IconComponent && (
            <IconComponent
              size={sizeConfig.icon}
              className={`${config.iconColor} transition-transform duration-200 ${isOpen ? 'scale-110' : ''}`}
            />
          )}

          <span className="font-semibold">{config.label}</span>

          {contactAttempts > 0 && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/60 text-gray-600 text-[10px] font-bold">
              <Phone size={sizeConfig.phoneIcon} className="text-gray-500" />
              {contactAttempts}
            </span>
          )}

          {!disabled && !isUpdating && (
            <ChevronDown
              size={sizeConfig.chevron}
              className={`text-current opacity-60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          )}

          {isUpdating && (
            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          )}
        </button>
      </div>

      {isOpen && (
        <div className={menuPlacement === 'overlay' ? 'relative' : 'mt-2 w-full max-w-full'}>
          <div
            onClick={(e) => e.stopPropagation()}
            className={
              menuPlacement === 'overlay'
                ? `${`absolute z-50 right-0 mt-1.5 ${sizeConfig.dropdown}`} bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200`
                : // Inline mode: no shadow overflow + guaranteed in-flow layout
                  'w-full max-w-full bg-white rounded-lg border border-gray-200 overflow-hidden'
            }
            role="listbox"
            aria-label="Select contact outcome"
          >
            <div className="px-3 py-2.5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                <Phone size={12} className="text-gray-400" />
                Call Outcome
              </p>
            </div>

            {useCompactMenu ? renderCompactOptions() : renderLegacyListOptions()}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactOutcomeDropdown;
