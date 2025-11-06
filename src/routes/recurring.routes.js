const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

let db = null;
try {
  db = require('../db');
} catch (e) {
  db = null;
}

// Create recurring income rule
router.post('/', (req, res) => {
  try {
    const { amount, category, description, startDate, frequency, interval, occurrences, endDate } = req.body;
    if (!amount || !category || !startDate || !frequency) return res.status(400).json({ message: 'amount, category, startDate, frequency required' });

    if (!db) return res.status(500).json({ message: 'DB not available' });

    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const stmt = db.prepare(`INSERT INTO recurring_incomes (id, amount, category, description, startDate, frequency, interval, occurrences, endDate, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    stmt.run(id, Number(amount), category, description || '', startDate, frequency, interval || 1, occurrences || null, endDate || null, createdAt);

    res.status(201).json({ id, amount, category, description, startDate, frequency, interval: interval || 1, occurrences: occurrences || null, endDate: endDate || null, createdAt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// List recurring rules
router.get('/', (req, res) => {
  try {
    if (!db) return res.json([]);
    const rows = db.prepare('SELECT * FROM recurring_incomes ORDER BY createdAt DESC').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Generate occurrences between start and end and optionally insert into incomes
const { addDays, addWeeks, addMonths, addYears, isAfter, parseISO } = require('date-fns');

function addInterval(date, frequency, interval) {
  switch (frequency) {
    case 'daily': return addDays(date, interval);
    case 'weekly': return addWeeks(date, interval);
    case 'monthly': return addMonths(date, interval);
    case 'yearly': return addYears(date, interval);
    default: return addMonths(date, interval);
  }
}

// Generate occurrences for a rule and optionally persist
router.post('/:id/generate', (req, res) => {
  try {
    if (!db) return res.status(500).json({ message: 'DB not available' });
    const { id } = req.params;
    const { from, to, persist } = req.body; // ISO dates
    const rule = db.prepare('SELECT * FROM recurring_incomes WHERE id = ?').get(id);
    if (!rule) return res.status(404).json({ message: 'Rule not found' });

    const start = parseISO(from || rule.startDate);
    const end = parseISO(to || rule.endDate || new Date().toISOString());

    const occurrences = [];
    let cursor = parseISO(rule.startDate);
    let count = 0;
    while (!isAfter(cursor, end)) {
      if (!isAfter(cursor, start)) {
        // before start -> skip
      } else {
        occurrences.push({ date: cursor.toISOString().slice(0,10), amount: rule.amount, category: rule.category, description: rule.description });
      }
      count++;
      if (rule.occurrences && count > rule.occurrences) break;
      cursor = addInterval(cursor, rule.frequency, rule.interval || 1);
    }

    if (persist && occurrences.length) {
      const insert = db.prepare('INSERT INTO incomes (id, amount, category, description, date, createdAt) VALUES (?,?,?,?,?,?)');
      const now = new Date().toISOString();
      const insertMany = db.transaction((rows) => {
        for (const r of rows) {
          insert.run(uuidv4(), Number(r.amount), r.category, r.description || '', r.date, now);
        }
      });
      insertMany(occurrences);
    }

    res.json({ occurrences, persisted: !!persist });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
