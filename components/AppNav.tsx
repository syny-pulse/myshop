'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Icon } from '@phosphor-icons/react';

export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
}

/**
 * One line on desktop. On phones the row scrolls horizontally rather than
 * collapsing into a "More" menu: six destinations is too few to justify
 * hiding half of them behind an extra tap in a shop.
 */
export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="-mx-4 overflow-x-auto px-4 pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max gap-1 sm:w-auto">
        {items.map(({ href, label, icon: IconGlyph }) => {
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
