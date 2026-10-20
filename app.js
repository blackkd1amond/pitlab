/* ПитЛаб – мини-приложение Telegram (MVP)
   Команда «Белая стрела». Все данные пользователя хранятся в его Telegram
   (CloudStorage), а если приложение открыто просто в браузере – в localStorage. */
(function () {
  "use strict";

  const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData !== undefined
    ? window.Telegram.WebApp : null;
  if (tg) {
    try { tg.ready(); tg.expand(); tg.setHeaderColor("#F5F9F5"); tg.setBackgroundColor("#F5F9F5"); } catch (e) {}
  }
  const P = window.PRODUCTS, L = window.LESSONS, KT = window.KNOWLEDGE_TEST, CH = window.CHALLENGES;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const r0 = x => Math.round(x);
  const r1 = x => Math.round(x * 10) / 10;
  const haptic = (t = "light") => { try { tg && tg.HapticFeedback.impactOccurred(t); } catch (e) {} };

  // ---------------------------------------------------------------- Хранилище
  const hasCloud = !!(tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast("6.9"));
  const Store = {
    data: {}, timers: {},
    async init() {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("pl_")) { try { this.data[k.slice(3)] = JSON.parse(localStorage.getItem(k)); } catch (e) {} }
      }
      if (!hasCloud) return;
      try {
        const keys = await new Promise((res, rej) => tg.CloudStorage.getKeys((e, k) => e ? rej(e) : res(k || [])));
        for (let i = 0; i < keys.length; i += 20) {
          const part = keys.slice(i, i + 20);
          const vals = await new Promise((res, rej) => tg.CloudStorage.getItems(part, (e, v) => e ? rej(e) : res(v || {})));
          for (const k of part) {
            if (!vals[k]) continue;
            try {
              const cloud = JSON.parse(vals[k]);
              const local = this.data[k];
              if (!local || (cloud.u || 0) > (local.u || 0)) { this.data[k] = cloud; localStorage.setItem("pl_" + k, vals[k]); }
            } catch (e) {}
          }
        }
      } catch (e) { console.warn("CloudStorage недоступен", e); }
    },
    get(k, def) { const w = this.data[k]; return w && w.v !== undefined ? w.v : def; },
    set(k, v) {
      const w = { u: Date.now(), v };
      this.data[k] = w;
      const s = JSON.stringify(w);
      try { localStorage.setItem("pl_" + k, s); } catch (e) {}
      if (hasCloud) {
        clearTimeout(this.timers[k]);
        this.timers[k] = setTimeout(() => { try { tg.CloudStorage.setItem(k, s); } catch (e) {} }, 400);
      }
    },
    remove(k) {
      delete this.data[k];
      try { localStorage.removeItem("pl_" + k); } catch (e) {}
      if (hasCloud) { try { tg.CloudStorage.removeItem(k); } catch (e) {} }
    },
    keys() { return Object.keys(this.data); },
  };

  // ---------------------------------------------------------------- Даты
  const pad = n => String(n).padStart(2, "0");
  const dkey = (d = new Date()) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const human = d => {
    const t = dkey(), k = dkey(d);
    if (k === t) return "Сегодня";
    if (k === dkey(addDays(new Date(), -1))) return "Вчера";
    return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${WD[d.getDay()]}`;
  };
  const weekStart = (d = new Date()) => { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); x.setHours(0, 0, 0, 0); return x; };

  // ---------------------------------------------------------------- Норма
  const ACT = [
    { id: 0, label: "1–2 тренировки в неделю", pal: 1.5 },
    { id: 1, label: "3–4 тренировки", pal: 1.65 },
    { id: 2, label: "5 и больше", pal: 1.8 },
  ];
  const GOALS = { lose: "Сбросить лишнее", keep: "Держать форму", gain: "Набрать мышцы" };

  function calcNorm(p) {
    // Основной обмен по формуле Шофилда для 10–18 лет (по весу)
    const bmr = p.sex === "m" ? 17.686 * p.w + 658.2 : 13.384 * p.w + 692.6;
    const pal = (ACT[p.act] || ACT[0]).pal;
    let goal = p.goal, note = "";
    const bmi = p.w / Math.pow(p.h / 100, 2);
    if (goal === "lose" && bmi < 18.5) {
      goal = "keep";
      note = "Судя по росту и весу, худеть тебе не нужно. Мы рассчитали норму, чтобы ты рос, был сильнее и бодрее. Если переживаешь о весе – поговори с врачом.";
    }
    let kcal = bmr * pal;
    if (goal === "lose") kcal *= 0.9;   // мягко, не больше −10%
    if (goal === "gain") kcal *= 1.1;
    const floor = Math.max(bmr * 1.4, p.sex === "m" ? 2000 : 1800); // ниже не опускаемся
    if (kcal < floor) kcal = floor;
    kcal = Math.round(kcal / 10) * 10;
    let prot = p.w * (goal === "gain" ? 1.6 : 1.4);
    prot = Math.min(prot, (kcal * 0.25) / 4);
    const fat = (kcal * 0.3) / 9;
    const carb = (kcal - prot * 4 - fat * 9) / 4;
    return { kcal, p: r0(prot), f: r0(fat), c: r0(carb), bmr: r0(bmr), goal, note, bmi: r1(bmi) };
  }

  // ---------------------------------------------------------------- Дни
  const emptyDay = () => ({ e: [], w: 0, t: 0, m: 0, ns: 0 });
  const getDay = k => Object.assign(emptyDay(), Store.get("day_" + k, {}));
  const setDay = (k, d) => Store.set("day_" + k, d);
  const MEALS = [
    { id: "b", label: "Завтрак", icon: "🍳" },
    { id: "l", label: "Обед", icon: "🍲" },
    { id: "d", label: "Ужин", icon: "🍽️" },
    { id: "s", label: "Перекус", icon: "🍎" },
  ];
  function entryNutr(e) {
    const base = e.i >= 0 && P[e.i] ? P[e.i] : e;
    const m = e.g / 100;
    return { n: e.i >= 0 && P[e.i] ? P[e.i].n : e.n, k: base.k * m, p: base.p * m, f: base.f * m, c: base.c * m, cat: base.cat || "custom" };
  }
  function totals(day) {
    const t = { k: 0, p: 0, f: 0, c: 0 };
    day.e.forEach(e => { const n = entryNutr(e); t.k += n.k; t.p += n.p; t.f += n.f; t.c += n.c; });
    return t;
  }

  // ---------------------------------------------------------------- Привычки, очки, питомец
  const lessonsState = () => Store.get("lessons", { done: {}, score: {} });
  function habits(k) {
    const d = getDay(k);
    const ls = lessonsState();
    const lessonToday = Object.values(ls.done).some(x => x === k);
    return {
      breakfast: d.e.some(e => e.ml === "b"),
      water: d.w >= 6,
      veg: d.e.some(e => entryNutr(e).cat === "veg"),
      lesson: lessonToday,
      nosoda: !!d.ns,
      training: !!d.t,
      mood: d.m || 0,
      active: d.e.length > 0 || d.w > 0 || lessonToday || d.m > 0 || d.t,
    };
  }
  function xpState() { return Store.get("xp", { xp: 0, aw: {} }); }
  function award(key, amount, label) {
    const s = xpState();
    const id = dkey() + ":" + key;
    if (s.aw[id]) return;
    s.aw[id] = 1; s.xp += amount;
    // чистим старые отметки (храним только 14 дней)
    const lim = dkey(addDays(new Date(), -14));
    Object.keys(s.aw).forEach(x => { if (x.slice(0, 8) < lim) delete s.aw[x]; });
    Store.set("xp", s);
    toast(`+${amount} XP · ${label}`);
  }
  function checkAwards() {
    const h = habits(dkey());
    if (h.breakfast) award("breakfast", 10, "завтрак");
    if (h.water) award("water", 10, "вода");
    if (h.veg) award("veg", 5, "овощи");
    if (h.training) award("training", 10, "тренировка");
    if (h.mood) award("mood", 5, "самочувствие");
  }
  const level = xp => Math.floor(xp / 100) + 1;
  function streak() {
    let n = 0, d = new Date();
    if (!habits(dkey(d)).active) d = addDays(d, -1);
    while (habits(dkey(d)).active && n < 365) { n++; d = addDays(d, -1); }
    return n;
  }
  function lastActiveDaysAgo() {
    for (let i = 0; i < 30; i++) if (habits(dkey(addDays(new Date(), -i))).active) return i;
    return 30;
  }
  function petMood() {
    const h = habits(dkey());
    const score = [h.breakfast, h.water, h.veg, h.lesson, h.training, h.mood > 0].filter(Boolean).length;
    if (score >= 3) return { mood: "happy", text: "Стрелка счастлива! Так держать 💚" };
    if (score >= 1) return { mood: "ok", text: "Стрелке хорошо. Ещё пара привычек – и она засияет." };
    if (lastActiveDaysAgo() >= 2) return { mood: "sad", text: "Стрелка скучает по тебе. Начнём с малого – стакан воды?" };
    return { mood: "ok", text: "Стрелка ждёт завтрак и стакан воды 🙂" };
  }
  function petSVG(mood, lvl, size = 96) {
    const s = 0.85 + Math.min(lvl, 10) * 0.03;
    const mouth = mood === "happy" ? "M44 66 Q60 82 76 66" : mood === "sad" ? "M46 74 Q60 64 74 74" : "M47 70 Q60 76 73 70";
    const eyes = mood === "sad"
      ? `<path d="M38 54 Q44 50 50 54" stroke="#23412E" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M70 54 Q76 50 82 54" stroke="#23412E" stroke-width="4" fill="none" stroke-linecap="round"/>`
      : `<ellipse cx="44" cy="54" rx="6" ry="7.5" fill="#23412E"/><ellipse cx="76" cy="54" rx="6" ry="7.5" fill="#23412E"/><circle cx="46" cy="51" r="2" fill="#fff"/><circle cx="78" cy="51" r="2" fill="#fff"/>`;
    const band = lvl >= 3 ? `<path d="M22 38 Q60 26 98 38" stroke="#4F9465" stroke-width="6" fill="none" stroke-linecap="round"/>` : "";
    const medal = lvl >= 6 ? `<circle cx="60" cy="104" r="9" fill="#F2C94C" stroke="#fff" stroke-width="2"/><text x="60" y="108" font-size="10" text-anchor="middle" fill="#fff" font-weight="700">★</text>` : "";
    const sparkle = mood === "happy" ? `<g fill="#F2C94C"><circle cx="14" cy="30" r="3"/><circle cx="108" cy="24" r="2.5"/><circle cx="104" cy="86" r="3"/></g>` : "";
    return `<svg width="${size}" height="${size}" viewBox="0 0 120 120" aria-label="Питомец Стрелка">
      <g transform="translate(60 64) scale(${s}) translate(-60 -64)">
      <ellipse cx="60" cy="112" rx="34" ry="5" fill="rgba(35,65,46,.15)"/>
      <g fill="#23412E"><rect x="59" y="6" width="2.5" height="22"/><polygon points="60,0 53,13 60,10 67,13"/></g>
      <path d="M60 26 C 96 26 106 56 104 74 C 102 96 84 108 60 108 C 36 108 18 96 16 74 C 14 56 24 26 60 26 Z" fill="#8FC09C"/>
      <path d="M60 34 C 90 34 98 60 96 74 C 94 92 80 100 60 100 C 40 100 26 92 24 74 C 22 60 30 34 60 34 Z" fill="#C4DDCA"/>
      ${band}${eyes}
      <ellipse cx="34" cy="66" rx="7" ry="4" fill="#F4B9B2"/><ellipse cx="86" cy="66" rx="7" ry="4" fill="#F4B9B2"/>
      <path d="${mouth}" stroke="#23412E" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      ${medal}</g>${sparkle}</svg>`;
  }

  // ---------------------------------------------------------------- Челленджи
  function weekDays() { const s = weekStart(); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); }
  function challengeProgress() {
    const days = weekDays().filter(d => dkey(d) <= dkey());
    return CH.map(c => {
      const marks = weekDays().map(d => dkey(d) <= dkey() && !!habits(dkey(d))[c.id]);
      const count = marks.filter(Boolean).length;
      return { ...c, marks, count, done: count >= c.goal, pts: Math.min(count, c.goal) };
    });
  }
  const weekPoints = () => challengeProgress().reduce((a, c) => a + c.pts, 0);

  // ---------------------------------------------------------------- Интерфейс: общее
  const view = $("#view");
  let tab = "home";
  let diaryDate = new Date();
  function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), 1800); }
  function openSheet(html, mount) {
    const sh = $("#sheet");
    sh.innerHTML = `<div class="grab"></div>` + html;
    sh.classList.add("on"); $("#sheetBg").classList.add("on");
    if (mount) mount(sh);
  }
  function closeSheet() { $("#sheet").classList.remove("on"); $("#sheetBg").classList.remove("on"); }
  $("#sheetBg").onclick = closeSheet;
  function go(t) { tab = t; closeSheet(); render(); window.scrollTo(0, 0); }
  $$("#tabs button").forEach(b => b.onclick = () => { haptic(); go(b.dataset.tab); });
  $("#profileBtn").onclick = () => go("profile");
  $("#sosBtn").onclick = () => go("sos");
  $("#goHome").onclick = () => go("home");

  function bar(val, max, cls = "") {
    const pct = max > 0 ? Math.min(100, (val / max) * 100) : 0;
    return `<div class="bar ${cls}"><i style="width:${pct}%"></i></div>`;
  }
  function ring(val, max, label) {
    const pct = max > 0 ? Math.min(1, val / max) : 0, R = 50, C = 2 * Math.PI * R;
    const over = max > 0 && val > max * 1.1;
    return `<div class="ring"><svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="${R}" fill="none" stroke="#DDEDE1" stroke-width="12"/>
      <circle cx="60" cy="60" r="${R}" fill="none" stroke="${over ? "#D9822B" : "#4F9465"}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C * pct} ${C}"/>
      </svg><div class="c"><b>${r0(val)}</b><span>из ${max} ${label}</span></div></div>`;
  }
  function macroRows(t, n) {
    const row = (name, v, m, u = "г") => {
      const ratio = m ? v / m : 0;
      const cls = ratio > 1.15 ? "warn" : ratio >= 0.8 ? "good" : "";
      return `<div class="macro"><b>${name}</b>${bar(v, m, cls)}<span class="muted">${r0(v)} / ${m} ${u}</span></div>`;
    };
    return row("Белки", t.p, n.p) + row("Жиры", t.f, n.f) + row("Углеводы", t.c, n.c);
  }

  // ---------------------------------------------------------------- Онбординг
  function renderOnboarding(edit) {
    const p = Store.get("profile", { name: (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.first_name) || "", sex: "", age: 15, h: 165, w: 55, act: 1, goal: "keep" });
    $("#tabs").style.display = edit ? "" : "none";
    view.innerHTML = `
      <div class="card blue">
        <div class="eyebrow" style="color:#E4F0E7">${edit ? "Профиль" : "Знакомство"}</div>
        <h2>${edit ? "Изменить данные" : "Привет! Я ПитЛаб 👋"}</h2>
        <p style="margin-top:6px;color:#DDEDE1">${edit ? "Норма пересчитается автоматически." : "Помогу разобраться с питанием под тренировки – безопасно и с поправкой на твой возраст. Ответь на несколько вопросов."}</p>
      </div>
      <div class="card">
        <label class="f">Как тебя зовут?</label><input class="inp" id="o_name" value="${esc(p.name)}" maxlength="30" placeholder="Имя">
        <label class="f">Пол</label><div class="seg" id="o_sex"><button data-v="f">Девушка</button><button data-v="m">Парень</button></div>
        <div class="grid2">
          <div><label class="f">Возраст</label><input class="inp" id="o_age" type="number" inputmode="numeric" min="10" max="19" value="${p.age}"></div>
          <div><label class="f">Рост, см</label><input class="inp" id="o_h" type="number" inputmode="numeric" min="120" max="220" value="${p.h}"></div>
        </div>
        <label class="f">Вес, кг</label><input class="inp" id="o_w" type="number" inputmode="decimal" min="30" max="150" step="0.1" value="${p.w}">
        <label class="f">Сколько тренировок в неделю?</label><div class="seg" id="o_act">${ACT.map(a => `<button data-v="${a.id}">${a.label}</button>`).join("")}</div>
        <label class="f">Твоя цель</label><div class="seg" id="o_goal">${Object.entries(GOALS).map(([k, v]) => `<button data-v="${k}">${v}</button>`).join("")}</div>
        <p class="muted small" style="margin-top:12px">Вес нужен только для расчёта нормы. Мы не показываем рейтинги по весу и никому его не передаём.</p>
        <button class="btn" id="o_save" style="margin-top:8px">${edit ? "Сохранить" : "Рассчитать мою норму"}</button>
      </div>`;
    const seg = (id, val) => { $$(`#${id} button`).forEach(b => { b.classList.toggle("on", b.dataset.v == val); b.onclick = () => { $$(`#${id} button`).forEach(x => x.classList.remove("on")); b.classList.add("on"); }; }); };
    seg("o_sex", p.sex); seg("o_act", p.act); seg("o_goal", p.goal);
    $("#o_save").onclick = () => {
      const g = id => ($(`#${id} button.on`) || {}).dataset;
      const np = {
        name: $("#o_name").value.trim() || "Друг",
        sex: g("o_sex") ? g("o_sex").v : "",
        age: +$("#o_age").value, h: +$("#o_h").value, w: +$("#o_w").value,
        act: g("o_act") ? +g("o_act").v : 1, goal: g("o_goal") ? g("o_goal").v : "keep",
      };
      if (!np.sex) return toast("Выбери пол – от него зависит расчёт");
      if (!(np.age >= 10 && np.age <= 19)) return toast("Укажи возраст от 10 до 19 лет");
      if (!(np.h >= 120 && np.h <= 220) || !(np.w >= 30 && np.w <= 150)) return toast("Проверь рост и вес");
      Store.set("profile", np);
      haptic("medium");
      if (edit) { toast("Сохранено"); go("profile"); } else renderNormResult();
    };
  }
  function renderNormResult() {
    const p = Store.get("profile"); const n = calcNorm(p);
    view.innerHTML = `
      <div class="card blue" style="text-align:center">
        <div class="eyebrow" style="color:#E4F0E7">Твоя безопасная норма</div>
        <div style="font-size:44px;font-weight:800">${n.kcal}</div><div>ккал в день</div>
      </div>
      ${n.note ? `<div class="note">${esc(n.note)}</div>` : ""}
      ${p.age < 13 || p.age > 18 ? `<div class="note">ПитЛаб рассчитан на подростков 13–18 лет. Твою норму лучше уточнить у врача.</div>` : ""}
      <div class="card">
        <div class="grid2" style="grid-template-columns:repeat(3,1fr);text-align:center">
          <div><b style="font-size:22px;color:var(--navy)">${n.p} г</b><div class="muted">белки</div></div>
          <div><b style="font-size:22px;color:var(--navy)">${n.f} г</b><div class="muted">жиры</div></div>
          <div><b style="font-size:22px;color:var(--navy)">${n.c} г</b><div class="muted">углеводы</div></div>
        </div>
        <p class="muted small" style="margin-top:12px">Расчёт по формуле Шофилда для 10–18 лет с учётом тренировок. Норма никогда не опускается ниже безопасного уровня. Это ориентир, а не медицинская рекомендация.</p>
      </div>
      <button class="btn" id="start">Поехали!</button>`;
    $("#start").onclick = () => { $("#tabs").style.display = ""; go("home"); };
  }

  // ---------------------------------------------------------------- Главная
  function renderHome() {
    const p = Store.get("profile"); const n = calcNorm(p);
    const k = dkey(); const d = getDay(k); const t = totals(d); const h = habits(k);
    const xs = xpState(); const lvl = level(xs.xp); const pm = petMood();
    const test = Store.get("test", {});
    const ls = lessonsState();
    const next = L.find(x => !ls.done[x.id]);
    const last7 = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6));
    view.innerHTML = `
      <div class="card blue">
        <div class="pet">${petSVG(pm.mood, lvl, 104)}
          <div style="flex:1">
            <div class="eyebrow" style="color:#E4F0E7">Привет, ${esc(p.name)}!</div>
            <h3>Стрелка · уровень ${lvl}</h3>
            <p style="font-size:13px;color:#DDEDE1;margin:4px 0 8px">${pm.text}</p>
            ${bar(xs.xp % 100, 100)}<div class="xp" style="margin-top:4px">${xs.xp % 100}/100 XP до уровня ${lvl + 1} · 🔥 серия ${streak()} дн.</div>
          </div>
        </div>
      </div>
      ${!test.before ? `<div class="card sky"><div class="row between"><div><h3>Тест «до» – 10 вопросов</h3><p class="muted" style="margin:2px 0 0">Узнаем, что ты уже знаешь о питании</p></div><button class="btn small" id="testBefore">Пройти</button></div></div>` : ""}
      <div class="card">
        <div class="row" style="gap:14px">${ring(t.k, n.kcal, "ккал")}
          <div style="flex:1">${macroRows(t, n)}</div></div>
        <button class="btn ghost" id="toDiary" style="margin-top:10px">+ Записать еду</button>
      </div>
      <div class="habits">
        <button class="habit ${h.water ? "done" : ""}" id="hWater"><b>💧</b>Вода ${d.w}/6</button>
        <button class="habit ${h.training ? "done" : ""}" id="hTrain"><b>🏋️</b>${h.training ? "Тренировка ✓" : "Тренировка"}</button>
        <button class="habit ${h.mood ? "done" : ""}" id="hMood"><b>${["🙂", "😫", "😕", "🙂", "😊", "🤩"][h.mood]}</b>${h.mood ? "Энергия " + h.mood + "/5" : "Как ты?"}</button>
      </div>
      <div style="height:12px"></div>
      ${next ? `<div class="card"><div class="eyebrow">Урок дня</div><div class="lesson-card"><div class="ic">${next.icon}</div><div style="flex:1"><h3>${esc(next.title)}</h3><p class="muted" style="margin:0">2–3 минуты + мини-тест</p></div><button class="btn small" id="lessonNext">Читать</button></div></div>` : ""}
      <div class="card">
        <div class="eyebrow">Моя неделя</div>
        <div class="chart">${last7.map(dd => { const hh = habits(dkey(dd)); return `<div><i style="height:${hh.mood ? hh.mood * 14 : 3}px;background:${hh.mood ? "#6CA97E" : "#DDEDE1"}"></i>${hh.training ? "🏋️" : "·"}<span>${WD[dd.getDay()]}</span></div>`; }).join("")}</div>
        <p class="muted small" style="margin-top:6px">Столбики – энергия по твоей оценке, 🏋️ – дни с тренировкой.</p>
      </div>`;
    if ($("#testBefore")) $("#testBefore").onclick = () => renderTest("before");
    $("#toDiary").onclick = () => { diaryDate = new Date(); go("diary"); setTimeout(() => openAdd(), 50); };
    $("#hWater").onclick = () => { const dd = getDay(k); dd.w = (dd.w + 1) % 13; setDay(k, dd); haptic(); checkAwards(); renderHome(); };
    $("#hTrain").onclick = () => { const dd = getDay(k); dd.t = dd.t ? 0 : 1; setDay(k, dd); haptic(); checkAwards(); renderHome(); };
    $("#hMood").onclick = openMood;
    if ($("#lessonNext")) $("#lessonNext").onclick = () => renderLesson(next.id);
  }
  function openMood() {
    const k = dkey();
    openSheet(`<h2>Как ты сегодня?</h2><p class="muted">Оцени энергию и самочувствие от 1 до 5</p>
      <div class="seg" style="margin-top:10px">${[1, 2, 3, 4, 5].map(i => `<button data-v="${i}" style="font-size:22px">${["😫", "😕", "🙂", "😊", "🤩"][i - 1]}<br><span style="font-size:12px">${i}</span></button>`).join("")}</div>`, sh => {
      $$(".seg button", sh).forEach(b => b.onclick = () => {
        const d = getDay(k); d.m = +b.dataset.v; setDay(k, d); closeSheet(); checkAwards();
        if (d.m <= 2) toast("Бывает. Загляни в «Нет мотивации» – там есть поддержка 💚"); renderHome();
      });
    });
  }

  // ---------------------------------------------------------------- Дневник
  function renderDiary() {
    const p = Store.get("profile"); const n = calcNorm(p);
    const k = dkey(diaryDate); const d = getDay(k); const t = totals(d);
    const isToday = k === dkey();
    view.innerHTML = `
      <div class="row between" style="margin-bottom:10px">
        <button class="btn small ghost" id="prevD">‹</button><h2 style="font-size:17px">${human(diaryDate)}</h2>
        <button class="btn small ghost" id="nextD" ${isToday ? "disabled" : ""}>›</button>
      </div>
      <div class="card">
        <div class="row between"><h3>${r0(t.k)} из ${n.kcal} ккал</h3><span class="muted">${n.kcal - r0(t.k) > 0 ? "осталось " + (n.kcal - r0(t.k)) : "норма выполнена"}</span></div>
        <div style="margin-top:8px">${bar(t.k, n.kcal, t.k > n.kcal * 1.1 ? "warn" : t.k >= n.kcal * 0.8 ? "good" : "")}</div>
        ${macroRows(t, n)}
      </div>
      ${MEALS.map(m => {
        const es = d.e.map((e, i) => ({ e, i })).filter(x => x.e.ml === m.id);
        const mk = es.reduce((a, x) => a + entryNutr(x.e).k, 0);
        return `<div class="card meal"><h3><span>${m.icon} ${m.label}</span><span class="muted">${r0(mk)} ккал</span></h3>
          <div class="list">${es.map(x => { const nn = entryNutr(x.e); return `<div class="item"><div><div class="t">${esc(nn.n)}</div><div class="s">${x.e.g} г · ${r0(nn.k)} ккал · Б ${r1(nn.p)} Ж ${r1(nn.f)} У ${r1(nn.c)}</div></div><button class="del" data-i="${x.i}" aria-label="Удалить">×</button></div>`; }).join("") || `<div class="muted" style="padding:6px 0">Пока пусто</div>`}</div>
          <button class="btn small ghost add" data-m="${m.id}" style="margin-top:6px">+ Добавить</button></div>`;
      }).join("")}
      <div class="card"><div class="row between"><div><h3>💧 Вода</h3><p class="muted" style="margin:0">${d.w} из 6 стаканов</p></div>
        <div class="row"><button class="btn small ghost" id="wMinus">−</button><button class="btn small" id="wPlus">+ стакан</button></div></div></div>
      <div class="card"><label class="row between"><span><b>🚫 Без сладкой газировки</b><br><span class="muted">Отметь, если сегодня обошёлся без неё</span></span>
        <input type="checkbox" id="noSoda" ${d.ns ? "checked" : ""} style="width:24px;height:24px"></label></div>`;
    $("#prevD").onclick = () => { diaryDate = addDays(diaryDate, -1); renderDiary(); };
    $("#nextD").onclick = () => { if (!isToday) { diaryDate = addDays(diaryDate, 1); renderDiary(); } };
    $$(".add").forEach(b => b.onclick = () => openAdd(b.dataset.m));
    $$(".del").forEach(b => b.onclick = () => { const dd = getDay(k); dd.e.splice(+b.dataset.i, 1); setDay(k, dd); renderDiary(); });
    $("#wPlus").onclick = () => { const dd = getDay(k); dd.w = Math.min(12, dd.w + 1); setDay(k, dd); haptic(); if (isToday) checkAwards(); renderDiary(); };
    $("#wMinus").onclick = () => { const dd = getDay(k); dd.w = Math.max(0, dd.w - 1); setDay(k, dd); renderDiary(); };
    $("#noSoda").onchange = e => { const dd = getDay(k); dd.ns = e.target.checked ? 1 : 0; setDay(k, dd); if (isToday && dd.ns) toast("Отлично! Засчитано в челлендж"); };
  }
  function defaultMeal() { const h = new Date().getHours(); return h < 11 ? "b" : h < 16 ? "l" : h < 21 ? "d" : "s"; }
  function openAdd(meal) {
    meal = meal || defaultMeal();
    openSheet(`<h2>Добавить еду</h2>
      <div class="seg" id="aMeal" style="margin:10px 0">${MEALS.map(m => `<button data-v="${m.id}" class="${m.id === meal ? "on" : ""}">${m.icon} ${m.label}</button>`).join("")}</div>
      <input class="inp" id="aQ" placeholder="Поиск: гречка, творог, банан…" autocomplete="off">
      <div class="list" id="aList" style="margin-top:6px"></div>
      <button class="btn ghost" id="aCustom" style="margin-top:8px">Нет в списке? Добавить свой продукт</button>`, sh => {
      $$("#aMeal button", sh).forEach(b => b.onclick = () => { meal = b.dataset.v; $$("#aMeal button", sh).forEach(x => x.classList.toggle("on", x === b)); });
      const list = $("#aList", sh);
      const draw = () => {
        const q = $("#aQ", sh).value.trim().toLowerCase();
        const res = P.map((x, i) => ({ x, i })).filter(o => !q || o.x.n.toLowerCase().includes(q)).slice(0, q ? 40 : 15);
        list.innerHTML = res.map(o => `<button class="item" data-i="${o.i}" style="width:100%;text-align:left"><div><div class="t">${esc(o.x.n)}</div><div class="s">${o.x.k} ккал · Б ${o.x.p} Ж ${o.x.f} У ${o.x.c} на 100 г</div></div><span style="color:var(--acc);font-size:22px">+</span></button>`).join("") || `<div class="empty">Ничего не нашлось – добавь свой продукт</div>`;
        $$("button.item", list).forEach(b => b.onclick = () => openGrams(+b.dataset.i, meal));
      };
      $("#aQ", sh).oninput = draw; draw();
      $("#aCustom", sh).onclick = () => openCustom(meal);
    });
  }
  function openGrams(i, meal) {
    const x = P[i];
    openSheet(`<h2>${esc(x.n)}</h2><p class="muted">${x.k} ккал · Б ${x.p} · Ж ${x.f} · У ${x.c} на 100 г</p>
      <label class="f">Сколько грамм?</label><input class="inp" id="gG" type="number" inputmode="numeric" value="${x.portion || 100}">
      <div class="chips" style="margin-top:8px">${[...new Set([x.portion, 50, 100, 150, 200, 250].filter(Boolean))].map(g => `<button class="chip" data-g="${g}">${g === x.portion ? "порция " : ""}${g} г</button>`).join("")}</div>
      <div class="card sky" style="margin-top:12px" id="gSum"></div>
      <button class="btn" id="gAdd">Добавить</button>`, sh => {
      const sum = () => { const g = +$("#gG", sh).value || 0; const m = g / 100; $("#gSum", sh).innerHTML = `<b>${r0(x.k * m)} ккал</b> · Б ${r1(x.p * m)} · Ж ${r1(x.f * m)} · У ${r1(x.c * m)}`; };
      $$(".chip", sh).forEach(c => c.onclick = () => { $("#gG", sh).value = c.dataset.g; sum(); });
      $("#gG", sh).oninput = sum; sum();
      $("#gAdd", sh).onclick = () => {
        const g = +$("#gG", sh).value; if (!(g > 0 && g < 3000)) return toast("Укажи вес в граммах");
        addEntry({ i, g, ml: meal });
      };
    });
  }
  function openCustom(meal) {
    openSheet(`<h2>Свой продукт</h2><p class="muted">Значения на 100 г – обычно они есть на упаковке</p>
      <label class="f">Название</label><input class="inp" id="cN" maxlength="40">
      <div class="grid2"><div><label class="f">Ккал</label><input class="inp" id="cK" type="number" inputmode="decimal"></div>
      <div><label class="f">Белки, г</label><input class="inp" id="cP" type="number" inputmode="decimal"></div>
      <div><label class="f">Жиры, г</label><input class="inp" id="cF" type="number" inputmode="decimal"></div>
      <div><label class="f">Углеводы, г</label><input class="inp" id="cC" type="number" inputmode="decimal"></div></div>
      <label class="f">Сколько грамм съел?</label><input class="inp" id="cG" type="number" inputmode="numeric" value="100">
      <button class="btn" id="cAdd" style="margin-top:12px">Добавить</button>`, sh => {
      $("#cAdd", sh).onclick = () => {
        const v = id => parseFloat(($("#" + id, sh).value || "0").replace(",", ".")) || 0;
        const n = $("#cN", sh).value.trim(); if (!n) return toast("Напиши название");
        if (v("cG") <= 0) return toast("Укажи вес");
        addEntry({ i: -1, n, k: v("cK"), p: v("cP"), f: v("cF"), c: v("cC"), g: v("cG"), ml: meal });
      };
    });
  }
  function addEntry(e, silent) {
    const k = dkey(diaryDate);
    const d = getDay(k); d.e.push(e); setDay(k, d);
    if (!silent) { closeSheet(); haptic("medium"); toast("Записано ✓"); }
    if (k === dkey()) checkAwards();
    if (!silent) { if (tab === "diary") renderDiary(); else render(); }
  }

  // ---------------------------------------------------------------- Собери тарелку
  const plateState = { veg: null, prot: null, carb: null };
  function renderPlate() {
    const cats = {
      veg: { label: "Овощи и фрукты", share: "½ тарелки", color: "#8CCB8E", idx: P.map((x, i) => i).filter(i => P[i].cat === "veg") },
      prot: { label: "Белок", share: "¼ тарелки", color: "#E9A27C", idx: P.map((x, i) => i).filter(i => P[i].cat === "prot" || P[i].cat === "dairy") },
      carb: { label: "Гарнир", share: "¼ тарелки", color: "#F6D97A", idx: P.map((x, i) => i).filter(i => P[i].cat === "carb") },
    };
    const sel = c => plateState[c] !== null ? P[plateState[c]] : null;
    const portion = c => c === "veg" ? 150 : (sel(c).portion || 120);
    let tk = 0, tp = 0;
    Object.keys(cats).forEach(c => { if (sel(c)) { const m = portion(c) / 100; tk += sel(c).k * m; tp += sel(c).p * m; } });
    const fill = c => sel(c) ? cats[c].color : "#EEF4EF";
    const ready = Object.keys(cats).every(c => sel(c));
    view.innerHTML = `
      <div class="card"><div class="eyebrow">Собери тарелку</div><h2>Сбалансированный приём пищи</h2>
        <p class="muted" style="margin-top:4px">Половина – овощи, четверть – белок, четверть – гарнир. Выбери продукт для каждой части.</p>
        <div class="plate-wrap"><svg width="210" height="210" viewBox="0 0 220 220" aria-label="Тарелка">
          <circle cx="110" cy="110" r="106" fill="#fff" stroke="#DCE8DF" stroke-width="4"/>
          <path d="M110 110 L110 18 A92 92 0 0 0 110 202 Z" fill="${fill("veg")}"/>
          <path d="M110 110 L110 18 A92 92 0 0 1 202 110 Z" fill="${fill("prot")}"/>
          <path d="M110 110 L202 110 A92 92 0 0 1 110 202 Z" fill="${fill("carb")}"/>
          <path d="M110 18 L110 202 M110 110 L202 110" stroke="#fff" stroke-width="4"/>
          <text x="62" y="114" text-anchor="middle" font-size="13" font-weight="700" fill="#2F4A38">Овощи</text>
          <text x="152" y="72" text-anchor="middle" font-size="13" font-weight="700" fill="#2F4A38">Белок</text>
          <text x="152" y="156" text-anchor="middle" font-size="13" font-weight="700" fill="#2F4A38">Гарнир</text>
        </svg></div>
        ${Object.entries(cats).map(([c, o]) => `<div style="margin-top:6px"><div class="row between"><b>${o.label}</b><span class="muted">${o.share}${sel(c) ? " · " + esc(sel(c).n) : ""}</span></div>
          <div class="pick">${o.idx.slice(0, 18).map(i => `<button data-c="${c}" data-i="${i}" class="${plateState[c] === i ? "on" : ""}">${esc(P[i].n)}</button>`).join("")}</div></div>`).join("")}
        <div class="card sky" style="margin:8px 0 10px">${ready ? `Твоя тарелка: <b>≈ ${r0(tk)} ккал</b>, белка ≈ ${r0(tp)} г` : "Выбери все три части тарелки"}</div>
        <button class="btn" id="plAdd" ${ready ? "" : "disabled"}>Добавить тарелку в дневник</button>
      </div>
      <div class="card"><div class="eyebrow">Тренировка</div>
        <h3>За 1–2 часа до</h3><p class="muted">Лёгкие углеводы: банан, йогурт, бутерброд, хлебцы. Не тренируйся голодным.</p>
        <h3>После</h3><p class="muted" style="margin:0">Белок + углеводы: творог с фруктами, кефир с бананом, курица с гарниром.</p>
      </div>`;
    $$(".pick button").forEach(b => b.onclick = () => { plateState[b.dataset.c] = +b.dataset.i; haptic(); renderPlate(); });
    $("#plAdd").onclick = () => {
      if (!ready) return;
      openSheet(`<h2>В какой приём пищи?</h2><div class="seg" style="margin-top:10px">${MEALS.map(m => `<button data-v="${m.id}">${m.icon} ${m.label}</button>`).join("")}</div>`, sh => {
        $$(".seg button", sh).forEach(b => b.onclick = () => {
          diaryDate = new Date();
          Object.keys(cats).forEach(c => addEntry({ i: plateState[c], g: portion(c), ml: b.dataset.v }, true));
          closeSheet(); toast("Тарелка записана в дневник ✓"); haptic("medium");
        });
      });
    };
  }

  // ---------------------------------------------------------------- Уроки и тесты
  function renderLessons() {
    const ls = lessonsState(); const test = Store.get("test", {});
    const done = Object.keys(ls.done).length;
    view.innerHTML = `
      <div class="card blue"><div class="eyebrow" style="color:#E4F0E7">Уроки ПитЛаба</div><h2>${done} из ${L.length} пройдено</h2>
        <div style="margin-top:8px">${bar(done, L.length)}</div></div>
      <div class="card sky"><div class="row between"><div><h3>Тест знаний</h3><p class="muted" style="margin:2px 0 0">До: ${test.before ? test.before.s + "/10" : "не пройден"} · После: ${test.after ? test.after.s + "/10" : "не пройден"}</p></div>
        <button class="btn small" id="tBtn">${!test.before ? "Тест «до»" : "Тест «после»"}</button></div></div>
      <div class="card"><div class="list">${L.map(x => `<button class="item lesson-card" data-id="${x.id}" style="width:100%;text-align:left">
        <div class="ic">${x.icon}</div><div style="flex:1"><div class="t">${esc(x.title)}</div><div class="s">${ls.done[x.id] ? "Пройден · тест " + (ls.score[x.id] || 0) + "/3" : "2–3 минуты"}</div></div>
        ${ls.done[x.id] ? `<span class="done-mark">✓</span>` : `<span style="color:var(--acc)">›</span>`}</button>`).join("")}</div></div>`;
    $$(".lesson-card").forEach(b => b.onclick = () => renderLesson(b.dataset.id));
    $("#tBtn").onclick = () => renderTest(!test.before ? "before" : "after");
  }
  function renderLesson(id) {
    const x = L.find(l => l.id === id); tab = "lessons"; markTabs();
    view.innerHTML = `
      <button class="btn small ghost" id="back">‹ Все уроки</button>
      <div class="card" style="margin-top:10px"><div style="font-size:40px">${x.icon}</div><h2>${esc(x.title)}</h2>
        <div style="margin-top:10px">${x.text.map(t => `<p>${esc(t)}</p>`).join("")}</div></div>
      <div class="card"><div class="eyebrow">Мини-тест</div><div id="quiz"></div></div>`;
    $("#back").onclick = () => go("lessons");
    let qi = 0, score = 0;
    const q = $("#quiz");
    const step = () => {
      if (qi >= x.q.length) {
        const ls = lessonsState(); ls.done[x.id] = ls.done[x.id] || dkey(); ls.score[x.id] = Math.max(ls.score[x.id] || 0, score); Store.set("lessons", ls);
        award("lesson", 20, "урок");
        q.innerHTML = `<h3>${score === 3 ? "Идеально! 🎯" : score === 2 ? "Хорошо! 👍" : "Урок засчитан 🙂"}</h3><p class="muted">Правильных ответов: ${score} из 3</p>
          <button class="btn" id="qDone">К урокам</button>`;
        $("#qDone").onclick = () => go("lessons"); return;
      }
      const [text, opts, right, expl] = x.q[qi];
      q.innerHTML = `<p class="muted small">Вопрос ${qi + 1} из ${x.q.length}</p><h3>${esc(text)}</h3>${opts.map((o, i) => `<button class="quiz-opt" data-i="${i}">${esc(o)}</button>`).join("")}<div id="qExp"></div>`;
      $$(".quiz-opt", q).forEach(b => b.onclick = () => {
        const i = +b.dataset.i; if (i === right) score++;
        $$(".quiz-opt", q).forEach((bb, j) => { bb.disabled = true; if (j === right) bb.classList.add("ok"); else if (j === i) bb.classList.add("no"); });
        haptic(i === right ? "light" : "rigid");
        $("#qExp").innerHTML = `<p class="muted" style="margin-top:8px">${esc(expl)}</p><button class="btn" id="qNext">Дальше</button>`;
        $("#qNext").onclick = () => { qi++; step(); };
      });
    };
    step(); window.scrollTo(0, 0);
  }
  function renderTest(kind) {
    let qi = 0, score = 0;
    view.innerHTML = `<div class="card blue"><div class="eyebrow" style="color:#E4F0E7">Тест знаний «${kind === "before" ? "до" : "после"}»</div>
      <h2>10 вопросов о питании</h2><p style="color:#DDEDE1;margin:4px 0 0">Отвечай честно – это не оценка, а замер для пилота.</p></div><div class="card" id="tq"></div>`;
    const box = $("#tq");
    const step = () => {
      if (qi >= KT.length) {
        const test = Store.get("test", {}); test[kind] = { s: score, d: dkey() }; Store.set("test", test);
        box.innerHTML = `<h3>Результат: ${score} из 10</h3>
          ${kind === "after" && test.before ? `<p class="muted">До пилота было ${test.before.s}/10. ${score > test.before.s ? "Ты стал разбираться лучше! 🎉" : "Пройди ещё пару уроков и попробуй снова."}</p>` : `<p class="muted">В конце пилота пройдёшь такой же тест – и мы увидим, как выросли знания.</p>`}
          <button class="btn" id="tOk">Готово</button>`;
        $("#tOk").onclick = () => go(kind === "before" ? "home" : "lessons"); return;
      }
      const [text, opts] = KT[qi];
      box.innerHTML = `<p class="muted small">Вопрос ${qi + 1} из ${KT.length}</p>${bar(qi, KT.length)}<h3 style="margin-top:10px">${esc(text)}</h3>${opts.map((o, i) => `<button class="quiz-opt" data-i="${i}">${esc(o)}</button>`).join("")}`;
      $$(".quiz-opt", box).forEach(b => b.onclick = () => { if (+b.dataset.i === KT[qi][2]) score++; qi++; haptic(); step(); });
    };
    step(); window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------- Челленджи
  function renderChallenges() {
    const cp = challengeProgress(); const pts = cp.reduce((a, c) => a + c.pts, 0); const max = cp.reduce((a, c) => a + c.goal, 0);
    view.innerHTML = `
      <div class="card blue"><div class="eyebrow" style="color:#E4F0E7">Челленджи недели</div>
        <h2>${pts} из ${max} очков</h2><p style="color:#DDEDE1;margin:4px 0 8px">Очки – только за привычки. Никаких рейтингов по весу.</p>${bar(pts, max)}</div>
      ${cp.map(c => `<div class="card"><div class="ch"><div class="ic">${c.icon}</div><div style="flex:1">
        <div class="row between"><h3>${esc(c.title)}</h3><span class="${c.done ? "done-mark" : "muted"}">${c.done ? "✓ выполнен" : c.count + "/" + c.goal}</span></div>
        <div class="muted small">${esc(c.hint)}</div>
        <div class="dots">${c.marks.map((m, i) => `<i class="${m ? "on" : ""}" title="${WD[(i + 1) % 7]}"></i>`).join("")}</div></div></div></div>`).join("")}
      <div class="card sky"><h3>Соревнуйся с друзьями из зала</h3>
        <p class="muted">В чате с ботом нажми кнопку <b>🏆 Моя группа</b> → «Создать группу» и отправь друзьям ссылку-приглашение. Потом нажми кнопку ниже – твои очки появятся в общей таблице.</p>
        <button class="btn" id="sync">Отправить мои очки в группу</button></div>`;
    $("#sync").onclick = () => sendToBot(syncPayload(), "очки отправлены в бот");
  }

  // ---------------------------------------------------------------- Профиль, тренер
  function weekSummary() {
    const p = Store.get("profile"); const n = calcNorm(p);
    const days = Array.from({ length: 7 }, (_, i) => dkey(addDays(new Date(), -i)));
    let act = 0, br = 0, wa = 0, ve = 0, tr = 0, kcSum = 0, kcDays = 0, en = 0, enN = 0, le = 0;
    days.forEach(k => {
      const h = habits(k); const d = getDay(k);
      if (h.active) act++; if (h.breakfast) br++; if (h.water) wa++; if (h.veg) ve++; if (h.training) tr++; if (h.lesson) le++;
      if (d.e.length) { kcSum += totals(d).k; kcDays++; }
      if (d.m) { en += d.m; enN++; }
    });
    return { t: "summary", n: p.name, act, br, wa, ve, tr, le, kc: kcDays ? r0((kcSum / kcDays / n.kcal) * 100) : 0, en: enN ? r1(en / enN) : 0, pts: weekPoints(), lvl: level(xpState().xp) };
  }
  function syncPayload() {
    const test = Store.get("test", {});
    let act10 = 0; for (let i = 0; i < 10; i++) if (habits(dkey(addDays(new Date(), -i))).active) act10++;
    return { t: "sync", pts: weekPoints(), xp: xpState().xp, lvl: level(xpState().xp), a10: act10, tb: test.before ? test.before.s : null, ta: test.after ? test.after.s : null, r: Store.get("rating", null), ls: Object.keys(lessonsState().done).length };
  }
  function summaryText(s) {
    return `ПитЛаб · неделя ${s.n}\nАктивных дней: ${s.act}/7\nЗавтрак: ${s.br}/7 · Вода: ${s.wa}/7 · Овощи: ${s.ve}/7\nТренировок: ${s.tr} · Уроков: ${s.le}\nКалории в среднем: ${s.kc}% нормы\nЭнергия: ${s.en || "–"}/5 · Очки челленджей: ${s.pts}`;
  }
  function sendToBot(obj, okText) {
    const json = JSON.stringify(obj);
    const fromKeyboard = tg && tg.initDataUnsafe && !tg.initDataUnsafe.query_id && tg.platform !== "unknown";
    if (fromKeyboard) {
      try { tg.sendData(json); return; } catch (e) { console.warn(e); }
    }
    const text = obj.t === "summary" ? summaryText(obj) : `Мои очки в ПитЛабе за неделю: ${obj.pts}`;
    openSheet(`<h2>Отправка в бот</h2>
      <p class="muted">Чтобы ${okText}, открой ПитЛаб кнопкой <b>«🍏 Открыть ПитЛаб»</b> внизу чата с ботом (не через меню) и нажми эту кнопку ещё раз.</p>
      ${obj.t === "summary" ? `<p class="muted">Или просто перешли сводку тренеру сам:</p><div class="card sky" style="white-space:pre-line;font-size:13px">${esc(text)}</div>
      <button class="btn" id="shareBtn">Переслать в Telegram</button>` : ""}`, sh => {
      if ($("#shareBtn", sh)) $("#shareBtn", sh).onclick = () => {
        const url = "https://t.me/share/url?url=" + encodeURIComponent("ПитЛаб") + "&text=" + encodeURIComponent(text);
        if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, "_blank");
      };
    });
  }
  function renderProfile() {
    const p = Store.get("profile"); const n = calcNorm(p); const rating = Store.get("rating", null);
    const s = weekSummary();
    view.innerHTML = `
      <div class="card blue"><div class="row between"><div><div class="eyebrow" style="color:#E4F0E7">Профиль</div><h2>${esc(p.name)}</h2>
        <p style="color:#DDEDE1;margin:2px 0 0">${p.age} лет · ${p.h} см · ${GOALS[p.goal]}</p></div><button class="btn small white" id="edit">Изменить</button></div></div>
      <div class="card"><div class="eyebrow">Моя норма</div>
        <div class="row between"><h2>${n.kcal} ккал</h2><span class="muted">Б ${n.p} · Ж ${n.f} · У ${n.c} г</span></div>
        ${n.note ? `<div class="note">${esc(n.note)}</div>` : ""}
        <p class="muted small" style="margin-top:6px">Формула Шофилда для 10–18 лет × уровень активности. Цель «сбросить» снижает норму максимум на 10%, и она никогда не опускается ниже безопасного минимума. Нормы БЖУ – по рекомендациям для подростков-спортсменов. Это ориентир, не медицинская рекомендация.</p></div>
      <div class="card"><div class="eyebrow">👟 Тренер на связи</div>
        <p class="muted">Тренер увидит только недельную сводку привычек – без веса и без того, что именно ты ел. Чтобы подключить тренера, открой его ссылку-приглашение или нажми в чате с ботом <b>👟 Тренер</b> → «Ввести код тренера».</p>
        <div class="card sky" style="white-space:pre-line;font-size:13px">${esc(summaryText(s))}</div>
        <button class="btn" id="sendCoach">Отправить сводку тренеру</button></div>
      <div class="card"><div class="eyebrow">Оцени ПитЛаб</div><p class="muted">Насколько ПитЛаб тебе полезен?</p>
        <div class="seg" id="rate">${[1, 2, 3, 4, 5].map(i => `<button data-v="${i}" class="${rating === i ? "on" : ""}">${i}</button>`).join("")}</div></div>
      <div class="card"><button class="btn ghost" id="testA">Пройти тест знаний «после»</button>
        <button class="btn ghost" id="reset" style="margin-top:8px;color:var(--bad)">Удалить все мои данные</button></div>
      <p class="muted small" style="text-align:center">ПитЛаб · команда «Белая стрела» · MVP</p>`;
    $("#edit").onclick = () => renderOnboarding(true);
    $("#sendCoach").onclick = () => sendToBot(s, "отправить сводку тренеру");
    $$("#rate button").forEach(b => b.onclick = () => { Store.set("rating", +b.dataset.v); $$("#rate button").forEach(x => x.classList.toggle("on", x === b)); toast("Спасибо за оценку!"); });
    $("#testA").onclick = () => renderTest("after");
    $("#reset").onclick = () => {
      const doIt = ok => { if (!ok) return; Store.keys().forEach(k => Store.remove(k)); location.reload(); };
      if (tg && tg.showConfirm) tg.showConfirm("Удалить все данные ПитЛаба? Это нельзя отменить.", doIt); else doIt(confirm("Удалить все данные ПитЛаба?"));
    };
  }

  // ---------------------------------------------------------------- Нет мотивации
  function renderSOS() {
    view.innerHTML = `
      <div class="card blue"><div class="eyebrow" style="color:#E4F0E7">Нет мотивации?</div><h2>Это нормально. Давай разберёмся</h2>
        <p style="color:#DDEDE1;margin:6px 0 0">Срыв – не провал. Один день ничего не решает: решает то, что ты делаешь чаще всего.</p></div>
      <div class="card"><h3>Попробуй прямо сейчас</h3>
        <div class="list">
          <div class="item"><div><div class="t">🫁 Подыши 1 минуту</div><div class="s">Вдох на 4 счёта, задержка на 4, выдох на 6. Повтори 5 раз.</div></div></div>
          <div class="item"><div><div class="t">💧 Один маленький шаг</div><div class="s">Выпей стакан воды или отметь одну привычку – этого достаточно на сегодня.</div></div></div>
          <div class="item"><div><div class="t">🍽️ Съел больше, чем хотел?</div><div class="s">Не нужно «отрабатывать» еду или голодать завтра. Просто вернись к обычному режиму со следующего приёма пищи.</div></div></div>
          <div class="item"><div><div class="t">🎯 Вспомни, зачем начал</div><div class="s">Сила, энергия, самочувствие – это растёт постепенно, даже когда не видно в зеркале.</div></div></div>
        </div></div>
      <div class="card"><h3>Поговори с кем-то</h3><p class="muted">Напиши тренеру, родителям или другу. Если тяжело на душе – можно бесплатно и анонимно позвонить:</p>
        <a class="big-phone" href="tel:88002000122">8-800-2000-122</a>
        <p class="muted small" style="text-align:center;margin:0">Детский телефон доверия · бесплатно, по всей России</p></div>
      <div class="card sos-card"><p style="margin:0;font-size:13px">Если мысли о еде, весе или теле занимают почти всё время, ты боишься есть или после еды хочется себя наказать – обязательно расскажи об этом взрослому, которому доверяешь, или врачу. Ты не один, и с этим помогают.</p></div>
      <button class="btn" id="back">Вернуться</button>`;
    $("#back").onclick = () => go("home");
  }

  // ---------------------------------------------------------------- Маршрутизация
  function markTabs() { $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab)); }
  function render() {
    if (!Store.get("profile")) return renderOnboarding(false);
    $("#tabs").style.display = "";
    markTabs();
    ({ home: renderHome, diary: renderDiary, plate: renderPlate, lessons: renderLessons, challenges: renderChallenges, profile: renderProfile, sos: renderSOS }[tab] || renderHome)();
  }

  Store.init().then(() => {
    const start = new URLSearchParams(location.search).get("tab") || (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param);
    if (start && ["home", "diary", "plate", "lessons", "challenges", "profile", "sos"].includes(start)) tab = start;
    render();
  });

  // для автотестов
  window.__pitlab = { calcNorm, Store, weekSummary, syncPayload };
})();
