import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MinimalStock — ระบบเช็คสต็อกร้านอาหารและเครื่องดื่ม',
  description: 'ระบบเช็คสต็อกสินค้าและวัตถุดิบภายในร้าน'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
