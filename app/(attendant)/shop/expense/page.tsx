import { requireAttendant } from '@/lib/auth';
import { rangeFor, formatDateShort } from '@/lib/dates';
import { getExpenses } from '@/lib/queries';
import { formatUGX } from '@/lib/format';
import { EXPENSE_KIND_LABELS, type ExpenseKind } from '@/db/schema';
import { ExpenseForm } from '@/components/forms/ExpenseForm';

export const metadata = { title: 'Record an expense · Shop Books' };

export default async function AttendantExpensePage() {
  await requireAttendant();

  // Today only: attendants log what they spend as they spend it.
  const today = rangeFor('today');
  const expenses = await getExpenses(today);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[1.5rem] font-semibold tracking-tight">Record an expense</h1>
        <p className="mt-1 text-[0.9375rem] text-[var(--text-muted)]">
          Money spent for the shop, such as transport or lunch for the day.
        </p>
      </div>

      <div className="surface p-5">
        <ExpenseForm />
      </div>

      <section>
        <h2 className="mb-2 text-[0.9375rem] font-semibold">Spent today</h2>
        {expenses.length === 0 ? (
          <p className="surface px-4 py-6 text-center text-[0.875rem] text-[var(--text-muted)]">
            Nothing recorded today.
          </p>
        ) : (
          <ul className="surface divide-y overflow-hidden">
            {expenses.map((expense) => (
              <li
                key={expense.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{expense.description}</p>
                  <p className="text-[0.8125rem] text-[var(--text-muted)]">
                    {formatDateShort(expense.expenseDate)} ·{' '}
                    {EXPENSE_KIND_LABELS[expense.kind as ExpenseKind] ?? 'Other'} ·{' '}
                    {expense.attendantName ?? 'owner'}
                  </p>
                </div>
                <p className="tnum font-medium">{formatUGX(expense.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
