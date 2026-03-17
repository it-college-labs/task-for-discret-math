# Interactive RB Tree

Учебное приложение для визуализации вставки в красно-чёрное дерево.

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

## Tests

```bash
cd backend
python3 -m unittest discover -s tests
```
