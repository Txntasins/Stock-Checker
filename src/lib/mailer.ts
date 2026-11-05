import nodemailer from 'nodemailer';
import { connectNoSQL } from '@/lib/mongodb';
import { AdminRecipientModel } from '@/models/StockItem';

function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error('กรุณาตั้งค่า SMTP_USER และ SMTP_APP_PASSWORD ใน Environment Variables');
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
}

async function getSavedRecipientEmails(): Promise<string[]> {
  await connectNoSQL();
  const docs = await AdminRecipientModel.find({}).sort({ lastLoginAt: -1 }).lean();
  const emails = docs.map((d: any) => d.email).filter(Boolean);
  if (emails.length === 0 && process.env.SMTP_USER) {
    return [process.env.SMTP_USER];
  }
  return emails;
}

export async function sendEmergencyEmail(params: {
  itemName: string;
  staffName: string;
  note: string;
}) {
  const recipients = await getSavedRecipientEmails();
  if (recipients.length === 0) {
    throw new Error('ยังไม่มีบัญชี Google Email ที่เคย Sign in เข้าระบบ');
  }
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `"MinimalStock แจ้งเตือนด่วน" <${process.env.SMTP_USER}>`,
    to: recipients.join(', '),
    subject: `[ฉุกเฉิน] ของหมด: ${params.itemName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; padding: 20px; border: 1px solid #fecdd3; border-radius: 12px; background: #fff1f2;">
        <h2 style="color: #be123c; margin-top: 0;">แจ้งเตือนของหมดกะทันหัน</h2>
        <p style="font-size: 15px; color: #0f172a;"><b>รายการสินค้า:</b> ${params.itemName}</p>
        <p style="font-size: 14px; color: #334155;"><b>ผู้กดแจ้ง:</b> ${params.staffName}</p>
        <p style="font-size: 14px; color: #334155;"><b>หมายเหตุจากหน้าร้าน:</b> ${params.note || '-'}</p>
      </div>
    `
  });
}

export async function send3DaySummaryEmail(items: Array<{ name: string; category: string; qty: number; min: number; unit: string }>) {
  const recipients = await getSavedRecipientEmails();
  if (recipients.length === 0) return;

  const transporter = getTransporter();
  const lowItems = items.filter((i) => i.qty <= i.min);

  const rowsHtml = items
    .map((i) => {
      const status = i.qty <= 0 ? '🔴 หมดสต็อก' : i.qty <= i.min ? '🟡 ใกล้หมด' : '🟢 ปกติ';
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${i.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${i.category}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${i.qty} ${i.unit}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${status}</td>
        </tr>
      `;
    })
    .join('');

  await transporter.sendMail({
    from: `"MinimalStock รายงานสต็อก" <${process.env.SMTP_USER}>`,
    to: recipients.join(', '),
    subject: `[รายงานสต็อกทุก 3 วัน เวลา 10:00 น.] สินค้าต้องสั่งเพิ่ม ${lowItems.length} รายการ`,
    html: `
      <div style="font-family: sans-serif; max-width: 640px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #0f172a; margin-top: 0;">สรุปรายงานสต็อกสินค้าประจำรอบ 3 วัน (10:00 น.)</h2>
        <p style="color: #475569; font-size: 14px;">รายการทั้งหมด ${items.length} รายการ | รายการที่ใกล้หมดหรือหมดสต็อก ${lowItems.length} รายการ</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">ชื่อรายการ</th>
              <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">หมวดหมู่</th>
              <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">คงเหลือ</th>
              <th style="padding: 8px; border-bottom: 2px solid #cbd5e1;">สถานะ</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `
  });
}
