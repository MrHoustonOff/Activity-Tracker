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
    
    const filterContainer = document.getElementById('filter-container');

    // Элементы навигации по дате
    const toggleNavBtn = document.getElementById('toggle-nav-btn');
    const dateSelector = document.getElementById('date-selector');
    const yearSelect = document.getElementById('year-select');
    const monthSelect = document.getElementById('month-select');
    const goToDateBtn = document.getElementById('go-to-date-btn');

    let currentDate = new Date();
    let activitiesCache = []; // Кэш для списка активностей

    // --- ЛОГИКА КАЛЕНДАРЯ ---

    const renderFilterControls = async () => {
        if (activitiesCache.length === 0) {
            const response = await fetch('/api/activities');
            activitiesCache = await response.json();
        }

        filterContainer.innerHTML = '<strong>Фильтр:</strong>'; // Очищаем
        
        // Чекбокс "Все"
        const allLabel = document.createElement('label');
        allLabel.innerHTML = '<input type="checkbox" value="all" checked> Все';
        filterContainer.appendChild(allLabel);

        // Чекбоксы для каждой активности
        activitiesCache.forEach(act => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${act.id}"> ${act.name}`;
            filterContainer.appendChild(label);
        });

        // Добавляем слушатель событий на весь контейнер
        filterContainer.addEventListener('change', handleFilterChange);
    };
    
    const handleFilterChange = (e) => {
        const allCheckbox = filterContainer.querySelector('input[value="all"]');
        const activityCheckboxes = filterContainer.querySelectorAll('input[type="checkbox"]:not([value="all"])');

        // Логика работы чекбокса "Все"
        if (e.target.value === 'all') {
            activityCheckboxes.forEach(cb => cb.checked = false);
        } else if (e.target.checked) {
            allCheckbox.checked = false;
        }

        // Если ни один чекбокс не выбран, выбираем "Все"
        const anyChecked = Array.from(filterContainer.querySelectorAll('input[type="checkbox"]')).some(cb => cb.checked);
        if (!anyChecked) {
            allCheckbox.checked = true;
        }

        renderCalendar(); // Перерисовываем календарь с новыми фильтрами
    };

    const getSelectedFilterIDs = () => {
        const allCheckbox = filterContainer.querySelector('input[value="all"]');
        if (allCheckbox.checked) {
            return []; // Пустой массив означает "без фильтра"
        }
        return Array.from(filterContainer.querySelectorAll('input[type="checkbox"]:not([value="all"]):checked'))
            .map(cb => cb.value);
    };

    const renderCalendar = async () => {
        // 1. Очистка и подготовка
        while (calendarGrid.children.length > 7) {
            calendarGrid.removeChild(calendarGrid.lastChild);
        }

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        currentMonthYearEl.textContent = currentDate.toLocaleDateString('ru-RU', {
            month: 'long',
            year: 'numeric'
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 2. Получение данных с учетом фильтра
        const filterIDs = getSelectedFilterIDs();
        const logs = await fetchLogs(year, month + 1, filterIDs);

        // 3. Анализ активных дней согласно логике фильтра
        const activeDays = new Set();
        if (filterIDs.length > 0) { // Логика "И"
            const logsByDate = logs.reduce((acc, log) => {
                acc[log.date] = acc[log.date] || new Set();
                acc[log.date].add(log.activity_id.toString());
                return acc;
            }, {});

            for (const date in logsByDate) {
                const loggedActivityIDs = logsByDate[date];
                const allFiltersPresent = filterIDs.every(id => loggedActivityIDs.has(id));
                if (allFiltersPresent) {
                    activeDays.add(date);
                }
            }
        } else { // Логика "Все"
            logs.forEach(log => activeDays.add(log.date));
        }

        // 4. Рендеринг сетки
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDay = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;

        for (let i = 0; i < startDay; i++) {
            calendarGrid.appendChild(document.createElement('div'));
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'day-cell';
            dayCell.textContent = day;
            
            const fullDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            dayCell.dataset.date = fullDate;
            const cellDate = new Date(fullDate + 'T00:00:00');

            // Логика окрашивания
            if (activeDays.has(fullDate)) {
                dayCell.classList.add('active');
            } else if (cellDate < today) {
                dayCell.classList.add('missed');
            }

            // ВАЖНО: Эти две строки находятся ВНЕ условных блоков if/else,
            // но ВНУТРИ цикла for. Это гарантирует, что каждая ячейка будет
            // добавлена в календарь.
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

    const fetchLogs = async (year, month, filterIDs = []) => {
        let url = `/api/logs/${year}/${month}`;
        if (filterIDs.length > 0) {
            url += `?filter_ids=${filterIDs.join(',')}`;
        }
        const response = await fetch(url);
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

    const populateDateSelector = () => {
        const currentYear = new Date().getFullYear();
        // Годы: текущий +/- 5 лет
        for (let i = currentYear - 5; i <= currentYear + 5; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            yearSelect.appendChild(option);
        }
        // Месяцы
        const months = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
        months.forEach((month, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = month;
            monthSelect.appendChild(option);
        });
    };
    
    toggleNavBtn.addEventListener('click', () => {
        dateSelector.classList.toggle('hidden');
        if (!dateSelector.classList.contains('hidden')) {
            // Устанавливаем текущие значения в селекторы
            yearSelect.value = currentDate.getFullYear();
            monthSelect.value = currentDate.getMonth();
        }
    });

    goToDateBtn.addEventListener('click', () => {
        const newYear = parseInt(yearSelect.value);
        const newMonth = parseInt(monthSelect.value);
        currentDate = new Date(newYear, newMonth, 1);
        renderCalendar();
        dateSelector.classList.add('hidden');
    });

    // --- ИНИЦИАЛИЗАЦИЯ ---
        const init = async () => {
        await renderFilterControls();
        populateDateSelector();
        await renderCalendar();
    };


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
    init();
});