import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  dueDate: { type: Date, required: true },
  recurrence: { type: String, enum: ['once', '6months', 'yearly'], default: 'once' },
  completed: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Reminder', reminderSchema);
