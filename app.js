/* ПитЛаб – мини-приложение Telegram (MVP)
   Команда «Белая стрела». Все данные пользователя хранятся в его Telegram
   (CloudStorage), а если приложение открыто просто в браузере – в localStorage. */
(function () {
  "use strict";

  // Telegram может держать в кэше старый index.html без новых файлов – тогда догружаем их сами
  if (!window.TASK_DAYS || !window.BADGES) {
    const r = Date.now(), add = (src, cb) => { const x = document.createElement("script"); x.src = src + "?r=" + r; x.onload = cb; document.body.appendChild(x); };
    if (!document.querySelector('link[href^="style.css?"]')) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "style.css?r=" + r; document.head.appendChild(l); }
    add("products.js", () => add("tasks.js", () => add("app.js", () => {})));
    return;
  }

  const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData !== undefined
    ? window.Telegram.WebApp : null;
  if (tg) {
    try { tg.ready(); tg.expand(); tg.setHeaderColor("#F3F7F2"); tg.setBackgroundColor("#F3F7F2"); } catch (e) {}
    // Свайп вниз в Telegram сворачивает приложение и «перехватывает» нажатия на поля ввода – отключаем его
    try { if (tg.isVersionAtLeast && tg.isVersionAtLeast("7.7") && tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch (e) {}
  }
  const P = window.PRODUCTS, L = window.LESSONS, KT = window.KNOWLEDGE_TEST, CH = window.CHALLENGES;
  const TD = window.TASK_DAYS, STAGES = window.PET_STAGES, TIPS = window.PET_TIPS, BADGES = window.BADGES;
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
    if (key === "lesson") { toast("Урок пройден ✓"); checkBadges(); }
  }
  function checkAwards() {
    const h = habits(dkey());
    if (h.breakfast) award("breakfast", 10, "завтрак");
    if (h.water) award("water", 10, "вода");
    if (h.veg) award("veg", 5, "овощи");
    if (h.training) award("training", 10, "тренировка");
    if (h.mood) award("mood", 5, "самочувствие");
    syncTasks();
  }
  const level = () => petLevel();

  // ---------------------------------------------------------------- Курс: 10 дней × 3 задания, 2 задания = 1 уровень
  const TASKS = [
    { id: "b", icon: "🍳", act: "Записать", go: "breakfast" },
    { id: "w", icon: "💧", act: "+ стакан", go: "water" },
    { id: "p", icon: "🥗", act: "Собрать", go: "plate" },
  ];
  const keyToDate = k => new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8));
  function course() {
    let c = Store.get("course", null);
    if (!c) { c = { start: dkey(), done: {}, seen: 0 }; Store.set("course", c); }
    return c;
  }
  function courseDay() {
    const ms = new Date(new Date().setHours(0, 0, 0, 0)) - keyToDate(course().start);
    return Math.floor(ms / 864e5) + 1;
  }
  function hasPlate(d) {
    return MEALS.some(m => {
      const cats = new Set(d.e.filter(e => e.ml === m.id).map(e => entryNutr(e).cat));
      return cats.has("veg") && (cats.has("prot") || cats.has("dairy")) && cats.has("carb");
    });
  }
  function taskState(k) { const d = getDay(k); return { b: d.e.some(e => e.ml === "b"), w: d.w >= 6, p: hasPlate(d), water: d.w }; }
  function syncTasks() {
    const c = course(), k = dkey(), st = taskState(k), cur = c.done[k] || {};
    let fresh = 0;
    TASKS.forEach(t => { if (st[t.id] && !cur[t.id]) { cur[t.id] = 1; fresh++; } });
    if (!fresh) return checkBadges();
    const before = Math.min(10, Math.floor(tasksDone() / 2));
    c.done[k] = cur; Store.set("course", c);
    const after = petLevel();
    haptic("medium");
    if (after > before) setTimeout(() => celebrate(after), 250);
    else toast(fresh > 1 ? `Заданий выполнено: ${fresh} ✓` : "Задание выполнено ✓ Стрелка растёт");
    checkBadges();
  }
  const tasksDone = () => Object.values(course().done).reduce((a, x) => a + Object.keys(x).length, 0);
  const petLevel = () => Math.min(10, Math.floor(tasksDone() / 2));
  const stageOf = lvl => STAGES.filter(st => lvl >= st.from).pop();
  function badgeState() {
    const c = course(), days = Object.keys(c.done).sort(), cnt = t => days.filter(k => c.done[k][t]).length;
    let run = 0, best = 0, prev = null;
    days.forEach(k => { if (prev && dkey(addDays(keyToDate(prev), 1)) === k) run++; else run = 1; best = Math.max(best, run); prev = k; });
    const lvl = petLevel();
    return {
      first: tasksDone() >= 1, hatch: lvl >= 1, perfect: days.some(k => Object.keys(c.done[k]).length >= 3), streak3: best >= 3,
      water5: cnt("w") >= 5, breakfast5: cnt("b") >= 5, plate5: cnt("p") >= 5,
      lessons3: Object.keys(lessonsState().done).length >= 3, lvl5: lvl >= 5, champ: lvl >= 10,
    };
  }
  function checkBadges() {
    const st = badgeState(), got = Store.get("badges", {});
    const fresh = BADGES.filter(b => st[b.id] && !got[b.id]);
    if (!fresh.length) return;
    fresh.forEach(b => got[b.id] = dkey()); Store.set("badges", got);
    $$(".bdg").forEach(el => el.classList.toggle("on", !!got[el.dataset.b]));
    if ($("#bdgN")) $("#bdgN").textContent = `${Object.keys(got).length}/${BADGES.length}`;
    setTimeout(() => toast(`${fresh[0].icon} Новый значок: ${fresh[0].title}`), $("#celebrate.on") ? 2600 : 1900);
  }
  function celebrate(lvl) {
    const st = stageOf(lvl);
    let el = $("#celebrate");
    if (!el) { el = document.createElement("div"); el.id = "celebrate"; document.body.appendChild(el); el.onclick = () => el.classList.remove("on"); }
    const colors = ["#F2C94C", "#4F9465", "#8FC09C", "#F4B9B2", "#FFFFFF"];
    const conf = Array.from({ length: 36 }, (_, i) => `<i style="left:${(i * 37) % 100}%;background:${colors[i % 5]};animation-delay:${(i % 9) * 0.07}s;animation-duration:${1.6 + (i % 5) * 0.25}s"></i>`).join("");
    el.innerHTML = `<div class="conf">${conf}</div><div class="cel-card">
      <div class="cel-pet">${petSVG("happy", lvl, 170)}</div>
      <div class="cel-lvl">Уровень ${lvl}</div><h2>${lvl === 10 ? "Стрелка – чемпион! 👑" : lvl === 1 ? "Стрелка вылупилась! 🐣" : "Стрелка подросла!"}</h2>
      <p>${esc(st.text)}</p><button class="btn">Ура!</button></div>`;
    el.classList.add("on"); haptic("heavy");
  }
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
    const since = (Store.data.profile && Store.data.profile.u) || Date.now();
    const newbie = Date.now() - since < 2 * 864e5;
    if (newbie && lastActiveDaysAgo() >= 30) return { mood: "happy", text: "Привет! Я Стрелка. Отметь первую привычку – и я начну расти 🐣" };
    if (lastActiveDaysAgo() >= 2) return { mood: "sad", text: "Стрелка скучает по тебе. Начнём с малого – стакан воды?" };
    return { mood: "ok", text: "Стрелка ждёт завтрак и стакан воды 🙂" };
  }
  function petSVG(mood, lvl, size = 96) {
    if (lvl <= 0) return `<svg class="pet-svg" width="${size}" height="${size}" viewBox="0 0 120 120" aria-label="Яйцо Стрелки">
      <ellipse cx="60" cy="112" rx="30" ry="5" fill="rgba(35,65,46,.18)"/>
      <path d="M60 14 C 86 14 100 52 100 74 C 100 96 82 110 60 110 C 38 110 20 96 20 74 C 20 52 34 14 60 14 Z" fill="#F7F2E1"/>
      <path d="M60 14 C 86 14 100 52 100 74 C 100 96 82 110 60 110" fill="none" stroke="#E8DFC3" stroke-width="5"/>
      <g fill="#8FC09C"><circle cx="42" cy="46" r="7"/><circle cx="78" cy="38" r="5"/><circle cx="84" cy="84" r="8"/><circle cx="36" cy="88" r="5"/></g>
      <path d="M30 66 L42 58 L52 68 L62 58 L72 68 L82 58 L92 66" fill="none" stroke="#23412E" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      <ellipse cx="50" cy="76" rx="4.5" ry="5.5" fill="#23412E"/><ellipse cx="70" cy="76" rx="4.5" ry="5.5" fill="#23412E"/>
      <circle cx="51.5" cy="74" r="1.6" fill="#fff"/><circle cx="71.5" cy="74" r="1.6" fill="#fff"/></svg>`;
    const s = 0.8 + Math.min(lvl, 10) * 0.022;
    const mouth = mood === "happy" ? "M44 66 Q60 82 76 66" : mood === "sad" ? "M46 74 Q60 64 74 74" : "M47 70 Q60 76 73 70";
    const eyes = mood === "sad"
      ? `<path d="M38 54 Q44 50 50 54" stroke="#23412E" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M70 54 Q76 50 82 54" stroke="#23412E" stroke-width="4" fill="none" stroke-linecap="round"/>`
      : `<ellipse cx="44" cy="54" rx="6" ry="7.5" fill="#23412E"/><ellipse cx="76" cy="54" rx="6" ry="7.5" fill="#23412E"/><circle cx="46" cy="51" r="2" fill="#fff"/><circle cx="78" cy="51" r="2" fill="#fff"/>`;
    const band = lvl >= 4 ? `<path d="M19 40 Q60 28 101 40 L101 47 Q60 35 19 47 Z" fill="#E25B4B"/><path d="M99 42 l12 -6 l-3 9 l7 5 l-14 -1 z" fill="#E25B4B"/>` : "";
    const medal = lvl >= 7 ? `<path d="M52 86 L60 98 L68 86" fill="none" stroke="#4F9465" stroke-width="4"/><circle cx="60" cy="102" r="8" fill="#F2C94C" stroke="#fff" stroke-width="2"/><text x="60" y="105.5" font-size="9" text-anchor="middle" fill="#fff" font-weight="800">★</text>` : "";
    const crown = lvl >= 10 ? `<path d="M38 30 L44 12 L52 24 L60 6 L68 24 L76 12 L82 30 Z" fill="#F2C94C" stroke="#D9A926" stroke-width="2" stroke-linejoin="round"/><circle cx="60" cy="20" r="2.5" fill="#E25B4B"/>` : "";
    const antenna = lvl >= 10 ? "" : `<g fill="#23412E"><rect x="59" y="6" width="2.5" height="22"/><polygon points="60,0 53,13 60,10 67,13"/></g>`;
    const arms = `<path d="M18 76 C 6 80 4 92 10 95 C 16 98 21 89 22 83 Z" fill="#8FC09C"/><path d="M102 76 C 114 80 116 92 110 95 C 104 98 99 89 98 83 Z" fill="#8FC09C"/>`;
    const sparkle = mood === "happy" || lvl >= 10 ? `<g class="spark" fill="#F2C94C"><circle cx="12" cy="30" r="3"/><circle cx="110" cy="22" r="2.5"/><circle cx="106" cy="86" r="3"/><circle cx="16" cy="96" r="2"/></g>` : "";
    return `<svg class="pet-svg" width="${size}" height="${size}" viewBox="0 0 120 120" aria-label="Питомец Стрелка">
      <g transform="translate(60 64) scale(${s}) translate(-60 -64)">
      <ellipse cx="60" cy="112" rx="34" ry="5" fill="rgba(35,65,46,.18)"/>
      ${antenna}${arms}
      <path d="M60 26 C 96 26 106 56 104 74 C 102 96 84 108 60 108 C 36 108 18 96 16 74 C 14 56 24 26 60 26 Z" fill="#8FC09C"/>
      <path d="M60 34 C 90 34 98 60 96 74 C 94 92 80 100 60 100 C 40 100 26 92 24 74 C 22 60 30 34 60 34 Z" fill="#C4DDCA"/>
      ${band}${eyes}
      <ellipse cx="34" cy="66" rx="7" ry="4" fill="#F4B9B2"/><ellipse cx="86" cy="66" rx="7" ry="4" fill="#F4B9B2"/>
      <path d="${mouth}" stroke="#23412E" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      ${medal}${crown}</g>${sparkle}</svg>`;
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
      ${pct > 0 ? `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${over ? "#D9822B" : "#4F9465"}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C * pct} ${C}"/>` : ""}
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
        <label class="f">Как тебя зовут?</label><input class="inp" id="o_name" type="text" value="${esc(p.name)}" maxlength="30" placeholder="Имя" autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" enterkeyhint="done">
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
    syncTasks();
    const k = dkey(); const d = getDay(k); const t = totals(d); const h = habits(k);
    const lvl = petLevel(); const pm = petMood(); const st = stageOf(lvl);
    const done = tasksDone(); const day = courseDay(); const dayN = Math.min(day, 10);
    const today = course().done[k] || {}; const ts = taskState(k);
    const plan = TD[(day - 1) % TD.length];
    const doneToday = TASKS.filter(x => today[x.id]).length;
    const test = Store.get("test", {});
    const ls = lessonsState();
    const next = L.find(x => !ls.done[x.id]);
    const inLvl = lvl >= 10 ? 2 : done - lvl * 2;
    const taskCard = x => {
      const [title, hint] = plan[x.id]; const ok = !!today[x.id];
      const extra = x.id === "w" && !ok ? `<div class="t-prog">${bar(ts.water, 6)}<span>${ts.water}/6</span></div>` : "";
      return `<div class="task ${ok ? "done" : ""}" data-t="${x.id}">
        <div class="t-ic">${x.icon}</div>
        <div class="t-body"><b>${esc(title)}</b><span>${esc(hint)}</span>${extra}</div>
        ${ok ? `<div class="t-check">✓</div>` : `<button class="t-btn" data-go="${x.go}">${x.act}</button>`}</div>`;
    };
    view.innerHTML = `
      <section class="hero">
        <div class="hero-top"><span class="pill">${day > 10 ? "Курс пройден 🎉" : `День ${dayN} из 10 · ${esc(plan.theme)}`}</span><span class="pill">🔥 ${streak()}</span></div>
        <div class="hero-pet" id="petTap"><div class="bubble" id="petSay"></div>${petSVG(pm.mood, lvl, 176)}</div>
        <div class="hero-name">Стрелка · ${st.name}</div>
        <div class="lvl"><span class="lvl-n">Уровень ${lvl}<small>/10</small></span><span class="lvl-s">${lvl >= 10 ? "максимум!" : `ещё ${2 - inLvl} ${2 - inLvl === 1 ? "задание" : "задания"} до ${lvl + 1}`}</span></div>
        <div class="lvl-bar"><i style="width:${(inLvl / 2) * 100}%"></i></div>
      </section>

      <div class="sec-head"><h2>Задания на сегодня</h2><span class="badge ${doneToday === 3 ? "ok" : ""}">${doneToday}/3</span></div>
      <div class="tasks">${TASKS.map(taskCard).join("")}</div>
      ${doneToday === 3 ? `<div class="note good">Все задания на сегодня выполнены! Возвращайся завтра – Стрелка будет ждать 💚</div>` : ""}

      <div class="tiles">
        <button class="tile" id="openPath"><b>🗺️</b><span>Путь Стрелки</span><i>${done}/30</i></button>
        <button class="tile" id="openBadges"><b>🏅</b><span>Значки</span><i id="bdgN">${Object.keys(Store.get("badges", {})).length}/${BADGES.length}</i></button>
      </div>
      ${!test.before ? `<button class="card promo slim" id="testBefore"><span>📝 Тест «до» – 10 вопросов</span><b>Пройти ›</b></button>` : ""}`;
    $$(".t-btn").forEach(b => b.onclick = e => {
      e.stopPropagation(); haptic();
      const g = b.dataset.go;
      if (g === "breakfast") { diaryDate = new Date(); go("diary"); setTimeout(() => openAdd("b"), 60); }
      else if (g === "water") { const dd = getDay(k); dd.w = Math.min(12, dd.w + 1); setDay(k, dd); checkAwards(); renderHome(); }
      else if (g === "plate") go("plate");
    });
    let tipI = Math.floor(Math.random() * TIPS.length);
    $("#petTap").onclick = () => {
      const el = $("#petTap"), say = $("#petSay");
      el.classList.remove("hop"); void el.offsetWidth; el.classList.add("hop"); haptic();
      say.textContent = lvl === 0 ? "Тук-тук! Выполни 2 задания – и я вылуплюсь 🥚" : TIPS[tipI++ % TIPS.length];
      say.classList.remove("on"); void say.offsetWidth; say.classList.add("on");
      clearTimeout(say._t); say._t = setTimeout(() => say.classList.remove("on"), 4200);
    };
    if ($("#testBefore")) $("#testBefore").onclick = () => renderTest("before");
    $("#openPath").onclick = () => openSheet(`<h2>Путь Стрелки</h2><p class="muted">${done} из 30 заданий · каждые 2 задания – новый уровень</p>
      <div class="path">${Array.from({ length: 10 }, (_, i) => { const L1 = i + 1; const ic = { 1: "🐣", 4: "💪", 7: "🏅", 10: "👑" }[L1] || L1; return `<div class="node ${lvl >= L1 ? "on" : ""} ${lvl + 1 === L1 ? "next" : ""}"><span>${ic}</span></div>`; }).join("")}</div>
      <div class="path-legend"><span>🐣 Малыш</span><span>💪 Спортсмен</span><span>🏅 Профи</span><span>👑 Чемпион</span></div>
      <p class="muted small" style="margin-top:12px">${esc(st.text)}</p>`);
    $("#openBadges").onclick = () => { const got = Store.get("badges", {});
      openSheet(`<h2>Мои значки</h2><p class="muted">${Object.keys(got).length} из ${BADGES.length} · нажми на значок, чтобы узнать, как его получить</p>
        <div class="badges">${BADGES.map(b => `<button class="bdg ${got[b.id] ? "on" : ""}" data-b="${b.id}"><span>${b.icon}</span><i>${esc(b.title)}</i></button>`).join("")}</div>
        <p class="muted small" id="bdgHint" style="margin-top:12px;min-height:18px"></p>`, sh => {
        $$(".bdg", sh).forEach(b => b.onclick = () => { const x = BADGES.find(y => y.id === b.dataset.b);
          $("#bdgHint", sh).textContent = got[x.id] ? `${x.icon} ${x.title} – получен!` : `${x.icon} ${x.title}: ${x.hint}`; });
      }); };
  }
  function openMood() {
    const k = dkey();
    openSheet(`<h2>Как ты сегодня?</h2><p class="muted">Оцени энергию и самочувствие от 1 до 5</p>
      <div class="seg" style="margin-top:10px">${[1, 2, 3, 4, 5].map(i => `<button data-v="${i}" style="font-size:22px">${["😫", "😕", "🙂", "😊", "🤩"][i - 1]}<br><span style="font-size:12px">${i}</span></button>`).join("")}</div>`, sh => {
      $$(".seg button", sh).forEach(b => b.onclick = () => {
        const d = getDay(k); d.m = +b.dataset.v; setDay(k, d); closeSheet(); checkAwards();
        if (d.m <= 2) toast("Бывает. Загляни в «Нет мотивации» – там есть поддержка 💚"); render();
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
        return `<div class="card meal slim"><div class="meal-h"><span>${m.icon} ${m.label}</span><span class="muted small">${mk ? r0(mk) + " ккал" : ""}</span><button class="add plus" data-m="${m.id}" aria-label="Добавить">+</button></div>
          ${es.length ? `<div class="list">${es.map(x => { const nn = entryNutr(x.e); return `<div class="item"><div><div class="t">${esc(nn.n)}</div><div class="s">${x.e.g} г · ${r0(nn.k)} ккал</div></div><button class="del" data-i="${x.i}" aria-label="Удалить">×</button></div>`; }).join("")}</div>` : ""}</div>`;
      }).join("")}
      <div class="card"><div class="row between"><b>💧 Вода · ${d.w}/6</b>
        <div class="row"><button class="btn small ghost" id="wMinus">−</button><button class="btn small" id="wPlus">+ стакан</button></div></div></div>
      <div class="habits three">
        <label class="habit ${d.ns ? "done" : ""}"><input type="checkbox" id="noSoda" ${d.ns ? "checked" : ""} hidden><b>🚫</b>${d.ns ? "Без газировки ✓" : "Без газировки?"}</label>
        <button class="habit ${d.t ? "done" : ""}" id="hTrain"><b>🏋️</b>${d.t ? "Тренировка ✓" : "Тренировка?"}</button>
        <button class="habit ${d.m ? "done" : ""}" id="hMood"><b>${["🙂", "😫", "😕", "🙂", "😊", "🤩"][d.m || 0]}</b>${d.m ? "Энергия " + d.m + "/5" : "Как ты?"}</button>
      </div>`;
    $("#prevD").onclick = () => { diaryDate = addDays(diaryDate, -1); renderDiary(); };
    $("#nextD").onclick = () => { if (!isToday) { diaryDate = addDays(diaryDate, 1); renderDiary(); } };
    $$(".add").forEach(b => b.onclick = () => openAdd(b.dataset.m));
    $$(".del").forEach(b => b.onclick = () => { const dd = getDay(k); dd.e.splice(+b.dataset.i, 1); setDay(k, dd); renderDiary(); });
    $("#wPlus").onclick = () => { const dd = getDay(k); dd.w = Math.min(12, dd.w + 1); setDay(k, dd); haptic(); if (isToday) checkAwards(); renderDiary(); };
    $("#wMinus").onclick = () => { const dd = getDay(k); dd.w = Math.max(0, dd.w - 1); setDay(k, dd); renderDiary(); };
    $("#noSoda").onchange = e => { const dd = getDay(k); dd.ns = e.target.checked ? 1 : 0; setDay(k, dd); if (isToday && dd.ns) toast("Отлично! Засчитано в челлендж"); renderDiary(); };
    $("#hTrain").onclick = () => { const dd = getDay(k); dd.t = dd.t ? 0 : 1; setDay(k, dd); haptic(); if (isToday) checkAwards(); renderDiary(); };
    $("#hMood").onclick = openMood;
  }
  function defaultMeal() { const h = new Date().getHours(); return h < 11 ? "b" : h < 16 ? "l" : h < 21 ? "d" : "s"; }
  const norm = s => String(s).toLowerCase().replace(/ё/g, "е").replace(/[«»"(),.]/g, " ");
  const FOOD_CATS = [["", "Все"], ["carb", "Гарниры"], ["prot", "Белок"], ["dairy", "Молочное"], ["veg", "Овощи и фрукты"], ["ready", "Готовые блюда"], ["snack", "Перекусы"], ["drink", "Напитки"]];
  function openPhoto(meal) {
    const canSend = !!(tg && tg.initData && tg.sendData);
    openSheet(`<div class="photo-hero">📷🍽️</div><h2>Посчитать КБЖУ по фото</h2>
      <ol class="steps"><li>Нажми кнопку ниже – откроется чат со Стрелкой</li><li>Сфотографируй тарелку сверху и отправь фото в чат</li>
      <li>Стрелка распознает блюда и посчитает калории, белки, жиры и углеводы</li><li>Нажми «Добавить в дневник» – всё запишется само</li></ol>
      <p class="muted small">Оценка по фото примерная (±20%). Можно поправить граммы после добавления.</p>
      <button class="btn" id="phGo">📷 Отправить фото Стрелке</button>`, sh => {
      $("#phGo", sh).onclick = () => {
        Store.set("photoMeal", meal);
        if (canSend) { try { tg.sendData(JSON.stringify({ t: "photo", m: meal })); return; } catch (e) {} }
        if (tg && tg.close) { toast("Отправь фото тарелки в чат с ботом 📷"); setTimeout(() => tg.close(), 1200); }
        else toast("Отправь фото тарелки в чат с ботом @PitLabb_bot 📷");
      };
    });
  }
  function importFromBot() {
    const raw = new URLSearchParams(location.search).get("add");
    if (!raw) return false;
    let data; try { data = JSON.parse(decodeURIComponent(escape(atob(raw.replace(/-/g, "+").replace(/_/g, "/"))))); } catch (e) { return false; }
    const doneKey = "imp_" + (data.id || raw.slice(0, 24));
    if (Store.get(doneKey)) { tab = "diary"; return true; }
    const meal = data.m || Store.get("photoMeal") || defaultMeal();
    const num = x => Math.max(0, Math.round((+x || 0) * 10) / 10);
    (data.e || []).slice(0, 12).forEach(x => {
      const [n, g, k, p, f, c, cat] = x;
      if (!n || !(+g > 0)) return;
      addEntry({ i: -1, n: String(n).slice(0, 40), g: Math.round(+g), k: num(k), p: num(p), f: num(f), c: num(c), cat: ["veg", "prot", "carb", "dairy", "snack", "drink", "ready"].includes(cat) ? cat : "ready", ml: meal, ph: 1 }, true);
    });
    Store.set(doneKey, 1);
    tab = "diary"; diaryDate = new Date();
    setTimeout(() => toast("📷 Блюда с фото добавлены в дневник ✓"), 400);
    return true;
  }
  function openAdd(meal) {
    meal = meal || defaultMeal();
    openSheet(`<h2>Добавить еду</h2>
      <div class="seg" id="aMeal" style="margin:10px 0">${MEALS.map(m => `<button data-v="${m.id}" class="${m.id === meal ? "on" : ""}">${m.icon} ${m.label}</button>`).join("")}</div>
      <button class="photo-btn" id="aPhoto"><b>📷</b><span><strong>Посчитать по фото</strong><i>Сфоткай тарелку – Стрелка определит КБЖУ</i></span></button>
      <input class="inp" id="aQ" placeholder="Поиск среди ${P.length} продуктов…" autocomplete="off">
      <div class="chips" id="aCat">${FOOD_CATS.map((c, i) => `<button data-c="${c[0]}" class="${i ? "" : "on"}">${c[1]}</button>`).join("")}</div>
      <div class="list" id="aList" style="margin-top:6px"></div>
      <button class="btn ghost" id="aCustom" style="margin-top:8px">Нет в списке? Добавить свой продукт</button>`, sh => {
      $$("#aMeal button", sh).forEach(b => b.onclick = () => { meal = b.dataset.v; $$("#aMeal button", sh).forEach(x => x.classList.toggle("on", x === b)); });
      const list = $("#aList", sh); let cat = "";
      $$("#aCat button", sh).forEach(b => b.onclick = () => { cat = b.dataset.c; $$("#aCat button", sh).forEach(x => x.classList.toggle("on", x === b)); draw(); });
      $("#aPhoto", sh).onclick = () => openPhoto(meal);
      const draw = () => {
        const words = norm($("#aQ", sh).value).split(/\s+/).filter(Boolean).map(w => w.length > 4 ? w.slice(0, w.length > 6 ? 5 : 4) : w);
        const res = P.map((x, i) => ({ x, i, t: norm(x.n) }))
          .filter(o => (!cat || cat.split(",").includes(o.x.cat)) && words.every(w => o.t.includes(w)))
          .sort((a, b) => words.length ? (a.t.startsWith(words[0]) ? 0 : 1) - (b.t.startsWith(words[0]) ? 0 : 1) : 0)
          .slice(0, words.length || cat ? 60 : 20);
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
          closeSheet(); haptic("medium"); toast("Тарелка записана в дневник ✓"); checkAwards();
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
    return { t: "summary", n: p.name, act, br, wa, ve, tr, le, kc: kcDays ? r0((kcSum / kcDays / n.kcal) * 100) : 0, en: enN ? r1(en / enN) : 0, pts: weekPoints(), lvl: petLevel(), tasks: tasksDone() };
  }
  function syncPayload() {
    const test = Store.get("test", {});
    let act10 = 0; for (let i = 0; i < 10; i++) if (habits(dkey(addDays(new Date(), -i))).active) act10++;
    return { t: "sync", pts: weekPoints(), xp: xpState().xp, lvl: petLevel(), tasks: tasksDone(), day: courseDay(), a10: act10, tb: test.before ? test.before.s : null, ta: test.after ? test.after.s : null, r: Store.get("rating", null), ls: Object.keys(lessonsState().done).length };
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
        <details class="more"><summary>Как считается норма</summary><p class="muted small">Формула Шофилда для 10–18 лет × уровень активности. Цель «сбросить» снижает норму максимум на 10%, и она никогда не опускается ниже безопасного минимума. Нормы БЖУ – по рекомендациям для подростков-спортсменов. Это ориентир, не медицинская рекомендация.</p></details></div>
      <div class="card"><div class="eyebrow">👟 Тренер на связи</div>
        <p class="muted">Тренер увидит только сводку привычек – без веса и без того, что ты ел.</p>
        <details class="more"><summary>Что увидит тренер</summary><div class="card sky" style="white-space:pre-line;font-size:13px">${esc(summaryText(s))}</div><p class="muted small">Подключить тренера: его ссылка-приглашение или в боте <b>👟 Тренер</b> → «Ввести код тренера».</p></details>
        <button class="btn" id="sendCoach">Отправить сводку тренеру</button></div>
      <div class="card"><div class="eyebrow">Оцени ПитЛаб</div><p class="muted">Насколько ПитЛаб тебе полезен?</p>
        <div class="seg" id="rate">${[1, 2, 3, 4, 5].map(i => `<button data-v="${i}" class="${rating === i ? "on" : ""}">${i}</button>`).join("")}</div></div>
      <div class="card"><button class="btn ghost" id="tourAgain" style="margin-bottom:8px">🐣 Обучение от Стрелки заново</button><button class="btn ghost" id="testA">Пройти тест знаний «после»</button>
        <button class="btn ghost" id="reset" style="margin-top:8px;color:var(--bad)">Удалить все мои данные</button></div>
      <p class="muted small" style="text-align:center">ПитЛаб · команда «Белая стрела» · MVP</p>`;
    $("#edit").onclick = () => renderOnboarding(true);
    $("#sendCoach").onclick = () => sendToBot(s, "отправить сводку тренеру");
    $$("#rate button").forEach(b => b.onclick = () => { Store.set("rating", +b.dataset.v); $$("#rate button").forEach(x => x.classList.toggle("on", x === b)); toast("Спасибо за оценку!"); });
    $("#testA").onclick = () => renderTest("after");
    $("#tourAgain").onclick = () => startTour();
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


  // ---------------------------------------------------------------- Обучение: Стрелка показывает кнопки
  const TOUR = [
    { sel: null, title: "Привет, я Стрелка!", text: "Я твой тамагочи. Пока я в яйце! Каждый день у тебя 3 задания: завтрак, вода и сбалансированная тарелка. Каждые 2 задания – мой новый уровень. Покажу, что тут где – 30 секунд." },
    { sel: '#tabs [data-tab="home"]', tab: "home", title: "Главная", text: "Здесь я живу. Тут задания на сегодня, мой уровень и путь до короны 👑 Выполняй задания – я буду расти." },
    { sel: '#tabs [data-tab="diary"]', tab: "diary", title: "Дневник", text: "Записывай, что ты ел. Я сам посчитаю калории, белки, жиры и углеводы. Можно добавить свой продукт." },
    { sel: '#tabs [data-tab="plate"]', tab: "plate", title: "Собери тарелку", text: "Половина – овощи, четверть – белок, четверть – гарнир. Собери обед и добавь его в дневник одной кнопкой." },
    { sel: '#tabs [data-tab="lessons"]', tab: "lessons", title: "Уроки", text: "Короткие уроки по 2 минуты с мини-тестами. Объясняю простым языком, без скучных цифр 💪" },
    { sel: '#tabs [data-tab="challenges"]', tab: "challenges", title: "Челленджи", text: "Задания на неделю и соревнование с друзьями. Очки – только за привычки, никаких рейтингов по весу." },
    { sel: "#sosBtn", title: "Нет мотивации", text: "Если опустились руки или сорвался – жми сюда. Там поддержка и телефон доверия. Срыв – не провал 💚" },
    { sel: "#profileBtn", title: "Профиль", text: "Твоя норма, связь с тренером и кнопка «Отправить сводку». Здесь же можно пройти это обучение заново." },
    { sel: null, tab: "home", title: "Готово!", text: "Начнём с первого задания – запиши завтрак или выпей стакан воды. Я жду, чтобы вылупиться 🐣" },
  ];
  let tourI = 0;
  function startTour() {
    tourI = 0; closeSheet();
    let el = $("#tour");
    if (!el) {
      el = document.createElement("div"); el.id = "tour";
      el.innerHTML = '<div class="tour-hole"></div><div class="tour-dim"></div><div class="tour-box"><div class="tour-pet"></div><div class="tour-body"><b class="tour-title"></b><p class="tour-text"></p><div class="tour-dots"></div><div class="tour-btns"><button class="tour-skip">Пропустить</button><button class="btn tour-next">Дальше</button></div></div></div>';
      document.body.appendChild(el);
      $(".tour-skip", el).onclick = endTour;
      $(".tour-next", el).onclick = () => { haptic(); tourI++; tourI < TOUR.length ? showTourStep() : endTour(); };
      window.addEventListener("resize", () => { if ($("#tour.on")) placeTour(); });
    }
    el.classList.add("on");
    showTourStep();
  }
  function showTourStep() {
    const st = TOUR[tourI], el = $("#tour");
    if (st.tab && st.tab !== tab) { tab = st.tab; render(); }
    $(".tour-pet", el).innerHTML = petSVG(tourI === TOUR.length - 1 || tourI === 0 ? "happy" : "ok", 1, 64);
    $(".tour-title", el).textContent = st.title;
    $(".tour-text", el).textContent = st.text;
    $(".tour-dots", el).innerHTML = TOUR.map((_, i) => `<i class="${i === tourI ? "on" : ""}"></i>`).join("");
    $(".tour-next", el).textContent = tourI === TOUR.length - 1 ? "Поехали!" : "Дальше";
    $(".tour-skip", el).style.visibility = tourI === TOUR.length - 1 ? "hidden" : "visible";
    requestAnimationFrame(placeTour);
  }
  function placeTour() {
    const st = TOUR[tourI], el = $("#tour"), hole = $(".tour-hole", el), box = $(".tour-box", el), dim = $(".tour-dim", el);
    const t = st.sel && $(st.sel);
    const vw = window.innerWidth, vh = window.innerHeight;
    if (!t) {
      hole.style.display = "none"; dim.style.display = "block";
      box.style.top = Math.max(16, vh / 2 - box.offsetHeight / 2) + "px"; box.className = "tour-box";
      return;
    }
    const r = t.getBoundingClientRect(), pad = 6;
    hole.style.display = "block"; dim.style.display = "none";
    Object.assign(hole.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
    const below = r.top + r.height / 2 < vh / 2;
    const top = below ? r.bottom + 18 : r.top - 18 - box.offsetHeight;
    box.style.top = Math.max(12, Math.min(vh - box.offsetHeight - 12, top)) + "px";
    box.className = "tour-box " + (below ? "up" : "down");
    box.style.setProperty("--ax", Math.max(28, Math.min(vw - 28, r.left + r.width / 2)) - 12 + "px");
  }
  function endTour() {
    const el = $("#tour"); if (el) el.classList.remove("on");
    Store.set("tourDone", true);
    if (tab !== "home") { tab = "home"; render(); }
  }

  // ---------------------------------------------------------------- Маршрутизация
  function markTabs() { $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab)); }
  function render() {
    if (!Store.get("profile")) return renderOnboarding(false);
    $("#tabs").style.display = "";
    markTabs();
    ({ home: renderHome, diary: renderDiary, plate: renderPlate, lessons: renderLessons, challenges: renderChallenges, profile: renderProfile, sos: renderSOS }[tab] || renderHome)();
    if (!Store.get("tourDone") && !$("#tour.on")) setTimeout(startTour, 350);
  }

  // Надёжный фокус: в некоторых версиях Telegram первое касание поля не ставит курсор
  document.addEventListener("touchend", e => {
    const el = e.target.closest && e.target.closest("input.inp, textarea.inp");
    if (el && document.activeElement !== el) setTimeout(() => { try { el.focus(); } catch (_) {} }, 0);
  }, { passive: true });
  // Enter в поле – просто прячет клавиатуру
  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.matches && e.target.matches("input.inp")) { e.preventDefault(); e.target.blur(); }
  });

  // ---------------------------------------------------------------- Заставка
  function splash(onStart) {
    const isNew = !Store.get("profile");
    const lvl = isNew ? 0 : petLevel();
    const el = document.createElement("div"); el.id = "splash";
    el.innerHTML = `<div class="sp-rings"><i></i><i></i><i></i></div>
      <div class="sp-logo"><svg width="46" height="18" viewBox="0 0 88 24"><g fill="#F6D97A"><rect x="12" y="11" width="62" height="3"/><polygon points="88,12.5 68,3 72,12.5 68,22"/><polygon points="18,12.5 8,3 0,3 10,12.5"/><polygon points="18,12.5 8,22 0,22 10,12.5"/></g></svg><span>Пит<em>Лаб</em></span></div>
      <div class="sp-pet">${petSVG("happy", lvl, 210)}</div>
      <h1 class="sp-title">${isNew ? "Вырасти свою Стрелку" : "Стрелка соскучилась!"}</h1>
      <p class="sp-text">${isNew ? "3 задания в день – и за 10 дней она вырастет из яйца до чемпиона" : `Уровень ${lvl} из 10`}</p>
      <button class="btn sp-btn">${isNew ? "Начать" : "Продолжить"}</button>
`;
    document.body.appendChild(el);
    $(".sp-btn", el).onclick = () => { haptic("medium"); el.classList.add("out"); setTimeout(() => el.remove(), 450); onStart(); };
  }
  Store.init().then(() => {
    const start = new URLSearchParams(location.search).get("tab") || (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param);
    if (start && ["home", "diary", "plate", "lessons", "challenges", "profile", "sos"].includes(start)) tab = start;
    if (importFromBot()) return render();
    if (start) return render();
    splash(() => render());
  });

  // для автотестов
  window.__pitlab = { calcNorm, Store, weekSummary, syncPayload, startTour, celebrate, petLevel, tasksDone, badgeState };
})();
