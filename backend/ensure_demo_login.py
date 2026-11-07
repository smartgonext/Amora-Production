"""
Ensure Amora Bakery & Superadmin Login Script
=============================================
Run this anytime to guarantee superadmin and Amora Bakery client exist.
Usage:
    python ensure_demo_login.py
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app
from app.database_setup import check_and_create_database
from seed import seed_database

if __name__ == '__main__':
    check_and_create_database()
    app = create_app('dev')
    seed_database(app)
