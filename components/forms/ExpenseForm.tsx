'use client';

import { useActionState, useEffect, useRef } from 'react';
import { recordExpense } from '@/app/actions/expenses';
import { idle } from '@/lib/action-state';
import { Field } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { todayInKampala } from '@/lib/dates';
import { EXPENSE_KINDS, EXPENSE_KIND_LABELS } from '@/db/schema';

export function ExpenseForm() {
  const [state, formAction] = useActionState(recordExpense, idle);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok, state.nonce]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="expenseDate" error={state.errors?.expenseDate}>
          <input
            id="expenseDate"
            name="expenseDate"
            type="date"
            required
            defaultValue={todayInKampala()}
            className="control"
          />
        </Field>

        <Field label="Type" htmlFor="kind" error={state.errors?.kind}>
          <select id="kind" name="kind" defaultValue="other" className="control">
            {EXPENSE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {EXPENSE_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="What was it for?"
        htmlFor="description"
        error={state.errors?.description}
        hint="For example: boda to pick up curtains from the market"
      >
        <input
          id="description"
          name="description"
          type="text"
          required
          maxLength={200}
          className="control"
        />
      </Field>

      <Field label="Amount" htmlFor="amount" error={state.errors?.amount}>
        <input
          id="amount"
          name="amount"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          className="control tnum"
        />
      </Field>

      <SubmitButton pendingLabel="Recording">Record expense</SubmitButton>
    </form>
  );
}
