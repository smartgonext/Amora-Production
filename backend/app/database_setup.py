import pymysql
from app.config import Config

def check_and_create_database():
    """Connect directly to MySQL server and ensure the target database exists"""
    print(f"Connecting to MySQL server at {Config.DB_HOST}:{Config.DB_PORT} to check database status...")
    
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
            cursor.execute(f"SHOW DATABASES LIKE '{Config.DB_NAME}'")
            result = cursor.fetchone()
            
            if not result:
                print(f"Database '{Config.DB_NAME}' does not exist. Creating database with UTF8MB4 charset...")
                cursor.execute(f"CREATE DATABASE {Config.DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
                connection.commit()
                print(f"Database '{Config.DB_NAME}' created successfully.")
            else:
                print(f"Database '{Config.DB_NAME}' already exists.")
    except Exception as e:
        print(f"Error checking/creating database: {e}")
        raise e
    finally:
        connection.close()
