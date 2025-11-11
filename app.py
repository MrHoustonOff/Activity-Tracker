# /ActivityTracker/app.py

import os
import sys
import threading
import json
import webview
import re 
from pathlib import Path
from flask import Flask, render_template, request, jsonify 
from database import (
    init_db, get_app_dir, add_activity, get_all_activities, get_all_data_for_export,
    delete_activity, add_log, get_logs_for_month, get_logs_for_day, delete_log
)


class Api:
    def export_data(self):
        """
        Открывает нативный диалог сохранения файла, получает данные из БД,
        и сохраняет их в выбранный пользователем файл.
        """
        try:
            # Получаем объект окна для вызова диалога
            window = webview.windows[0] 
            
            # Определяем папку "Документы" для начального отображения
            docs_path = str(Path.home() / 'Documents')
            
            result = window.create_file_dialog(
                webview.SAVE_DIALOG,
                directory=docs_path,
                save_filename='activity_tracker_data.json'
            )

            # Если пользователь выбрал файл и нажал "Сохранить" (result не None и не пустой)
            if result:
                file_path = result[0] # pywebview возвращает кортеж с одним путем
                
                # 1. Получаем данные из БД
                all_data = get_all_data_for_export()
                
                # 2. Конвертируем в JSON
                json_data = json.dumps(all_data, ensure_ascii=False, indent=2)
                
                # 3. Записываем в файл
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(json_data)
                
                return {'status': 'success', 'path': file_path}
            else:
                # Пользователь закрыл диалоговое окно
                return {'status': 'cancelled'}

        except Exception as e:
            print(f"Ошибка при экспорте: {e}")
            return {'status': 'error', 'message': str(e)}

def check_lock():
    app_dir = get_app_dir()
    lock_file_path = app_dir / 'app.lock'
    try:
        lock_file = os.open(lock_file_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.close(lock_file)
        return lock_file_path
    except FileExistsError:
        webview.create_window(
            "Ошибка",
            html="<h1 style='text-align:center; padding-top: 20px;'>Activity Tracker уже запущен.</h1>",
            width=400, height=100
        )
        sys.exit(1)

def release_lock(lock_file_path):
    if os.path.exists(lock_file_path):
        os.remove(lock_file_path)

app = Flask(__name__, template_folder='./templates', static_folder='./static')

app = Flask(__name__, template_folder='./templates', static_folder='./static')

# --- СТРАНИЦЫ ПРИЛОЖЕНИЯ ---

@app.route('/')
def index():
    """Отдает главную страницу - Календарь."""
    return render_template('index.html')

@app.route('/activities')
def activities_page():
    """Отдает страницу Управления активностями."""
    return render_template('activities.html')

# --- API ДЛЯ АКТИВНОСТЕЙ (Этап 1, без изменений) ---

@app.route('/api/activities', methods=['GET'])
def api_get_activities():
    return jsonify(get_all_activities())

@app.route('/api/activity', methods=['POST'])
def api_add_activity():
    data = request.get_json()
    name = data.get('name', '').strip()
    value_type = data.get('value_type')
    valid_types = ['checkmark', 'count', 'duration', 'text']
    if not name or not value_type or value_type not in valid_types:
        return jsonify({"success": False, "error": "Некорректные данные."}), 400
    result = add_activity(name, value_type)
    return jsonify(result), 201 if result["success"] else 409

@app.route('/api/activity/<int:activity_id>', methods=['DELETE'])
def api_delete_activity(activity_id):
    delete_activity(activity_id)
    return jsonify({"success": True})

@app.route('/api/logs/<int:year>/<int:month>', methods=['GET'])
def api_get_logs_for_month(year, month):
    """API: Получить все записи за месяц с учетом фильтра."""
    # --- НОВАЯ ЛОГИКА: Читаем GET-параметр filter_ids ---
    filter_ids_str = request.args.get('filter_ids')
    filter_ids = []
    if filter_ids_str:
        try:
            filter_ids = [int(id) for id in filter_ids_str.split(',')]
        except ValueError:
            return jsonify({"error": "Некорректный формат filter_ids"}), 400

    logs = get_logs_for_month(year, month, filter_ids)
    return jsonify(logs)

@app.route('/api/logs_by_day', methods=['GET'])
def api_get_logs_for_day():
    """API: Получить все записи за конкретный день."""
    date = request.args.get('date')
    if not date:
        return jsonify({"error": "Параметр 'date' обязателен"}), 400
    logs = get_logs_for_day(date)
    return jsonify(logs)

@app.route('/api/log', methods=['POST'])
def api_add_log():
    """API: Добавить запись в журнал."""
    data = request.get_json()
    activity_id = data.get('activity_id')
    date = data.get('date')
    value = data.get('value')
    
    # Проверяем тип активности, чтобы знать, нужно ли валидировать 'value'
    activity = next((act for act in get_all_activities() if act['id'] == int(activity_id)), None)

    if activity and activity['value_type'] == 'duration' and value:
        # Проверяем, что значение соответствует формату ЧЧ:ММ:СС
        if not re.match(r'^\d{2}:\d{2}:\d{2}$', value):
            return jsonify({"success": False, "error": "Неверный формат времени. Используйте ЧЧ:ММ:СС."}), 400

    if not all([activity_id, date]):
        return jsonify({"success": False, "error": "Некорректные данные."}), 400
        
    result = add_log(activity_id, date, value)
    return jsonify(result), 201


@app.route('/api/log/<int:log_id>', methods=['DELETE'])
def api_delete_log(log_id):
    """API: Удалить конкретную запись."""
    result = delete_log(log_id)
    return jsonify(result)

@app.route('/export')
def export_page():
    """Отдает страницу Экспорта."""
    return render_template('export.html')


if __name__ == '__main__':
    lock_file = check_lock()
    init_db()

    api = Api()
    
    def run_flask():
        app.run(host='127.0.0.1', port=5000)

    flask_thread = threading.Thread(target=run_flask)
    flask_thread.daemon = True
    flask_thread.start()
    
    window = webview.create_window(
        'Activity Tracker', 
        'http://127.0.0.1:5000/',
        js_api=api  # Вот магия
    )
    window.events.closed += lambda: release_lock(lock_file)
    webview.start()