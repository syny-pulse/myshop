'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Icon } from '@phosphor-icons/react';
import {
  ChartBarIcon,
  ChartLineUpIcon,
  CoinsIcon,
  PackageIcon,
  ReceiptIcon,
  StorefrontIcon,
  TagIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react/dist/ssr';

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
}

/**
 * The lists live here, not in the layouts that use them, because an icon is a
 * function and a Server Component cannot hand a function to a Client one. Only
 * the variant name crosses the boundary; the icons are resolved on this side,
 * which is also what lets the active item render at a different weight.
 */
const NAVS: Record<'owner' | 'attendant', NavItem[]> = {
  owner: [
    { href: '/dashboard', label: 'Dashboard', icon: ChartLineUpIcon },
    { href: '/products', label: 'Stock', icon: PackageIcon },
    { href: '/sales', label: 'Sales', icon: CoinsIcon },
    { href: '/expenses', label: 'Expenses', icon: ReceiptIcon },
    { href: '/categories', label: 'Categories', icon: TagIcon },
    { href: '/attendants', label: 'Attendants', icon: UsersThreeIcon },
  ],
  attendant: [
    { href: '/shop', label: 'Stock', icon: StorefrontIcon },
    { href: '/shop/sale', label: 'Sell', icon: CoinsIcon },
    { href: '/shop/expense', label: 'Expense', icon: ReceiptIcon },
    { href: '/shop/summary', label: 'Summary', icon: ChartBarIcon },
  ],
};

/**
 * One line on desktop. On phones the row scrolls horizontally rather than
 * collapsing into a "More" menu: six destinations is too few to justify
 * hiding half of them behind an extra tap in a shop.
 */
export function AppNav({ variant }: { variant: keyof typeof NAVS }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="-mx-4 overflow-x-auto px-4 pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max gap-1 sm:w-auto">
        {NAVS[variant].map(({ href, label, icon: IconGlyph }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className="flex items-center gap-1.5 rounded-[var(--radius-control)] px-3 py-2 text-[0.875rem] font-medium transition-colors"
                style={
                  active
                    ? {
                        background: 'var(--accent-soft)',
                        color: 'var(--accent-text)',
                      }
                    : { color: 'var(--text-muted)' }
                }
              >
                <IconGlyph size={17} weight={active ? 'fill' : 'regular'} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
