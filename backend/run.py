import os
from app import create_app
from app.extensions import db

# Get configuration name from environment, default to 'dev'
config_name = os.environ.get('FLASK_CONFIG', 'dev')
app = create_app(config_name)

if __name__ == '__main__':
    # Create all database tables if they don't exist
    with app.app_context():
        db.create_all()
        print("All database tables ensured.")
        
        # Auto-seed if database is completely fresh (first run)
        try:
            from app.models.user import User
            if User.query.count() == 0:
                print("First run detected: Database is empty. Running initial setup for Amora Bakery & Superadmin...")
                from seed import seed_database
                seed_database(app)
                print("Initial setup completed.")
        except Exception as e:
            print(f"Warning: Auto-seed check encountered an issue: {e}")
    
    # Default parameters for running locally
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5000))
    app.run(host=host, port=port)
