'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { recordExpense } from '@/app/actions/expenses';
import { idle } from '@/lib/action-state';
import { Field } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { AmountInput } from '@/components/ui/AmountInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { todayInKampala } from '@/lib/dates';
import { EXPENSE_KINDS, EXPENSE_KIND_LABELS } from '@/db/schema';

export function ExpenseForm() {
  const [state, formAction] = useActionState(recordExpense, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      // reset() only clears uncontrolled fields; the amount is React's now.
      setAmount('');
    }
  }, [state.ok, state.nonce]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="expenseDate" error={state.errors?.expenseDate}>
          <DatePicker
            id="expenseDate"
            name="expenseDate"
            defaultValue={todayInKampala()}
            invalid={Boolean(state.errors?.expenseDate)}
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
        <AmountInput
          id="amount"
          name="amount"
          required
          value={amount}
          onValueChange={setAmount}
          className="control tnum"
        />
      </Field>

      <SubmitButton pendingLabel="Recording">Record expense</SubmitButton>
    </form>
  );
}
