import sqlite3
import os
from pathlib import Path

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

    cursor.execute("PRAGMA foreign_keys = ON;")

    # Добавлено поле value_type, которое будет хранить тип ('checkmark', 'count', 'duration', 'text')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            value_type TEXT NOT NULL 
        )
    ''')

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

def add_activity(name, value_type):
    """Добавляет новую активность с указанным типом значения в базу данных."""
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO activities (name, value_type) VALUES (?, ?)", (name, value_type))
        conn.commit()
        return {"success": True, "id": cursor.lastrowid}
    except sqlite3.IntegrityError:
        return {"success": False, "error": "Активность с таким именем уже существует."}
    finally:
        conn.close()

def get_all_activities():
    """Возвращает список всех активностей, включая их тип."""
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, value_type FROM activities ORDER BY name ASC")
    activities = [{"id": row[0], "name": row[1], "value_type": row[2]} for row in cursor.fetchall()]
    conn.close()
    return activities

def delete_activity(activity_id):
    """Удаляет активность и все связанные с ней логи (каскадно)."""
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("DELETE FROM activities WHERE id = ?", (activity_id,))
    conn.commit()
    conn.close()
    
def add_log(activity_id, date, value):
    """Добавляет запись в журнал активностей."""
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO activity_logs (activity_id, date, value) VALUES (?, ?, ?)",
        (activity_id, date, value)
    )
    conn.commit()
    log_id = cursor.lastrowid
    conn.close()
    return {"success": True, "id": log_id}

def get_logs_for_month(year, month, filter_ids=None):
    """
    Возвращает все логи за указанный год и месяц.
    Если передан filter_ids, возвращает логи только для этих активностей.
    """
    month_str = f"{int(month):02d}"
    date_prefix = f"{year}-{month_str}-"
    
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row 
    cursor = conn.cursor()
    
    params = [date_prefix + '%']
    
    query = """
        SELECT l.id, l.activity_id, l.date, l.value, a.name as activity_name, a.value_type
        FROM activity_logs l
        JOIN activities a ON l.activity_id = a.id
        WHERE l.date LIKE ?
    """
    
    if filter_ids:
        # Создаем плейсхолдеры (?,?,?) для безопасной вставки
        placeholders = ', '.join('?' for _ in filter_ids)
        query += f" AND l.activity_id IN ({placeholders})"
        params.extend(filter_ids)

    cursor.execute(query, params)
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return logs

def get_logs_for_day(date):
    """Возвращает все логи за конкретный день."""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    query = """
        SELECT l.id, l.activity_id, l.value, a.name as activity_name
        FROM activity_logs l
        JOIN activities a ON l.activity_id = a.id
        WHERE l.date = ?
    """
    cursor.execute(query, (date,))
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return logs

def delete_log(log_id):
    """Удаляет конкретную запись из журнала."""
    conn = sqlite3.connect(get_db_path())
    cursor = conn.cursor()
    cursor.execute("DELETE FROM activity_logs WHERE id = ?", (log_id,))
    conn.commit()
    conn.close()
    return {"success": True}

def get_all_data_for_export():
    """Возвращает все записи из activity_logs в формате для JSON экспорта."""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    query = """
        SELECT
            l.date,
            a.name AS activity_name,
            l.value
        FROM activity_logs l
        JOIN activities a ON l.activity_id = a.id
        ORDER BY l.date ASC
    """
    cursor.execute(query)
    # Преобразуем строки в словари и фильтруем value=None для чистоты JSON
    all_data = []
    for row in cursor.fetchall():
        data_point = dict(row)
        if data_point['value'] is None:
            del data_point['value']
        all_data.append(data_point)

    conn.close()
    return all_data