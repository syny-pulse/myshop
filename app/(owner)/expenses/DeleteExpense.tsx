'use client';

import { useActionState } from 'react';
import { deleteExpense } from '@/app/actions/expenses';
import { idle } from '@/lib/action-state';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Alert } from '@/components/ui/Alert';

export function DeleteExpense({ id }: { id: number }) {
  const [state, formAction] = useActionState(deleteExpense, idle);

  return (
    <>
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <ConfirmButton
          label="Remove"
          confirmLabel="Tap again to remove"
          className="btn btn-ghost px-2 py-1 text-[0.8125rem]"
        />
      </form>
      {state.message && !state.ok && (
        <div className="mt-2">
          <Alert tone="error">{state.message}</Alert>
        </div>
      )}
    </>
  );
}
