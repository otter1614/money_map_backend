const express = require('express');
const router = express.Router();

let db = null;
try { db = require('../db'); } catch (e) { db = null; }

// helper: format YYYY-MM
function monthKey(dateStr) {
  return dateStr.slice(0,7);
}

/**
 * @openapi
 * /api/stats/monthly:
 *   get:
 *     summary: 월별 수입 통계 조회
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 시작 날짜 (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 종료 날짜 (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: 월별 수입 총액 반환
 */
router.get('/monthly', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (db) {
      let sql = `SELECT substr(date,1,7) as month, SUM(amount) as total FROM incomes`;
      const where = [];
      const params = [];
      if (startDate) { where.push('date >= ?'); params.push(startDate); }
      if (endDate) { where.push('date <= ?'); params.push(endDate); }
      if (where.length) sql += ' WHERE ' + where.join(' AND ');
      sql += ' GROUP BY month ORDER BY month';
      const rows = db.prepare(sql).all(...params);
      return res.json(rows);
    }
    return res.status(500).json({ message: 'DB not available for aggregated stats' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @openapi
 * /api/stats/category:
 *   get:
 *     summary: 카테고리별 수입 통계 조회
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 시작 날짜 (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 종료 날짜 (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: 카테고리별 수입 총액 반환
 */
router.get('/category', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (db) {
      let sql = `SELECT category, SUM(amount) as total FROM incomes`;
      const where = [];
      const params = [];
      if (startDate) { where.push('date >= ?'); params.push(startDate); }
      if (endDate) { where.push('date <= ?'); params.push(endDate); }
      if (where.length) sql += ' WHERE ' + where.join(' AND ');
      sql += ' GROUP BY category ORDER BY total DESC';
      const rows = db.prepare(sql).all(...params);
      return res.json(rows);
    }
    return res.status(500).json({ message: 'DB not available for aggregated stats' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @openapi
 * /api/stats/weekday:
 *   get:
 *     summary: 요일별 수입 통계 조회
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 시작 날짜 (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 종료 날짜 (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: 요일별 수입 총액 반환 (0=일요일..6=토요일)
 */
router.get('/weekday', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (db) {
      let sql = `SELECT strftime('%w', date) as weekday, SUM(amount) as total FROM incomes`;
      const where = [];
      const params = [];
      if (startDate) { where.push('date >= ?'); params.push(startDate); }
      if (endDate) { where.push('date <= ?'); params.push(endDate); }
      if (where.length) sql += ' WHERE ' + where.join(' AND ');
      sql += ' GROUP BY weekday ORDER BY weekday';
      const rows = db.prepare(sql).all(...params);
      return res.json(rows.map(r => ({ weekday: Number(r.weekday), total: r.total })));
    }
    return res.status(500).json({ message: 'DB not available for aggregated stats' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @openapi
 * /api/stats/summary:
 *   get:
 *     summary: 수입 요약 통계 조회
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 시작 날짜 (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: 종료 날짜 (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: 총액, 일평균, 이전 기간 대비 증감률 반환
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                   description: 기간 내 총 수입
 *                 avg:
 *                   type: number
 *                   description: 일 평균 수입
 *                 prevTotal:
 *                   type: number
 *                   description: 이전 기간 총 수입
 *                 change:
 *                   type: number
 *                   description: 이전 기간 대비 증감률 (%)
 */
router.get('/summary', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!db) return res.status(500).json({ message: 'DB not available' });

    const totalRow = db.prepare('SELECT SUM(amount) as total FROM incomes WHERE date >= ? AND date <= ?').get(startDate, endDate);
    const total = Number(totalRow.total || 0);

    // 평균 (일 단위)
    const days = (new Date(endDate) - new Date(startDate)) / (1000*60*60*24) || 1;
    const avg = total / Math.max(1, days);

    // 전 기간 (같은 길이) 대비 증감률: compute previous period
    const prevEnd = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days + 1);
    const prevStartStr = prevStart.toISOString().slice(0,10);
    const prevEndStr = prevEnd.toISOString().slice(0,10);

    const prevRow = db.prepare('SELECT SUM(amount) as total FROM incomes WHERE date >= ? AND date <= ?').get(prevStartStr, prevEndStr);
    const prevTotal = Number(prevRow.total || 0);
    const change = prevTotal === 0 ? null : ((total - prevTotal) / Math.abs(prevTotal)) * 100;

    res.json({ total, avg, prevTotal, change });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
