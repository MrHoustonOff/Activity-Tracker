# /ActivityTracker/app.py

import os
import sys
import threading
import webview
from flask import Flask, render_template, request, jsonify
from database import init_db, get_app_dir, add_activity, get_all_activities, delete_activity

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

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/activities', methods=['GET'])
def api_get_activities():
    activities = get_all_activities()
    return jsonify(activities)

@app.route('/api/activity', methods=['POST'])
def api_add_activity():
    """API: Создать новую активность с указанием типа."""
    data = request.get_json()
    name = data.get('name', '').strip()
    value_type = data.get('value_type')
    
    # Валидация входных данных
    valid_types = ['checkmark', 'count', 'duration', 'text']
    if not name or not value_type:
        return jsonify({"success": False, "error": "Имя и тип активности обязательны."}), 400
    if value_type not in valid_types:
        return jsonify({"success": False, "error": "Недопустимый тип активности."}), 400
    
    result = add_activity(name, value_type)
    
    if result["success"]:
        return jsonify(result), 201
    else:
        return jsonify(result), 409

@app.route('/api/activity/<int:activity_id>', methods=['DELETE'])
def api_delete_activity(activity_id):
    delete_activity(activity_id)
    return jsonify({"success": True, "message": "Активность удалена."})

if __name__ == '__main__':
    lock_file = check_lock()
    init_db()

    def run_flask():
        app.run(host='127.0.0.1', port=5000)

    flask_thread = threading.Thread(target=run_flask)
    flask_thread.daemon = True
    flask_thread.start()

    window = webview.create_window('Activity Tracker', 'http://127.0.0.1:5000')
    window.events.closed += lambda: release_lock(lock_file)
    webview.start()