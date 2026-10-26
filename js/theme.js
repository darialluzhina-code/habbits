(function () {
  const themeKey = "habits-diary-theme";
  const button = document.getElementById("themeToggle");
  if (!button) return;

  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem(themeKey);
  } catch (error) {
    /* Хранилище может быть недоступно. */
  }

  const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

  function applyTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    button.textContent = dark ? "☀" : "☾";
    button.setAttribute("aria-label", dark ? "Включить светлую тему" : "Включить тёмную тему");
    button.title = dark ? "Светлая тема" : "Тёмная тема";
    button.setAttribute("aria-pressed", String(dark));
  }

  applyTheme(savedTheme === "dark" || savedTheme === "light" ? savedTheme : systemDark ? "dark" : "light");

  button.addEventListener("click", function () {
    const nextTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    try {
      localStorage.setItem(themeKey, nextTheme);
    } catch (error) {
      /* Переключение всё равно работает. */
    }
  });
})();
