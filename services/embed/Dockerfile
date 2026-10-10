# The embedding service (P17, D34): the pinned open model as ONNX on the CPU, reachable only from the API.
# Build context: repository root.   docker build -f services/embed/Dockerfile -t jadhr-embed .
# The model's files are fetched into /models on the first start (pinned revision, each file's sha256 checked) and kept
# in the `models` volume; a file that is not the pinned one stops the service before it answers anything.

FROM ghcr.io/astral-sh/uv:0.11-python3.13-trixie-slim AS build
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock ./
COPY packages/arabic-py packages/arabic-py
COPY pipeline pipeline
COPY services/api services/api
COPY services/embed services/embed
RUN uv sync --frozen --no-dev --package jadhr-embed

FROM python:3.13-slim-trixie AS run
WORKDIR /app
RUN useradd --system --uid 10001 jadhr && mkdir /models && chown jadhr /models
COPY --from=build --chown=jadhr /app /app
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 JADHR_MODELS_DIR=/models
USER jadhr
EXPOSE 8010
HEALTHCHECK --interval=30s --timeout=5s --start-period=600s CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8010/healthz').status == 200 else 1)"
# fetch is a no-op once the files are there and are the pinned ones; no access log (the privacy page: no request log
# but Caddy's, and this service is never reached from outside)
CMD ["sh", "-c", "python -m jadhr_embed fetch && exec python -m jadhr_embed serve --host 0.0.0.0 --port 8010"]
