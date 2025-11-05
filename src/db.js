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

module.exports = db;