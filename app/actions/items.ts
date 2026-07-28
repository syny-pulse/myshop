'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { items } from '@/db/schema';
import { requireOwner } from '@/lib/auth';
import { itemSchema, itemUpdateSchema, idSchema } from '@/lib/validation';
import { formatUGX } from '@/lib/format';
import {
  failure,
  invalid,
  success,
  unexpected,
  type ActionState,
} from '@/lib/action-state';

/** The shopping-day form. Owner only — this is where cost price enters the system. */
export async function createItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOwner();

  const parsed = itemSchema.safeParse({
    categoryId: formData.get('categoryId'),
    specifics: formData.get('specifics'),
    costPrice: formData.get('costPrice'),
    minPrice: formData.get('minPrice'),
    quantity: formData.get('quantity'),
    purchaseDate: formData.get('purchaseDate'),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { quantity, costPrice, minPrice } = parsed.data;

  try {
    await db.insert(items).values({
      ...parsed.data,
      // A new batch starts entirely unsold.
      qtyRemaining: quantity,
    });
  } catch (error) {
    return unexpected(error, 'createItem');
  }

  revalidatePath('/products');
  revalidatePath('/dashboard');
  revalidatePath('/sales');
  revalidatePath('/shop');

  const estimatedProfit = (minPrice - costPrice) * quantity;
  return success(
    `Added ${quantity} × ${parsed.data.specifics}. Estimated profit ${formatUGX(estimatedProfit)}.`,
  );
}

/**
 * Editing a batch has to keep `qtyRemaining` consistent with what has already
 * been sold. Units sold is derived (quantity − qtyRemaining) rather than
 * counted from the sales table, so it stays correct even if a sale row was
 * deleted and the stock restored.
 */
export async function updateItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOwner();

  const parsed = itemUpdateSchema.safeParse({
    id: formData.get('id'),
    categoryId: formData.get('categoryId'),
    specifics: formData.get('specifics'),
    costPrice: formData.get('costPrice'),
    minPrice: formData.get('minPrice'),
    quantity: formData.get('quantity'),
    purchaseDate: formData.get('purchaseDate'),
  });
  if (!parsed.success) return invalid(parsed.error);

  try {
    const [existing] = await db
      .select()
      .from(items)
      .where(eq(items.id, parsed.data.id))
      .limit(1);

    if (!existing) return failure('That product batch no longer exists');

    const unitsSold = existing.quantity - existing.qtyRemaining;

    if (parsed.data.quantity < unitsSold) {
      return failure(
        `${unitsSold} ${unitsSold === 1 ? 'unit has' : 'units have'} already been sold from this batch, ` +
          `so the quantity cannot be less than ${unitsSold}.`,
        { quantity: `Must be at least ${unitsSold}` },
      );
    }

    await db
      .update(items)
      .set({
        categoryId: parsed.data.categoryId,
        specifics: parsed.data.specifics,
        costPrice: parsed.data.costPrice,
        minPrice: parsed.data.minPrice,
        quantity: parsed.data.quantity,
        qtyRemaining: parsed.data.quantity - unitsSold,
        purchaseDate: parsed.data.purchaseDate,
      })
      .where(eq(items.id, parsed.data.id));
  } catch (error) {
    return unexpected(error, 'updateItem');
  }

  revalidatePath('/products');
  revalidatePath('/dashboard');
  revalidatePath('/shop');

  // Past sales keep their snapshotted unit_cost, so historical profit is unchanged.
  return success('Product updated. Past sales keep the cost they were recorded with.');
}

/** Archiving hides a batch from sale lists and stock value without destroying sales history. */
export async function archiveItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOwner();

  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return failure('Could not identify that product');

  const archived = formData.get('archived') !== 'true';

  try {
    await db.update(items).set({ archived }).where(eq(items.id, parsed.data.id));
  } catch (error) {
    return unexpected(error, 'archiveItem');
  }

  revalidatePath('/products');
  revalidatePath('/dashboard');
  revalidatePath('/shop');
  return success(archived ? 'Product archived' : 'Product restored');
}
