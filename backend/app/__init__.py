import os
import logging
from flask import Flask, jsonify, request
from app.config import config_by_name
from app.extensions import db, jwt, migrate, bcrypt, cors
from app.database_setup import check_and_create_database

# Configure application logger (also capture Werkzeug request logs)
logging.basicConfig(
    handlers=[logging.StreamHandler()],
    format='%(asctime)s %(levelname)s [%(name)s] %(message)s',
    level=logging.INFO,
)
logger = logging.getLogger('erp')

def create_app(config_name='dev', config_overrides=None):
    cfg = config_by_name.get(config_name)
    db_name = getattr(cfg, 'DB_NAME', None) if cfg else None
    if config_overrides and 'DB_NAME' in config_overrides:
        db_name = config_overrides['DB_NAME']
        
    try:
        check_and_create_database(db_name)
    except Exception as e:
        print(f"Warning: Auto database check/creation failed: {e}. Flask-SQLAlchemy will attempt to connect anyway.")
            
    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])
    if config_overrides:
        app.config.update(config_overrides)
    
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
    from app.routes.manufacturing import manufacturing_bp
    from app.routes.bakery import bakery_bp
    
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
    app.register_blueprint(manufacturing_bp, url_prefix='/api/v1/manufacturing')
    app.register_blueprint(bakery_bp, url_prefix='/api/v1/bakery')
    
    @app.route('/')
    def index():
        return jsonify({
            "message": "Welcome to SmartGoNext Universal ERP API Gateway",
            "version": "1.0.0",
            "status": "online"
        })

    # ------------------------------------------------------------------
    # Centralised error handling — always return the app's JSON envelope
    # so a failing route never surfaces a raw HTML 500 with no detail.
    # ------------------------------------------------------------------
    @app.errorhandler(404)
    def not_found(err):
        return jsonify({
            "data": None,
            "meta": None,
            "errors": ["The requested resource was not found."]
        }), 404

    @app.errorhandler(405)
    def method_not_allowed(err):
        return jsonify({
            "data": None,
            "meta": None,
            "errors": ["The HTTP method is not allowed for this endpoint."]
        }), 405

    @app.errorhandler(500)
    def internal_error(err):
        db.session.rollback()
        original = getattr(err, 'original_exception', None) or err
        logger.error("Unhandled error -> %s: %s", request.method, request.url,
                     exc_info=(type(original), original, original.__traceback__))
        msg = "Internal server error."
        if app.debug or (cfg and getattr(cfg, 'DEBUG', False)):
            msg = f"{type(original).__name__}: {original}"
        elif not str(err).startswith('500 Internal'):
            # Include unexpected server-raised detail in production responses
            msg = f"{type(original).__name__}: {original}"
        return jsonify({
            "data": None,
            "meta": None,
            "errors": [msg]
        }), 500

    return app
