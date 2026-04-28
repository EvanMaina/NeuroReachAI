/**
 * Persistent per-user, per-table settings (column visibility + column widths +
 * rows-per-page). Stored in localStorage under `nr_table_settings::<tableKey>`.
 *
 * The hook is defensive by design: if localStorage is unavailable or the stored
 * blob can't be parsed we fall back silently to the defaults. This is the
 * usual SaaS pattern — settings are a nice-to-have, never a blocker.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ITableSettings {
  visibleColumns: string[];
  columnWidths: Record<string, number>;
  pageSize: number;
}

export interface ITableSettingsInput {
  /** Unique key per table, e.g. "leads" or `leads:${queueType}`. */
  tableKey: string;
  defaultVisible: readonly string[];
  defaultWidths: Readonly<Record<string, number>>;
  defaultPageSize: number;
  /** Columns that must never be hidden (e.g. leadId, patient). */
  lockedColumns?: readonly string[];
}

const KEY_PREFIX = 'nr_table_settings::';

function storageKey(tableKey: string): string {
  return `${KEY_PREFIX}${tableKey}`;
}

function readInitial(
  input: ITableSettingsInput,
): ITableSettings {
  try {
    const raw = localStorage.getItem(storageKey(input.tableKey));
    if (!raw) return fallback(input);
    const parsed = JSON.parse(raw) as Partial<ITableSettings>;
    return {
      visibleColumns:
        Array.isArray(parsed.visibleColumns) && parsed.visibleColumns.length > 0
          ? mergeLocked(parsed.visibleColumns, input)
          : [...input.defaultVisible],
      columnWidths: {
        ...input.defaultWidths,
        ...(parsed.columnWidths ?? {}),
      },
      pageSize:
        typeof parsed.pageSize === 'number' && parsed.pageSize > 0
          ? parsed.pageSize
          : input.defaultPageSize,
    };
  } catch {
    return fallback(input);
  }
}

function fallback(input: ITableSettingsInput): ITableSettings {
  return {
    visibleColumns: [...input.defaultVisible],
    columnWidths: { ...input.defaultWidths },
    pageSize: input.defaultPageSize,
  };
}

function mergeLocked(stored: string[], input: ITableSettingsInput): string[] {
  const locked = input.lockedColumns ?? [];
  const out = [...stored];
  for (const col of locked) {
    if (!out.includes(col)) out.push(col);
  }
  return out;
}

export function useTableSettings(input: ITableSettingsInput) {
  const [settings, setSettings] = useState<ITableSettings>(() => readInitial(input));

  // Keep a ref of the input so the persisted-write effect stays stable.
  const inputRef = useRef(input);
  inputRef.current = input;

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(inputRef.current.tableKey), JSON.stringify(settings));
    } catch {
      // Quota / privacy — non-fatal.
    }
  }, [settings]);

  const toggleColumn = useCallback(
    (col: string) => {
      const locked = inputRef.current.lockedColumns ?? [];
      if (locked.includes(col)) return;
      setSettings((prev) => {
        const has = prev.visibleColumns.includes(col);
        return {
          ...prev,
          visibleColumns: has
            ? prev.visibleColumns.filter((c) => c !== col)
            : [...prev.visibleColumns, col],
        };
      });
    },
    [],
  );

  const setColumnWidth = useCallback((col: string, width: number) => {
    setSettings((prev) => ({
      ...prev,
      columnWidths: { ...prev.columnWidths, [col]: width },
    }));
  }, []);

  const setColumnWidths = useCallback(
    (updater: (prev: Record<string, number>) => Record<string, number>) => {
      setSettings((prev) => ({ ...prev, columnWidths: updater(prev.columnWidths) }));
    },
    [],
  );

  const resetVisible = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      visibleColumns: [...inputRef.current.defaultVisible],
    }));
  }, []);

  const resetWidths = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      columnWidths: { ...inputRef.current.defaultWidths },
    }));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setSettings((prev) => ({ ...prev, pageSize: size }));
  }, []);

  return {
    settings,
    toggleColumn,
    setColumnWidth,
    setColumnWidths,
    resetVisible,
    resetWidths,
    setPageSize,
  };
}
