import Link from 'next/link';
import {
  ChartLineUpIcon,
  PackageIcon,
  ReceiptIcon,
  TagIcon,
  UsersThreeIcon,
  CoinsIcon,
  SignOutIcon,
} from '@phosphor-icons/react/dist/ssr';
import { requireOwner } from '@/lib/auth';
import { logout } from '@/app/actions/auth';
import { AppNav, type NavItem } from '@/components/AppNav';

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: ChartLineUpIcon },
  { href: '/products', label: 'Stock', icon: PackageIcon },
  { href: '/sales', label: 'Sales', icon: CoinsIcon },
  { href: '/expenses', label: 'Expenses', icon: ReceiptIcon },
  { href: '/categories', label: 'Categories', icon: TagIcon },
  { href: '/attendants', label: 'Attendants', icon: UsersThreeIcon },
];

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  // Guards the pages. Server Actions guard themselves; see lib/auth.ts.
  await requireOwner();

  return (
    <div className="min-h-[100dvh]">
      <header
        className="sticky top-0 z-20 border-b backdrop-blur"
        style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex h-14 items-center justify-between gap-4">
            <Link href="/dashboard" className="flex items-baseline gap-2">
              <span className="text-[0.9375rem] font-semibold tracking-tight">
                Shop Books
              </span>
              <span className="text-[0.75rem] text-[var(--text-faint)]">Owner</span>
            </Link>

            <form action={logout}>
              <button type="submit" className="btn btn-ghost px-2.5 py-1.5">
                <SignOutIcon size={16} />
                <span className="sr-only sm:not-sr-only">Sign out</span>
              </button>
            </form>
          </div>
          <div className="pb-2">
            <AppNav items={NAV} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-16">{children}</main>
    </div>
  );
}
