'use client';

import { useActionState, useEffect, useRef } from 'react';
import type { ActionState } from '@/lib/action-state';
import { idle } from '@/lib/action-state';
import { Field } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * One-field create form, used for categories and attendant links. Both are
 * "type a name, press add" and do not justify a component each.
 */
export function InlineForm({
  action,
  label,
  name,
  placeholder,
  submitLabel,
  hint,
}: {
  action: Action;
  label: string;
  name: string;
  placeholder?: string;
  submitLabel: string;
  hint?: string;
}) {
  const [state, formAction] = useActionState(action, idle);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok, state.nonce]);

  const error = state.errors?.[name];

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <FormMessage state={state} />
      {/*
       * The hint lives outside this row on purpose. It used to render inside
       * Field, under the input, which made the Field column taller than the
       * button column — so `items-end` lined the button up with the hint
       * instead of the input. Keeping only the label+input here means both
       * columns are the same height and the button sits level with the box.
       */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label={label} htmlFor={name} error={error} className="flex-1">
          <input
            id={name}
            name={name}
            type="text"
            required
            maxLength={60}
            placeholder={placeholder}
            className="control"
          />
        </Field>
        <SubmitButton pendingLabel="Adding" className="sm:mb-px">
          {submitLabel}
        </SubmitButton>
      </div>
      {hint && !error && (
        <p className="text-[0.8125rem] text-[var(--text-muted)]">{hint}</p>
      )}
    </form>
  );
}
