import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app
from app.extensions import db, bcrypt
from app.models.user import User, Role
from app.models.tenant import Tenant

app = create_app('dev')
with app.app_context():
    print("--- TENANTS ---")
    tenants = Tenant.query.all()
    for t in tenants:
        print(f"ID: {t.id}, Name: {t.name}, Subdomain: {t.subdomain}")

    print("\n--- USERS ---")
    users = User.query.all()
    for u in users:
        print(f"ID: {u.id}, Name: {u.name}, Email: {u.email}, Active: {u.is_active}, Deleted: {u.is_deleted}, Tenant ID: {u.tenant_id}")
        # Verify check_password
        try:
            print(f"  Password check 'demo123': {u.check_password('demo123')}")
            print(f"  Password check 'demo1234': {u.check_password('demo1234')}")
        except Exception as e:
            print(f"  Password check failed: {e}")
