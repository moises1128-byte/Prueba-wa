import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { AppApolloProvider } from '@/context/appApolloProvider';
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
  title: 'Planificación de Transporte',
  description: 'Planificación de rutas, unidades y duties',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AppApolloProvider>
          <AppNav />
          {children}
          <Toaster position="top-right" richColors />
        </AppApolloProvider>
      </body>
    </html>
  );
}
