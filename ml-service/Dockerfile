FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 MODEL_DIR=/data/models

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

# Railway sets $PORT. Mount a volume at /data to keep the trained model across deploys
# (optional: without it the model is retrained from the database on startup).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
