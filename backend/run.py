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
    
    # Default parameters for running locally
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5000))
    app.run(host=host, port=port)
