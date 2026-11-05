import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerEmail } from '@/lib/auth';
import { connectNoSQL } from '@/lib/mongodb';
import { StockItemModel } from '@/models/StockItem';
import { AdminCreateItemSchema, StaffUpdateStockSchema, sanitizeString } from '@/lib/security';

const INITIAL_SEED = [
  { name: 'เมล็ดกาแฟคั่วกลาง (House Blend)', category: 'เครื่องดื่ม / วัตถุดิบชง', qty: 8, min: 3, unit: 'ถุง', updatedBy: 'พนักงานหน้าร้าน' },
  { name: 'ผงมัทฉะเกรดพรีเมียม (Uji Matcha)', category: 'เครื่องดื่ม / วัตถุดิบชง', qty: 2, min: 3, unit: 'กระป๋อง', updatedBy: 'พนักงานบาร์น้ำ' },
  { name: 'นมสดพาสเจอร์ไรส์ (Meiji 2L)', category: 'ของสด / นม', qty: 12, min: 5, unit: 'แกลลอน', updatedBy: 'พนักงานบาร์น้ำ' },
  { name: 'นมโอ๊ต (Oat Milk Barista)', category: 'ของสด / นม', qty: 0, min: 4, unit: 'กล่อง', updatedBy: 'พนักงานหน้าร้าน' },
  { name: 'ครัวซองต์เนยสดฝรั่งเศส', category: 'อาหาร / เบเกอรี่', qty: 15, min: 6, unit: 'ชิ้น', updatedBy: 'พนักงานครัว' },
  { name: 'แก้วพลาสติกใส 16 oz พร้อมฝา', category: 'บรรจุภัณฑ์ / แก้ว', qty: 4, min: 5, unit: 'แถว', updatedBy: 'พนักงานหน้าร้าน' }
];

export async function GET() {
  try {
    await connectNoSQL();
    let count = await StockItemModel.countDocuments();
    if (count === 0) {
      await StockItemModel.insertMany(INITIAL_SEED);
    }
    const items = await StockItemModel.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !isOwnerEmail(session.user?.email)) {
      return NextResponse.json({ error: 'เฉพาะเจ้าของร้านที่ล็อกอินด้วย Google เท่านั้น' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = AdminCreateItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }

    await connectNoSQL();
    const created = await StockItemModel.create({
      ...parsed.data,
      updatedBy: session.user?.name || session.user?.email || 'เจ้าของร้าน'
    });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = StaffUpdateStockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'ตัวเลขสต็อกไม่ถูกต้อง' }, { status: 400 });
    }

    await connectNoSQL();
    const cleanStaff = sanitizeString(parsed.data.staffName);
    const updated = await StockItemModel.findByIdAndUpdate(
      parsed.data.id,
      { $set: { qty: parsed.data.qty, updatedBy: cleanStaff } },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'ไม่พบสินค้า' }, { status: 404 });
    }

    return NextResponse.json({ item: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !isOwnerEmail(session.user?.email)) {
      return NextResponse.json({ error: 'เฉพาะเจ้าของร้านเท่านั้น' }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ระบุ ID' }, { status: 400 });

    await connectNoSQL();
    await StockItemModel.findByIdAndDelete(id);
    return NextResponse.json({ status: 'deleted' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
