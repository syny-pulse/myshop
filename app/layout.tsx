import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'Shop Books',
  description: 'Stock, sales and expenses for a beddings and clothings shop.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Attendants work one-handed on phones; keep the theme bar in step with the app.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfafa' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0b0d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
