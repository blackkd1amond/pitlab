/* ПитЛаб – голосовой ввод еды.
   parse(text, products, defaultMeal) -> { meal, items:[{i, g, src}], miss:[строки] }
   Работает локально, без ключей: распознанная речь (или напечатанный текст)
   разбирается по словарю продуктов из products.js. */
(function () {
  "use strict";
  const norm = s => String(s).toLowerCase().replace(/ё/g, "е").replace(/[«»"().!?:]/g, " ").replace(/\s+/g, " ").trim();

  const NUMW = { ноль: 0, один: 1, одна: 1, одно: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
    пол: 0.5, полтора: 1.5, полторы: 1.5, половина: 0.5, половинку: 0.5, половину: 0.5, сто: 100, двести: 200, триста: 300, четыреста: 400, пятьсот: 500,
    пятьдесят: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90, тридцать: 30, сорок: 40, двадцать: 20, сотню: 100 };
  // единицы: [корень, граммов в одной единице или 0 = «порция продукта»]
  const UNITS = [
    ["кг", 1000], ["килограмм", 1000], ["грамм", 1], ["гр", 1], ["г", 1], ["мл", 1], ["миллилитр", 1], ["литр", 1000], ["л", 1000],
    ["стакан", 200], ["кружк", 250], ["чашк", 200], ["чайн", 5], ["столов", 15], ["ложк", 15], ["тарелк", 0], ["порци", 0], ["миск", 250],
    ["ломтик", 30], ["кусок", 0], ["куска", 0], ["кусочк", 0], ["штук", 0], ["шт", 0], ["пачк", 0], ["баночк", 0], ["бутылк", 0], ["горсть", 30], ["горсти", 30],
  ];
  const STOP = new Set(["я", "съел", "съела", "ел", "ела", "выпил", "выпила", "поел", "поела", "добавь", "добавить", "запиши", "записать", "еще", "ещё", "на", "в", "с", "со", "из", "по", "около", "примерно", "где-то", "немного", "мой", "моя", "это", "около", "штуки", "штука", "потом", "также", "плюс", "сегодня", "вчера", "утром", "днем", "днём", "вечером", "пожалуйста", "слушай", "стрелка", "было", "были", "вот", "ну", "и", "а", "ещё", "порция", "порции", "порцию"]);
  const MEALW = [["b", /завтрак/], ["l", /обед/], ["d", /ужин/], ["s", /перекус|полдник/]];

  const END = /(ами|ями|ом|ем|ов|ев|ах|ях|ой|ей|ого|его|ому|ему|ым|им|ые|ие|ых|их|ую|юю|ая|яя|а|я|у|ю|ы|и|е|о|ь)$/;
  const stem = w => { if (/^\d/.test(w)) return w; const b = w.replace(END, ""); return (b.length >= 4 ? b : w).slice(0, 6); };
  const ALIAS = { чая: "чай", чаю: "чай", сока: "сок", сок: "сок", риса: "рис", рису: "рис", сыра: "сыр", сыру: "сыр", мяса: "мяс", кофе: "кофе", яйца: "яйц", яйцо: "яйц", яиц: "яйц", яйцом: "яйц", яйцу: "яйц", кола: "кола", колу: "кола", колы: "кола", мед: "мед", мёда: "мед", меда: "мед" };

  function splitParts(t) {
    // «на завтрак» и т. п. убираем, части делим по запятым, «и», «плюс», «потом»
    return t.split(/\s*(?:,|;|(?:^|\s)и(?:\s|$)|(?:^|\s)плюс(?:\s|$)|(?:^|\s)потом(?:\s|$)|(?:^|\s)а также(?:\s|$)|(?:^|\s)еще(?:\s|$))\s*/).map(s => s.trim()).filter(Boolean);
  }

  function takeQty(words) {
    // ищем число (цифрами или словом) и единицу; возвращает { n, unit, rest }
    let n = null, unit = null; const rest = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      let v = null;
      if (/^\d+([.,]\d+)?$/.test(w)) v = parseFloat(w.replace(",", "."));
      else if (/^\d+[.,]?\d*(г|гр|мл|кг|шт)$/.test(w)) { const m = w.match(/^(\d+[.,]?\d*)(г|гр|мл|кг|шт)$/); v = parseFloat(m[1].replace(",", ".")); unit = UNITS.find(u => u[0] === m[2]); }
      else if (NUMW[w] !== undefined && n === null) v = NUMW[w];
      if (v !== null) {
        // «двести пятьдесят»: складываем соседние числительные
        if (n !== null && NUMW[w] !== undefined && NUMW[words[i - 1]] !== undefined && n >= 20 !== v >= 20 && n >= 100 && v < 100) n += v;
        else if (n === null) n = v;
        continue;
      }
      const u = UNITS.find(([r]) => r.length <= 2 ? w === r && n !== null : w.startsWith(r));
      if (u) { if (!unit || unit[1] === 0) unit = u; continue; }
      rest.push(w);
    }
    return { n, unit, rest };
  }

  function findProduct(words, P) {
    const ws = words.map(w => ALIAS[w] || stem(w)).filter(w => w.length > 1);
    if (!ws.length) return -1;
    let best = -1, bs = 0;
    for (let i = 0; i < P.length; i++) {
      const t = P[i]._t || (P[i]._t = norm(P[i].n));
      const tw = t.split(" ");
      let hit = 0;
      for (const w of ws) if (tw.some(x => x.startsWith(w))) hit++;
      if (!hit) continue;
      // доля совпавших слов запроса + бонус, если название начинается с первого слова + штраф за длинное название
      let s = hit / ws.length * 10 + (t.startsWith(ws[0]) ? 2 : 0) + (tw[0] === ws[0] ? 1.5 : 0) - tw.length * 0.35;
      if (hit < ws.length) s -= 4;
      if (/вар[её]н|отварн/.test(t)) s += 0.6;
      if (s > bs) { bs = s; best = i; }
    }
    return bs >= 4 ? best : -1;
  }

  function parse(text, P, defMeal) {
    let t = norm(text), meal = defMeal || "b";
    for (const [id, re] of MEALW) if (re.test(t)) { meal = id; t = t.replace(new RegExp("(на|в|за|как)\\s+" + re.source + "\\w*", "g"), " ").replace(re, " "); break; }
    const items = [], miss = [];
    for (const part of splitParts(t)) {
      const words = part.split(" ").filter(Boolean);
      const q = takeQty(words);
      const name = q.rest.filter(w => !STOP.has(w));
      if (!name.length) continue;
      const i = findProduct(name, P);
      if (i < 0) { miss.push(name.join(" ")); continue; }
      const x = P[i]; let g;
      const por = x.portion || 100;
      if (q.n === null) g = por;
      else if (!q.unit) g = q.n <= 20 ? Math.round(q.n * por) : Math.round(q.n);       // «два яйца» или «200 гречки»
      else if (q.unit[1] === 0) g = Math.round(q.n * por);
      else g = Math.round(q.n * q.unit[1]);
      g = Math.max(5, Math.min(2500, g));
      items.push({ i, g });
    }
    return { meal, items, miss };
  }

  // распознавание речи браузером (в Telegram на Android и в Chrome работает, на iOS – часто нет)
  function recognizer() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR(); r.lang = "ru-RU"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    return r;
  }

  window.PLVoice = { parse, recognizer, supported: () => !!(window.SpeechRecognition || window.webkitSpeechRecognition) };
})();
