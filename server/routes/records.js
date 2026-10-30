import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import Record from '../models/Record.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const uploadDir = path.resolve('server/uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const allowed = new Set(['image/png', 'image/jpeg', 'application/pdf']);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => cb(null, allowed.has(file.mimetype))
});

router.use(requireAuth);
router.get('/', async (req, res, next) => {
  try { res.json(await Record.find({ userId: req.userId }).sort({ recordDate: -1 })); }
  catch (error) { next(error); }
});
router.post('/', upload.array('attachments', 5), async (req, res, next) => {
  try {
    const { title, category, recordDate, notes } = req.body;
    if (!title?.trim() || !recordDate || !['Blood test','Whole body checkup','Doctor visit','Other'].includes(category)) {
      return res.status(400).json({ message: 'Provide a title, category, and record date.' });
    }
    const attachments = (req.files || []).map(file => ({
      name: file.originalname, mimeType: file.mimetype, size: file.size, path: `/uploads/${file.filename}`
    }));
    const record = await Record.create({ userId: req.userId, title: title.trim(), category, recordDate, notes: notes || '', attachments });
    res.status(201).json(record);
  } catch (error) { next(error); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    const record = await Record.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!record) return res.status(404).json({ message: 'Record not found.' });
    for (const file of record.attachments || []) {
      const filename = path.basename(file.path);
      fs.rm(path.join(uploadDir, filename), { force: true }, () => {});
    }
    res.json({ message: 'Record deleted.' });
  } catch (error) { next(error); }
});
export default router;
