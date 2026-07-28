'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { items, sales } from '@/db/schema';
import { attendantIdOf, requireUser } from '@/lib/auth';
import { saleSchema, idSchema } from '@/lib/validation';
import { formatUGX, pluralise } from '@/lib/format';
import {
  failure,
  invalid,
  success,
  unexpected,
  type ActionState,
} from '@/lib/action-state';

/** Thrown inside the transaction to roll it back with a message we can render. */
class StockError extends Error {
  constructor(
    message: string,
    readonly kind: 'missing' | 'archived' | 'insufficient',
    readonly remaining = 0,
  ) {
    super(message);
  }
}

/**
 * Recording a sale is the only place in the app with real concurrency risk:
 * two attendants can tap "Record sale" for the last blanket at the same moment.
 *
 * The guard is the conditional UPDATE itself — `WHERE qty_remaining >= n` makes
 * the decrement atomic, so exactly one of the two racing statements matches a
 * row and the other gets zero rows back and is rejected. A read-then-write
 * would let both through and drive stock negative.
 */
export async function recordSale(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();

  const parsed = saleSchema.safeParse({
    itemId: formData.get('itemId'),
    saleDate: formData.get('saleDate'),
    quantity: formData.get('quantity'),
    unitPrice: formData.get('unitPrice'),
  });
  if (!parsed.success) return invalid(parsed.error);

  const { itemId, saleDate, quantity, unitPrice } = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      const decremented = await tx
        .update(items)
        .set({ qtyRemaining: sql`${items.qtyRemaining} - ${quantity}` })
        .where(
          and(
            eq(items.id, itemId),
            eq(items.archived, false),
            gte(items.qtyRemaining, quantity),
          ),
        )
        .returning({
          costPrice: items.costPrice,
          minPrice: items.minPrice,
          specifics: items.specifics,
          qtyRemaining: items.qtyRemaining,
        });

      if (decremented.length === 0) {
        // Work out *why* it failed so the message is actionable.
        const [current] = await tx
          .select({
            qtyRemaining: items.qtyRemaining,
            archived: items.archived,
          })
          .from(items)
          .where(eq(items.id, itemId))
          .limit(1);

        if (!current) throw new StockError('That item no longer exists', 'missing');
        if (current.archived)
          throw new StockError('That item has been archived', 'archived');
        throw new StockError(
          'Not enough stock remaining',
          'insufficient',
          current.qtyRemaining,
        );
      }

      const item = decremented[0];

      await tx.insert(sales).values({
        itemId,
        saleDate,
        quantity,
        unitPrice,
        // Snapshot, not a join — see db/schema.ts.
        unitCost: item.costPrice,
        belowMin: unitPrice < item.minPrice,
        attendantId: attendantIdOf(session),
      });

      return {
        specifics: item.specifics,
        belowMin: unitPrice < item.minPrice,
        remaining: item.qtyRemaining,
      };
    });

    revalidatePath('/sales');
    revalidatePath('/dashboard');
    revalidatePath('/products');
    revalidatePath('/shop');
    revalidatePath('/shop/summary');

    const total = unitPrice * quantity;
    const tail = `${result.remaining} ${pluralise(result.remaining, 'unit')} left`;

    return success(
      result.belowMin
        ? `Recorded ${quantity} × ${result.specifics} for ${formatUGX(total)}. Flagged as below the minimum. ${tail}.`
        : `Recorded ${quantity} × ${result.specifics} for ${formatUGX(total)}. ${tail}.`,
    );
  } catch (error) {
    if (error instanceof StockError) {
      if (error.kind === 'insufficient') {
        return failure(
          error.remaining === 0
            ? 'That item is out of stock.'
            : `Only ${error.remaining} ${pluralise(error.remaining, 'unit')} left. Someone may have just sold some.`,
          { quantity: `Only ${error.remaining} available` },
        );
      }
      return failure(error.message);
    }
    return unexpected(error, 'recordSale');
  }
}

/**
 * Deleting a sale must put the stock back, in the same transaction, or the
 * batch is permanently short.
 *
 * Attendants may only undo their own entries; Sarah can delete any.
 */
export async function deleteSale(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();

  const parsed = idSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) return failure('Could not identify that sale');

  try {
    const denied = await db.transaction(async (tx) => {
      const [sale] = await tx
        .select()
        .from(sales)
        .where(eq(sales.id, parsed.data.id))
        .limit(1);

      if (!sale) return 'That sale has already been removed';

      if (session.role === 'attendant' && sale.attendantId !== session.linkId) {
        return 'You can only remove sales you recorded yourself';
      }

      await tx.delete(sales).where(eq(sales.id, parsed.data.id));
      await tx
        .update(items)
        .set({ qtyRemaining: sql`${items.qtyRemaining} + ${sale.quantity}` })
        .where(eq(items.id, sale.itemId));

      return null;
    });

    if (denied) return failure(denied);
  } catch (error) {
    return unexpected(error, 'deleteSale');
  }

  revalidatePath('/sales');
  revalidatePath('/dashboard');
  revalidatePath('/products');
  revalidatePath('/shop');
  revalidatePath('/shop/summary');
  return success('Sale removed and stock restored');
}
