"""
Ensure Demo Login Script
========================
Run this anytime to guarantee a demo superadmin user exists.

- If the demo user already exists, it simply prints the credentials.
- If not, it creates the demo tenant, company, branch, role, and demo admin user.

Usage:
    python ensure_demo_login.py
"""
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app
from app.extensions import db
from app.models.tenant import Tenant, SubscriptionPlan, Subscription, Company, Branch
from app.models.user import User, Role
from app.database_setup import check_and_create_database

DEMO_EMAIL = 'demo@smartgonext.com'
DEMO_PASSWORD = 'demo123'
DEMO_TENANT_SUBDOMAIN = 'demo'


def ensure_demo_login():
    # Make sure the database exists
    check_and_create_database()

    app = create_app('dev')

    with app.app_context():
        # 1. Check if the demo user already exists
        existing_user = User.query.filter_by(email=DEMO_EMAIL).first()
        if existing_user:
            print("\n========================================")
            print("  Demo user already exists — no changes made.")
            print("========================================")
            print(f"  Email   : {DEMO_EMAIL}")
            print(f"  Password: {DEMO_PASSWORD}")
            print("========================================\n")
            return

        # 2. Ensure a demo tenant exists
        demo_tenant = Tenant.query.filter_by(subdomain=DEMO_TENANT_SUBDOMAIN).first()
        if not demo_tenant:
            print("Creating demo tenant...")
            demo_tenant = Tenant(
                name='SmartGo ERP Demo',
                subdomain=DEMO_TENANT_SUBDOMAIN,
                business_type='Heavy Equipment & Services'
            )
            db.session.add(demo_tenant)
            db.session.flush()

            # Make sure a Free Trial plan exists
            free_plan = SubscriptionPlan.query.filter_by(name='Free Trial').first()
            if not free_plan:
                free_plan = SubscriptionPlan(
                    name='Free Trial',
                    price=0.00,
                    billing_cycle='monthly',
                    allowed_devices=1,
                    max_users=3,
                    max_storage_mb=100,
                    description='15-day free trial with limited features'
                )
                db.session.add(free_plan)
                db.session.flush()

            subscription = Subscription(
                tenant_id=demo_tenant.id,
                plan_id=free_plan.id,
                status='active',
                start_date=datetime.utcnow(),
                expiry_date=datetime.utcnow() + timedelta(days=365)
            )
            db.session.add(subscription)
            db.session.flush()

            # Company
            company = Company(
                tenant_id=demo_tenant.id,
                name='SmartGo Services & Rentals',
                email='info@smartgoservices.com',
                phone='9988776655',
                business_type='Services & Rentals',
                is_head_office=True
            )
            db.session.add(company)
            db.session.flush()

            # Branch
            branch = Branch(
                tenant_id=demo_tenant.id,
                company_id=company.id,
                name='Head Office',
                code='HO',
                city='Bangalore',
                state='Karnataka',
                phone='9988776601',
                email='ho@smartgo.com',
                is_main=True,
                is_active=True
            )
            db.session.add(branch)
            db.session.flush()

            # Admin role
            admin_role = Role(
                tenant_id=demo_tenant.id,
                name='Admin',
                description='Full access to all operations and configuration'
            )
            db.session.add(admin_role)
            db.session.flush()
        else:
            company = Company.query.filter_by(tenant_id=demo_tenant.id).first()
            branch = Branch.query.filter_by(tenant_id=demo_tenant.id).first()
            admin_role = Role.query.filter_by(tenant_id=demo_tenant.id, name='Admin').first()
            if not admin_role:
                admin_role = Role(
                    tenant_id=demo_tenant.id,
                    name='Admin',
                    description='Full access to all operations and configuration'
                )
                db.session.add(admin_role)
                db.session.flush()

        # 3. Create the demo admin user
        print("Creating demo admin user...")
        user = User(
            tenant_id=demo_tenant.id,
            company_id=company.id if company else None,
            branch_id=branch.id if branch else None,
            name='Demo Admin',
            email=DEMO_EMAIL,
            phone='9876543210',
            role_id=admin_role.id,
            is_active=True,
            is_superadmin=True
        )
        user.set_password(DEMO_PASSWORD)
        db.session.add(user)
        db.session.commit()

        print("\n========================================")
        print("  Demo user created successfully!")
        print("========================================")
        print(f"  Email   : {DEMO_EMAIL}")
        print(f"  Password: {DEMO_PASSWORD}")
        print("========================================\n")


if __name__ == '__main__':
    ensure_demo_login()