/* ПитЛаб – видео-уроки со Стрелкой.
   Это не файл-ролик, а «живое видео»: Стрелка говорит по сцене, реплика подсвечивается по словам,
   вокруг появляются картинки, звук (голос браузера) можно включить кнопкой.
   Так не нужен ни видеохостинг, ни тяжёлые файлы, а любые тексты уроков озвучиваются автоматически. */
(function () {
  "use strict";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const EMO = [
    [/белк|белок|мяс|кури|рыб|яйц|творог/, "🍗"], [/углевод|круп|каш|хлеб|макарон|рис|гречк|гарнир/, "🍚"], [/жир|масл|орех|авокадо/, "🥑"],
    [/калори|энерги|ккал/, "🔥"], [/вод[аыуе]|пить|стакан|питьё|жидкост/, "💧"], [/завтрак/, "🍳"], [/обед|тарелк/, "🍽️"], [/ужин/, "🌙"],
    [/овощ|фрукт|клетчатк|салат|зелен/, "🥦"], [/сахар|сладк|конфет|шоколад|газиров|сок/, "🍬"], [/сон|спать|спишь|выспа/, "😴"],
    [/тренир|зал|спорт|мышц|упражн/, "🏋️"], [/рост|подрост|растёт|растет/, "🌱"], [/настроени|эмоци|стресс|тревог/, "💭"], [/фаст|чипс|снек|перекус/, "🍟"],
    [/витамин|минерал|железо|кальци/, "💊"], [/этикетк|упаковк|состав/, "🏷️"], [/норм[аыу]|цел[ьи]|план/, "🎯"], [/дневник|запис/, "📒"],
    [/голос|скаж|продикт/, "🎙️"], [/фото/, "📷"], [/привычк|каждый день|регулярн/, "📆"], [/вес\b|похуд|набор/, "⚖️"], [/здоров|самочувств/, "💚"],
  ];
  function emojiFor(text, extra) {
    const t = String(text).toLowerCase().replace(/ё/g, "е"), out = [];
    if (extra) out.push(extra);
    for (const [re, e] of EMO) if (re.test(t) && !out.includes(e)) out.push(e);
    return out.slice(0, 3).length ? out.slice(0, 3) : ["💚"];
  }
  const BG = ["#3E8A57,#24452F", "#4F9465,#2B5A3F", "#5FA474,#1F3A29", "#3F7F55,#7FB48D", "#2F6F4A,#9CCBA8", "#E0A63E,#3E8A57"];

  function sentences(t) { return String(t).split(/(?<=[.!?…])\s+/).map(s => s.trim()).filter(Boolean); }
  function chunk(text, max = 120) {
    const out = []; let cur = "";
    for (const s of sentences(text)) { if (cur && (cur + " " + s).length > max) { out.push(cur); cur = s; } else cur = cur ? cur + " " + s : s; }
    if (cur) out.push(cur); return out;
  }

  function lessonScenes(x) {
    const sc = [{ say: `Привет! Я Стрелка. Сегодня коротко расскажу: ${x.title.charAt(0).toLowerCase() + x.title.slice(1)}.`, mood: "happy", emo: [x.icon] }];
    x.text.forEach(p => chunk(p).forEach(c => sc.push({ say: c, mood: "ok", emo: emojiFor(c) })));
    sc.push({ say: "Вот и всё! Теперь проверим себя – три коротких вопроса. У тебя получится!", mood: "happy", emo: ["🎯", "⭐"] });
    return sc;
  }

  const KIND = {
    b: [
      ["Открой «Дневник», нажми плюс у завтрака и выбери продукты из списка.", ["📒", "➕"]],
      ["Хочешь быстрее? Просто скажи голосом: «два яйца и овсянка». Я сама всё найду и посчитаю.", ["🎙️", "🍳"]],
    ],
    w: [
      ["Стакан воды – это примерно двести пятьдесят миллилитров. Пей понемногу в течение дня, а не залпом.", ["💧", "🥛"]],
      ["Выпил стакан – нажми плюс в Дневнике или тут, на главной. Мне приятно считать вместе с тобой!", ["➕", "💚"]],
    ],
    p: [
      ["Раздели тарелку: половина – овощи, четверть – белок, четверть – гарнир.", ["🥗", "🍗", "🍚"]],
      ["Открой «Тарелку», добавь продукты в приём пищи и смотри, как собирается полезный обед.", ["🍽️", "👀"]],
    ],
  };
  function taskScenes(kind, title, hint, theme) {
    const sc = [{ say: `Сегодня тема «${theme}». Задание: ${title.charAt(0).toLowerCase() + title.slice(1)}. ${hint.replace(/\s*[–-]\s*/, ": ")}`.replace(/\.\.$/, "."), mood: "happy", emo: emojiFor(title + " " + hint) }];
    (KIND[kind] || []).forEach(([say, emo]) => sc.push({ say, mood: "ok", emo }));
    sc.push({ say: "Сделаешь – я вырасту! Нажимай кнопку ниже, я подожду.", mood: "happy", emo: ["🌟", "💚"] });
    return sc;
  }

  // ---------------------------------------------------------------------------- плеер
  let cur = null;
  function close() {
    if (!cur) return; cur.stop(); cur.el.classList.remove("on");
    const el = cur.el; setTimeout(() => el.remove(), 250); cur = null;
  }

  const canSpeakNow = () => !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  function open(o) {
    close();
    const scenes = o.scenes, pet = o.pet;                       // pet(mood) -> svg
    const el = document.createElement("div"); el.className = "vid";
    el.innerHTML = `<div class="vid-bg"></div>
      <div class="vid-top"><div class="vid-segs">${scenes.map(() => `<i><b></b></i>`).join("")}</div>
        <div class="vid-bar"><span>${esc(o.title || "Видео-урок")}</span><button class="vid-x" aria-label="Закрыть">✕</button></div></div>
      <div class="vid-props"></div>
      <div class="vid-stage"><div class="vid-pet"></div><div class="vid-say"><div class="vid-text"></div></div></div>
      <div class="vid-ctl"><button data-a="prev" aria-label="Назад">⏮</button><button data-a="play" class="big" aria-label="Пауза">⏸</button><button data-a="next" aria-label="Дальше">⏭</button>
        <button data-a="voice" aria-label="Сменить голос">🗣</button><button data-a="snd" aria-label="Звук">${canSpeakNow() ? "🔊" : "🔇"}</button></div>
      <div class="vid-end"><div class="vid-end-in"><div class="vid-end-pet"></div><h2>${esc(o.endTitle || "Урок посмотрен!")}</h2><p>${esc(o.endText || "")}</p>
        ${o.cta ? `<button class="btn" data-a="cta">${esc(o.cta.label)}</button>` : ""}<button class="btn ghost" data-a="again" style="margin-top:8px">↻ Посмотреть ещё раз</button>
        <button class="btn ghost" data-a="close" style="margin-top:8px">${esc(o.closeLabel || "Закрыть")}</button></div></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("on"));

    const $ = s => el.querySelector(s), segs = [...el.querySelectorAll(".vid-segs b")];
    const synth = window.speechSynthesis, canSpeak = !!(synth && window.SpeechSynthesisUtterance);
    let idx = 0, t0 = 0, dur = 3000, paused = false, raf = 0, snd = canSpeak, spoke = false, elapsed = 0, ended = false;
    // голос: берём лучший женский русский голос устройства (приоритет – «Елена», затем Милена, Алёна, Светлана, Google/нейро-голоса)
    const rank = v => /elena|yelena|елена/i.test(v.name) ? 100 : /milena|alena|алена|алёна|svetlana|светлана|irina|ирина|dariya|дарья|katya|катя|google|yandex|natural|neural|online/i.test(v.name) ? 50 : /pavel|павел|yuri|юрий|dmitri|дмитрий|male/i.test(v.name) ? -10 : 10;
    const voice = () => { if (!canSpeak) return null; const vs = synth.getVoices().filter(v => /^ru/i.test(v.lang)); return vs.sort((a, b) => rank(b) - rank(a))[0] || null; };
    if (!canSpeak) { $('[data-a="snd"]').style.display = "none"; $('[data-a="voice"]').style.display = "none"; }

    function show(i) {
      idx = i; ended = false; el.classList.remove("done");
      const s = scenes[i];
      const words = s.say.split(/(\s+)/);
      $(".vid-text").innerHTML = words.map(w => /^\s+$/.test(w) ? w : `<span>${esc(w)}</span>`).join("");
      $(".vid-pet").innerHTML = pet(s.mood || "ok");
      $(".vid-bg").style.background = `linear-gradient(160deg,${BG[i % BG.length].split(",").join(",")})`;
      const pr = $(".vid-props"); pr.innerHTML = "";
      (s.emo || []).forEach((e, k) => { const b = document.createElement("div"); b.className = "vid-prop p" + k; b.innerHTML = window.PLIcon ? PLIcon(e) : e; b.style.animationDelay = (0.15 + k * 0.35) + "s"; pr.appendChild(b); });
      segs.forEach((b, k) => { b.style.width = k < i ? "100%" : "0"; });
      dur = Math.max(2800, s.say.length * 62);
      elapsed = 0; t0 = performance.now(); spoke = false;
      el.classList.toggle("talk", !paused);
      if (snd && canSpeak && !paused) speak(s.say);
    }
    const PRE = [["Мягкий", 1.15, 0.95], ["Спокойный", 1.0, 0.9], ["Бодрый", 1.3, 1.1], ["Низкий", 0.8, 1.0]];
    let vsel = 1; try { const sv = localStorage.getItem("pl_voice"); if (sv !== null) vsel = +sv || 0; } catch (e) {}
    const combos = () => { const vs = canSpeak ? synth.getVoices().filter(v => /^ru/i.test(v.lang)).sort((a, b) => rank(b) - rank(a)) : [], c = [];
      PRE.forEach(p => c.push({ v: vs[0] || null, p, label: p[0] + (vs[0] ? " · " + vs[0].name.replace(/Microsoft |Google |\s*-.*$/g, "") : "") }));
      vs.slice(1).forEach(v => c.push({ v, p: PRE[0], label: v.name.replace(/Microsoft |Google |\s*-.*$/g, "") })); return c; };
    // текст для озвучки: без тире, двоеточий, кавычек и скобок – вместо них паузы, цифры и единицы словами
    const speechText = t => String(t)
      .replace(/(\d)\s*[–—-]\s*(\d)/g, "$1 или $2 ").replace(/\s+[–—-]\s+/g, ", ").replace(/[–—]/g, ", ")
      .replace(/(\d+)\s*ккал/gi, "$1 килокалорий").replace(/ккал/gi, "килокалорий").replace(/(\d+)\s*%/g, "$1 процентов")
      .replace(/(\d+)\s*г(?![а-яё])/gi, "$1 грамм").replace(/(\d+)\s*мл(?![а-яё])/gi, "$1 миллилитров").replace(/КБЖУ/g, "ка бэ же у").replace(/БЖУ/g, "бэ же у")
      .replace(/:/g, ",").replace(/[«»"“”()\[\]]/g, "").replace(/;/g, ",").replace(/…/g, ".").replace(/\s*\/\s*/g, " или ").replace(/\+/g, " плюс ")
      .replace(/[\u{1F000}-\u{1FFFF}\u2600-\u27BF]/gu, "").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").trim();
    function speak(text) {
      try {
        synth.cancel(); const u = new SpeechSynthesisUtterance(speechText(text)); u.lang = "ru-RU"; const cs = combos(), cb = cs[vsel % (cs.length || 1)]; if (cb) { if (cb.v) u.voice = cb.v; u.pitch = cb.p[1]; u.rate = cb.p[2]; } else { const v = voice(); if (v) u.voice = v; }
        const my = idx; u.onend = () => { if (snd && !paused && idx === my && elapsed > 600) { spoke = true; } };
        synth.speak(u);
      } catch (e) {}
    }
    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (paused || ended) return;
      elapsed = now - t0;
      const p = Math.min(1, elapsed / dur);
      segs[idx].style.width = p * 100 + "%";
      const sp = el.querySelectorAll(".vid-text span"), n = Math.ceil(p * 1.15 * sp.length);
      sp.forEach((w, k) => w.classList.toggle("on", k < n));
      el.classList.toggle("talk", p < 0.96);
      if (p >= 1 && (!snd || !canSpeak || spoke || elapsed > dur * 2.2 + 3000 || !(synth && synth.speaking))) next();
    }
    function finish() {
      ended = true; el.classList.add("done"); el.classList.remove("talk"); try { synth && synth.cancel(); } catch (e) {}
      $(".vid-end-pet").innerHTML = pet("happy"); segs.forEach(b => b.style.width = "100%");
      if (o.onEnd) { try { o.onEnd(); } catch (e) {} }
    }
    function next() { if (idx + 1 >= scenes.length) finish(); else show(idx + 1); }
    function prev() { show(Math.max(0, idx - 1)); }
    function setPaused(v) {
      paused = v; $('[data-a="play"]').textContent = v ? "▶" : "⏸"; el.classList.toggle("talk", !v && !ended);
      if (v) { try { synth && synth.pause(); } catch (e) {} t0 = performance.now() - elapsed; }
      else { t0 = performance.now() - elapsed; try { synth && synth.resume(); } catch (e) {} }
    }
    el.addEventListener("click", e => {
      const a = e.target.closest("[data-a]"), x = e.target.closest(".vid-x");
      if (x) return close();
      if (!a) return;
      const act = a.dataset.a;
      if (act === "next") next(); else if (act === "prev") prev(); else if (act === "play") setPaused(!paused);
      else if (act === "snd") { snd = !snd; a.textContent = snd ? "🔊" : "🔇"; if (snd) speak(scenes[idx].say); else try { synth.cancel(); } catch (er) {} }
      else if (act === "voice") { const cs = combos(); vsel = (vsel + 1) % (cs.length || 1); try { localStorage.setItem("pl_voice", vsel); } catch (er) {} snd = true; el.querySelector('[data-a="snd"]').textContent = "🔊"; const t = el.querySelector(".vid-bar span"), old = o.title || "Видео-урок"; t.textContent = "Голос: " + ((cs[vsel] || {}).label || "по умолчанию"); setTimeout(() => t.textContent = old, 2500); speak("Привет! Я Стрелка. Так я буду звучать."); }
      else if (act === "again") show(0);
      else if (act === "close") close();
      else if (act === "cta") { const f = o.cta.fn; close(); if (f) f(); }
    });
    cur = { el, stop() { cancelAnimationFrame(raf); try { synth && synth.cancel(); } catch (e) {} } };
    show(0); raf = requestAnimationFrame(tick);
  }

  window.PLVideo = { open, close, lessonScenes, taskScenes, emojiFor };
})();
