import { z } from 'zod';
import { isValidIsoDate } from './dates';
import { EXPENSE_KINDS } from '@/db/schema';

/** A YYYY-MM-DD calendar date that actually exists. */
export const isoDate = z
  .string()
  .refine(isValidIsoDate, { message: 'Enter a valid date' });

/**
 * Money arrives from the form as a string. UGX has no subunit, so anything with
 * decimals is a data-entry slip — round rather than reject, but refuse
 * negatives and absurd values outright.
 *
 * Separators are stripped first. AmountInput submits bare digits through a
 * hidden field, so "15,000" should never arrive; if it does — a cached bundle,
 * a paste into a field that lost its JS — Number() would return NaN and the
 * shop would be told "Enter an amount" about an amount plainly on screen.
 */
export const money = z.preprocess(
  (value) => (typeof value === 'string' ? value.replace(/[,\s]/g, '') : value),
  z.coerce
    .number({ invalid_type_error: 'Enter an amount' })
    .finite('Enter a valid amount')
    .min(0, 'Amount cannot be negative')
    .max(2_000_000_000, 'That amount looks too large')
    .transform((n) => Math.round(n)),
);

export const positiveMoney = money.refine((n) => n > 0, {
  message: 'Amount must be more than zero',
});

export const quantity = z.coerce
  .number({ invalid_type_error: 'Enter a quantity' })
  .int('Quantity must be a whole number')
  .min(1, 'Quantity must be at least 1')
  .max(100_000, 'That quantity looks too large');

export const shortText = (label: string, max = 200) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be under ${max} characters`);

export const categorySchema = z.object({
  name: shortText('Category name', 60),
});

export const categoryUpdateSchema = categorySchema.extend({
  id: z.coerce.number().int().positive(),
});

export const itemSchema = z
  .object({
    categoryId: z.coerce.number({ invalid_type_error: 'Choose a category' }).int().positive('Choose a category'),
    specifics: shortText('Item description', 200),
    costPrice: positiveMoney,
    minPrice: positiveMoney,
    quantity,
    purchaseDate: isoDate,
  })
  .refine((v) => v.minPrice >= v.costPrice, {
    message: 'Selling price is below the cost price. This batch would lose money.',
    path: ['minPrice'],
  });

export const itemUpdateSchema = z
  .object({
    id: z.coerce.number().int().positive(),
    categoryId: z.coerce.number().int().positive('Choose a category'),
    specifics: shortText('Item description', 200),
    costPrice: positiveMoney,
    minPrice: positiveMoney,
    quantity,
    purchaseDate: isoDate,
  })
  .refine((v) => v.minPrice >= v.costPrice, {
    message: 'Selling price is below the cost price. This batch would lose money.',
    path: ['minPrice'],
  });

export const saleSchema = z.object({
  itemId: z.coerce.number({ invalid_type_error: 'Choose an item' }).int().positive('Choose an item'),
  saleDate: isoDate,
  quantity,
  unitPrice: positiveMoney,
});

export const expenseSchema = z.object({
  expenseDate: isoDate,
  description: shortText('Description', 200),
  amount: positiveMoney,
  kind: z.enum(EXPENSE_KINDS).catch('other'),
});

export const attendantSchema = z.object({
  name: shortText('Attendant name', 60),
});

export const idSchema = z.object({ id: z.coerce.number().int().positive() });

/** Turns a Zod failure into { fieldName: 'message' } for rendering beside inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    const name = typeof key === 'string' ? key : '_form';
    if (!out[name]) out[name] = issue.message;
  }
  return out;
}
