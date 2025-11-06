const express = require('express');
const cors = require('cors');
require('dotenv').config();

const incomeRoutes = require('./routes/income.routes');
const expenseRoutes = require('./routes/expense.routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const summaryRoutes = require('./routes/summary.routes');
const recurringRoutes = require('./routes/recurring.routes');
const statsRoutes = require('./routes/stats.routes');

const app = express();
const port = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 기본 라우트
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Money Map API' });
});

// 수입 관련 라우트
app.use('/api/income', incomeRoutes);

// 지출 관련 라우트
app.use('/api/expense', expenseRoutes);

// Swagger UI 제공
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// Swagger JSON (raw)
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// 요약(잔액) 관련 라우트
app.use('/api/summary', summaryRoutes);

// 반복 수입 관련 라우트
app.use('/api/recurring', recurringRoutes);

// 통계 관련 라우트
app.use('/api/stats', statsRoutes);

// 서버 시작
app.listen(port, () => {
    console.log(`서버가 포트 ${port}에서 실행 중입니다.`);
});