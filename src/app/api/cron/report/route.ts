import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { connectNoSQL } from '@/lib/mongodb';
import { StockItemModel } from '@/models/StockItem';
import { send3DaySummaryEmail } from '@/lib/mailer';

// GET: สำหรับ Vercel Cron เรียกอัตโนมัติทุก ๆ 3 วัน (0 9 */3 * *)
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized Cron' }, { status: 401 });
    }

    await connectNoSQL();
    const items = await StockItemModel.find({}).sort({ qty: 1 }).lean();
    await send3DaySummaryEmail(items as any);

    return NextResponse.json({ status: 'report_sent', count: items.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: สำหรับเจ้าของร้านกดปุ่ม "ส่งรายงานสต็อกเข้าอีเมลทันที" จากหน้าเว็บ
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !isOwnerEmail(session.user?.email)) {
      return NextResponse.json({ error: 'เฉพาะเจ้าของร้านเท่านั้น' }, { status: 401 });
    }

    await connectNoSQL();
    const items = await StockItemModel.find({}).sort({ qty: 1 }).lean();
    await send3DaySummaryEmail(items as any);

    return NextResponse.json({ status: 'report_sent', count: items.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
