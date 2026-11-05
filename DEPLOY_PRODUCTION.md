# คู่มือการ Deploy ขึ้นระบบจริง (Production พร้อมใช้งานจริง ไม่ใช่ localhost)

โปรเจกต์นี้เชื่อมต่อ **Google Login (NextAuth)** + **MongoDB Atlas (NoSQL)** + **ส่งอีเมลจริงผ่าน Gmail SMTP** เรียบร้อยแล้ว สามารถเอาขึ้นออนไลน์ให้พนักงานและเจ้าของร้านใช้งานผ่านมือถือ/แท็บเล็ตได้ทันทีตาม 4 ขั้นตอนด้านล่างนี้ครับ:

---

## ขั้นตอนที่ 1: สร้างฐานข้อมูล NoSQL ฟรีบน MongoDB Atlas
1. เข้าเว็บ [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) แล้วสมัคร/ล็อกอิน
2. กด **Create Cluster** เลือกแพ็กเกจ **M0 (Free)**
3. ไปที่เมนู **Database Access** -> สร้าง User และ Password สำหรับเชื่อมต่อฐานข้อมูล
4. ไปที่เมนู **Network Access** -> กด **Add IP Address** -> เลือก **Allow Access from Anywhere (`0.0.0.0/0`)** เพื่อให้เซิร์ฟเวอร์ Vercel เชื่อมต่อได้
5. กด **Connect** -> **Drivers** -> คัดลอก Connection String มาเก็บไว้เป็นค่า `MONGODB_URI`

---

## ขั้นตอนที่ 2: สร้างรหัสผ่านส่งอีเมล Gmail (App Password 16 หลัก)
เพื่อให้ระบบส่งอีเมลแจ้งเตือนของหมดด่วนและรายงานทุก 3 วันเข้า Gmail เจ้าของร้านได้จริง:
1. เข้าบัญชี Google ของเจ้าของร้าน ไปที่ [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. เปิดใช้งาน **2-Step Verification (การยืนยันแบบ 2 ขั้นตอน)**
3. ค้นหาคำว่า **App Passwords (รหัสผ่านสำหรับแอป)** ด้านบน
4. ตั้งชื่อแอปว่า `MinimalStock` แล้วกดสร้าง จะได้รหัส 16 หลัก (เช่น `abcd efgh ijkl mnop`) นำไปใส่ในค่า `SMTP_APP_PASSWORD`

---

## ขั้นตอนที่ 3: สร้าง Google OAuth สำหรับล็อกอินหน้า Admin
1. เข้า [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. สร้างโปรเจกต์ใหม่ -> ไปที่ **OAuth consent screen** ตั้งค่าเป็น External แล้วกรอกชื่อแอปและอีเมล
3. ไปที่ **Credentials** -> กด **Create Credentials** -> **OAuth client ID** -> เลือกประเภทเป็น **Web application**
4. ช่อง **Authorized JavaScript origins** ใส่โดเมนจริงของคุณ (เช่น `https://stock-otr.vercel.app`)
5. ช่อง **Authorized redirect URIs** ใส่:
   `https://stock-otr.vercel.app/api/auth/callback/google`
6. คัดลอก **Client ID** และ **Client Secret** ไปใส่ใน `GOOGLE_CLIENT_ID` และ `GOOGLE_CLIENT_SECRET`

---

## ขั้นตอนที่ 4: นำขึ้นออนไลน์ฟรีบน Vercel (พร้อมทำงาน Cron ทุก 3 วัน)
1. อัปโหลดโฟลเดอร์โปรเจกต์นี้ขึ้น GitHub Repository ของคุณ
2. เข้าเว็บ [https://vercel.com](https://vercel.com) กด **Add New Project** แล้วเลือก GitHub Repo นี้
3. ในหัวข้อ **Environment Variables** บน Vercel ให้ใส่ตัวแปรทั้ง 8 ตัวตามไฟล์ `.env.example`:
   - `MONGODB_URI`
   - `NEXTAUTH_URL` (ใส่ URL จริงของ Vercel เช่น `https://stock-otr.vercel.app`)
   - `NEXTAUTH_SECRET` (ใส่รหัสสุ่มยาว ๆ อะไรก็ได้)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `OWNER_GOOGLE_EMAIL` (อีเมล Gmail ของเจ้าของร้าน)
   - `SMTP_USER` (อีเมล Gmail ที่ใช้ส่ง)
   - `SMTP_APP_PASSWORD` (รหัส 16 หลักจากขั้นตอนที่ 2)
   - `CRON_SECRET` (ตั้งรหัสลับสำหรับ Cron)
4. กด **Deploy** ระบบจะออนไลน์พร้อมใช้งานจริงทันที และไฟล์ `vercel.json` จะสั่งส่งอีเมลรายงานสต็อกทุก ๆ 3 วันเวลา 09:00 น. ให้โดยอัตโนมัติครับ
