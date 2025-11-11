document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const moonIcon = '🌙';
    const sunIcon = '☀️';

    // Функция для применения темы
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            themeToggle.textContent = sunIcon;
        } else {
            document.body.classList.remove('dark-theme');
            themeToggle.textContent = moonIcon;
        }
    };

    // Получаем сохраненную тему или используем системные настройки
    let currentTheme = localStorage.getItem('theme') || 
                       (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    applyTheme(currentTheme);

    // Обработчик клика
    themeToggle.addEventListener('click', () => {
        currentTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
        localStorage.setItem('theme', currentTheme);
        applyTheme(currentTheme);
    });
});