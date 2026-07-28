import 'server-only';
import { and, desc, eq, gt, gte, lte, sql, asc } from 'drizzle-orm';
import { db } from '@/db';
import { categories, items, sales, expenses, attendantLinks } from '@/db/schema';
import { toNumber } from './format';
import type { DateRange } from './dates';

/**
 * ===================================================================
 * THE COST-PRICE BOUNDARY
 *
 * Attendants must never receive cost price or profit. That rule is
 * enforced HERE, in the select lists — not in the templates.
 *
 * A template that simply "doesn't render" a field still ships it in the
 * RSC payload, where it is visible in devtools, in View Source, and in a
 * React error overlay. Functions below marked ATTENDANT-SAFE never put
 * items.costPrice, sales.unitCost or any profit expression into a select.
 *
 * If you add a field to an ATTENDANT-SAFE function, re-check that rule.
 * ===================================================================
 */

const ZERO = sql`0`;

// ---------------------------------------------------------------- categories

export async function getCategories() {
  return db.select().from(categories).orderBy(asc(categories.name));
}

export async function getCategoriesWithCounts() {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      itemCount: sql<string>`COUNT(${items.id})`,
      unitsRemaining: sql<string>`COALESCE(SUM(${items.qtyRemaining}), 0)`,
    })
    .from(categories)
    .leftJoin(items, and(eq(items.categoryId, categories.id), eq(items.archived, false)))
    .groupBy(categories.id, categories.name)
    .orderBy(asc(categories.name));
}

// -------------------------------------------------------------------- items

/** OWNER ONLY — includes cost price and margin. */
export async function getItemsWithCost() {
  return db
    .select({
      id: items.id,
      specifics: items.specifics,
      costPrice: items.costPrice,
      minPrice: items.minPrice,
      quantity: items.quantity,
      qtyRemaining: items.qtyRemaining,
      purchaseDate: items.purchaseDate,
      archived: items.archived,
      categoryId: items.categoryId,
      categoryName: categories.name,
    })
    .from(items)
    .innerJoin(categories, eq(items.categoryId, categories.id))
    .orderBy(desc(items.purchaseDate), desc(items.id));
}

/** OWNER ONLY — one batch, for the edit form. */
export async function getItemById(id: number) {
  const [row] = await db.select().from(items).where(eq(items.id, id)).limit(1);
  return row ?? null;
}

/**
 * ATTENDANT-SAFE. Deliberately used by BOTH sale forms so there is only one
 * query to audit. `minPrice` is the proposed selling price and is meant to be
 * seen; `costPrice` is absent from the select list.
 */
export async function getSellableItems() {
  return db
    .select({
      id: items.id,
      specifics: items.specifics,
      minPrice: items.minPrice,
      qtyRemaining: items.qtyRemaining,
      categoryId: items.categoryId,
      categoryName: categories.name,
    })
    .from(items)
    .innerJoin(categories, eq(items.categoryId, categories.id))
    .where(and(eq(items.archived, false), gt(items.qtyRemaining, 0)))
    .orderBy(asc(categories.name), asc(items.specifics));
}

export type SellableItem = Awaited<ReturnType<typeof getSellableItems>>[number];

// ------------------------------------------------------------------- stock

/** OWNER ONLY — stock valued at cost and at retail. */
export async function getStockValue() {
  const [row] = await db
    .select({
      atCost: sql<string>`COALESCE(SUM(${items.qtyRemaining} * ${items.costPrice}), 0)`,
      atRetail: sql<string>`COALESCE(SUM(${items.qtyRemaining} * ${items.minPrice}), 0)`,
      units: sql<string>`COALESCE(SUM(${items.qtyRemaining}), 0)`,
      batches: sql<string>`COUNT(*) FILTER (WHERE ${items.qtyRemaining} > 0)`,
    })
    .from(items)
    .where(eq(items.archived, false));

  return {
    atCost: toNumber(row?.atCost),
    atRetail: toNumber(row?.atRetail),
    units: toNumber(row?.units),
    batches: toNumber(row?.batches),
  };
}

/** ATTENDANT-SAFE — a unit count and nothing else. No money figure at all. */
export async function getStockUnitCount() {
  const [row] = await db
    .select({
      units: sql<string>`COALESCE(SUM(${items.qtyRemaining}), 0)`,
      batches: sql<string>`COUNT(*) FILTER (WHERE ${items.qtyRemaining} > 0)`,
    })
    .from(items)
    .where(eq(items.archived, false));

  return { units: toNumber(row?.units), batches: toNumber(row?.batches) };
}

// --------------------------------------------------------------- dashboard

/**
 * OWNER ONLY.
 *
 * Note that stock value is POINT-IN-TIME — it answers "what am I holding
 * right now" and deliberately ignores the date range. The UI must label it
 * "as of today" so it is never read as belonging to the selected period.
 */
export async function getDashboardMetrics(range: DateRange) {
  const inRange = and(gte(sales.saleDate, range.from), lte(sales.saleDate, range.to));

  const [salesAgg] = await db
    .select({
      revenue: sql<string>`COALESCE(SUM(${sales.quantity} * ${sales.unitPrice}), 0)`,
      grossProfit: sql<string>`COALESCE(SUM(${sales.quantity} * (${sales.unitPrice} - ${sales.unitCost})), 0)`,
      unitsSold: sql<string>`COALESCE(SUM(${sales.quantity}), 0)`,
      transactions: sql<string>`COUNT(*)`,
      belowMinCount: sql<string>`COUNT(*) FILTER (WHERE ${sales.belowMin})`,
    })
    .from(sales)
    .where(inRange);

  const [expenseAgg] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
      count: sql<string>`COUNT(*)`,
    })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, range.from), lte(expenses.expenseDate, range.to)));

  const stock = await getStockValue();

  const revenue = toNumber(salesAgg?.revenue);
  const grossProfit = toNumber(salesAgg?.grossProfit);
  const expensesTotal = toNumber(expenseAgg?.total);

  return {
    revenue,
    grossProfit,
    expensesTotal,
    /** The bottom line Sarah actually cares about. */
    netProfit: grossProfit - expensesTotal,
    costOfGoodsSold: revenue - grossProfit,
    unitsSold: toNumber(salesAgg?.unitsSold),
    transactions: toNumber(salesAgg?.transactions),
    belowMinCount: toNumber(salesAgg?.belowMinCount),
    expenseCount: toNumber(expenseAgg?.count),
    stock,
  };
}

/** ATTENDANT-SAFE — revenue and volume only. No profit, no stock value. */
export async function getAttendantSummary(range: DateRange) {
  const [row] = await db
    .select({
      revenue: sql<string>`COALESCE(SUM(${sales.quantity} * ${sales.unitPrice}), 0)`,
      unitsSold: sql<string>`COALESCE(SUM(${sales.quantity}), 0)`,
      transactions: sql<string>`COUNT(*)`,
    })
    .from(sales)
    .where(and(gte(sales.saleDate, range.from), lte(sales.saleDate, range.to)));

  const stock = await getStockUnitCount();

  return {
    revenue: toNumber(row?.revenue),
    unitsSold: toNumber(row?.unitsSold),
    transactions: toNumber(row?.transactions),
    stockUnits: stock.units,
  };
}

/** OWNER ONLY — daily revenue/profit series for the chart. */
export async function getDailySeries(range: DateRange) {
  const rows = await db
    .select({
      day: sales.saleDate,
      revenue: sql<string>`COALESCE(SUM(${sales.quantity} * ${sales.unitPrice}), 0)`,
      profit: sql<string>`COALESCE(SUM(${sales.quantity} * (${sales.unitPrice} - ${sales.unitCost})), 0)`,
    })
    .from(sales)
    .where(and(gte(sales.saleDate, range.from), lte(sales.saleDate, range.to)))
    .groupBy(sales.saleDate)
    .orderBy(asc(sales.saleDate));

  return rows.map((r) => ({
    day: r.day,
    revenue: toNumber(r.revenue),
    profit: toNumber(r.profit),
  }));
}

/** ATTENDANT-SAFE version of the series — revenue only. */
export async function getDailyRevenueSeries(range: DateRange) {
  const rows = await db
    .select({
      day: sales.saleDate,
      revenue: sql<string>`COALESCE(SUM(${sales.quantity} * ${sales.unitPrice}), 0)`,
    })
    .from(sales)
    .where(and(gte(sales.saleDate, range.from), lte(sales.saleDate, range.to)))
    .groupBy(sales.saleDate)
    .orderBy(asc(sales.saleDate));

  return rows.map((r) => ({ day: r.day, revenue: toNumber(r.revenue) }));
}

/** OWNER ONLY — which categories are actually earning. */
export async function getCategoryBreakdown(range: DateRange) {
  const rows = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      revenue: sql<string>`COALESCE(SUM(${sales.quantity} * ${sales.unitPrice}), 0)`,
      profit: sql<string>`COALESCE(SUM(${sales.quantity} * (${sales.unitPrice} - ${sales.unitCost})), 0)`,
      unitsSold: sql<string>`COALESCE(SUM(${sales.quantity}), 0)`,
    })
    .from(sales)
    .innerJoin(items, eq(sales.itemId, items.id))
    .innerJoin(categories, eq(items.categoryId, categories.id))
    .where(and(gte(sales.saleDate, range.from), lte(sales.saleDate, range.to)))
    .groupBy(categories.id, categories.name)
    .orderBy(desc(sql`COALESCE(SUM(${sales.quantity} * ${sales.unitPrice}), 0)`));

  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    revenue: toNumber(r.revenue),
    profit: toNumber(r.profit),
    unitsSold: toNumber(r.unitsSold),
  }));
}

// -------------------------------------------------------------------- sales

/** OWNER ONLY — includes unit cost and per-line profit. */
export async function getSalesForOwner(range: DateRange, limit = 500) {
  return db
    .select({
      id: sales.id,
      saleDate: sales.saleDate,
      quantity: sales.quantity,
      unitPrice: sales.unitPrice,
      unitCost: sales.unitCost,
      belowMin: sales.belowMin,
      specifics: items.specifics,
      minPrice: items.minPrice,
      categoryName: categories.name,
      attendantName: attendantLinks.name,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .innerJoin(items, eq(sales.itemId, items.id))
    .innerJoin(categories, eq(items.categoryId, categories.id))
    .leftJoin(attendantLinks, eq(sales.attendantId, attendantLinks.id))
    .where(and(gte(sales.saleDate, range.from), lte(sales.saleDate, range.to)))
    .orderBy(desc(sales.saleDate), desc(sales.id))
    .limit(limit);
}

/** ATTENDANT-SAFE — no unitCost, no profit expression. */
export async function getSalesForAttendant(range: DateRange, limit = 200) {
  return db
    .select({
      id: sales.id,
      saleDate: sales.saleDate,
      quantity: sales.quantity,
      unitPrice: sales.unitPrice,
      specifics: items.specifics,
      categoryName: categories.name,
      attendantName: attendantLinks.name,
    })
    .from(sales)
    .innerJoin(items, eq(sales.itemId, items.id))
    .innerJoin(categories, eq(items.categoryId, categories.id))
    .leftJoin(attendantLinks, eq(sales.attendantId, attendantLinks.id))
    .where(and(gte(sales.saleDate, range.from), lte(sales.saleDate, range.to)))
    .orderBy(desc(sales.saleDate), desc(sales.id))
    .limit(limit);
}

/** OWNER ONLY — the flagged-sale callout on the dashboard. */
export async function getBelowMinSales(range: DateRange) {
  return db
    .select({
      id: sales.id,
      saleDate: sales.saleDate,
      quantity: sales.quantity,
      unitPrice: sales.unitPrice,
      minPrice: items.minPrice,
      specifics: items.specifics,
      attendantName: attendantLinks.name,
    })
    .from(sales)
    .innerJoin(items, eq(sales.itemId, items.id))
    .leftJoin(attendantLinks, eq(sales.attendantId, attendantLinks.id))
    .where(
      and(
        eq(sales.belowMin, true),
        gte(sales.saleDate, range.from),
        lte(sales.saleDate, range.to),
      ),
    )
    .orderBy(desc(sales.saleDate), desc(sales.id))
    .limit(50);
}

// ----------------------------------------------------------------- expenses

export async function getExpenses(range: DateRange, limit = 500) {
  return db
    .select({
      id: expenses.id,
      expenseDate: expenses.expenseDate,
      description: expenses.description,
      amount: expenses.amount,
      kind: expenses.kind,
      attendantName: attendantLinks.name,
    })
    .from(expenses)
    .leftJoin(attendantLinks, eq(expenses.attendantId, attendantLinks.id))
    .where(and(gte(expenses.expenseDate, range.from), lte(expenses.expenseDate, range.to)))
    .orderBy(desc(expenses.expenseDate), desc(expenses.id))
    .limit(limit);
}

export async function getExpenseTotal(range: DateRange) {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
    .from(expenses)
    .where(and(gte(expenses.expenseDate, range.from), lte(expenses.expenseDate, range.to)));
  return toNumber(row?.total);
}

// --------------------------------------------------------- attendant links

export async function getAttendantLinks() {
  return db
    .select({
      id: attendantLinks.id,
      name: attendantLinks.name,
      token: attendantLinks.token,
      active: attendantLinks.active,
      createdAt: attendantLinks.createdAt,
      lastUsedAt: attendantLinks.lastUsedAt,
      salesCount: sql<string>`(SELECT COUNT(*) FROM ${sales} WHERE ${sales.attendantId} = ${attendantLinks.id})`,
    })
    .from(attendantLinks)
    .orderBy(desc(attendantLinks.active), asc(attendantLinks.name));
}

/**
 * Revalidates an attendant's session on every guarded request. A revoked link
 * must stop working immediately — the signed cookie alone is not enough,
 * because it stays cryptographically valid for 30 days after revocation.
 */
export async function isAttendantActive(linkId: number): Promise<boolean> {
  const [row] = await db
    .select({ active: attendantLinks.active })
    .from(attendantLinks)
    .where(eq(attendantLinks.id, linkId))
    .limit(1);
  return row?.active === true;
}

export { ZERO };
