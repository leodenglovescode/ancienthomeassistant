FROM python:3.12-alpine
LABEL org.opencontainers.image.title="Ancient Home Assistant" \
      org.opencontainers.image.description="A lightweight Home Assistant dashboard for older iPads." \
      org.opencontainers.image.source="https://github.com/leodenglovescode/ancienthomeassistant"
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 ANCIENT_DATA_DIR=/data
WORKDIR /app
RUN addgroup -S -g 10001 dashboard && adduser -S -u 10001 -G dashboard dashboard \
    && mkdir /data && chown dashboard:dashboard /data && chmod 700 /data
COPY --chown=dashboard:dashboard server.py storage.py ./
COPY --chown=dashboard:dashboard static ./static
USER dashboard
VOLUME ["/data"]
EXPOSE 8095
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8095/api/status', timeout=3)"
CMD ["python", "server.py", "--host", "0.0.0.0", "--port", "8095"]
