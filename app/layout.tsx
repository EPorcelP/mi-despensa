import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Mi Despensa · Lo que tienes, a mano',
  description: 'Tu despensa y tu próxima compra, sin complicaciones.',
  icons: { icon: '/favicon.svg' },
  robots: { index: false, follow: false },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="es"><body>{children}</body></html>;
}
