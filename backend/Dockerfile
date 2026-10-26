FROM python:3.11-slim

# LightGBM needs the OpenMP runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app

COPY requirements-serve.txt .
RUN pip install --no-cache-dir -r requirements-serve.txt

COPY siltda_ml ./siltda_ml
COPY artifacts/erosion_model.joblib ./artifacts/erosion_model.joblib

# Run as a non-root user
RUN useradd --create-home appuser
USER appuser

# Render injects PORT; default to 8000 for local `docker run`
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn siltda_ml.api:app --host 0.0.0.0 --port ${PORT}"]
