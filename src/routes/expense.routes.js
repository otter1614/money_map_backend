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
 *                 description: 지출 금액
 *               description:
 *                 type: string
 *                 description: 지출 설명
 *               date:
 *                 type: string
 *                 description: 지출 날짜 (YYYY-MM-DD)
 *               paymentMethod:
 *                 type: string
 *                 description: 결제 수단
 *               location:
 *                 type: string
 *                 description: 지출 장소
 *               categories:
 *                 type: object
 *                 description: 지출 카테고리 정보
 *                 properties:
 *                   isFixed:
 *                     type: boolean
 *                     description: 고정 지출 여부
 *                   isCoffee:
 *                     type: boolean
 *                     description: 커피/음료 지출
 *                   isRent:
 *                     type: boolean
 *                     description: 월세
 *                   isFood:
 *                     type: boolean
 *                     description: 식비
 *                   isSavings:
 *                     type: boolean
 *                     description: 저축/적금
 *                   isTransportation:
 *                     type: boolean
 *                     description: 교통비
 *                   isUtility:
 *                     type: boolean
 *                     description: 공과금
 *                   isEntertainment:
 *                     type: boolean
 *                     description: 문화/여가
 *                   isShopping:
 *                     type: boolean
 *                     description: 쇼핑
 *     responses:
 *       201:
 *         description: 생성된 지출 객체 반환
 */
// 새로운 지출 데이터 추가
router.post('/', async (req, res) => {
    try {
        const { 
            amount, 
            description, 
            date, 
            paymentMethod, 
            location,
            categories
        } = req.body;
        
        // 입력 데이터 검증
        if (!amount || !date) {
            return res.status(400).json({ message: '금액과 날짜는 필수 입력값입니다.' });
        }

        // 카테고리 객체 처리
        const defaultCategories = {
            isFixed: false,
            isCoffee: false,
            isRent: false,
            isFood: false,
            isSavings: false,
            isTransportation: false,
            isUtility: false,
            isEntertainment: false,
            isShopping: false
        };

        const expenseTypes = {
            ...defaultCategories,
            ...(categories && Object.fromEntries(
                Object.entries(categories).map(([key, value]) => [key, parseBoolean(value)])
            ))
        };

        // 자동으로 카테고리 결정
        let derivedCategory = '기타';
        if (expenseTypes.isCoffee) derivedCategory = '커피/음료';
        else if (expenseTypes.isRent) derivedCategory = '월세';
        else if (expenseTypes.isFood) derivedCategory = '식비';
        else if (expenseTypes.isSavings) derivedCategory = '저축/적금';
        else if (expenseTypes.isTransportation) derivedCategory = '교통비';
        else if (expenseTypes.isUtility) derivedCategory = '공과금';
        else if (expenseTypes.isEntertainment) derivedCategory = '문화/여가';
        else if (expenseTypes.isShopping) derivedCategory = '쇼핑';

        const newExpense = {
            id: Date.now().toString(), // 간단한 유니크 ID 생성
            amount: Number(amount),
            category: category || derivedCategory,
            description: description || '',
            date,
            paymentMethod: paymentMethod || '현금',
            location: location || '',
            ...expenseTypes,
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
        const { amount, description, date, paymentMethod, location, categories } = req.body;
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
            description: description || existing.description,
            date: date || existing.date,
            paymentMethod: paymentMethod || existing.paymentMethod,
            location: location || existing.location,
            updatedAt: new Date().toISOString()
        };

        // 카테고리 객체 업데이트
        if (categories) {
            const existingCategories = {
                isFixed: existing.isFixed || false,
                isCoffee: existing.isCoffee || false,
                isRent: existing.isRent || false,
                isFood: existing.isFood || false,
                isSavings: existing.isSavings || false,
                isTransportation: existing.isTransportation || false,
                isUtility: existing.isUtility || false,
                isEntertainment: existing.isEntertainment || false,
                isShopping: existing.isShopping || false
            };

            Object.entries(categories).forEach(([key, value]) => {
                if (existingCategories.hasOwnProperty(key)) {
                    updated[key] = parseBoolean(value);
                }
            });
        }

        // 카테고리 자동 업데이트
        let derivedCategory = '기타';
        if (updated.isCoffee) derivedCategory = '커피/음료';
        else if (updated.isRent) derivedCategory = '월세';
        else if (updated.isFood) derivedCategory = '식비';
        else if (updated.isSavings) derivedCategory = '저축/적금';
        else if (updated.isTransportation) derivedCategory = '교통비';
        else if (updated.isUtility) derivedCategory = '공과금';
        else if (updated.isEntertainment) derivedCategory = '문화/여가';
        else if (updated.isShopping) derivedCategory = '쇼핑';

        updated.category = category || derivedCategory;
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