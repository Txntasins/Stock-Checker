import { Schema, model, models } from 'mongoose';

const StockItemSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    category: { type: String, required: true, trim: true, maxlength: 40 },
    qty: { type: Number, required: true, min: 0, max: 9999, default: 0 },
    min: { type: Number, required: true, min: 1, max: 999, default: 3 },
    unit: { type: String, required: true, trim: true, maxlength: 20 },
    updatedBy: { type: String, default: 'พนักงานหน้าร้าน' }
  },
  { timestamps: true, collection: 'stock_items' }
);

export const StockItemModel = models.StockItem || model('StockItem', StockItemSchema);

const AdminRecipientSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, default: 'เจ้าของร้าน' },
    lastLoginAt: { type: Date, default: Date.now }
  },
  { timestamps: true, collection: 'admin_recipients' }
);

export const AdminRecipientModel = models.AdminRecipient || model('AdminRecipient', AdminRecipientSchema);
