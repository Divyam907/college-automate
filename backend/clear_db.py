import psycopg2
from config import DB_PARAMS

conn = psycopg2.connect(**DB_PARAMS)
cur = conn.cursor()

# Get all tables in public schema
cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public'")
tables = [r[0] for r in cur.fetchall()]
print('Tables found:', tables)

if tables:
    cur.execute('TRUNCATE ' + ', '.join(tables) + ' CASCADE')
    conn.commit()
    print('All tables truncated successfully!')
else:
    print('No tables found.')

cur.close()
conn.close()
