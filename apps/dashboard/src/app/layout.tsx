import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Negatic Dashboard',
  description: 'Supplier dashboard for the Negatic F&B procurement platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <header className="border-b border-neutral-200 bg-white">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
            <Link href="/" className="font-semibold">
              Negatic
            </Link>
            <Link href="/orders" className="text-sm hover:underline">
              Orders
            </Link>
            <Link href="/products" className="text-sm hover:underline">
              Products
            </Link>
            <Link href="/docs" className="text-sm hover:underline">
              API
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
