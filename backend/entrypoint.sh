#!/bin/sh
set -e

echo "=== AMORA BAKERY PRODUCTION STARTUP ==="
echo "Waiting for MySQL at ${DB_HOST:-localhost}:${DB_PORT:-3306}..."

python - <<'EOF'
import time, os, urllib.parse, pymysql

host = os.environ.get('DB_HOST', 'localhost')
port = int(os.environ.get('DB_PORT', 3306))
user = os.environ.get('DB_USER', 'root')
password = os.environ.get('DB_PASSWORD', '')
db_name = os.environ.get('DB_NAME', 'smartgonext_erp')

connected = False
for attempt in range(1, 41):
    try:
        conn = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            connect_timeout=5
        )
        with conn.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        conn.close()
        print(f"[OK] Connected to MySQL and database '{db_name}' ensured on attempt {attempt}.")
        connected = True
        break
    except Exception as e:
        print(f"[WAIT] Attempt {attempt}/40: Waiting for MySQL ({e})...")
        time.sleep(3)

if not connected:
    print("[ERROR] Could not connect to MySQL after 40 attempts. Exiting.")
    exit(1)
EOF

echo "Ensuring tables and initial seed data..."
python - <<'EOF'
import os
from run import app, db
from app.models.user import User

with app.app_context():
    db.create_all()
    print("[OK] Database tables created/verified.")
    try:
        user_count = User.query.count()
        if user_count == 0:
            print("[INFO] No users found. Executing Amora Bakery production seed...")
            from seed import seed_database
            seed_database(app)
            print("[OK] Amora Bakery seed completed successfully.")
        else:
            print(f"[OK] Database already populated with {user_count} users. Skipping seed.")
    except Exception as e:
        print(f"[WARN] Error checking/seeding users: {e}")
EOF

echo "Starting Gunicorn application server..."
exec gunicorn --bind 0.0.0.0:5000 --workers 3 --timeout 120 --access-logfile - --error-logfile - run:app

