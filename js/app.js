(() => {
  "use strict";

  const KEY = "habits-diary-v1";
  const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const date = (y, m, d) => new Date(y, m, d, 12);
  const add = (d, n) => date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const monday = (d) => add(d, -(d.getDay() + 6) % 7);
  const fmt = (d) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  const monthfmt = (d) => d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

  let state = { habits: [], marks: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (validState(saved)) state = saved;
  } catch (error) {
    console.warn("Не удалось прочитать сохранение", error);
  }

  function validState(data) {
    return !!(
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      Array.isArray(data.habits) &&
      data.habits.every(
        (habit) =>
          habit &&
          typeof habit.id === "string" &&
          habit.id.length > 0 &&
          typeof habit.name === "string" &&
          habit.name.trim().length > 0 &&
          habit.name.length <= 60 &&
          Array.isArray(habit.days) &&
          habit.days.every((n) => Number.isInteger(n) && n >= 0 && n <= 6)
      ) &&
      new Set(data.habits.map((habit) => habit.id)).size === data.habits.length &&
      data.marks &&
      typeof data.marks === "object" &&
      !Array.isArray(data.marks) &&
      Object.entries(data.marks).every(
        ([id, days]) =>
          data.habits.some((habit) => habit.id === id) &&
          days &&
          typeof days === "object" &&
          !Array.isArray(days) &&
          Object.entries(days).every(([day, value]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && value === true)
      )
    );
  }

  let week = monday(new Date());
  let month = date(new Date().getFullYear(), new Date().getMonth(), 1);
  let editing = null;

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      $("storage-warning").hidden = true;
      return true;
    } catch (error) {
      const warning = $("storage-warning");
      warning.hidden = false;
      warning.textContent = "⚠ Не удалось сохранить данные. Проверьте настройки браузера и скачайте резервную копию.";
      return false;
    }
  }

  function planned(habit, day) {
    return habit.days.includes((day.getDay() + 6) % 7);
  }

  function marked(habit, day) {
    return !!state.marks[habit.id]?.[key(day)];
  }

  function summary(from, to, habit = null) {
    let plannedCount = 0;
    let completed = 0;
    for (let day = new Date(from); day <= to; day = add(day, 1)) {
      for (const item of habit ? [habit] : state.habits) {
        if (planned(item, day)) plannedCount += 1;
        if (marked(item, day)) completed += 1;
      }
    }
    return { p: plannedCount, c: completed, rate: plannedCount ? Math.round((completed / plannedCount) * 100) : 0 };
  }

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function render() {
    const end = add(week, 6);
    $("range").textContent = `${fmt(week)} — ${fmt(end)}`;
    const today = key(new Date());

    for (let i = 0; i < 7; i += 1) {
      const day = add(week, i);
      $("d" + i).textContent = `${DAYS[i]} ${day.getDate()}`;
      $("d" + i).className = key(day) === today ? "today" : "";
    }

    const body = $("tbody");
    body.replaceChildren();

    if (!state.habits.length) {
      const tr = el("tr");
      const td = el("td", "Пока нет привычек. Нажмите «Добавить привычку».", "empty");
      td.colSpan = 9;
      tr.append(td);
      body.append(tr);
    }

    for (const habit of state.habits) {
      const tr = el("tr");
      const first = el("td");
      first.append(el("strong", habit.name), el("small", habit.days.map((i) => DAYS[i]).join(", ")));
      tr.append(first);

      for (let i = 0; i < 7; i += 1) {
        const day = add(week, i);
        const td = el("td");
        if (key(day) === today) td.className = "today";
        const input = el("input");
        input.type = "checkbox";
        input.className = "tick";
        input.disabled = day > date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
        input.checked = marked(habit, day);
        input.setAttribute(
          "aria-label",
          `${habit.name}, ${key(day)}${planned(habit, day) ? " (по плану)" : " (дополнительное занятие)"}`
        );
        input.addEventListener("change", () => {
          state.marks[habit.id] ??= {};
          if (input.checked) state.marks[habit.id][key(day)] = true;
          else delete state.marks[habit.id][key(day)];
          save();
          render();
        });
        if (!planned(habit, day)) td.classList.add("extra-day");
        td.append(input);
        tr.append(td);
      }

      const td = el("td");
      const actions = el("div", undefined, "actions");
      const edit = el("button", "✎", "iconbtn");
      const del = el("button", "✕", "iconbtn");
      edit.title = "Изменить";
      del.title = "Удалить";
      edit.addEventListener("click", () => open(habit));
      del.addEventListener("click", () => {
        if (confirm(`Удалить привычку «${habit.name}» и всю историю её выполнения?`)) {
          state.habits = state.habits.filter((item) => item.id !== habit.id);
          delete state.marks[habit.id];
          save();
          render();
        }
      });
      actions.append(edit, del);
      td.append(actions);
      tr.append(td);
      body.append(tr);
    }

    const weekSummary = summary(week, end);
    $("done").textContent = weekSummary.c;
    $("planned").textContent = weekSummary.p;
    $("rate").textContent = weekSummary.p ? weekSummary.rate + "%" : "—";
    $("weekpercent").textContent = weekSummary.p ? weekSummary.rate + "%" : "—";
    $("weekprogress").style.width = Math.min(100, weekSummary.rate) + "%";

    const now = date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const elapsedEnd = now < week ? null : now > end ? end : now;
    const elapsed = elapsedEnd ? summary(week, elapsedEnd) : { p: 0, c: 0, rate: 0 };
    $("elapsed").textContent = elapsedEnd
      ? `По наступившим дням: факт ${elapsed.c}, план ${elapsed.p} · ${elapsed.p ? elapsed.rate + "%" : "план отсутствует"}${elapsed.c > elapsed.p ? " · сверх плана +" + (elapsed.c - elapsed.p) : ""}`
      : "Эта неделя ещё не началась";

    const breakdown = $("breakdown");
    breakdown.replaceChildren();
    for (const habit of state.habits) {
      const itemSummary = summary(week, end, habit);
      const line = el("div", undefined, "habitline");
      line.append(
        el("span", habit.name),
        el(
          "strong",
          `факт ${itemSummary.c} / план ${itemSummary.p} · ${itemSummary.p ? itemSummary.rate + "%" : "—"}${itemSummary.c > itemSummary.p ? " · +" + (itemSummary.c - itemSummary.p) : ""}`
        )
      );
      breakdown.append(line);
    }
    if (!state.habits.length) breakdown.append(el("p", "Добавьте первую привычку.", "muted"));
    renderMonth();
  }

  function renderMonth() {
    $("monthlabel").textContent = monthfmt(month);
    const last = date(month.getFullYear(), month.getMonth() + 1, 0);
    const monthSummary = summary(month, last);
    $("monthpercent").textContent = monthSummary.p ? monthSummary.rate + "%" : "—";
    $("monthdetail").textContent = `Факт: ${monthSummary.c}, план: ${monthSummary.p}${monthSummary.c > monthSummary.p ? " · сверх плана +" + (monthSummary.c - monthSummary.p) : ""}`;

    const chart = $("chart");
    chart.replaceChildren();
    let start = new Date(month);
    while (start <= last) {
      const finish = add(start, 6 - ((start.getDay() + 6) % 7));
      const stop = finish > last ? last : finish;
      const weekSummary = summary(start, stop);
      const block = el("div", undefined, "weekbar");
      block.append(el("strong", weekSummary.p ? weekSummary.rate + "%" : "—"));
      const col = el("div", undefined, "column");
      const fill = el("div");
      fill.style.height = Math.min(100, weekSummary.rate) + "%";
      col.append(fill);
      block.append(col, el("span", `${start.getDate()}–${stop.getDate()}`));
      block.title = `${weekSummary.c} из ${weekSummary.p}`;
      chart.append(block);
      start = add(stop, 1);
    }
  }

  function open(habit = null) {
    editing = habit?.id || null;
    $("modaltitle").textContent = habit ? "Изменить привычку" : "Новая привычка";
    $("name").value = habit?.name || "";
    const days = $("daychecks");
    days.replaceChildren();
    DAYS.forEach((name, index) => {
      const label = el("label");
      const input = el("input");
      input.type = "checkbox";
      input.value = index;
      input.checked = habit ? habit.days.includes(index) : true;
      label.append(el("span", name), input);
      days.append(label);
    });
    $("modal").hidden = false;
    $("name").focus();
  }

  function close() {
    $("modal").hidden = true;
    editing = null;
  }

  $("add").onclick = () => open();
  $("cancel").onclick = close;
  $("modal").addEventListener("click", (event) => {
    if (event.target === $("modal")) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  $("form").onsubmit = (event) => {
    event.preventDefault();
    const name = $("name").value.trim();
    const days = [...$("daychecks").querySelectorAll("input:checked")].map((input) => Number(input.value));
    if (!name) return;
    if (!days.length) {
      alert("Выберите хотя бы один день недели.");
      return;
    }
    if (editing) {
      const habit = state.habits.find((item) => item.id === editing);
      if (habit) {
        habit.name = name;
        habit.days = days;
      }
    } else {
      state.habits.push({ id: uid(), name, days });
    }
    save();
    close();
    render();
  };

  $("prev").onclick = () => {
    week = add(week, -7);
    render();
  };
  $("next").onclick = () => {
    week = add(week, 7);
    render();
  };
  $("current").onclick = () => {
    week = monday(new Date());
    month = date(new Date().getFullYear(), new Date().getMonth(), 1);
    render();
  };
  $("monthprev").onclick = () => {
    month = date(month.getFullYear(), month.getMonth() - 1, 1);
    renderMonth();
  };
  $("monthnext").onclick = () => {
    month = date(month.getFullYear(), month.getMonth() + 1, 1);
    renderMonth();
  };

  $("export").onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "moi-privychki-" + key(new Date()) + ".json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  $("import").onclick = () => $("file").click();
  $("file").onchange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!validState(data)) throw Error("Неверный формат");
      if (confirm("Заменить текущие данные данными из резервной копии?")) {
        const previous = state;
        state = { habits: data.habits, marks: data.marks };
        if (!save()) state = previous;
        render();
      }
    } catch (error) {
      alert("Не удалось прочитать файл: " + error.message);
    }
    event.target.value = "";
  };

  const helpModal = $("helpModal");
  const helpOpen = $("help");
  const closeHelp = () => {
    helpModal.hidden = true;
    helpOpen.focus();
  };
  helpOpen.addEventListener("click", () => {
    helpModal.hidden = false;
    $("helpClose").focus();
  });
  $("helpClose").addEventListener("click", closeHelp);
  $("helpOk").addEventListener("click", closeHelp);
  helpModal.addEventListener("click", (event) => {
    if (event.target === helpModal) closeHelp();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !helpModal.hidden) closeHelp();
  });

  const demoButton = $("demo");
  if (demoButton) {
    demoButton.addEventListener("click", () => {
      if (state.habits.length && !confirm("Добавить примеры к текущим привычкам?")) return;
      const waterId = uid();
      const walkId = uid();
      const readId = uid();
      const today = new Date();
      const start = monday(today);
      state.habits.push(
        { id: waterId, name: "Стакан воды утром", days: [0, 1, 2, 3, 4, 5, 6] },
        { id: walkId, name: "Прогулка 20 минут", days: [0, 2, 4] },
        { id: readId, name: "Чтение 10 страниц", days: [1, 3, 6] }
      );
      state.marks[waterId] = {};
      state.marks[walkId] = {};
      state.marks[readId] = {};
      for (let i = 0; i < 7; i += 1) {
        const day = add(start, i);
        if (day > today) continue;
        if (i !== 5) state.marks[waterId][key(day)] = true;
        if ([0, 2].includes(i)) state.marks[walkId][key(day)] = true;
        if ([1, 3].includes(i) || i === 5) state.marks[readId][key(day)] = true;
      }
      save();
      render();
    });
  }

  render();
})();
