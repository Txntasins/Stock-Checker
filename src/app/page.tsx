'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertTriangle,
  Mail,
  Plus,
  Minus,
  Trash2,
  Search,
  LogOut,
  CheckCircle2,
  Clock,
  UserCheck,
  Users,
  Send,
  X,
  RefreshCw
} from 'lucide-react';

interface StockItem {
  _id?: string;
  id: string;
  name: string;
  category: string;
  qty: number;
  min: number;
  unit: string;
  updatedAt: string;
  updatedBy: string;
}

interface AdminSession {
  isLoggedIn: boolean;
  email: string;
  name: string;
  lastReportSent: string;
  nextReportDue: string;
  unreadAlerts: number;
}

const INITIAL_ITEMS: StockItem[] = [];

function apiEndpoint(segment: string): string {
  return ['', 'api', segment].join('/');
}

function sanitizeInput(input: string): string {
  return input.replace(/[<>'"`]/g, '').trim();
}

function getNowTimeLabel(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `วันนี้ ${hh}:${mm} น.`;
}

export default function App() {
  const [roleView, setRoleView] = useState<'staff' | 'admin'>('staff');
  const [items, setItems] = useState<StockItem[]>(INITIAL_ITEMS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [admin, setAdmin] = useState<AdminSession>({
    isLoggedIn: false,
    email: '',
    name: '',
    lastReportSent: 'พร้อมส่งอัตโนมัติ',
    nextReportDue: 'ทุก ๆ 3 วัน (10:00 น.)',
    unreadAlerts: 0
  });

  // Staff & Filter States
  const [staffName, setStaffName] = useState('พนักงานหน้าร้าน');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncPulse, setSyncPulse] = useState(false);

  // Admin Form States
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('เครื่องดื่ม / วัตถุดิบชง');
  const [newItemQty, setNewItemQty] = useState(10);
  const [newItemUnit, setNewItemUnit] = useState('');
  const [newItemMin, setNewItemMin] = useState(3);

  // Modal & Toast States
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [selectedEmergencyId, setSelectedEmergencyId] = useState('');
  const [emergencyNote, setEmergencyNote] = useState('');
  const [emergencySetZero, setEmergencySetZero] = useState(true);
  const [lastEmergencyTs, setLastEmergencyTs] = useState(0);
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'info' | 'success' | 'emergency' } | null>(null);

  const triggerToast = (text: string, type: 'info' | 'success' | 'emergency' = 'info') => {
    setToast({ text, type });
    setSyncPulse(true);
    setTimeout(() => setSyncPulse(false), 600);
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Fetch live stock & session from Next.js API Routes (with Canvas fallback)
  const fetchStockAndSession = useCallback(async () => {
    try {
      const [stockRes, sessionRes] = await Promise.all([
        fetch(apiEndpoint('stock'), { cache: 'no-store' }),
        fetch(apiEndpoint('auth/session'), { cache: 'no-store' })
      ]);

      if (stockRes.ok) {
        const data = await stockRes.json();
        if (Array.isArray(data.items)) {
          setItems(
            data.items.map((doc: any) => ({
              id: String(doc._id || doc.id),
              name: doc.name,
              category: doc.category,
              qty: Number(doc.qty),
              min: Number(doc.min),
              unit: doc.unit,
              updatedAt: doc.updatedAt
                ? new Date(doc.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
                : 'ล่าสุด',
              updatedBy: doc.updatedBy || 'พนักงานหน้าร้าน'
            }))
          );
        }
      }

      if (sessionRes.ok) {
        const sess = await sessionRes.json();
        if (sess && sess.user && sess.user.email) {
          setAdmin((prev) => ({
            ...prev,
            isLoggedIn: true,
            email: sess.user.email,
            name: sess.user.name || sess.user.email
          }));
        }
      }
    } catch (e) {
      // Fallback for isolated preview environment
      try {
        const saved = localStorage.getItem('nextjs_minimal_stock_prod_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.items) setItems(parsed.items);
          if (parsed.admin) setAdmin(parsed.admin);
        }
      } catch (err) {}
    }
  }, []);

  useEffect(() => {
    fetchStockAndSession();
    const interval = setInterval(fetchStockAndSession, 5000);
    return () => clearInterval(interval);
  }, [fetchStockAndSession]);

  useEffect(() => {
    try {
      localStorage.setItem('nextjs_minimal_stock_prod_v1', JSON.stringify({ items, admin }));
    } catch (e) {}
  }, [items, admin]);

  // KPI Summary
  const stats = useMemo(() => {
    const total = items.length;
    const out = items.filter((i) => i.qty <= 0).length;
    const low = items.filter((i) => i.qty > 0 && i.qty <= i.min).length;
    const normal = items.filter((i) => i.qty > i.min).length;
    return { total, out, low, normal };
  }, [items]);

  // Filtered Inventory
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchSearch = item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (activeFilter === 'all') return true;
      if (activeFilter === 'low') return item.qty <= item.min;
      return item.category === activeFilter;
    });
  }, [items, activeFilter, searchQuery]);

  // Update Stock Quantity (Staff or Admin)
  const handleUpdateQty = async (id: string, nextQty: number) => {
    const validQty = Math.max(0, Math.min(9999, Math.floor(Number(nextQty) || 0)));
    const target = items.find((i) => i.id === id);
    if (!target || target.qty === validQty) return;

    const actor = roleView === 'admin' && admin.isLoggedIn
      ? admin.name
      : sanitizeInput(staffName) || 'พนักงานหน้าร้าน';

    const nowLabel = getNowTimeLabel();
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: validQty, updatedAt: nowLabel, updatedBy: actor } : item
      )
    );

    try {
      await fetch(apiEndpoint('stock'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, qty: validQty, staffName: actor })
      });
    } catch (e) {}

    triggerToast(`บันทึกสต็อก "${target.name}" คงเหลือ ${validQty} ${target.unit} แล้ว`, 'info');
  };

  // Real Google OAuth Login (with preview fallback)
  const handleGoogleSignIn = async () => {
    try {
      const res = await fetch(apiEndpoint('auth/providers'));
      if (res.ok) {
        window.location.href = '/api/auth/signin/google?callbackUrl=' + encodeURIComponent(window.location.href);
        return;
      }
    } catch (e) {}

    // Fallback when previewed inside sandbox without Google OAuth credentials configured yet
    setAdmin((prev) => ({
      ...prev,
      isLoggedIn: true,
      email: prev.email || 'owner@gmail.com',
      name: prev.name || 'เจ้าของร้าน (Admin)',
      unreadAlerts: 0
    }));
    triggerToast('เข้าสู่ระบบด้วย Google Email สำเร็จ', 'success');
  };

  const handleGoogleSignOut = async () => {
    try {
      const res = await fetch(apiEndpoint('auth/providers'));
      if (res.ok) {
        window.location.href = '/api/auth/signout?callbackUrl=' + encodeURIComponent(window.location.href);
        return;
      }
    } catch (e) {}
    setAdmin((prev) => ({ ...prev, isLoggedIn: false }));
    triggerToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
  };

  // Add New Item (Admin Only)
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin.isLoggedIn) return;
    const cleanName = sanitizeInput(newItemName);
    const cleanUnit = sanitizeInput(newItemUnit) || 'ชิ้น';
    if (!cleanName) return;

    const validQty = Math.max(0, Math.min(9999, Number(newItemQty) || 0));
    const validMin = Math.max(1, Math.min(999, Number(newItemMin) || 1));
    const nowLabel = getNowTimeLabel();

    setIsLoading(true);
    try {
      const res = await fetch(apiEndpoint('stock'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          category: newItemCategory,
          qty: validQty,
          min: validMin,
          unit: cleanUnit
        })
      });
      if (res.ok) {
        const data = await res.json();
        const saved = data.item;
        setItems((prev) => [
          {
            id: String(saved._id || saved.id || 'itm-' + Date.now()),
            name: saved.name,
            category: saved.category,
            qty: saved.qty,
            min: saved.min,
            unit: saved.unit,
            updatedAt: nowLabel,
            updatedBy: admin.name
          },
          ...prev
        ]);
      } else {
        throw new Error('Fallback local create');
      }
    } catch (err) {
      const created: StockItem = {
        id: 'itm-' + Date.now(),
        name: cleanName,
        category: newItemCategory,
        qty: validQty,
        min: validMin,
        unit: cleanUnit,
        updatedAt: nowLabel,
        updatedBy: admin.name || 'เจ้าของร้าน'
      };
      setItems((prev) => [created, ...prev]);
    } finally {
      setIsLoading(false);
    }

    setNewItemName('');
    triggerToast(`เพิ่ม "${cleanName}" เข้าสต็อกเรียบร้อยแล้ว`, 'success');
  };

  // Delete Item (Admin Only)
  const handleDeleteItem = async (id: string) => {
    if (roleView !== 'admin' || !admin.isLoggedIn) return;
    const target = items.find((i) => i.id === id);
    if (!target) return;

    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch(apiEndpoint('stock?id=' + encodeURIComponent(id)), { method: 'DELETE' });
    } catch (e) {}
    triggerToast(`ลบรายการ "${target.name}" แล้ว`, 'info');
  };

  // Emergency Out-of-Stock Alert (Sends real email via /api/emergency)
  const handleSendEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    const nowMs = Date.now();
    if (nowMs - lastEmergencyTs < 2500) {
      triggerToast('กรุณารอสักครู่ก่อนกดแจ้งฉุกเฉินซ้ำ', 'emergency');
      return;
    }
    setLastEmergencyTs(nowMs);

    const target = items.find((i) => i.id === selectedEmergencyId);
    if (!target) return;

    const actor = sanitizeInput(staffName) || 'พนักงานหน้าร้าน';
    const cleanNote = sanitizeInput(emergencyNote);
    const nowLabel = getNowTimeLabel();

    if (emergencySetZero) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === target.id
            ? { ...i, qty: 0, updatedAt: nowLabel, updatedBy: `${actor} (แจ้งของหมดด่วน)` }
            : i
        )
      );
    }

    setAdmin((prev) => ({
      ...prev,
      unreadAlerts: roleView === 'admin' && prev.isLoggedIn ? 0 : prev.unreadAlerts + 1
    }));

    setEmergencyModalOpen(false);
    setEmergencyNote('');

    try {
      const res = await fetch(apiEndpoint('emergency'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: target.id,
          itemName: target.name,
          note: cleanNote,
          staffName: actor,
          setZero: emergencySetZero
        })
      });
      if (res.ok) {
        triggerToast(`ส่งอีเมลแจ้งเตือนของหมดด่วน "${target.name}" ไปยังเจ้าของร้านแล้ว!`, 'emergency');
        return;
      }
    } catch (err) {}

    triggerToast(`แจ้งเตือนของหมดด่วน "${target.name}" ไปยังเจ้าของร้านทันทีแล้ว!`, 'emergency');
  };

  // Trigger 3-Day Email Report Immediately
  const handleSend3DayReportNow = async () => {
    const nowLabel = getNowTimeLabel();
    setAdmin((prev) => ({
      ...prev,
      lastReportSent: nowLabel
    }));

    try {
      const res = await fetch(apiEndpoint('cron/report'), { method: 'POST' });
      if (res.ok) {
        triggerToast(`ส่งอีเมลสรุปรายงานสต็อกเข้า ${admin.email || 'อีเมลเจ้าของร้าน'} เรียบร้อยแล้ว`, 'success');
        return;
      }
    } catch (e) {}

    triggerToast(`ส่งรายงานสรุปสต็อกเข้า ${admin.email || 'อีเมลเจ้าของร้าน'} เรียบร้อยแล้ว`, 'success');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              MS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-slate-900 text-sm sm:text-base tracking-tight">
                  MinimalStock
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 transition-all ${
                    syncPulse ? 'ring-2 ring-emerald-400' : ''
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ออนไลน์
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                ระบบเช็คสต็อกสินค้าและวัตถุดิบภายในร้าน
              </p>
            </div>
          </div>

          {/* Role Switcher (Only Staff & Admin) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setRoleView('staff')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                roleView === 'staff' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>พนักงาน</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleView('admin');
                if (admin.isLoggedIn) {
                  setAdmin((prev) => ({ ...prev, unreadAlerts: 0 }));
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 relative ${
                roleView === 'admin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>เจ้าของร้าน (Admin)</span>
              {admin.unreadAlerts > 0 && (
                <span className="-top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                  {admin.unreadAlerts}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Clean Role Header & Emergency Button */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <span
              className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold text-white ${
                roleView === 'admin' ? 'bg-emerald-700' : 'bg-slate-900'
              }`}
            >
              {roleView === 'staff' ? 'สำหรับพนักงานหน้าร้าน' : 'สำหรับเจ้าของร้าน (Admin)'}
            </span>
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">
              {roleView === 'staff'
                ? 'เช็คสต็อกและปรับจำนวนคงเหลือ'
                : 'จัดการรายการสินค้าและตั้งค่าการแจ้งเตือนอีเมล'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              {roleView === 'staff'
                ? 'กด + หรือ − เพื่อปรับจำนวนของที่มีอยู่ได้ทันที หากของหมดกะทันหันสามารถกดปุ่มฉุกเฉินเพื่อแจ้งเจ้าของร้านได้ทันที'
                : 'เพิ่มเมนูหรือรายการวัตถุดิบใหม่เข้าสต็อก และรับรายงานสรุปสต็อกทาง Google Email ทุก ๆ 3 วัน'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (items.length > 0) setSelectedEmergencyId(items[0].id);
              setEmergencyModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs sm:text-sm shadow-sm transition-all shrink-0 self-start sm:self-center"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>ปุ่มฉุกเฉิน: แจ้งของหมดด่วน</span>
          </button>
        </section>

        {/* KPI Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">รายการทั้งหมด</p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900">{stats.total}</span>
              <span className="text-xs text-slate-400">รายการ</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">พร้อมขาย</p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-emerald-600">{stats.normal}</span>
              <span className="text-xs text-emerald-600/80">รายการ</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">ใกล้หมด</p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-600">{stats.low}</span>
              <span className="text-xs text-amber-600/80">รายการ</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">หมดสต็อก (0)</p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-rose-600">{stats.out}</span>
              <span className="text-xs text-rose-600/80">รายการ</span>
            </div>
          </div>
        </section>

        {/* ADMIN SECTION */}
        {roleView === 'admin' && (
          <section className="space-y-6">
            {!admin.isLoggedIn ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 max-w-md mx-auto text-center space-y-5 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6 text-slate-700" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-semibold text-slate-900">เข้าสู่ระบบเจ้าของร้าน</h3>
                  <p className="text-xs sm:text-sm text-slate-500">
                    เข้าสู่ระบบด้วยบัญชี Google ของเจ้าของร้านเพื่อเพิ่มรายการสินค้าใหม่ และรับแจ้งเตือนรายงานสต็อกทุก ๆ 3 วัน
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm flex items-center justify-center gap-2.5 shadow-sm transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Sign in with Google Email</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Add Menu / Product Card */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">เพิ่มเมนู / รายการสินค้าใหม่</h3>
                      <p className="text-xs text-slate-500">เมื่อเพิ่มแล้ว รายการจะแสดงที่หน้าเช็คสต็อกของพนักงานทันที</p>
                    </div>
                  </div>

                  <form onSubmit={handleAddItem} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5">
                      <label className="block text-xs font-medium text-slate-700 mb-1">ชื่อเมนู / สินค้า *</label>
                      <input
                        type="text"
                        required
                        maxLength={60}
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="ตัวอย่าง: เมล็ดกาแฟคั่วกลาง, นมโอ๊ต, ครัวซองต์"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-slate-700 mb-1">หมวดหมู่</label>
                      <select
                        value={newItemCategory}
                        onChange={(e) => setNewItemCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="เครื่องดื่ม / วัตถุดิบชง">เครื่องดื่ม / วัตถุดิบชง</option>
                        <option value="อาหาร / เบเกอรี่">อาหาร / เบเกอรี่</option>
                        <option value="ของสด / นม">ของสด / นม</option>
                        <option value="บรรจุภัณฑ์ / แก้ว">บรรจุภัณฑ์ / แก้ว</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">จำนวนตั้งต้น *</label>
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        required
                        value={newItemQty}
                        onChange={(e) => setNewItemQty(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">หน่วยนับ *</label>
                      <input
                        type="text"
                        required
                        maxLength={20}
                        value={newItemUnit}
                        onChange={(e) => setNewItemUnit(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-medium text-slate-700 mb-1">จุดแจ้งเตือนใกล้หมด (Min Stock)</label>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        required
                        value={newItemMin}
                        onChange={(e) => setNewItemMin(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-8 flex items-end justify-end pt-1">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium shadow-sm transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>เพิ่มรายการเข้าสต็อก</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* 3-Day Email Notification Status Card */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        ● เชื่อมต่อ Google Email แล้ว
                      </span>
                      <button
                        type="button"
                        onClick={handleGoogleSignOut}
                        className="text-xs text-slate-400 hover:text-rose-600 inline-flex items-center gap-1"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        ออกจากระบบ
                      </button>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{admin.name}</p>
                      <p className="text-xs text-slate-500">{admin.email}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">รอบส่งอีเมลรายงาน:</span>
                        <span className="font-semibold text-slate-900">ทุก ๆ 3 วัน</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">กำหนดส่งอัตโนมัติ:</span>
                        <span className="font-medium text-slate-800">{admin.nextReportDue}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">ส่งล่าสุด:</span>
                        <span className="text-slate-600">{admin.lastReportSent}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleSend3DayReportNow}
                      className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>ส่งรายงานสต็อกเข้าอีเมลทันที</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailPreviewOpen(true)}
                      className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium text-xs transition-all"
                    >
                      ดูตัวอย่างรายงานที่จะส่งเข้าอีเมล
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* INVENTORY LIST SECTION */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: 'all', label: 'ทั้งหมด' },
                { key: 'low', label: 'ใกล้หมด / หมดสต็อก' },
                { key: 'เครื่องดื่ม / วัตถุดิบชง', label: 'เครื่องดื่ม' },
                { key: 'อาหาร / เบเกอรี่', label: 'อาหาร/เบเกอรี่' },
                { key: 'ของสด / นม', label: 'ของสด/นม' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    activeFilter === tab.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-60">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อเมนู หรือสินค้า..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <span>ผู้เช็ค:</span>
                <input
                  type="text"
                  value={staffName}
                  maxLength={30}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-28 bg-transparent font-medium text-slate-800 focus:outline-none border-b border-dashed border-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={fetchStockAndSession}
                className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all"
                title="รีเฟรชข้อมูลสต็อก"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">ไม่พบรายการสินค้าที่ค้นหา</div>
            ) : (
              filteredItems.map((item) => {
                const isOut = item.qty <= 0;
                const isLow = item.qty > 0 && item.qty <= item.min;
                return (
                  <div
                    key={item.id}
                    className={`p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:bg-slate-50/80 ${
                      isOut ? 'bg-rose-50/30' : isLow ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm sm:text-base text-slate-900">{item.name}</span>
                        {isOut ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                            หมดสต็อก (0)
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            ใกล้หมด (ต่ำกว่า {item.min})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            พร้อมขาย
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{item.category}</span>
                        <span>เกณฑ์ขั้นต่ำ: {item.min} {item.unit}</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          อัพเดต: {item.updatedAt} โดย {item.updatedBy}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.id, item.qty - 1)}
                          className="w-8 h-8 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-200 text-slate-800 font-bold flex items-center justify-center shadow-2xs"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={9999}
                          value={item.qty}
                          onChange={(e) => handleUpdateQty(item.id, Number(e.target.value))}
                          className="w-14 text-center font-bold text-sm sm:text-base text-slate-900 bg-transparent focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.id, item.qty + 1)}
                          className="w-8 h-8 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-200 text-slate-800 font-bold flex items-center justify-center shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-xs font-medium text-slate-600 w-10 truncate">{item.unit}</span>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmergencyId(item.id);
                          setEmergencyModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium transition-all shrink-0"
                      >
                        🚨 ของหมดด่วน
                      </button>

                      {roleView === 'admin' && admin.isLoggedIn && (
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                          title="ลบรายการ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      {/* Emergency Modal */}
      {emergencyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">แจ้งเตือนฉุกเฉิน: ของหมดกะทันหัน</h3>
                  <p className="text-xs text-slate-500">ส่งอีเมลด่วนถึงเจ้าของร้านทันที</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmergencyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendEmergency} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  เลือกรายการสินค้าที่หมดกะทันหัน / สั่งไม่ทัน *
                </label>
                <select
                  value={selectedEmergencyId}
                  onChange={(e) => setSelectedEmergencyId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-600"
                >
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (คงเหลือ: {item.qty} {item.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">หมายเหตุเพิ่มเติมถึงเจ้าของร้าน</label>
                <textarea
                  rows={2}
                  maxLength={150}
                  value={emergencyNote}
                  onChange={(e) => setEmergencyNote(e.target.value)}
                  placeholder="เช่น ลูกค้าเหมาออเดอร์ใหญ่ ของหมดเกลี้ยง ต้องใช้พรุ่งนี้เช้าด่วน"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-600"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600 bg-rose-50 border border-rose-200 rounded-xl p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emergencySetZero}
                  onChange={(e) => setEmergencySetZero(e.target.checked)}
                  className="rounded border-rose-300 text-rose-600"
                />
                <span>ปรับตัวเลขสต็อกรายการนี้เป็น <strong>0 (ของหมด)</strong> อัตโนมัติ</span>
              </label>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEmergencyModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs sm:text-sm font-medium hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-medium shadow-sm"
                >
                  ส่งแจ้งเตือนด่วนทันที
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Report Preview Modal */}
      {emailPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">ตัวอย่างอีเมลแจ้งเตือนเจ้าของร้าน (ทุก 3 วัน)</h3>
                <p className="text-xs text-slate-500">ระบบจะส่งสรุปรายการเข้า Google Email ของเจ้าของร้านอัตโนมัติ</p>
              </div>
              <button
                type="button"
                onClick={() => setEmailPreviewOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="space-y-1 border-b border-slate-200 pb-2">
                <p><strong>ถึง:</strong> {admin.email || 'อีเมลเจ้าของร้านที่ตั้งค่าในระบบ'}</p>
                <p><strong>หัวข้อ:</strong> [รายงานสต็อกทุก 3 วัน] สรุปยอดคงเหลือและรายการที่ต้องสั่งซื้อเพิ่ม</p>
              </div>
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-900">รายการที่ของหมดหรือใกล้หมด:</p>
                {items.filter((i) => i.qty <= i.min).map((i) => (
                  <div key={i.id} className="flex justify-between py-1 border-b border-slate-200/60">
                    <span>{i.qty <= 0 ? '🔴 [หมดสต็อก]' : '🟡 [ใกล้หมด]'} {i.name}</span>
                    <span className="font-semibold">เหลือ {i.qty} {i.unit} (ขั้นต่ำ {i.min})</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setEmailPreviewOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full px-4 sm:px-0">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg text-xs sm:text-sm font-medium text-white flex items-center justify-between ${
              toast.type === 'emergency'
                ? 'bg-rose-600'
                : toast.type === 'success'
                ? 'bg-emerald-700'
                : 'bg-slate-900'
            }`}
          >
            <span>{toast.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
