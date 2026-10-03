# API image (FastAPI + Alembic migrations + dataset loader). Build context: repository root.
#   docker build -f services/api/Dockerfile -t jadhr-api .

FROM ghcr.io/astral-sh/uv:0.11-python3.13-trixie-slim AS build
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock ./
COPY packages/arabic-py packages/arabic-py
COPY pipeline pipeline
COPY services/api services/api
RUN uv sync --frozen --no-dev --package jadhr-api

FROM python:3.13-slim-trixie AS run
WORKDIR /app
RUN useradd --system --uid 10001 jadhr
COPY --from=build --chown=jadhr /app /app
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 JADHR_ENVIRONMENT=production
USER jadhr
WORKDIR /app/services/api
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/healthz').status == 200 else 1)"
# Workers: one per CPU is a sane default for a read-only, cache-friendly API. No access log here: Caddy's,
# filtered (no query string, a shortened address) and kept seven days, is the only request log (privacy page).
CMD ["sh", "-c", "uvicorn jadhr_api.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-2} --proxy-headers --forwarded-allow-ips='*' --no-access-log"]
