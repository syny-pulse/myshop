import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  date,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * MONEY IS STORED AS INTEGER UGX (whole shillings).
 *
 * The Ugandan Shilling has no subunit in practice, so integers sidestep
 * floating-point drift and decimal-string handling entirely. Never introduce
 * a numeric/decimal money column here — format for display in lib/format.ts.
 *
 * DATES are `date` columns (no time component) so a stored row never shifts
 * across a timezone boundary. "Today" is always computed via
 * todayInKampala() in lib/dates.ts, never from the UTC server clock.
 */

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nameUnique: uniqueIndex('categories_name_unique').on(t.name),
  }),
);

/** One row = one purchase batch bought on a shopping day. */
export const items = pgTable(
  'items',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    specifics: text('specifics').notNull(),
    /** Per unit, in whole shillings. Never exposed to attendants. */
    costPrice: integer('cost_price').notNull(),
    /** Per unit. The "estimated selling price" — doubles as the minimum shown to attendants. */
    minPrice: integer('min_price').notNull(),
    /** How many were bought. */
    quantity: integer('quantity').notNull(),
    /** Decremented by each sale. The oversell guard reads this. */
    qtyRemaining: integer('qty_remaining').notNull(),
    purchaseDate: date('purchase_date').notNull(),
    archived: boolean('archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byCategory: index('items_category_idx').on(t.categoryId),
    byPurchaseDate: index('items_purchase_date_idx').on(t.purchaseDate),
  }),
);

export const attendantLinks = pgTable(
  'attendant_links',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    /** 32 random bytes, base64url. The whole of an attendant's credential. */
    token: text('token').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => ({
    tokenUnique: uniqueIndex('attendant_links_token_unique').on(t.token),
  }),
);

export const sales = pgTable(
  'sales',
  {
    id: serial('id').primaryKey(),
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'restrict' }),
    saleDate: date('sale_date').notNull(),
    quantity: integer('quantity').notNull().default(1),
    /** What it actually sold for, per unit. */
    unitPrice: integer('unit_price').notNull(),
    /**
     * SNAPSHOT of items.costPrice at the moment of sale — deliberately not a join.
     * If Sarah later corrects a typo in a batch's cost, historical profit must not
     * silently change. It also makes profit a single-table aggregate.
     */
    unitCost: integer('unit_cost').notNull(),
    /** True when unitPrice < items.minPrice at the time of sale. */
    belowMin: boolean('below_min').notNull().default(false),
    /** null = recorded by Sarah herself. */
    attendantId: integer('attendant_id').references(() => attendantLinks.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bySaleDate: index('sales_sale_date_idx').on(t.saleDate),
    byItem: index('sales_item_idx').on(t.itemId),
  }),
);

export const expenses = pgTable(
  'expenses',
  {
    id: serial('id').primaryKey(),
    expenseDate: date('expense_date').notNull(),
    description: text('description').notNull(),
    amount: integer('amount').notNull(),
    /** rent | transport | stock_transport | wages | utilities | other */
    kind: text('kind').notNull().default('other'),
    attendantId: integer('attendant_id').references(() => attendantLinks.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byExpenseDate: index('expenses_expense_date_idx').on(t.expenseDate),
  }),
);

export const categoriesRelations = relations(categories, ({ many }) => ({
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  category: one(categories, { fields: [items.categoryId], references: [categories.id] }),
  sales: many(sales),
}));

export const salesRelations = relations(sales, ({ one }) => ({
  item: one(items, { fields: [sales.itemId], references: [items.id] }),
  attendant: one(attendantLinks, {
    fields: [sales.attendantId],
    references: [attendantLinks.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  attendant: one(attendantLinks, {
    fields: [expenses.attendantId],
    references: [attendantLinks.id],
  }),
}));

export type Category = typeof categories.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type AttendantLink = typeof attendantLinks.$inferSelect;

export const EXPENSE_KINDS = [
  'rent',
  'transport',
  'stock_transport',
  'wages',
  'utilities',
  'other',
] as const;

export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  rent: 'Rent',
  transport: 'Transport',
  stock_transport: 'Stock transport',
  wages: 'Wages',
  utilities: 'Utilities',
  other: 'Other',
};
