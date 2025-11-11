# /ActivityTracker/app.py

import os
import sys
import threading
import webview
from flask import Flask, render_template, request, jsonify
from database import init_db, get_app_dir, add_activity, get_all_activities, delete_activity

# --- Этап 0: Ядро - Механизм блокировки ---
def check_lock():
    """Проверяет и создает lock-файл, чтобы предотвратить двойной запуск."""
    app_dir = get_app_dir()
    lock_file_path = app_dir / 'app.lock'
    
    try:
        # Создаем эксклюзивный файл. Если он уже существует, будет ошибка.
        lock_file = os.open(lock_file_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.close(lock_file)
        return lock_file_path
    except FileExistsError:
        # Приложение уже запущено
        print("Приложение уже запущено. Завершение работы.")
        # Показываем системное уведомление и выходим
        webview.create_window(
            "Ошибка",
            html="<h1 style='text-align:center; padding-top: 20px;'>Activity Tracker уже запущен.</h1>",
            width=400,
            height=100
        )
        sys.exit(1)

def release_lock(lock_file_path):
    """Удаляет lock-файл при закрытии приложения."""
    if os.path.exists(lock_file_path):
        os.remove(lock_file_path)

# --- Инициализация Flask ---
app = Flask(__name__, template_folder='./templates', static_folder='./static')

# --- API Endpoints для Этапа 1 ---

@app.route('/')
def index():
    """Отдает главную HTML-страницу."""
    # В будущем здесь будет навигация, сейчас сразу показываем управление активностями
    return render_template('index.html')

@app.route('/api/activities', methods=['GET'])
def api_get_activities():
    """API: Получить все активности."""
    activities = get_all_activities()
    return jsonify(activities)

@app.route('/api/activity', methods=['POST'])
def api_add_activity():
    """API: Создать новую активность."""
    data = request.get_json()
    if not data or 'name' not in data or not data['name'].strip():
        return jsonify({"success": False, "error": "Имя активности не может быть пустым."}), 400
    
    result = add_activity(data['name'].strip())
    
    if result["success"]:
        return jsonify(result), 201
    else:
        return jsonify(result), 409 # 409 Conflict - такой ресурс уже существует

@app.route('/api/activity/<int:activity_id>', methods=['DELETE'])
def api_delete_activity(activity_id):
    """API: Удалить активность."""
    delete_activity(activity_id)
    return jsonify({"success": True, "message": "Активность удалена."})

# --- Основная логика запуска ---
if __name__ == '__main__':
    # Этап 0: Блокировка и инициализация БД
    lock_file = check_lock()
    init_db()

    # Запускаем Flask в отдельном потоке
    def run_flask():
        app.run(host='127.0.0.1', port=5000)

    flask_thread = threading.Thread(target=run_flask)
    flask_thread.daemon = True
    flask_thread.start()

    # Создаем окно pywebview
    window = webview.create_window('Activity Tracker', 'http://127.0.0.1:5000')
    # При закрытии окна - снимаем блокировку
    window.events.closed += lambda: release_lock(lock_file)
    webview.start()