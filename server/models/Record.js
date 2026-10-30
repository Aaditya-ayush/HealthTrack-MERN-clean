import mongoose from 'mongoose';

const recordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, required: true, enum: ['Blood test', 'Whole body checkup', 'Doctor visit', 'Other'] },
  recordDate: { type: Date, required: true },
  notes: { type: String, default: '', maxlength: 3000 },
  attachments: [{ name: String, mimeType: String, size: Number, path: String }]
}, { timestamps: true });

export default mongoose.model('Record', recordSchema);
