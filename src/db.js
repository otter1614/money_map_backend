// src/db.js
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '../data/money-map.db'); // data 폴더에 DB 파일
const db = new Database(dbPath);

// incomes 테이블 생성
db.prepare(`
  CREATE TABLE IF NOT EXISTS incomes (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )
`).run();

// expenses 테이블 생성
db.prepare(`
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    paymentMethod TEXT,
    location TEXT,
    isFixed INTEGER NOT NULL DEFAULT 0, -- 0=false, 1=true
    createdAt TEXT NOT NULL,
    updatedAt TEXT
  )
`).run();

// 반복 수입 규칙 테이블 (recurring incomes)
db.prepare(`
  CREATE TABLE IF NOT EXISTS recurring_incomes (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    startDate TEXT NOT NULL,
    frequency TEXT NOT NULL, -- e.g., daily, weekly, monthly, yearly
    interval INTEGER DEFAULT 1, -- e.g., every 1 month
    occurrences INTEGER, -- optional number of times
    endDate TEXT, -- optional end date
    createdAt TEXT NOT NULL
  )
`).run();

module.exports = db;