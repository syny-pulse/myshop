'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { expenses } from '@/db/schema';
import { attendantIdOf, requireUser } from '@/lib/auth';
import { expenseSchema, idSchema } from '@/lib/validation';
import { formatUGX } from '@/lib/format';
import {
  failure,
  invalid,
  success,
  unexpected,
  type ActionState,
} from '@/lib/action-state';

export async function recordExpense(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();

  const parsed = expenseSchema.safeParse({
    expenseDate: formData.get('expenseDate'),
    description: formData.get('description'),
    amount: formData.get('amount'),
    kind: formData.get('kind'),
  });
  if (!parsed.success) return invalid(parsed.error);

  try {
    await db.insert(expenses).values({
      ...parsed.data,
      attendantId: attendantIdOf(session),
    });
  } catch (error) {
    return unexpected(error, 'recordExpense');
  }

  revalidatePath('/expenses');
  revalidatePath('/dashboard');
  revalidatePath('/shop/expense');
  revalidatePath('/shop/summary');

  return success(`Recorded ${formatUGX(parsed.data.amount)} for ${parsed.data.description}`);
}

/** Attendants may only remove expenses they entered themselves. */
export async function deleteExpense(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();

  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return failure('Could not identify that expense');

  try {
    const [expense] = await db
      .select()
      .from(expenses)
      .where(eq(expenses.id, parsed.data.id))
      .limit(1);

    if (!expense) return failure('That expense has already been removed');

    if (session.role === 'attendant' && expense.attendantId !== session.linkId) {
      return failure('You can only remove expenses you recorded yourself');
    }

    await db.delete(expenses).where(eq(expenses.id, parsed.data.id));
  } catch (error) {
    return unexpected(error, 'deleteExpense');
  }

  revalidatePath('/expenses');
  revalidatePath('/dashboard');
  revalidatePath('/shop/expense');
  revalidatePath('/shop/summary');
  return success('Expense removed');
}
