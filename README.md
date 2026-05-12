# Intelligent Bill Recognition and Personal Consumption Analysis System

智能账单识别与个人消费分析系统，面向个人账单管理场景，提供账单导入、账单管理、统计分析、图片识别和智能对话分析等功能。

## Features

- 账单管理：支持账单新增、查询、筛选、编辑和删除。
- 文件导入：支持微信、支付宝导出账单文件解析，并进行字段标准化、过滤和去重。
- 图片识别：支持上传账单截图，通过多模态视觉模型识别账单字段，用户确认后入库。
- 统计分析：提供收支汇总、趋势图、分类占比、月度日历和账单排行等视图。
- 智能对话：基于大语言模型工具调用能力，支持自然语言查询账单、统计消费和生成分析建议。
- 系统配置：支持配置模型名称、接口地址等参数。

## Tech Stack

### Backend

- FastAPI
- SQLAlchemy
- SQLite
- pandas
- OpenAI-compatible model API / DashScope-compatible model service

### Frontend

- React 18
- TypeScript
- Vite
- Ant Design
- ECharts

## Project Structure

```text
bill-analyzer/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/             # API routes
│   │   ├── core/            # Config and database setup
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Request/response schemas
│   │   └── services/        # Parsers, OCR, AI tools and business logic
│   ├── .env.example         # Backend environment example
│   └── requirements.txt
├── frontend/                # React frontend
│   ├── src/
│   │   ├── api/             # API clients
│   │   ├── components/      # Shared components
│   │   ├── layouts/         # App layout
│   │   ├── pages/           # Main pages
│   │   └── utils/           # Frontend utilities
│   └── package.json
├── start-backend.bat
└── start-frontend.bat
```

## Getting Started

### 1. Clone

```bash
cd bill-analyzer
```

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will run at:

```text
http://localhost:8000
```

### 3. Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend development server will run at:

```text
http://localhost:5173
```

## Environment Variables

Backend environment variables are defined in `backend/.env.example`:

```env
DATABASE_URL=sqlite:///./bill_analyzer.db
CORS_ORIGINS=http://localhost:5173
UPLOAD_DIR=../uploads
DASHSCOPE_API_KEY=your-api-key-here
QWEN_MODEL=qwen3-max
```

Create `backend/.env` from this file and fill in your own model API key if AI features are needed.
