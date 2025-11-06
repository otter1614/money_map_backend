// src/db.js
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '../data/money-map.db'); // data 폴더에 DB 파일
const db = new Database(dbPath);

// 데이터베이스 초기화 함수
function initDatabase() {
    // 외래 키 활성화
    db.pragma('foreign_keys = ON');

    // 카테고리 마스터 테이블 생성
    db.prepare(`
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense')), -- 수입 또는 지출
            description TEXT,
            isDefault INTEGER DEFAULT 0, -- 기본 카테고리 여부
            createdAt TEXT NOT NULL,
            updatedAt TEXT
        )
    `).run();

    // 기본 카테고리 데이터 삽입
    const defaultCategories = [
        // 수입 카테고리
        { id: 'salary', name: '급여', type: 'income', isDefault: 1, description: '정규직 급여' },
        { id: 'bonus', name: '보너스', type: 'income', isDefault: 1, description: '성과급, 상여금' },
        { id: 'interest', name: '이자수입', type: 'income', isDefault: 1, description: '예금 이자, 투자 수익' },
        { id: 'side', name: '부수입', type: 'income', isDefault: 1, description: '아르바이트, 프리랜서 수입' },
        
        // 지출 카테고리
        { id: 'coffee', name: '커피/음료', type: 'expense', isDefault: 1, description: '카페, 음료 구매' },
        { id: 'rent', name: '월세', type: 'expense', isDefault: 1, description: '주거비, 월세' },
        { id: 'food', name: '식비', type: 'expense', isDefault: 1, description: '식사, 식료품' },
        { id: 'savings', name: '저축/적금', type: 'expense', isDefault: 1, description: '저축, 적금' },
        { id: 'transport', name: '교통비', type: 'expense', isDefault: 1, description: '대중교통, 주유비' },
        { id: 'utility', name: '공과금', type: 'expense', isDefault: 1, description: '전기, 수도, 가스비' },
        { id: 'entertainment', name: '문화/여가', type: 'expense', isDefault: 1, description: '영화, 공연, 취미' },
        { id: 'shopping', name: '쇼핑', type: 'expense', isDefault: 1, description: '의류, 잡화' }
    ];

    const insertCategory = db.prepare(`
        INSERT OR IGNORE INTO categories (id, name, type, description, isDefault, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    defaultCategories.forEach(cat => {
        insertCategory.run(cat.id, cat.name, cat.type, cat.description, cat.isDefault);
    });

    // 수입 테이블 생성
    db.prepare(`
  CREATE TABLE IF NOT EXISTS incomes (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    categoryId TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    isRecurring INTEGER DEFAULT 0,
    recurringId TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT,
    FOREIGN KEY(categoryId) REFERENCES categories(id),
    FOREIGN KEY(recurringId) REFERENCES recurring_rules(id)
  )
`).run();

    // expenses 테이블 생성
    db.prepare(`
        CREATE TABLE IF NOT EXISTS expenses (
            id TEXT PRIMARY KEY,
            amount REAL NOT NULL,
            categoryId TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            paymentMethod TEXT CHECK(paymentMethod IN ('현금', '카드', '계좌이체', '기타')),
            location TEXT,
            isFixed INTEGER NOT NULL DEFAULT 0,
            tags TEXT, -- JSON 형식으로 저장된 태그 배열
            createdAt TEXT NOT NULL,
            updatedAt TEXT,
            FOREIGN KEY(categoryId) REFERENCES categories(id)
        )
    `).run();

    // 반복 규칙 테이블 (수입/지출 공통)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS recurring_rules (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
            amount REAL NOT NULL,
            categoryId TEXT NOT NULL,
            description TEXT,
            startDate TEXT NOT NULL,
            frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
            interval INTEGER DEFAULT 1,
            occurrences INTEGER,
            endDate TEXT,
            lastProcessedDate TEXT,
            isActive INTEGER DEFAULT 1,
            createdAt TEXT NOT NULL,
            updatedAt TEXT,
            FOREIGN KEY(categoryId) REFERENCES categories(id)
        )
    `).run();

    // 예산 테이블
    db.prepare(`
        CREATE TABLE IF NOT EXISTS budgets (
            id TEXT PRIMARY KEY,
            categoryId TEXT NOT NULL,
            amount REAL NOT NULL,
            startDate TEXT NOT NULL,
            endDate TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT,
            FOREIGN KEY(categoryId) REFERENCES categories(id)
        )
    `).run();

    // 알림 설정 테이블
    db.prepare(`
        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL CHECK(type IN ('budget', 'recurring', 'goal')),
            condition TEXT NOT NULL, -- JSON 형식으로 저장된 알림 조건
            message TEXT,
            isActive INTEGER DEFAULT 1,
            createdAt TEXT NOT NULL,
            updatedAt TEXT
        )
    `).run();

    // 재무 목표 테이블
    db.prepare(`
        CREATE TABLE IF NOT EXISTS financial_goals (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            targetAmount REAL NOT NULL,
            currentAmount REAL DEFAULT 0,
            startDate TEXT NOT NULL,
            targetDate TEXT NOT NULL,
            description TEXT,
            isCompleted INTEGER DEFAULT 0,
            createdAt TEXT NOT NULL,
            updatedAt TEXT
        )
    `).run();

    // 태그 마스터 테이블
    db.prepare(`
        CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT,
            description TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT
        )
    `).run();

    console.log('데이터베이스 초기화 완료');
}

// 데이터베이스 초기화 실행
initDatabase();

module.exports = db;