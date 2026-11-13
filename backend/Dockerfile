FROM python:3.11-slim-bookworm

WORKDIR /app

# Install python dependencies (all pre-built wheels, zero apt hang)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefer-binary --default-timeout=1000 --retries 10 -r requirements.txt

# Copy source code
COPY . .

# Ensure line endings are LF and set execution rights on entrypoint
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

EXPOSE 5000

ENV FLASK_CONFIG=prod
ENV PYTHONUNBUFFERED=1

ENTRYPOINT ["./entrypoint.sh"]
