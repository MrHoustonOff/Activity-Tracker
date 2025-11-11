# /ActivityTracker/database.py

import sqlite3
import os
from pathlib import Path

# --- Этап 0: Ядро - Логика хранения данных ---
def get_app_dir():
    """Возвращает путь к директории данных приложения в зависимости от ОС."""
    if os.name == 'nt':  # Windows
        app_dir = Path(os.getenv('APPDATA')) / 'MrHouston' / 'ActivityTracker'
    else:  # Linux, MacOS
        app_dir = Path.home() / '.local' / 'share' / 'MrHouston' / 'ActivityTracker'
    
    app_dir.mkdir(parents=True, exist_ok=True)
    return app_dir

def get_db_path():
    """Возвращает полный путь к файлу базы данных."""
    return get_app_dir() / 'activity_tracker.db'

def init_db():
    """Инициализирует базу данных и создает таблицы, если их нет."""
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Включаем поддержку внешних ключей для каскадного удаления
    cursor.execute("PRAGMA foreign_keys = ON;")

    # Создание таблицы активностей
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    ''')

    # Создание таблицы логов
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            value TEXT,
            FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
        )
    ''')

    conn.commit()
    conn.close()
    print(f"База данных инициализирована по пути: {db_path}")

# --- Этап 1: Модуль 2 - Функции для управления активностями ---

def add_activity(name):
    """Добавляет новую активность в базу данных."""
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO activities (name) VALUES (?)", (name,))
        conn.commit()
        return {"success": True, "id": cursor.lastrowid}
    except sqlite3.IntegrityError:
        return {"success": False, "error": "Активность с таким именем уже существует."}
    finally:
        conn.close()

def get_all_activities():
    """Возвращает список всех активностей."""
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM activities ORDER BY name ASC")
    activities = [{"id": row[0], "name": row[1]} for row in cursor.fetchall()]
    conn.close()
    return activities

def delete_activity(activity_id):
    """Удаляет активность и все связанные с ней логи (каскадно)."""
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;") # Важно для каскадного удаления
    cursor.execute("DELETE FROM activities WHERE id = ?", (activity_id,))
    conn.commit()
    conn.close()