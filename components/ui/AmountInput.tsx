'use client';

import type { ComponentPropsWithoutRef, ChangeEvent } from 'react';

/**
 * A money field that groups thousands as it is typed: 15000 shows as 15,000.
 *
 * The grouped text is display only. A hidden sibling carries bare digits under
 * the real field name, so the Server Action still receives "15000" and
 * lib/validation.ts keeps coercing a plain integer. Nothing downstream has to
 * know this component exists.
 *
 * It has to be type="text": a number input rejects a value containing commas,
 * so the browser would blank the field on every keystroke. inputMode keeps the
 * numeric keypad, which is what attendants actually type on.
 */

/** Drops everything that is not a digit, and a leading zero that would read as "05". */
function toDigits(text: string): string {
  return text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

/**
 * "15000" -> "15,000". Grouped with a regex rather than Number().toLocaleString()
 * so a pasted 30-digit string is not quietly rounded through a float on its way
 * to a field the server still has to reject on its own terms.
 */
function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function countDigits(text: string): number {
  let count = 0;
  for (const character of text) if (character >= '0' && character <= '9') count++;
  return count;
}

/** The offset just past the nth digit, so the caret can be put back where it was. */
function offsetAfterDigit(text: string, digitIndex: number): number {
  if (digitIndex <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] >= '0' && text[i] <= '9' && ++seen === digitIndex) return i + 1;
  }
  return text.length;
}

type AmountInputProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'value' | 'onChange' | 'type' | 'inputMode'
> & {
  name: string;
  /** Bare digits, never grouped. */
  value: string;
  onValueChange: (digits: string) => void;
};

export function AmountInput({ name, value, onValueChange, ...rest }: AmountInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const element = event.currentTarget;
    const caret = element.selectionStart ?? element.value.length;
    const digitsBeforeCaret = countDigits(element.value.slice(0, caret));

    const digits = toDigits(element.value);
    const display = group(digits);

    // Write the text and the caret back synchronously rather than waiting for
    // React to re-render. Inserting a comma shifts every character after it, so
    // deferring this parks the caret at the end of the field — which is wrong
    // for anyone correcting a digit in the middle of a number they mistyped.
    element.value = display;
    const offset = offsetAfterDigit(display, digitsBeforeCaret);
    element.setSelectionRange(offset, offset);

    onValueChange(digits);
  }

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={group(value)}
        onChange={handleChange}
        {...rest}
      />
    </>
  );
}
