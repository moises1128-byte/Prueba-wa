import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AppApolloProvider } from '@/context/apolloProvider';
import { AppNav } from '@/shared/ui/molecules/appNav';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Transport Planning',
  description: 'Route, unit, and duty planning',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AppApolloProvider>
          <AppNav />
          {children}
        </AppApolloProvider>
      </body>
    </html>
  );
}
