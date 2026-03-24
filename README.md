# AI Stock Analysis

AI Stock Analysis is a Django + React project for portfolio tracking, stock analysis, and metals insights.

## Repository Layout

- `Backend/ai_stockanalysis` - Django REST backend
- `Frontend` - Vite React frontend

## Local Setup

### Backend

1. Go to `Backend/ai_stockanalysis`.
1. Copy `.env.example` to `.env` and fill in your real values.
1. Install dependencies with `pip install -r requirements.txt`.
1. Run migrations with `python manage.py migrate`.
1. Start the API with `python manage.py runserver`.

### Frontend

1. Go to `Frontend`.
1. Copy `.env.example` to `.env` if you want to override the backend URL.
1. Install dependencies with `npm install`.
1. Start the app with `npm run dev`.

## Git-Friendly Files

The repository now ignores generated and local-only files such as:

- `node_modules`
- `Frontend/dist`
- Python bytecode and caches
- backend `.env`
- Telethon session files
- backend media uploads

This keeps the repo safe to push to GitHub without leaking local secrets or generated artifacts.
