/**
 * Severity Assessment Step — Horizontal Chip Layout for ZERO SCROLL.
 * 
 * Step 3: Conditional severity questions based on selected conditions.
 * Uses compact horizontal pill/chip buttons instead of vertical cards
 * so all questions fit in viewport without scrolling.
 * 
 * On the full-page assessment, CSS classes .assess-chip and 
 * .assess-severity-* provide the premium styling.
 * 
 * @version 5.0.0 — Production UX Overhaul
 */

import React from 'react';
import { type ConditionType } from '../../types/lead';

interface SeverityStepProps {
  conditions: ConditionType[];
  phq2_interest: number | null;
  phq2_mood: number | null;
  onPhq2InterestChange: (value: number) => void;
  onPhq2MoodChange: (value: number) => void;
  gad2_nervous: number | null;
  gad2_worry: number | null;
  onGad2NervousChange: (value: number) => void;
  onGad2WorryChange: (value: number) => void;
  ocd_time_occupied: number | null;
  onOcdTimeChange: (value: number) => void;
  ptsd_intrusion: number | null;
  onPtsdIntrusionChange: (value: number) => void;
}

const PHQ_GAD_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half' },
  { value: 3, label: 'Nearly every day' },
];

const OCD_TIME_OPTIONS = [
  { value: 1, label: '<1 hr/day' },
  { value: 2, label: '1–3 hrs/day' },
  { value: 3, label: '3–8 hrs/day' },
  { value: 4, label: '8+ hrs/day' },
];

const PTSD_INTRUSION_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'A little' },
  { value: 2, label: 'Moderate' },
  { value: 3, label: 'Quite a bit' },
  { value: 4, label: 'Extremely' },
];

/** Horizontal chip/pill for a single option */
const Chip: React.FC<{
  label: string;
  selected: boolean;
  onClick: () => void;
}> = ({ label, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`assess-chip${selected ? ' assess-chip--selected' : ''}`}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '7px 14px',
      borderRadius: '999px',
      border: selected ? '2px solid #1B2A4A' : '1.5px solid #E2E8F0',
      background: selected ? '#EBF4FF' : '#fff',
      fontSize: '14px',
      fontWeight: selected ? 600 : 500,
      color: selected ? '#1B2A4A' : '#4A5568',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      whiteSpace: 'nowrap',
      outline: 'none',
      WebkitTapHighlightColor: 'transparent',
    }}
  >
    {label}
  </button>
);

/** A single question with horizontal chip options */
const QuestionRow: React.FC<{
  question: string;
  options: { value: number; label: string }[];
  selected: number | null;
  onChange: (value: number) => void;
}> = ({ question, options, selected, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <p className="assess-severity-question" style={{
      fontSize: '15px',
      fontWeight: 500,
      color: '#2D3748',
      margin: 0,
      lineHeight: '1.4',
    }}>
      {question}
    </p>
    <div className="assess-severity-chips" style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px',
    }}>
      {options.map(opt => (
        <Chip
          key={opt.value}
          label={opt.label}
          selected={selected === opt.value}
          onClick={() => onChange(opt.value)}
        />
      ))}
    </div>
  </div>
);

/** Section header for condition group */
const SectionHeader: React.FC<{
  title: string;
  subtitle: string;
  emoji: string;
}> = ({ title, subtitle, emoji }) => (
  <div className="assess-section-header" style={{
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingBottom: '6px',
    borderBottom: '1px solid #EDF2F7',
  }}>
    <span style={{ fontSize: '15px' }}>{emoji}</span>
    <div>
      <div className="assess-section-title" style={{ fontSize: '15px', fontWeight: 600, color: '#1B2A4A' }}>{title}</div>
      <div className="assess-section-subtitle" style={{ fontSize: '14px', color: '#4A5568', fontWeight: 400 }}>{subtitle}</div>
    </div>
  </div>
);

export const SeverityStep: React.FC<SeverityStepProps> = ({
  conditions,
  phq2_interest, phq2_mood, onPhq2InterestChange, onPhq2MoodChange,
  gad2_nervous, gad2_worry, onGad2NervousChange, onGad2WorryChange,
  ocd_time_occupied, onOcdTimeChange,
  ptsd_intrusion, onPtsdIntrusionChange,
}) => {
  const showDepression = conditions.includes('DEPRESSION');
  const showAnxiety = conditions.includes('ANXIETY');
  const showOCD = conditions.includes('OCD');
  const showPTSD = conditions.includes('PTSD');

  return (
    <div className="assess-severity-section" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#1B2A4A', margin: 0 }}>
          Quick Symptom Check
        </h3>
        <p style={{ fontSize: '15px', color: '#4A5568', marginTop: '4px' }}>
          Select the option that best describes you.
        </p>
      </div>

      {/* PHQ-2 for Depression */}
      {showDepression && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SectionHeader title="Depression" subtitle="Over the last 2 weeks" emoji="🧠" />
          <QuestionRow
            question="Little interest or pleasure in doing things?"
            options={PHQ_GAD_OPTIONS}
            selected={phq2_interest}
            onChange={onPhq2InterestChange}
          />
          <QuestionRow
            question="Feeling down, depressed, or hopeless?"
            options={PHQ_GAD_OPTIONS}
            selected={phq2_mood}
            onChange={onPhq2MoodChange}
          />
        </div>
      )}

      {/* GAD-2 for Anxiety */}
      {showAnxiety && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SectionHeader title="Anxiety" subtitle="Over the last 2 weeks" emoji="⚡" />
          <QuestionRow
            question="Feeling nervous, anxious, or on edge?"
            options={PHQ_GAD_OPTIONS}
            selected={gad2_nervous}
            onChange={onGad2NervousChange}
          />
          <QuestionRow
            question="Not being able to stop or control worrying?"
            options={PHQ_GAD_OPTIONS}
            selected={gad2_worry}
            onChange={onGad2WorryChange}
          />
        </div>
      )}

      {/* OCD */}
      {showOCD && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SectionHeader title="OCD" subtitle="About obsessive thoughts" emoji="🔄" />
          <QuestionRow
            question="Time spent on obsessive thoughts or compulsive behaviors?"
            options={OCD_TIME_OPTIONS}
            selected={ocd_time_occupied}
            onChange={onOcdTimeChange}
          />
        </div>
      )}

      {/* PTSD */}
      {showPTSD && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SectionHeader title="PTSD" subtitle="In the past month" emoji="🛡️" />
          <QuestionRow
            question="Bothered by disturbing memories of a stressful experience?"
            options={PTSD_INTRUSION_OPTIONS}
            selected={ptsd_intrusion}
            onChange={onPtsdIntrusionChange}
          />
        </div>
      )}

      <div className="assess-severity-helper" style={{
        fontSize: '14px',
        color: '#718096',
        fontWeight: 400,
        paddingTop: '4px',
        borderTop: '1px solid #EDF2F7',
      }}>
        Your responses help personalize your treatment plan.
      </div>
    </div>
  );
};
