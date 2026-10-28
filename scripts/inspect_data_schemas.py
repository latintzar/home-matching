import duckdb
import sqlite3
import os

DATA_DIR = '/Users/peterneyra/puedo_casa/data'
AIRBNB_DB = os.path.join(DATA_DIR, 'airbnb_consolidated_20250902_150025.db')
BURBUJA_DB = os.path.join(DATA_DIR, 'burbuja_data_ultra.duckdb')
REDDIT_DB = os.path.join(DATA_DIR, 'reddit_data_full.duckdb')

def inspect_sqlite(db_path):
    print(f"\n--- Inspecting SQLite: {os.path.basename(db_path)} ---")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        for table in tables:
            table_name = table[0]
            print(f"\nTable: {table_name}")
            
            # Get schema
            cursor.execute(f"PRAGMA table_info({table_name});")
            columns = cursor.fetchall()
            print("Columns:", [f"{col[1]} ({col[2]})" for col in columns])
            
            # Get sample
            cursor.execute(f"SELECT * FROM {table_name} LIMIT 1;")
            row = cursor.fetchone()
            print("Sample Row:", row)
            
        conn.close()
    except Exception as e:
        print(f"Error inspecting SQLite: {e}")

def inspect_duckdb(db_path):
    print(f"\n--- Inspecting DuckDB: {os.path.basename(db_path)} ---")
    try:
        conn = duckdb.connect(db_path)
        
        # Get tables
        tables = conn.execute("SHOW TABLES").fetchall()
        
        for table in tables:
            table_name = table[0]
            print(f"\nTable: {table_name}")
            
            # Get schema
            schema = conn.execute(f"DESCRIBE {table_name}").fetchall()
            print("Columns:", [f"{col[0]} ({col[1]})" for col in schema])
            
            # Get sample
            row = conn.execute(f"SELECT * FROM {table_name} LIMIT 1").fetchone()
            print("Sample Row:", row)
            
        conn.close()
    except Exception as e:
        print(f"Error inspecting DuckDB: {e}")

if __name__ == "__main__":
    if os.path.exists(AIRBNB_DB):
        inspect_sqlite(AIRBNB_DB)
    else:
        print(f"File not found: {AIRBNB_DB}")

    if os.path.exists(BURBUJA_DB):
        inspect_duckdb(BURBUJA_DB)
    else:
        print(f"File not found: {BURBUJA_DB}")

    if os.path.exists(REDDIT_DB):
        inspect_duckdb(REDDIT_DB)
    else:
        print(f"File not found: {REDDIT_DB}")

