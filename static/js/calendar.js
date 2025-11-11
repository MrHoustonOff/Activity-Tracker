// /ActivityTracker/static/js/calendar.js

document.addEventListener('DOMContentLoaded', () => {
    // Элементы календаря
    const calendarGrid = document.getElementById('calendar-grid');
    const currentMonthYearEl = document.getElementById('current-month-year');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');

    // Элементы модального окна
    const modal = document.getElementById('modal');
    const modalDateEl = document.getElementById('modal-date');
    const closeModalBtn = document.querySelector('.close-btn');
    const activitySelect = document.getElementById('modal-activity-select');
    const valueContainer = document.getElementById('modal-value-container');
    const saveLogBtn = document.getElementById('save-log-btn');
    const dayLogsList = document.getElementById('day-logs-list');
    const modalError = document.getElementById('modal-error');
    
    let currentDate = new Date();
    let activitiesCache = []; // Кэш для списка активностей

    // --- ЛОГИКА КАЛЕНДАРЯ ---

    const renderCalendar = async () => {
        // Очищаем старую сетку (кроме названий дней недели)
        while (calendarGrid.children.length > 7) {
            calendarGrid.removeChild(calendarGrid.lastChild);
        }

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        currentMonthYearEl.textContent = currentDate.toLocaleDateString('ru-RU', {
            month: 'long',
            year: 'numeric'
        });

        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0-Вс, 1-Пн
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Коррекция для `getDay()` (делаем понедельник первым днем - 0)
        const startDay = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;

        // Загружаем логи для текущего месяца
        const logs = await fetchLogs(year, month + 1);
        const activeDays = new Set(logs.map(log => log.date));

        // Добавляем пустые ячейки для дней предыдущего месяца
        for (let i = 0; i < startDay; i++) {
            calendarGrid.appendChild(document.createElement('div'));
        }

        // Добавляем ячейки дней текущего месяца
        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'day-cell';
            dayCell.textContent = day;
            const fullDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            dayCell.dataset.date = fullDate;

            if (activeDays.has(fullDate)) {
                dayCell.classList.add('active');
            }

            dayCell.addEventListener('click', () => openModal(fullDate));
            calendarGrid.appendChild(dayCell);
        }
    };

    // --- ЛОГИКА МОДАЛЬНОГО ОКНА ---

    const openModal = async (date) => {
        modalDateEl.textContent = new Date(date + 'T00:00:00').toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
        saveLogBtn.dataset.date = date;
        modalError.textContent = '';
        await populateActivitiesSelect();
        await renderDayLogs(date);
        modal.style.display = 'block';
    };
    
    const closeModal = () => {
        modal.style.display = 'none';
        valueContainer.innerHTML = ''; // Очищаем поле ввода
    };

    const populateActivitiesSelect = async () => {
        if (activitiesCache.length === 0) {
            const response = await fetch('/api/activities');
            activitiesCache = await response.json();
        }
        activitySelect.innerHTML = '<option value="">-- Выберите активность --</option>';
        activitiesCache.forEach(act => {
            const option = document.createElement('option');
            option.value = act.id;
            option.textContent = act.name;
            option.dataset.type = act.value_type;
            activitySelect.appendChild(option);
        });
    };

    const renderValueInput = (type) => {
        valueContainer.innerHTML = '';
        let input;
        switch(type) {
            case 'count':
                input = document.createElement('input');
                input.type = 'number';
                input.placeholder = 'Количество';
                input.step = '1';
                input.className = 'form-input';
                break;
            case 'duration':
                input = document.createElement('input');
                input.type = 'text';
                input.placeholder = 'ЧЧ:ММ:СС';
                input.className = 'form-input';
                break;
            case 'text':
                input = document.createElement('input');
                input.type = 'text';
                input.placeholder = 'Заметка';
                input.className = 'form-input';
                break;
            case 'checkmark': // Для отметки поле не нужно
            default:
                return;
        }
        input.id = 'modal-value-input';
        valueContainer.appendChild(input);
    };

    const renderDayLogs = async (date) => {
        dayLogsList.innerHTML = '<li>Загрузка...</li>';
        const logs = await fetchLogsForDay(date);
        dayLogsList.innerHTML = '';
        if (logs.length === 0) {
            dayLogsList.innerHTML = '<li>Записей нет.</li>';
            return;
        }
        logs.forEach(log => {
            const li = document.createElement('li');
            li.textContent = `${log.activity_name}${log.value ? `: ${log.value}` : ''}`;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Удалить';
            deleteBtn.className = 'delete-btn-small';
            deleteBtn.onclick = async () => {
                await deleteLog(log.id);
                renderDayLogs(date); // Обновляем список
                renderCalendar(); // Обновляем календарь (подсветку)
            };
            li.appendChild(deleteBtn);
            dayLogsList.appendChild(li);
        });
    };

    // --- ВЗАИМОДЕЙСТВИЕ С API ---

    const fetchLogs = async (year, month) => {
        const response = await fetch(`/api/logs/${year}/${month}`);
        return await response.json();
    };

    const fetchLogsForDay = async (date) => {
        const response = await fetch(`/api/logs_by_day?date=${date}`);
        return await response.json();
    };

    const saveLog = async () => {
        const activityId = activitySelect.value;
        const date = saveLogBtn.dataset.date;
        const valueInput = document.getElementById('modal-value-input');
        const value = valueInput ? valueInput.value.trim() : null;

        if (!activityId) {
            modalError.textContent = 'Пожалуйста, выберите активность.';
            return;
        }
        
        const response = await fetch('/api/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activity_id: activityId, date, value })
        });

        if (response.ok) {
            modalError.textContent = '';
            activitySelect.value = '';
            valueContainer.innerHTML = '';
            await renderDayLogs(date);
        } else {
            modalError.textContent = 'Ошибка сохранения.';
        }
    };
    
    const deleteLog = async (logId) => {
        await fetch(`/api/log/${logId}`, { method: 'DELETE' });
    };

    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---

    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    activitySelect.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        renderValueInput(selectedOption.dataset.type);
    });
    
    saveLogBtn.addEventListener('click', async () => {
        await saveLog();
        renderCalendar(); // Перерисовываем календарь для обновления подсветки
    });

    // --- ИНИЦИАЛИЗАЦИЯ ---
    renderCalendar();
});