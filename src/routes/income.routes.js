const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// 데이터 파일 경로
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

        const newIncome = {
            id: Date.now().toString(), // 간단한 유니크 ID 생성
            amount: Number(amount),
            category,
            description: description || '',
            date,
            createdAt: new Date().toISOString()
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