document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('export-btn');
    const statusEl = document.getElementById('export-status');

    exportBtn.addEventListener('click', async () => {
        statusEl.textContent = 'Подготовка данных...';
        exportBtn.disabled = true;

        try {
            // Вызываем Python-функцию export_data из нашего класса Api,
            // которую мы "пробросили" через js_api.
            // pywebview автоматически создает объект window.pywebview.api
            const result = await window.pywebview.api.export_data();

            if (result.status === 'success') {
                statusEl.textContent = `Данные успешно сохранены в файл: ${result.path}`;
                statusEl.style.color = 'green';
            } else if (result.status === 'cancelled') {
                statusEl.textContent = 'Экспорт отменен пользователем.';
                statusEl.style.color = '#666';
            } else {
                // Обработка ошибок, которые могли произойти на стороне Python
                statusEl.textContent = `Произошла ошибка: ${result.message}`;
                statusEl.style.color = 'red';
            }

        } catch (error) {
            console.error('Ошибка вызова Python API:', error);
            statusEl.textContent = 'Произошла критическая ошибка при вызове функции экспорта.';
            statusEl.style.color = 'red';
        } finally {
            exportBtn.disabled = false;
        }
    });
});