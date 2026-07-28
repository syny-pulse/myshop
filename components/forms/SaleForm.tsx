'use client';

import { useActionState, useMemo, useRef, useState, useEffect } from 'react';
import { recordSale } from '@/app/actions/sales';
import { idle } from '@/lib/action-state';
import { Field } from '@/components/ui/Field';
import { FormMessage } from '@/components/ui/Alert';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatUGX } from '@/lib/format';
import { todayInKampala } from '@/lib/dates';
import type { SellableItem } from '@/lib/queries';

/**
 * Shared by Sarah and by attendants. It is deliberately built from
 * getSellableItems(), which never selects cost price, so neither side can leak
 * a margin through this component.
 *
 * Selling below the minimum warns but never blocks. Haggling is normal in this
 * trade; the sale is flagged instead so Sarah sees it on her dashboard.
 */
export function SaleForm({ items }: { items: SellableItem[] }) {
  const [state, formAction] = useActionState(recordSale, idle);
  const formRef = useRef<HTMLFormElement>(null);

  const [categoryId, setCategoryId] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');

  const categories = useMemo(() => {
    const seen = new Map<number, string>();
    for (const item of items) seen.set(item.categoryId, item.categoryName);
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const visibleItems = useMemo(
    () => (categoryId ? items.filter((i) => i.categoryId === Number(categoryId)) : items),
    [items, categoryId],
  );

  const selected = items.find((i) => i.id === Number(itemId));

  // Clear a selection that the new category filter no longer contains.
  useEffect(() => {
    if (selected && categoryId && selected.categoryId !== Number(categoryId)) {
      setItemId('');
      setUnitPrice('');
    }
  }, [categoryId, selected]);

  // Reset for the next customer once a sale saves.
  useEffect(() => {
    if (state.ok) {
      setItemId('');
      setQuantity('1');
      setUnitPrice('');
    }
  }, [state.ok, state.nonce]);

  const price = Number(unitPrice) || 0;
  const qty = Number(quantity) || 0;
  const belowMin = Boolean(selected) && price > 0 && price < selected!.minPrice;
  const overStock = Boolean(selected) && qty > selected!.qtyRemaining;
  const total = price * qty;

  if (items.length === 0) {
    return (
      <div className="surface p-5 text-[0.9375rem] text-[var(--text-muted)]">
        There is nothing in stock to sell right now.
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date of sale" htmlFor="saleDate" error={state.errors?.saleDate}>
          <input
            id="saleDate"
            name="saleDate"
            type="date"
            required
            defaultValue={todayInKampala()}
            className="control"
          />
        </Field>

        <Field label="Category" htmlFor="saleCategory">
          <select
            id="saleCategory"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="control"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Item" htmlFor="itemId" error={state.errors?.itemId}>
        <select
          id="itemId"
          name="itemId"
          required
          value={itemId}
          onChange={(e) => {
            setItemId(e.target.value);
            const next = items.find((i) => i.id === Number(e.target.value));
            // Pre-fill with the proposed price; it is the common case.
            setUnitPrice(next ? String(next.minPrice) : '');
          }}
          className="control"
        >
          <option value="" disabled>
            Choose an item
          </option>
          {visibleItems.map((i) => (
            <option key={i.id} value={i.id}>
              {i.specifics} ({i.qtyRemaining} left)
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="How many?"
          htmlFor="quantity"
          error={state.errors?.quantity}
          hint={selected ? `${selected.qtyRemaining} in stock` : undefined}
        >
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
            aria-invalid={overStock || undefined}
            className="control tnum"
          />
        </Field>

        <Field label="Selling price (per item)" htmlFor="unitPrice" error={state.errors?.unitPrice}>
          <input
            id="unitPrice"
            name="unitPrice"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            aria-describedby={selected ? 'min-price-tag' : undefined}
            className="control tnum"
          />
          {selected && (
            <p id="min-price-tag" className="mt-2 flex flex-wrap items-center gap-2">
              <span className={belowMin ? 'chip chip-warn' : 'chip chip-accent'}>
                Minimum {formatUGX(selected.minPrice)}
              </span>
              {belowMin && (
                <span className="text-[0.8125rem] font-medium text-[var(--warn)]">
                  Below the minimum. This sale will be flagged.
                </span>
              )}
            </p>
          )}
        </Field>
      </div>

      {overStock && selected && (
        <p className="text-[0.875rem] font-medium text-[var(--negative)]" role="alert">
          Only {selected.qtyRemaining} in stock. Reduce the quantity to continue.
        </p>
      )}

      <div className="surface flex items-center justify-between gap-3 px-4 py-3.5">
        <span className="text-[0.8125rem] font-medium text-[var(--text-muted)]">
          Total for this sale
        </span>
        <span className="tnum text-[1.35rem] font-semibold tracking-tight">
          {formatUGX(total)}
        </span>
      </div>

      <SubmitButton pendingLabel="Recording" disabled={overStock}>
        Record sale
      </SubmitButton>
    </form>
  );
}
