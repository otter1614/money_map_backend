const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// 데이터 파일 경로
const dataPath = path.join(__dirname, '../data/expenses.json');

/**
 * @openapi
 * /api/expense:
 *   get:
 *     summary: 모든 지출 데이터 조회
 *     responses:
 *       200:
 *         description: 지출 목록을 반환합니다.
 */
// 모든 지출 데이터 조회
router.get('/', async (req, res) => {
    try {
        const data = await readExpenseData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: '데이터를 불러오는데 실패했습니다.', error: error.message });
    }
});

/**
 * @openapi
 * /api/expense:
 *   post:
 *     summary: 새로운 지출 데이터 추가
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
 *               paymentMethod:
 *                 type: string
 *               location:
 *                 type: string
 *               isFixed:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: 생성된 지출 객체 반환
 */
// 새로운 지출 데이터 추가
router.post('/', async (req, res) => {
    try {
        const { amount, category, description, date, paymentMethod, location, isFixed } = req.body;
        
        // 입력 데이터 검증
        if (!amount || !category || !date) {
            return res.status(400).json({ message: '금액, 카테고리, 날짜는 필수 입력값입니다.' });
        }

        // isFixed는 명시적으로 제공되지 않으면 false로 처리
        const parsedIsFixed = parseBoolean(isFixed);

        const newExpense = {
            id: Date.now().toString(), // 간단한 유니크 ID 생성
            amount: Number(amount),
            category,
            description: description || '',
            date,
            paymentMethod: paymentMethod || '현금', // 결제 수단 (현금, 카드 등)
            location: location || '', // 지출 장소
            isFixed: parsedIsFixed,
            createdAt: new Date().toISOString()
        };

        const data = await readExpenseData();
        data.push(newExpense);
        await saveExpenseData(data);

        res.status(201).json(newExpense);
    } catch (error) {
        res.status(500).json({ message: '데이터 저장에 실패했습니다.', error: error.message });
    }
});

/**
 * @openapi
 * /api/expense/{id}:
 *   get:
 *     summary: 특정 지출 데이터 조회
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 지출 객체 반환
 *       404:
 *         description: 찾을 수 없음
 */
// 특정 지출 데이터 조회
router.get('/:id', async (req, res) => {
    try {
        const data = await readExpenseData();
        const expense = data.find(item => item.id === req.params.id);
        
        if (!expense) {
            return res.status(404).json({ message: '해당 지출 데이터를 찾을 수 없습니다.' });
        }

        res.json(expense);
    } catch (error) {
        res.status(500).json({ message: '데이터를 불러오는데 실패했습니다.', error: error.message });
    }
});

// 지출 데이터 수정
/**
 * @openapi
 * /api/expense/{id}:
 *   put:
 *     summary: 지출 데이터 수정
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
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
 *               paymentMethod:
 *                 type: string
 *               location:
 *                 type: string
 *               isFixed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 수정된 지출 객체 반환
 */
router.put('/:id', async (req, res) => {
    try {
        const { amount, category, description, date, paymentMethod, location, isFixed } = req.body;
        const data = await readExpenseData();
        const index = data.findIndex(item => item.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({ message: '해당 지출 데이터를 찾을 수 없습니다.' });
        }

        // 기존값을 보존하되, 클라이언트가 명시적으로 보낸 값이 있으면 갱신
        const existing = data[index];
        const updated = {
            ...existing,
            amount: (amount !== undefined && amount !== null) ? Number(amount) : existing.amount,
            category: category || existing.category,
            description: description || existing.description,
            date: date || existing.date,
            paymentMethod: paymentMethod || existing.paymentMethod,
            location: location || existing.location,
            updatedAt: new Date().toISOString()
        };

        // isFixed는 클라이언트가 보낸 경우에만 변경, 아니면 기존값 유지
        if (req.body.hasOwnProperty('isFixed')) {
            updated.isFixed = parseBoolean(isFixed);
        }

        data[index] = updated;

        await saveExpenseData(data);
        res.json(data[index]);
    } catch (error) {
        res.status(500).json({ message: '데이터 수정에 실패했습니다.', error: error.message });
    }
});

/**
 * @openapi
 * /api/expense/{id}:
 *   delete:
 *     summary: 지출 데이터 삭제
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 삭제 성공 메시지
 */
// 지출 데이터 삭제
router.delete('/:id', async (req, res) => {
    try {
        const data = await readExpenseData();
        const filteredData = data.filter(item => item.id !== req.params.id);

        if (data.length === filteredData.length) {
            return res.status(404).json({ message: '해당 지출 데이터를 찾을 수 없습니다.' });
        }

        await saveExpenseData(filteredData);
        res.json({ message: '지출 데이터가 성공적으로 삭제되었습니다.' });
    } catch (error) {
        res.status(500).json({ message: '데이터 삭제에 실패했습니다.', error: error.message });
    }
});

// 데이터 파일 읽기 함수
async function readExpenseData() {
    try {
        const data = await fs.readFile(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // 파일이 없는 경우 빈 배열로 시작
            await saveExpenseData([]);
            return [];
        }
        throw error;
    }
}

// 데이터 파일 저장 함수
async function saveExpenseData(data) {
    // data 디렉토리가 없으면 생성
    const dir = path.dirname(dataPath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
}

// 유틸: 다양한 입력 형태(true, 'true', '1', 1)를 boolean으로 변환
function parseBoolean(value) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (v === 'true' || v === '1') return true;
        if (v === 'false' || v === '0' || v === '') return false;
    }
    // undefined 또는 명시되지 않은 값은 false
    return false;
}

module.exports = router;