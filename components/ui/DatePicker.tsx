'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  CalendarBlankIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from '@phosphor-icons/react/dist/ssr';
import {
  WEEKDAY_LABELS,
  addDays,
  addMonths,
  calendarWeeks,
  dayOfMonth,
  dayOfWeek,
  formatDate,
  formatMonthYear,
  startOfMonth,
  todayInKampala,
} from '@/lib/dates';

/**
 * A month-grid date picker, replacing `<input type="date">`.
 *
 * The native control was the honest first choice, but it renders as a different
 * widget in every browser — Chrome's grey placeholder box, Safari's iOS drum,
 * Firefox's bare text field — none of which take the pink accent, the radius
 * scale or the dark palette. This is one calendar, the same everywhere, in the
 * app's own colours.
 *
 * The value crosses to the server exactly as it did before: a hidden input
 * carrying YYYY-MM-DD under the real field name, so the Server Actions and the
 * `isoDate` schema in lib/validation.ts are untouched and never learn this
 * component exists.
 *
 * All arithmetic goes through lib/dates.ts, which works in UTC. A calendar
 * built on local-time Date objects would shade the wrong cell as "today" for
 * the first three hours of every Kampala day.
 */

interface DatePickerProps {
  /** Also the anchor for the accessible name: `<Field>` labels are `${id}-label`. */
  id: string;
  /** The form field name. Omit for a picker that only drives client state. */
  name?: string;
  /** Pass to control the value; otherwise the picker keeps its own. */
  value?: string;
  defaultValue?: string;
  onChange?: (isoDate: string) => void;
  /** Inclusive bounds, YYYY-MM-DD. */
  min?: string;
  max?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({
  id,
  name,
  value,
  defaultValue,
  onChange,
  min,
  max,
  invalid,
  disabled,
  className = 'control',
}: DatePickerProps) {
  const today = todayInKampala();

  const controlled = value !== undefined;
  const [ownValue, setOwnValue] = useState(defaultValue ?? '');
  const selected = controlled ? value : ownValue;

  const [open, setOpen] = useState(false);
  /** The month on screen. */
  const [cursor, setCursor] = useState(() => startOfMonth(selected || today));
  /** The day the arrow keys are sitting on — the grid's one tabbable cell. */
  const [focused, setFocused] = useState(selected || today);
  /** Flipped when the field sits too near the right edge for a left-aligned panel. */
  const [alignRight, setAlignRight] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  /**
   * Whether the pending render should pull focus onto the focused day. Only
   * keyboard moves and opening set it: the month arrows must NOT, or focus
   * would jump into the grid on the first tap and the arrow could not be
   * tapped a second time.
   */
  const wantsDayFocus = useRef(false);

  // ISO dates compare correctly as plain strings, which is why min/max need no parsing.
  const outOfRange = (iso: string) =>
    (min !== undefined && iso < min) || (max !== undefined && iso > max);

  const clamp = (iso: string) => (min && iso < min ? min : max && iso > max ? max : iso);

  /*
   * form.reset() clears native fields only — the value here lives in React, so
   * it has to be put back by hand. ExpenseForm resets itself after every saved
   * expense, and without this the date would keep whatever was last picked.
   */
  useEffect(() => {
    const form = hiddenRef.current?.form;
    if (!form || controlled) return;
    const restore = () => setOwnValue(defaultValue ?? '');
    form.addEventListener('reset', restore);
    return () => form.removeEventListener('reset', restore);
  }, [controlled, defaultValue]);

  // A tap anywhere else closes the panel, leaving focus wherever it was aimed.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Runs every render, guarded by the ref, so a keyboard move and the open
  // that precedes it both land focus on the right cell.
  useEffect(() => {
    if (!open || !wantsDayFocus.current) return;
    wantsDayFocus.current = false;
    panelRef.current?.querySelector<HTMLElement>(`[data-iso="${focused}"]`)?.focus();
  });

  function openPanel() {
    const anchor = clamp(selected || today);
    setFocused(anchor);
    setCursor(startOfMonth(anchor));

    // Left-aligned would be clipped: body sets overflow-x: hidden, so a panel
    // running past the right edge is unreachable rather than merely scrolled.
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setAlignRight(rect.left + 320 > window.innerWidth - 16);

    wantsDayFocus.current = true;
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(iso: string) {
    if (outOfRange(iso)) return;
    if (!controlled) setOwnValue(iso);
    onChange?.(iso);
    closePanel();
  }

  /** Move the roving focus, following it with the month on screen. */
  function moveFocus(iso: string, pullFocus = true) {
    const next = clamp(iso);
    setFocused(next);
    setCursor(startOfMonth(next));
    if (pullFocus) wantsDayFocus.current = true;
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (event.key in steps) {
      event.preventDefault();
      moveFocus(addDays(focused, steps[event.key]));
      return;
    }

    const intoWeek = (dayOfWeek(focused) + 6) % 7; // days since Monday

    switch (event.key) {
      case 'Home':
        event.preventDefault();
        moveFocus(addDays(focused, -intoWeek));
        break;
      case 'End':
        event.preventDefault();
        moveFocus(addDays(focused, 6 - intoWeek));
        break;
      case 'PageUp':
        event.preventDefault();
        moveFocus(addMonths(focused, -1));
        break;
      case 'PageDown':
        event.preventDefault();
        moveFocus(addMonths(focused, 1));
        break;
    }
  }

  const weeks = calendarWeeks(cursor);
  const month = cursor.slice(0, 7);
  // If min/max pushed the focused day out of view, keep one cell reachable by Tab.
  const tabbable = focused.slice(0, 7) === month ? focused : cursor;

  const canGoBack = min === undefined || addDays(startOfMonth(cursor), -1) >= min;
  const canGoForward = max === undefined || addMonths(startOfMonth(cursor), 1) <= max;

  return (
    <div ref={rootRef} className="relative">
      {name && <input ref={hiddenRef} type="hidden" name={name} value={selected} />}

      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? closePanel() : openPanel())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        /*
         * A <label for> would otherwise become the button's whole accessible
         * name and swallow the date it is showing. Naming it from the label
         * AND from its own content announces "Date of sale, 15 Mar 2026".
         * A missing label id is skipped, so the date survives either way.
         */
        aria-labelledby={`${id}-label ${id}`}
        className={`${className} flex items-center justify-between gap-2 text-left`}
      >
        <span style={{ color: selected ? 'var(--text)' : 'var(--text-faint)' }}>
          {selected ? formatDate(selected) : 'Choose a date'}
        </span>
        <CalendarBlankIcon
          size={17}
          aria-hidden
          style={{ color: 'var(--text-muted)', flexShrink: 0 }}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Choose a date"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              closePanel();
            }
          }}
          className={`surface calendar-panel ${alignRight ? 'right-0' : 'left-0'}`}
        >
          <div className="mb-2 flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => moveFocus(addMonths(focused, -1), false)}
              disabled={!canGoBack}
              aria-label="Previous month"
              className="btn btn-ghost px-2 py-1.5"
            >
              <CaretLeftIcon size={16} weight="bold" aria-hidden />
            </button>

            <span aria-live="polite" className="text-[0.9375rem] font-semibold">
              {formatMonthYear(cursor)}
            </span>

            <button
              type="button"
              onClick={() => moveFocus(addMonths(focused, 1), false)}
              disabled={!canGoForward}
              aria-label="Next month"
              className="btn btn-ghost px-2 py-1.5"
            >
              <CaretRightIcon size={16} weight="bold" aria-hidden />
            </button>
          </div>

          <div role="grid" aria-label={formatMonthYear(cursor)} onKeyDown={onGridKeyDown}>
            <div role="row" className="grid grid-cols-7">
              {WEEKDAY_LABELS.map((weekday) => (
                <div
                  key={weekday}
                  role="columnheader"
                  aria-label={weekday}
                  className="pb-1.5 text-center text-[0.6875rem] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--text-faint)' }}
                >
                  {weekday}
                </div>
              ))}
            </div>

            {weeks.map((week) => (
              <div key={week[0]} role="row" className="grid grid-cols-7">
                {week.map((iso) => {
                  const isSelected = iso === selected;
                  return (
                    <div key={iso} role="gridcell" aria-selected={isSelected}>
                      <button
                        type="button"
                        data-iso={iso}
                        data-outside={iso.slice(0, 7) === month ? undefined : ''}
                        data-today={iso === today ? '' : undefined}
                        data-selected={isSelected ? '' : undefined}
                        tabIndex={iso === tabbable ? 0 : -1}
                        disabled={outOfRange(iso)}
                        onClick={() => choose(iso)}
                        aria-label={formatDate(iso)}
                        aria-current={iso === today ? 'date' : undefined}
                        className="calendar-day tnum"
                      >
                        {dayOfMonth(iso)}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
            <button
              type="button"
              onClick={() => choose(today)}
              disabled={outOfRange(today)}
              className="btn btn-ghost px-2.5 py-1.5 text-[0.8125rem]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={closePanel}
              className="btn btn-ghost px-2.5 py-1.5 text-[0.8125rem]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
