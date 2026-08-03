import pymysql

conn = pymysql.connect(host='localhost', user='root', password='Arish@123', port=3306)
cursor = conn.cursor()
cursor.execute('DROP DATABASE IF EXISTS smartgonext_erp')
cursor.execute('CREATE DATABASE smartgonext_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
conn.commit()
conn.close()
print('Database reset complete - ready for fresh seed')