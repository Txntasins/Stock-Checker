import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  const rawAllowed = process.env.OWNER_GOOGLE_EMAIL || '';
  if (!rawAllowed.trim()) return true; // หากไม่ได้ล็อกอีเมลไว้ ให้ทุกบัญชี Google ที่ผ่าน OAuth เข้าได้
  const allowedList = rawAllowed.split(',').map((e) => e.trim().toLowerCase());
  return allowedList.includes(email.toLowerCase());
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || ''
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user }) {
      return isOwnerEmail(user.email);
    },
    async session({ session }) {
      return session;
    }
  }
};
