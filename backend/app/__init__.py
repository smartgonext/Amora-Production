import os
from flask import Flask, jsonify
from app.config import config_by_name
from app.extensions import db, jwt, migrate, bcrypt, cors
from app.database_setup import check_and_create_database

def create_app(config_name='dev'):
    # Check and create database automatically if it doesn't exist
    if os.environ.get('FLASK_ENV') != 'testing':
        try:
            check_and_create_database()
        except Exception as e:
            print(f"Warning: Auto database check/creation failed: {e}. Flask-SQLAlchemy will attempt to connect anyway.")
            
    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])
    
    # Initialize Extensions
    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})
    
    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.superadmin import superadmin_bp
    from app.routes.setup import setup_bp
    from app.routes.events import events_bp
    from app.routes.reports import reports_bp
    from app.routes.licensing import licensing_bp
    from app.routes.customers import customers_bp
    from app.routes.products import products_bp
    from app.routes.suppliers import suppliers_bp
    from app.routes.invoices import invoices_bp
    from app.routes.purchases import purchases_bp
    from app.routes.hr import hr_bp
    from app.routes.projects import projects_bp
    from app.routes.documents import documents_bp
    from app.routes.equipment import equipment_bp
    from app.routes.backup import backup_bp
    from app.routes.finance import finance_bp
    from app.routes.sales import sales_bp
    from app.routes.inventory import inventory_bp
    from app.routes.settings import settings_bp
    from app.routes.subscriptions import subscriptions_bp
    from app.routes.devices import devices_bp
    from app.routes.search import search_bp
    from app.routes.branches import branches_bp
    from app.routes.users import users_bp
    from app.routes.companies import companies_bp
    from app.utils.health import health_bp
    from app.routes.notifications import notifications_bp
    from app.routes.custom_fields import custom_fields_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/v1/auth')
    app.register_blueprint(superadmin_bp, url_prefix='/api/v1/superadmin')
    app.register_blueprint(setup_bp, url_prefix='/api/v1/setup')
    app.register_blueprint(events_bp, url_prefix='/api/v1/events')
    app.register_blueprint(reports_bp, url_prefix='/api/v1/reports')
    app.register_blueprint(licensing_bp, url_prefix='/api/v1/licensing')
    app.register_blueprint(customers_bp, url_prefix='/api/v1/customers')
    app.register_blueprint(products_bp, url_prefix='/api/v1/products')
    app.register_blueprint(suppliers_bp, url_prefix='/api/v1/suppliers')
    app.register_blueprint(invoices_bp, url_prefix='/api/v1/invoices')
    app.register_blueprint(purchases_bp, url_prefix='/api/v1/purchases')
    app.register_blueprint(hr_bp, url_prefix='/api/v1/hr')
    app.register_blueprint(projects_bp, url_prefix='/api/v1/projects')
    app.register_blueprint(documents_bp, url_prefix='/api/v1/documents')
    app.register_blueprint(equipment_bp, url_prefix='/api/v1/equipment')
    app.register_blueprint(backup_bp, url_prefix='/api/v1/backup')
    app.register_blueprint(finance_bp, url_prefix='/api/v1/finance')
    app.register_blueprint(sales_bp, url_prefix='/api/v1/sales')
    app.register_blueprint(inventory_bp, url_prefix='/api/v1/inventory')
    app.register_blueprint(settings_bp, url_prefix='/api/v1/settings')
    app.register_blueprint(subscriptions_bp, url_prefix='/api/v1/subscriptions')
    app.register_blueprint(devices_bp, url_prefix='/api/v1/devices')
    app.register_blueprint(search_bp, url_prefix='/api/v1/search')
    app.register_blueprint(branches_bp, url_prefix='/api/v1/branches')
    app.register_blueprint(users_bp, url_prefix='/api/v1/users')
    app.register_blueprint(companies_bp, url_prefix='/api/v1/companies')
    app.register_blueprint(health_bp, url_prefix='/api/v1/health')
    app.register_blueprint(notifications_bp, url_prefix='/api/v1/notifications')
    app.register_blueprint(custom_fields_bp, url_prefix='/api/v1/custom-fields')
    
    @app.route('/')
    def index():
        return jsonify({
            "message": "Welcome to SmartGoNext Universal ERP API Gateway",
            "version": "1.0.0",
            "status": "online"
        })
        
    return app
