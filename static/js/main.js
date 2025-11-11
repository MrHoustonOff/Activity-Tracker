// /ActivityTracker/static/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    const activityList = document.getElementById('activity-list');
    const newActivityInput = document.getElementById('new-activity-name');
    const addActivityBtn = document.getElementById('add-activity-btn');
    const errorMessage = document.getElementById('error-message');

    // --- Функции для работы с API ---

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

    const addActivity = async (name) => {
        if (!name) return;
        try {
            const response = await fetch('/api/activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Ошибка при добавлении активности');
            }
            
            newActivityInput.value = '';
            errorMessage.textContent = '';
            fetchActivities(); // Обновляем список
        } catch (error) {
            console.error(error);
            errorMessage.textContent = error.message;
        }
    };

    const deleteActivity = async (id) => {
        if (!confirm('Вы уверены, что хотите удалить эту активность? Все связанные записи также будут удалены.')) {
            return;
        }
        try {
            const response = await fetch(`/api/activity/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Ошибка при удалении');
            fetchActivities(); // Обновляем список
        } catch (error) {
            console.error(error);
            errorMessage.textContent = 'Не удалось удалить активность.';
        }
    };

    // --- Рендеринг и события ---

    const renderActivities = (activities) => {
        activityList.innerHTML = ''; // Очищаем список перед рендером
        if (activities.length === 0) {
            activityList.innerHTML = '<li>Список активностей пуст.</li>';
            return;
        }
        activities.forEach(activity => {
            const li = document.createElement('li');
            li.textContent = activity.name;
            li.dataset.id = activity.id;

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Удалить';
            deleteBtn.classList.add('delete-btn');
            deleteBtn.onclick = () => deleteActivity(activity.id);

            li.appendChild(deleteBtn);
            activityList.appendChild(li);
        });
    };

    addActivityBtn.addEventListener('click', () => {
        addActivity(newActivityInput.value.trim());
    });

    newActivityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addActivity(newActivityInput.value.trim());
        }
    });

    // --- Инициализация ---
    fetchActivities();
});