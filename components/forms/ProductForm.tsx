'use client';

import { useActionState, useState } from 'react';
import { createItem, updateItem } from '@/app/actions/items';
import { idle } from '@/lib/action-state';
import { Field } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatUGX } from '@/lib/format';
import { todayInKampala } from '@/lib/dates';
import type { Category, Item } from '@/db/schema';

/**
 * The shopping-day form. The live estimated-profit footer is the whole point:
 * it tells Sarah whether a batch is worth buying while she is still standing
 * at the supplier, not after she has already paid.
 */
export function ProductForm({
  categories,
  item,
}: {
  categories: Category[];
  item?: Item;
}) {
  const editing = Boolean(item);
  const [state, formAction] = useActionState(editing ? updateItem : createItem, idle);

  const [costPrice, setCostPrice] = useState(item ? String(item.costPrice) : '');
  const [minPrice, setMinPrice] = useState(item ? String(item.minPrice) : '');
  const [quantity, setQuantity] = useState(item ? String(item.quantity) : '1');

  const cost = Number(costPrice) || 0;
  const sell = Number(minPrice) || 0;
  const qty = Number(quantity) || 0;

  const perUnit = sell - cost;
  const total = perUnit * qty;
  const hasFigures = cost > 0 && sell > 0 && qty > 0;
  const losesMoney = hasFigures && perUnit < 0;

  if (categories.length === 0) {
    return (
      <div className="surface p-5 text-[0.9375rem] text-[var(--text-muted)]">
        Add a category first, then come back to record what you bought.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Shopping day" htmlFor="purchaseDate" error={state.errors?.purchaseDate}>
          <input
            id="purchaseDate"
            name="purchaseDate"
            type="date"
            required
            defaultValue={item?.purchaseDate ?? todayInKampala()}
            className="control"
          />
        </Field>

        <Field label="Category" htmlFor="categoryId" error={state.errors?.categoryId}>
          <select
            id="categoryId"
            name="categoryId"
            required
            defaultValue={item?.categoryId ?? ''}
            className="control"
          >
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="What is it?"
        htmlFor="specifics"
        error={state.errors?.specifics}
        hint="Be specific enough to recognise it later, for example: Cotton king size, floral"
      >
        <input
          id="specifics"
          name="specifics"
          type="text"
          required
          maxLength={200}
          defaultValue={item?.specifics ?? ''}
          className="control"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Cost price (per item)"
          htmlFor="costPrice"
          error={state.errors?.costPrice}
        >
          <input
            id="costPrice"
            name="costPrice"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            className="control tnum"
          />
        </Field>

        <Field
          label="Selling price (per item)"
          htmlFor="minPrice"
          error={state.errors?.minPrice}
          hint="Attendants see this as the minimum"
        >
          <input
            id="minPrice"
            name="minPrice"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="control tnum"
          />
        </Field>

        <Field label="How many?" htmlFor="quantity" error={state.errors?.quantity}>
          <input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="control tnum"
          />
        </Field>
      </div>

      <div
        className="rounded-[var(--radius-card)] border px-4 py-3.5"
        style={{
          background: losesMoney ? 'var(--warn-soft)' : 'var(--accent-soft)',
          borderColor: losesMoney ? 'var(--warn-border)' : 'var(--accent-border)',
        }}
      >
        {hasFigures ? (
          <>
            <p
              className="text-[0.8125rem] font-medium"
              style={{ color: losesMoney ? 'var(--warn)' : 'var(--accent-text)' }}
            >
              {losesMoney ? 'This batch would lose money' : 'Estimated profit'}
            </p>
            <p
              className="tnum mt-0.5 text-[1.5rem] font-semibold tracking-tight"
              style={{ color: losesMoney ? 'var(--warn)' : 'var(--accent-text)' }}
            >
              {formatUGX(total)}
            </p>
            <p
              className="tnum mt-0.5 text-[0.8125rem]"
              style={{ color: losesMoney ? 'var(--warn)' : 'var(--accent-text)' }}
            >
              {formatUGX(perUnit)} per item across {qty} {qty === 1 ? 'item' : 'items'}
            </p>
          </>
        ) : (
          <p className="text-[0.875rem] text-[var(--text-muted)]">
            Fill in cost, selling price and quantity to see the estimated profit.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <SubmitButton pendingLabel={editing ? 'Saving' : 'Adding'}>
          {editing ? 'Save changes' : 'Add to stock'}
        </SubmitButton>
      </div>
    </form>
  );
}
