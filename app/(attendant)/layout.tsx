import Link from 'next/link';
import { requireAttendant } from '@/lib/auth';
import { AppNav } from '@/components/AppNav';

export default async function AttendantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Also re-checks that the link has not been revoked. See lib/auth.ts.
  const session = await requireAttendant();

  return (
    <div className="min-h-[100dvh]">
      <header
        className="sticky top-0 z-20 border-b backdrop-blur"
        style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}
      >
        <div className="mx-auto max-w-3xl px-4">
          <div className="flex h-14 items-center justify-between gap-4">
            <Link href="/shop" className="text-[0.9375rem] font-semibold tracking-tight">
              Shop Books
            </Link>
            <span className="text-[0.8125rem] text-[var(--text-muted)]">
              {session.name}
            </span>
          </div>
          <div className="pb-2">
            <AppNav variant="attendant" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 pb-16">{children}</main>
    </div>
  );
}
