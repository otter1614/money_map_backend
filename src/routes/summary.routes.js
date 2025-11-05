const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Try to use DB if available, otherwise fall back to JSON files
let db = null;
try {
  db = require('../db');
} catch (e) {
  db = null;
}

const incomeJsonPath = path.join(__dirname, '../data/income.json');
const expenseJsonPath = path.join(__dirname, '../data/expenses.json');

async function readJsonIfExists(p) {
  try {
    const txt = await fs.readFile(p, 'utf8');
    return JSON.parse(txt || '[]');
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * @openapi
 * /api/summary:
 *   get:
 *     summary: 현재 잔액 요약을 반환합니다.
 *     responses:
 *       200:
 *         description: 잔액 및 상태 반환
 */
router.get('/', async (req, res) => {
  try {
    let incomeTotal = 0;
    let expenseTotal = 0;

    if (db) {
      // better-sqlite3 returns { sum: value } or { SUM(amount): value } depending on SQL
      const incRow = db.prepare('SELECT SUM(amount) as sum FROM incomes').get();
      const expRow = db.prepare('SELECT SUM(amount) as sum FROM expenses').get();
      incomeTotal = Number(incRow && incRow.sum ? incRow.sum : 0);
      expenseTotal = Number(expRow && expRow.sum ? expRow.sum : 0);
    } else {
      const incomes = await readJsonIfExists(incomeJsonPath);
      const expenses = await readJsonIfExists(expenseJsonPath);
      incomeTotal = incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);
      expenseTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    }

    const balance = Number((incomeTotal - expenseTotal).toFixed(2));

    const result = {
      incomeTotal,
      expenseTotal,
      balance,
      isNegative: balance < 0,
      isPositive: balance > 0,
      // color hint for front-end
      color: balance < 0 ? 'red' : (balance > 0 ? 'green' : 'neutral'),
      // message / event hints
      message: balance < 0 ? '잔액이 마이너스입니다. 지출을 줄이세요.' : (balance > 0 ? '좋아요! 잔액이 플러스입니다.' : '잔액이 0입니다.'),
      // small suggestion flags
      alert: balance < 0,
      celebrate: balance > 0
    };

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: '요약 계산 중 오류가 발생했습니다.', error: error.message });
  }
});

module.exports = router;
