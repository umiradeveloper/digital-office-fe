import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Quicksand } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// Quicksand: bulat & geometris, selaras logotype Umira. Plus Jakarta Sans: teks yang nyaman dibaca.
const display = Quicksand({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--f-display', display: 'swap' });
const body = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--f-body', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Digital Office · Umira', template: '%s · Digital Office Umira' },
  description: 'Workflow, dokumen, dan approval bertingkat dalam satu ruang kerja.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.png', apple: '/apple-touch-icon.png' },
};
export const viewport: Viewport = { themeColor: '#024558', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${display.variable} ${body.variable}`}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
