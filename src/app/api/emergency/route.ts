import { NextRequest, NextResponse } from 'next/server';
import { connectNoSQL } from '@/lib/mongodb';
import { StockItemModel } from '@/models/StockItem';
import { checkEmergencyRateLimit, sanitizeString } from '@/lib/security';
import { sendEmergencyEmail } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    if (!checkEmergencyRateLimit(ip)) {
      return NextResponse.json({ error: 'กรุณารอสักครู่ก่อนส่งแจ้งเตือนซ้ำ' }, { status: 429 });
    }

    const { itemId, itemName, note, staffName, setZero } = await req.json();
    const cleanStaff = sanitizeString(staffName || 'พนักงานหน้าร้าน');
    const cleanNote = sanitizeString(note || '');

    await connectNoSQL();
    let finalItemName = sanitizeString(itemName || 'สินค้าในร้าน');

    if (itemId) {
      const item = await StockItemModel.findById(itemId);
      if (item) {
        finalItemName = item.name;
        if (setZero) {
          item.qty = 0;
          item.updatedBy = `${cleanStaff} (แจ้งของหมดด่วน)`;
          await item.save();
        }
      }
    }

    await sendEmergencyEmail({
      itemName: finalItemName,
      staffName: cleanStaff,
      note: cleanNote
    });

    return NextResponse.json({ status: 'emergency_sent' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
