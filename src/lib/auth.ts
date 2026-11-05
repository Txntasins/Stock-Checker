import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { connectNoSQL } from '@/lib/mongodb';
import { AdminRecipientModel } from '@/models/StockItem';

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
      if (!user?.email) return false;
      try {
        await connectNoSQL();
        await AdminRecipientModel.findOneAndUpdate(
          { email: user.email.toLowerCase() },
          {
            $set: {
              email: user.email.toLowerCase(),
              name: user.name || 'เจ้าของร้าน',
              lastLoginAt: new Date()
            }
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error('Failed to save Admin Google email to DB:', err);
      }
      return true;
    },
    async session({ session }) {
      return session;
    }
  }
};
