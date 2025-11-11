// /ActivityTracker/static/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    const activityList = document.getElementById('activity-list');
    const newActivityInput = document.getElementById('new-activity-name');
    const newActivityTypeSelect = document.getElementById('new-activity-type'); // Новый элемент
    const addActivityBtn = document.getElementById('add-activity-btn');
    const errorMessage = document.getElementById('error-message');

    // Словарь для отображения типов на русском языке
    const typeDisplayNames = {
        checkmark: 'Отметка',
        count: 'Количество',
        duration: 'Время',
        text: 'Текст'
    };

    const fetchActivities = async () => {
        try {
            const response = await fetch('/api/activities');
            if (!response.ok) throw new Error('Ошибка при загрузке активностей');
            const activities = await response.json();
            renderActivities(activities);
        } catch (error) {
            console.error(error);
            errorMessage.textContent = 'Не удалось загрузить список активностей.';
        }
    };

    // --- ИЗМЕНЕНИЕ ЗДЕСЬ: Функция теперь принимает name и type ---
    const addActivity = async (name, type) => {
        if (!name || !type) return;
        try {
            const response = await fetch('/api/activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name, value_type: type }) // Отправляем оба поля
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Ошибка при добавлении');
            
            newActivityInput.value = '';
            errorMessage.textContent = '';
            fetchActivities(); // Обновляем список
        } catch (error) {
            console.error(error);
            errorMessage.textContent = error.message;
        }
    };

    const deleteActivity = async (id) => {
        if (!confirm('Вы уверены? Все связанные записи также будут удалены.')) return;
        try {
            const response = await fetch(`/api/activity/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Ошибка при удалении');
            fetchActivities();
        } catch (error) {
            console.error(error);
            errorMessage.textContent = 'Не удалось удалить активность.';
        }
    };

    // --- ИЗМЕНЕНИЕ ЗДЕСЬ: Рендеринг теперь включает отображение типа ---
    const renderActivities = (activities) => {
        activityList.innerHTML = '';
        if (activities.length === 0) {
            activityList.innerHTML = '<li>Список активностей пуст.</li>';
            return;
        }
        activities.forEach(activity => {
            const li = document.createElement('li');
            li.dataset.id = activity.id;

            const textContainer = document.createElement('div');
            const nameSpan = document.createElement('span');
            nameSpan.textContent = activity.name;
            nameSpan.className = 'activity-name';

            const typeSpan = document.createElement('span');
            typeSpan.textContent = typeDisplayNames[activity.value_type] || activity.value_type;
            typeSpan.className = 'activity-type';

            textContainer.appendChild(nameSpan);
            textContainer.appendChild(typeSpan);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Удалить';
            deleteBtn.classList.add('delete-btn');
            deleteBtn.onclick = () => deleteActivity(activity.id);

            li.appendChild(textContainer);
            li.appendChild(deleteBtn);
            activityList.appendChild(li);
        });
    };

    addActivityBtn.addEventListener('click', () => {
        const name = newActivityInput.value.trim();
        const type = newActivityTypeSelect.value;
        addActivity(name, type);
    });

    newActivityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addActivityBtn.click(); // Симулируем клик для единой логики
        }
    });

    fetchActivities();
});