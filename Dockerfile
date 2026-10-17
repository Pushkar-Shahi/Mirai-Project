FROM python:3.12-slim

# System libraries WeasyPrint needs to render PDFs, plus a font.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt backend/requirements-production.txt ./
RUN pip install --no-cache-dir -r requirements-production.txt
COPY backend/ .

EXPOSE 8000
CMD ["bash", "scripts/start_public_demo.sh"]
