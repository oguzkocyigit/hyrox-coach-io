# syntax=docker/dockerfile:1

# ------------------------------------------------------------------
# Build stage: bagimliliklari izole bir venv'e kurar
# ------------------------------------------------------------------
FROM python:3.12-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install -r requirements.txt

# ------------------------------------------------------------------
# Runtime stage: minimal imaj, non-root kullanici
# ------------------------------------------------------------------
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    PORT=8000

RUN useradd --create-home --uid 1000 appuser

WORKDIR /srv

COPY --from=builder /opt/venv /opt/venv
COPY app/ ./app/

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,os; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/health', timeout=4)"

# Tek worker varsayilani: Railway/Fly gibi platformlarda yatay olcekleme
# replica ile yapilir. Dikey olcek icin WEB_CONCURRENCY env'i kullanin.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers ${WEB_CONCURRENCY:-1}"]
