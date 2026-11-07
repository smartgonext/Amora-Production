FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Set execution rights on entrypoint
RUN chmod +x entrypoint.sh

EXPOSE 5000

ENV FLASK_CONFIG=prod
ENV PYTHONUNBUFFERED=1

ENTRYPOINT ["./entrypoint.sh"]
