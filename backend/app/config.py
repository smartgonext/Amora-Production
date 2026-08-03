import os
import urllib.parse
from datetime import timedelta

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'smartgonext-super-secret-key')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-super-secret-key')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # No JWT timeouts - tokens never expire
    JWT_ACCESS_TOKEN_EXPIRES = False
    JWT_REFRESH_TOKEN_EXPIRES = False
    
    # Database config
    DB_USER = os.environ.get('DB_USER', 'root')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', 'Arish@123')
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_PORT = os.environ.get('DB_PORT', '3306')
    DB_NAME = os.environ.get('DB_NAME', 'smartgonext_erp')
    
    # URL quote the password to handle characters like '@'
    quoted_password = urllib.parse.quote_plus(DB_PASSWORD)
    
    # Combined URI for SQLAlchemy
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        f"mysql+pymysql://{DB_USER}:{quoted_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False

class TestingConfig(Config):
    TESTING = True
    DEBUG = True
    DB_NAME = 'smartgonext_erp_test'
    
    quoted_password = urllib.parse.quote_plus(Config.DB_PASSWORD)
    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{Config.DB_USER}:{quoted_password}@{Config.DB_HOST}:{Config.DB_PORT}/{DB_NAME}"

config_by_name = {
    'dev': DevelopmentConfig,
    'prod': ProductionConfig,
    'test': TestingConfig
}