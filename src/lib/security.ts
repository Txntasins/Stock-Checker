import { z } from 'zod';

export function sanitizeString(str: string): string {
  return str.replace(/[<>'"`]/g, '').trim();
}

export const StaffUpdateStockSchema = z.object({
  id: z.string().min(1),
  qty: z.number().int().min(0).max(9999),
  staffName: z.string().max(40).optional().default('พนักงานหน้าร้าน')
});

export const AdminCreateItemSchema = z.object({
  name: z.string().min(1).max(60).transform(sanitizeString),
  category: z.string().min(1).max(40).transform(sanitizeString),
  qty: z.number().int().min(0).max(9999),
  min: z.number().int().min(1).max(999),
  unit: z.string().min(1).max(20).transform(sanitizeString)
});

const emergencyRateLimitMap = new Map<string, number>();

export function checkEmergencyRateLimit(ip: string, cooldownMs = 5000): boolean {
  const now = Date.now();
  const lastCall = emergencyRateLimitMap.get(ip) || 0;
  if (now - lastCall < cooldownMs) return false;
  emergencyRateLimitMap.set(ip, now);
  return true;
}
