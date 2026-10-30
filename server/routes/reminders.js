import { Router } from 'express';
import Reminder from '../models/Reminder.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try { res.json(await Reminder.find({ userId: req.userId }).sort({ dueDate: 1 })); }
  catch (error) { next(error); }
});
router.post('/', async (req, res, next) => {
  try {
    const { title, dueDate, recurrence = 'once' } = req.body;
    if (!title?.trim() || !dueDate || !['once','6months','yearly'].includes(recurrence)) {
      return res.status(400).json({ message: 'Enter a reminder title, due date, and valid recurrence.' });
    }
    res.status(201).json(await Reminder.create({ userId: req.userId, title: title.trim(), dueDate, recurrence }));
  } catch (error) { next(error); }
});
router.patch('/:id/complete', async (req, res, next) => {
  try {
    const reminder = await Reminder.findOne({ _id: req.params.id, userId: req.userId });
    if (!reminder) return res.status(404).json({ message: 'Reminder not found.' });
    reminder.completed = true;
    await reminder.save();
    if (reminder.recurrence !== 'once') {
      const nextDate = new Date(reminder.dueDate);
      if (reminder.recurrence === '6months') nextDate.setMonth(nextDate.getMonth() + 6);
      else nextDate.setFullYear(nextDate.getFullYear() + 1);
      await Reminder.create({ userId: req.userId, title: reminder.title, dueDate: nextDate, recurrence: reminder.recurrence });
    }
    res.json({ message: 'Reminder completed.', reminder });
  } catch (error) { next(error); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await Reminder.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!result) return res.status(404).json({ message: 'Reminder not found.' });
    res.json({ message: 'Reminder deleted.' });
  } catch (error) { next(error); }
});
export default router;
