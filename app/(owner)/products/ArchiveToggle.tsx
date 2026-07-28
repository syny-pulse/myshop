'use client';

import { useActionState } from 'react';
import { archiveItem } from '@/app/actions/items';
import { idle } from '@/lib/action-state';
import { SubmitButton } from '@/components/ui/SubmitButton';

export function ArchiveToggle({ id, archived }: { id: number; archived: boolean }) {
  const [, formAction] = useActionState(archiveItem, idle);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="archived" value={String(archived)} />
      <SubmitButton
        variant="secondary"
        pendingLabel="Saving"
        className="py-1.5 text-[0.875rem]"
      >
        {archived ? 'Restore' : 'Archive'}
      </SubmitButton>
    </form>
  );
}
