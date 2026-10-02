#!/usr/bin/env python3
"""Database connection test"""
from database import get_connection, sales_db_cursor

print('Testing main DB connection...')
try:
    conn = get_connection()
    print('✓ Main DB connected')
    conn.close()
except Exception as e:
    print(f'✗ Main DB error: {e}')

print('\nTesting sales DB connection...')
try:
    with sales_db_cursor() as cur:
        cur.execute('SELECT 1')
        print('✓ Sales DB connected')
except Exception as e:
    print(f'✗ Sales DB error: {e}')

print('\nDatabase connection test completed!')
