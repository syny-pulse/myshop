'use server';

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, items } from '@/db/schema';
import { requireOwner } from '@/lib/auth';
import { categorySchema, categoryUpdateSchema, idSchema } from '@/lib/validation';
import {
  failure,
  invalid,
  success,
  unexpected,
  type ActionState,
} from '@/lib/action-state';

const POSTGRES_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
  );
}

export async function createCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOwner();

  const parsed = categorySchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return invalid(parsed.error);

  try {
    await db.insert(categories).values({ name: parsed.data.name });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure(`"${parsed.data.name}" already exists`, {
        name: 'That category already exists',
      });
    }
    return unexpected(error, 'createCategory');
  }

  revalidatePath('/categories');
  revalidatePath('/products');
  return success(`Added "${parsed.data.name}"`);
}

export async function renameCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOwner();

  const parsed = categoryUpdateSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
  });
  if (!parsed.success) return invalid(parsed.error);

  try {
    await db
      .update(categories)
      .set({ name: parsed.data.name })
      .where(eq(categories.id, parsed.data.id));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure('Another category already has that name', {
        name: 'That name is taken',
      });
    }
    return unexpected(error, 'renameCategory');
  }

  revalidatePath('/categories');
  revalidatePath('/products');
  return success('Category renamed');
}

/**
 * Deleting a category that still has stock would orphan the batches, so the
 * FK is ON DELETE RESTRICT. We check first to give a message that says what
 * to do rather than surfacing a constraint error.
 */
export async function deleteCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOwner();

  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return failure('Could not identify that category');

  try {
    const [{ count }] = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(items)
      .where(eq(items.categoryId, parsed.data.id));

    if (Number(count) > 0) {
      return failure(
        `That category still has ${count} product ${Number(count) === 1 ? 'batch' : 'batches'}. ` +
          'Move or archive them before deleting it.',
      );
    }

    await db.delete(categories).where(eq(categories.id, parsed.data.id));
  } catch (error) {
    return unexpected(error, 'deleteCategory');
  }

  revalidatePath('/categories');
  revalidatePath('/products');
  return success('Category deleted');
}
