'use client';

import { useActionState } from 'react';
import { deleteSale } from '@/app/actions/sales';
import { idle } from '@/lib/action-state';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Alert } from '@/components/ui/Alert';

/** Removing a sale puts the stock back; the action does both in one transaction. */
export function DeleteSale({ id }: { id: number }) {
  const [state, formAction] = useActionState(deleteSale, idle);

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
