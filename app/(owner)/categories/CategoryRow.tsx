'use client';

import { useActionState, useState } from 'react';
import { deleteCategory, renameCategory } from '@/app/actions/categories';
import { idle } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Alert } from '@/components/ui/Alert';

export function CategoryRow({
  id,
  name,
  detail,
  deletable,
}: {
  id: number;
  name: string;
  detail: string;
  deletable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [renameState, renameAction] = useActionState(renameCategory, idle);
  const [deleteState, deleteAction] = useActionState(deleteCategory, idle);

  if (editing) {
    return (
      <form
        action={async (formData) => {
          await renameAction(formData);
          setEditing(false);
        }}
        className="flex flex-wrap items-center gap-2 px-4 py-3"
      >
        <input type="hidden" name="id" value={id} />
        <input
          name="name"
          defaultValue={name}
          required
          maxLength={60}
          autoFocus
          aria-label="Category name"
          className="control flex-1 py-1.5"
        />
        <SubmitButton pendingLabel="Saving" className="py-1.5 text-[0.875rem]">
          Save
        </SubmitButton>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="btn btn-ghost py-1.5 text-[0.875rem]"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{name}</p>
          <p className="text-[0.8125rem] text-[var(--text-muted)]">{detail}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn btn-ghost py-1.5 text-[0.875rem]"
          >
            Rename
          </button>
          {deletable && (
            <form action={deleteAction}>
              <input type="hidden" name="id" value={id} />
              <ConfirmButton
                label="Delete"
                className="btn btn-danger py-1.5 text-[0.875rem]"
              />
            </form>
          )}
        </div>
      </div>

      {renameState.message && !renameState.ok && (
        <div className="mt-2">
          <Alert tone="error">{renameState.message}</Alert>
        </div>
      )}
      {deleteState.message && !deleteState.ok && (
        <div className="mt-2">
          <Alert tone="error">{deleteState.message}</Alert>
        </div>
      )}
    </div>
  );
}
