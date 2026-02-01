# NeuroReach AI Backend Dockerfile
# Python 3.11 FastAPI application

# =============================================================================
# Build stage
# =============================================================================
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# =============================================================================
# Production stage
# =============================================================================
FROM python:3.11-slim as production

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create non-root user for security
RUN groupadd -r neuroreach && useradd -r -g neuroreach neuroreach

# Create celery beat schedule directory with proper permissions
RUN mkdir -p /var/run/celery && chown neuroreach:neuroreach /var/run/celery

# Copy application code
COPY --chown=neuroreach:neuroreach src/ /app/src/

# Copy static assets (logo for emails, etc.)
COPY --chown=neuroreach:neuroreach static/ /app/static/

# Copy scripts (setup_fresh_admin.py, etc.)
COPY --chown=neuroreach:neuroreach scripts/ /app/scripts/

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Switch to non-root user
USER neuroreach

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health/live || exit 1

# Run the application with proxy header support for reverse proxies (ngrok, nginx, ALB)
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]

# =============================================================================
# Development stage
# =============================================================================
FROM production as development

# Switch back to root to install dev tools
USER root

# Install development dependencies
RUN pip install --no-cache-dir \
    pytest \
    pytest-asyncio \
    pytest-cov \
    httpx \
    black \
    isort \
    mypy \
    flake8

# Switch back to non-root user
USER neuroreach

# Run with reload for development, with proxy header support
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--proxy-headers", "--forwarded-allow-ips", "*"]
