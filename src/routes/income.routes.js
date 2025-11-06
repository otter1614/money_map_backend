const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let db = null;
try {
    db = require('../db');
} catch (e) {
    db = null;
}

// 데이터 파일 경로 (fallback)
const dataPath = path.join(__dirname, '../data/income.json');

/**
 * @openapi
 * /api/income:
 *   get:
 *     summary: 모든 수입 데이터 조회
 *     responses:
 *       200:
 *         description: 수입 목록을 반환합니다.
 */
// 모든 수입 데이터 조회
router.get('/', async (req, res) => {
    try {
        const { startDate, endDate, category } = req.query;
        if (db) {
            let sql = 'SELECT * FROM incomes';
            const where = [];
            const params = [];
            if (startDate) { where.push('date >= ?'); params.push(startDate); }
            if (endDate) { where.push('date <= ?'); params.push(endDate); }
            if (category) { where.push('category = ?'); params.push(category); }
            if (where.length) sql += ' WHERE ' + where.join(' AND ');
            sql += ' ORDER BY date DESC';
            const rows = db.prepare(sql).all(...params);
            return res.json(rows);
        }

        const data = await readIncomeData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: '데이터를 불러오는데 실패했습니다.', error: error.message });
    }
});

/**
 * @openapi
 * /api/income:
 *   post:
 *     summary: 새로운 수입 데이터 추가
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *     responses:
 *       201:
 *         description: 생성된 수입 객체 반환
 */
// 새로운 수입 데이터 추가
router.post('/', async (req, res) => {
    try {
        const { amount, category, description, date } = req.body;
        
        // 입력 데이터 검증
        if (!amount || !category || !date) {
            return res.status(400).json({ message: '금액, 카테고리, 날짜는 필수 입력값입니다.' });
        }

        const id = uuidv4();
        const createdAt = new Date().toISOString();

        if (db) {
            const stmt = db.prepare('INSERT INTO incomes (id, amount, category, description, date, createdAt) VALUES (?,?,?,?,?,?)');
            stmt.run(id, Number(amount), category, description || '', date, createdAt);
            return res.status(201).json({ id, amount: Number(amount), category, description: description || '', date, createdAt });
        }

        const newIncome = {
            id: Date.now().toString(), // 간단한 유니크 ID 생성
            amount: Number(amount),
            category,
            description: description || '',
            date,
            createdAt
        };

        const data = await readIncomeData();
        data.push(newIncome);
        await saveIncomeData(data);

        res.status(201).json(newIncome);
    } catch (error) {
        res.status(500).json({ message: '데이터 저장에 실패했습니다.', error: error.message });
    }
});

/**
 * @openapi
 * /api/income/{id}:
 *   get:
 *     summary: 특정 수입 데이터 조회
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 수입 객체 반환
 *       404:
 *         description: 찾을 수 없음
 */
// 특정 수입 데이터 조회
router.get('/:id', async (req, res) => {
    try {
        if (db) {
            const row = db.prepare('SELECT * FROM incomes WHERE id = ?').get(req.params.id);
            if (!row) return res.status(404).json({ message: '해당 수입 데이터를 찾을 수 없습니다.' });
            return res.json(row);
        }

        const data = await readIncomeData();
        const income = data.find(item => item.id === req.params.id);
        
        if (!income) {
            return res.status(404).json({ message: '해당 수입 데이터를 찾을 수 없습니다.' });
        }

        res.json(income);
    } catch (error) {
        res.status(500).json({ message: '데이터를 불러오는데 실패했습니다.', error: error.message });
    }
});

// 수정
router.put('/:id', async (req, res) => {
    try {
        const { amount, category, description, date } = req.body;
        if (db) {
            const existing = db.prepare('SELECT * FROM incomes WHERE id = ?').get(req.params.id);
            if (!existing) return res.status(404).json({ message: '해당 수입 데이터를 찾을 수 없습니다.' });
            const updatedAt = new Date().toISOString();
            db.prepare(`UPDATE incomes SET amount = ?, category = ?, description = ?, date = ?, createdAt = ? WHERE id = ?`).run(
                Number(amount) || existing.amount,
                category || existing.category,
                description || existing.description,
                date || existing.date,
                updatedAt,
                req.params.id
            );
            const row = db.prepare('SELECT * FROM incomes WHERE id = ?').get(req.params.id);
            return res.json(row);
        }

        const data = await readIncomeData();
        const idx = data.findIndex(i => i.id === req.params.id);
        if (idx === -1) return res.status(404).json({ message: '해당 수입 데이터를 찾을 수 없습니다.' });
        data[idx] = { ...data[idx], amount: Number(amount) || data[idx].amount, category: category || data[idx].category, description: description || data[idx].description, date: date || data[idx].date, updatedAt: new Date().toISOString() };
        await saveIncomeData(data);
        res.json(data[idx]);
    } catch (error) {
        res.status(500).json({ message: '데이터 수정에 실패했습니다.', error: error.message });
    }
});

// 삭제
router.delete('/:id', async (req, res) => {
    try {
        if (db) {
            const info = db.prepare('DELETE FROM incomes WHERE id = ?').run(req.params.id);
            if (info.changes === 0) return res.status(404).json({ message: '해당 수입 데이터를 찾을 수 없습니다.' });
            return res.json({ message: '삭제되었습니다.' });
        }

        const data = await readIncomeData();
        const filtered = data.filter(i => i.id !== req.params.id);
        if (filtered.length === data.length) return res.status(404).json({ message: '해당 수입 데이터를 찾을 수 없습니다.' });
        await saveIncomeData(filtered);
        res.json({ message: '삭제되었습니다.' });
    } catch (error) {
        res.status(500).json({ message: '데이터 삭제에 실패했습니다.', error: error.message });
    }
});

// CSV import (simple)
router.post('/import-csv', async (req, res) => {
    try {
        const { csv, persist } = req.body; // csv string
        if (!csv) return res.status(400).json({ message: 'CSV 내용 필요' });
        const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const header = lines.shift().split(',').map(h => h.trim().toLowerCase());
        const rows = lines.map(line => {
            const cols = line.split(',');
            const obj = {};
            header.forEach((h, i) => obj[h] = cols[i]);
            return obj;
        });

        const items = rows.map(r => ({ amount: Number(r.amount || r.value || 0), category: r.category || r.source || '기타', description: r.description || r.memo || '', date: (r.date || new Date().toISOString()).slice(0,10) }));

        if (db && persist) {
            const insert = db.prepare('INSERT INTO incomes (id, amount, category, description, date, createdAt) VALUES (?,?,?,?,?,?)');
            const now = new Date().toISOString();
            const insertMany = db.transaction((arr) => {
                for (const it of arr) insert.run(uuidv4(), Number(it.amount), it.category, it.description, it.date, now);
            });
            insertMany(items);
        }

        res.json({ imported: items.length, items });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// CSV export
router.get('/export-csv', async (req, res) => {
    try {
        let rows = [];
        if (db) rows = db.prepare('SELECT * FROM incomes ORDER BY date DESC').all();
        else rows = await readIncomeData();
        const header = ['id','amount','category','description','date','createdAt'];
        const csv = [header.join(',')].concat(rows.map(r => header.map(h => JSON.stringify(r[h] || '')).join(','))).join('\n');
        res.setHeader('Content-Type','text/csv');
        res.send(csv);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 데이터 파일 읽기 함수
async function readIncomeData() {
    try {
        const data = await fs.readFile(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // 파일이 없는 경우 빈 배열로 시작
            await saveIncomeData([]);
            return [];
        }
        throw error;
    }
}

// 데이터 파일 저장 함수
async function saveIncomeData(data) {
    // data 디렉토리가 없으면 생성
    const dir = path.dirname(dataPath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
}

module.exports = router;