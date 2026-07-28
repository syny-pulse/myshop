'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { attendantLinks } from '@/db/schema';
import { requireOwner } from '@/lib/auth';
import { attendantSchema, idSchema } from '@/lib/validation';
import {
  failure,
  invalid,
  success,
  unexpected,
  type ActionState,
} from '@/lib/action-state';

/**
 * The token IS the attendant's whole credential, so it must be unguessable:
 * 32 bytes of CSPRNG entropy, base64url so it survives being pasted into
 * WhatsApp without escaping.
 */
function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function createLink(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOwner();

  const parsed = attendantSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return invalid(parsed.error);

  try {
    await db.insert(attendantLinks).values({
      name: parsed.data.name,
      token: newToken(),
    });
  } catch (error) {
    return unexpected(error, 'createLink');
  }

  revalidatePath('/attendants');
  return success(`Created a link for ${parsed.data.name}`);
}

/**
 * Revoking flips `active` to false. lib/auth.ts re-checks this on every
 * attendant request, so an open tab stops working on its next action rather
 * than when the 30-day cookie eventually expires.
 */
export async function revokeLink(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOwner();

  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return failure('Could not identify that link');

  const active = formData.get('active') !== 'true';

  try {
    await db
      .update(attendantLinks)
      .set({ active })
      .where(eq(attendantLinks.id, parsed.data.id));
  } catch (error) {
    return unexpected(error, 'revokeLink');
  }

  revalidatePath('/attendants');
  return success(active ? 'Link re-activated' : 'Link revoked. It no longer works.');
}

/**
 * Issues a fresh token for the same person, instantly invalidating the old URL.
 * This is what to use when a link has been forwarded to someone it shouldn't have.
 */
export async function regenerateLink(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOwner();

  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return failure('Could not identify that link');

  try {
    await db
      .update(attendantLinks)
      .set({ token: newToken(), active: true, lastUsedAt: null })
      .where(eq(attendantLinks.id, parsed.data.id));
  } catch (error) {
    return unexpected(error, 'regenerateLink');
  }

  revalidatePath('/attendants');
  return success('New link generated. The old one has stopped working.');
}
