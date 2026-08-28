import pymysql
from app.config import Config

def check_and_create_database(db_name=None):
    """Connect directly to MySQL server and ensure the target database exists"""
    if not db_name:
        db_name = Config.DB_NAME
    print(f"Connecting to MySQL server at {Config.DB_HOST}:{Config.DB_PORT} to check database status for database '{db_name}'...")
    
    # Establish connection without a specific database
    connection = pymysql.connect(
        host=Config.DB_HOST,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        port=int(Config.DB_PORT),
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )
    
    try:
        with connection.cursor() as cursor:
            # Check if database exists
            cursor.execute(f"SHOW DATABASES LIKE '{db_name}'")
            result = cursor.fetchone()
            
            if not result:
                print(f"Database '{db_name}' does not exist. Creating database with UTF8MB4 charset...")
                cursor.execute(f"CREATE DATABASE `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
                connection.commit()
                print(f"Database '{db_name}' created successfully.")
            else:
                print(f"Database '{db_name}' already exists.")
    except Exception as e:
        print(f"Error checking/creating database: {e}")
        raise e
    finally:
        connection.close()
