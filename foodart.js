/* ПитЛаб – мультяшные картинки еды для «Собери тарелку».
   Каждая картинка нарисована вокруг точки (0,0), размер примерно 46×46.
   FOOD_ART(name, cat) подбирает картинку по названию продукта. */
(function () {
  const O = 'stroke="#33413A" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"';
  const face = (y = 2, s = 1) => `<g transform="translate(0 ${y}) scale(${s})"><circle cx="-5" cy="-1" r="1.9" fill="#33413A"/><circle cx="5" cy="-1" r="1.9" fill="#33413A"/>
    <path d="M-3.5 3.2 Q0 6.4 3.5 3.2" fill="none" stroke="#33413A" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="-8.6" cy="3" r="2" fill="#F49A9A" opacity=".7"/><circle cx="8.6" cy="3" r="2" fill="#F49A9A" opacity=".7"/></g>`;
  const shine = (x, y, r = 3) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.6}" fill="#fff" opacity=".55" transform="rotate(-30 ${x} ${y})"/>`;

  const A = {
    cucumber: `<rect x="-20" y="-9" width="40" height="18" rx="9" fill="#5DB36A" ${O}/><circle cx="-10" cy="-3" r="1.2" fill="#2E7D3A"/><circle cx="8" cy="4" r="1.2" fill="#2E7D3A"/><circle cx="13" cy="-4" r="1.2" fill="#2E7D3A"/>${shine(-8, -5)}${face(1, .8)}`,
    tomato: `<circle r="17" fill="#EF5B4C" ${O}/><path d="M-7 -15 L0 -10 L7 -15 L3 -17 L0 -21 L-3 -17 Z" fill="#4FA35B" ${O}/>${shine(-8, -7, 4)}${face(3)}`,
    broccoli: `<path d="M-5 4 L-6 20 L6 20 L5 4 Z" fill="#9BD08F" ${O}/><circle cx="-10" cy="-4" r="10" fill="#3F9C4E" ${O}/><circle cx="10" cy="-4" r="10" fill="#3F9C4E" ${O}/><circle cx="0" cy="-12" r="11" fill="#4CAF5A" ${O}/><circle cx="0" cy="0" r="9" fill="#4CAF5A"/>${face(-4, .85)}`,
    carrot: `<path d="M-6 -12 Q0 -16 6 -12 L1 22 Q0 24 -1 22 Z" fill="#F39A35" ${O}/><path d="M-1 -13 L-7 -24 M1 -13 L1 -25 M2 -13 L8 -23" stroke="#4FA35B" stroke-width="3.4" stroke-linecap="round"/><path d="M-3 0 L1 1 M-2 8 L1 8" stroke="#C96F17" stroke-width="1.6" stroke-linecap="round"/>${face(-5, .7)}`,
    lettuce: `<path d="M-20 4 Q-22 -10 -10 -14 Q-4 -22 4 -16 Q16 -20 19 -6 Q24 6 12 14 Q0 20 -12 14 Q-22 12 -20 4 Z" fill="#8FD07A" ${O}/><path d="M-12 8 Q0 -2 10 -10 M0 2 L-2 -10 M4 -2 L12 2" stroke="#5AA54B" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    cabbage: `<circle r="18" fill="#B9E3A2" ${O}/><path d="M-12 -10 Q0 0 -4 16 M12 -10 Q0 0 4 16 M0 -18 L0 4" stroke="#7FC167" stroke-width="2.2" fill="none"/>${face(4, .8)}`,
    pepper: `<path d="M-14 -6 Q-16 18 0 20 Q16 18 14 -6 Q8 -12 0 -9 Q-8 -12 -14 -6 Z" fill="#F2C94C" ${O}/><path d="M0 -9 Q1 -16 6 -18" stroke="#4FA35B" stroke-width="3.4" fill="none" stroke-linecap="round"/>${shine(-7, -1, 3)}${face(4, .85)}`,
    redpepper: `<path d="M-14 -6 Q-16 18 0 20 Q16 18 14 -6 Q8 -12 0 -9 Q-8 -12 -14 -6 Z" fill="#E8543F" ${O}/><path d="M0 -9 Q1 -16 6 -18" stroke="#4FA35B" stroke-width="3.4" fill="none" stroke-linecap="round"/>${shine(-7, -1, 3)}${face(4, .85)}`,
    zucchini: `<path d="M-20 6 Q-18 -10 4 -10 Q20 -10 21 -2 Q20 10 0 10 Q-18 14 -20 6 Z" fill="#6BAF4F" ${O}/><path d="M21 -2 L25 -4" stroke="#4A7D35" stroke-width="3.4" stroke-linecap="round"/>${shine(-8, -4)}${face(1, .75)}`,
    eggplant: `<path d="M-18 8 Q-20 -8 0 -8 Q14 -10 18 -2 Q20 12 2 13 Q-14 18 -18 8 Z" fill="#7C4FA3" ${O}/><path d="M16 -5 Q20 -12 24 -10 M14 -7 L22 -2" stroke="#4FA35B" stroke-width="3.2" stroke-linecap="round"/>${shine(-8, -2)}${face(3, .75)}`,
    beet: `<path d="M0 20 Q-17 14 -16 0 Q-14 -12 0 -12 Q14 -12 16 0 Q17 14 0 20 L0 25" fill="#B23A5A" ${O}/><path d="M-2 -12 Q-8 -22 -12 -22 M2 -12 Q6 -24 12 -21" stroke="#4FA35B" stroke-width="3.2" fill="none" stroke-linecap="round"/>${shine(-7, -4)}${face(3, .8)}`,
    corn: `<path d="M-10 -18 Q0 -24 10 -18 L10 14 Q0 20 -10 14 Z" fill="#F6D04D" ${O}/><path d="M-10 8 Q-22 4 -14 22 Q-4 22 0 16 Q4 22 14 22 Q22 4 10 8" fill="#7CC46B" ${O}/><path d="M-4 -14 L-4 6 M4 -14 L4 6 M-9 -8 L9 -8 M-9 0 L9 0" stroke="#D9A92B" stroke-width="1.4"/>`,
    peas: `<path d="M-22 4 Q0 -14 22 -4 Q14 12 -6 12 Q-18 12 -22 4 Z" fill="#7CC46B" ${O}/><circle cx="-10" cy="2" r="5" fill="#A6DC7E" ${O}/><circle cx="0" cy="0" r="5" fill="#A6DC7E" ${O}/><circle cx="10" cy="-1" r="5" fill="#A6DC7E" ${O}/>`,
    avocado: `<path d="M0 -20 Q12 -20 14 0 Q16 20 0 20 Q-16 20 -14 0 Q-12 -20 0 -20 Z" fill="#5C9A3C" ${O}/><path d="M0 -15 Q9 -15 10 1 Q11 15 0 15 Q-11 15 -10 1 Q-9 -15 0 -15 Z" fill="#D8EB8F"/><circle cx="0" cy="5" r="6.5" fill="#9A6234" ${O}/>${face(-7, .7)}`,
    banana: `<path d="M-20 -8 Q-14 16 8 14 Q20 12 22 2 Q10 8 0 4 Q-12 0 -16 -12 Z" fill="#F6D04D" ${O}/><path d="M-16 -12 L-19 -16" stroke="#6A5426" stroke-width="3.4" stroke-linecap="round"/>${face(6, .7)}`,
    apple: `<path d="M0 -10 Q-8 -16 -15 -8 Q-21 6 -10 17 Q-4 21 0 17 Q4 21 10 17 Q21 6 15 -8 Q8 -16 0 -10 Z" fill="#E84E4E" ${O}/><path d="M0 -10 Q1 -16 3 -19" stroke="#6A4426" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M3 -16 Q11 -22 13 -14 Q6 -11 3 -16 Z" fill="#5DB36A" ${O}/>${shine(-9, -4, 3.4)}${face(4)}`,
    greenapple: `<path d="M0 -10 Q-8 -16 -15 -8 Q-21 6 -10 17 Q-4 21 0 17 Q4 21 10 17 Q21 6 15 -8 Q8 -16 0 -10 Z" fill="#9BCF55" ${O}/><path d="M0 -10 Q1 -16 3 -19" stroke="#6A4426" stroke-width="3" stroke-linecap="round" fill="none"/>${shine(-9, -4, 3.4)}${face(4)}`,
    pear: `<path d="M0 -18 Q8 -18 8 -6 Q18 4 14 14 Q8 22 0 21 Q-8 22 -14 14 Q-18 4 -8 -6 Q-8 -18 0 -18 Z" fill="#C9D85A" ${O}/><path d="M0 -18 L2 -24" stroke="#6A4426" stroke-width="3" stroke-linecap="round"/>${shine(-6, 0, 3)}${face(8, .85)}`,
    orange: `<circle r="17" fill="#F7A23B" ${O}/><circle cx="-4" cy="-6" r="1" fill="#D9821F"/><circle cx="7" cy="-2" r="1" fill="#D9821F"/><path d="M0 -17 Q4 -23 10 -21 Q7 -16 0 -17 Z" fill="#5DB36A" ${O}/>${shine(-8, -7, 4)}${face(3)}`,
    kiwi: `<circle r="17" fill="#8B6A3E" ${O}/><circle r="13" fill="#9CCB4B"/><circle r="5" fill="#F4F1C9"/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<circle cx="${(Math.cos(a * Math.PI / 180) * 8.5).toFixed(1)}" cy="${(Math.sin(a * Math.PI / 180) * 8.5).toFixed(1)}" r="1.1" fill="#33413A"/>`).join("")}`,
    grapes: `${[[-7, -8], [7, -8], [0, -10], [-11, 2], [0, 2], [11, 2], [-6, 12], [6, 12], [0, 21]].map(([x, y]) => `<circle cx="${x}" cy="${y - 2}" r="6.5" fill="#8E5BC4" ${O}/>`).join("")}<path d="M0 -16 L2 -23" stroke="#6A4426" stroke-width="3" stroke-linecap="round"/>`,
    berries: `<path d="M-6 -12 Q-20 -12 -18 2 Q-14 16 -6 18 Q2 16 4 2 Q6 -12 -6 -12 Z" fill="#E8434E" ${O}/><path d="M-12 -12 L-6 -8 L0 -12 L-6 -17 Z" fill="#4FA35B" ${O}/><circle cx="12" cy="-2" r="7" fill="#4C5FBF" ${O}/><circle cx="10" cy="14" r="7" fill="#4C5FBF" ${O}/>${[[-10, -2], [-4, 2], [-10, 8], [-3, 10]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="#FFE08A"/>`).join("")}`,
    watermelon: `<path d="M-22 -6 A22 22 0 0 0 22 -6 Z" fill="#F0525E" ${O}/><path d="M-22 -6 A22 22 0 0 0 22 -6" fill="none" stroke="#4FA35B" stroke-width="5"/><path d="M-22 -6 A22 22 0 0 0 22 -6 Z" fill="none" ${O}/><circle cx="-8" cy="2" r="1.4" fill="#33413A"/><circle cx="0" cy="6" r="1.4" fill="#33413A"/><circle cx="8" cy="2" r="1.4" fill="#33413A"/>`,
    mushroom: `<path d="M-6 0 L-7 18 L7 18 L6 0 Z" fill="#F4E8D2" ${O}/><path d="M-20 2 Q-20 -18 0 -18 Q20 -18 20 2 Z" fill="#C98A5A" ${O}/><circle cx="-8" cy="-8" r="2.4" fill="#F4E8D2"/><circle cx="7" cy="-11" r="2" fill="#F4E8D2"/>${face(10, .6)}`,
    pumpkin: `<ellipse rx="20" ry="16" fill="#F28C28" ${O}/><path d="M-7 -15 Q-12 0 -7 15 M7 -15 Q12 0 7 15" stroke="#C96417" stroke-width="2" fill="none"/><path d="M0 -15 L2 -22" stroke="#4FA35B" stroke-width="4" stroke-linecap="round"/>${face(3, .8)}`,
    peach: `<circle r="17" fill="#FFB07A" ${O}/><path d="M0 -16 Q-6 0 0 16" stroke="#E8875A" stroke-width="2" fill="none"/><path d="M0 -17 Q5 -24 11 -20 Q6 -15 0 -17 Z" fill="#5DB36A" ${O}/>${shine(-8, -7, 4)}${face(3)}`,
    onion: `<path d="M0 -18 Q-4 -10 -14 0 Q-18 14 0 18 Q18 14 14 0 Q4 -10 0 -18 Z" fill="#E9C9A8" ${O}/><path d="M-6 -6 Q-10 6 -4 16 M6 -6 Q10 6 4 16" stroke="#C9A27C" stroke-width="1.6" fill="none"/>${face(4, .75)}`,
    radish: `<path d="M0 18 Q-16 12 -14 -2 Q-10 -12 0 -12 Q10 -12 14 -2 Q16 12 0 18 L0 24" fill="#E8546E" ${O}/><path d="M-2 -12 Q-6 -22 -10 -22 M2 -12 Q6 -22 10 -21" stroke="#4FA35B" stroke-width="3.2" fill="none" stroke-linecap="round"/>${face(2, .8)}`,
    olive: `<ellipse cx="-7" cy="0" rx="9" ry="12" fill="#5E7A2E" ${O}/><ellipse cx="9" cy="2" rx="9" ry="12" fill="#3B3B3B" ${O}/><circle cx="-7" cy="-2" r="2.4" fill="#E36A4A"/>`,
    salad: `<path d="M-22 -2 L22 -2 Q20 18 0 19 Q-20 18 -22 -2 Z" fill="#F4F7F4" ${O}/><circle cx="-10" cy="-6" r="6" fill="#8FD07A" ${O}/><circle cx="2" cy="-8" r="6" fill="#EF5B4C" ${O}/><circle cx="12" cy="-5" r="5.5" fill="#5DB36A" ${O}/>`,
    // белок
    drumstick: `<path d="M-6 6 L10 22" stroke="#33413A" stroke-width="9" stroke-linecap="round"/><path d="M-6 6 L10 22" stroke="#FFF4E0" stroke-width="5" stroke-linecap="round"/><circle cx="12" cy="24" r="3.4" fill="#FFF4E0" ${O}/><circle cx="16" cy="20" r="3.4" fill="#FFF4E0" ${O}/><path d="M-20 -6 Q-22 -22 -6 -22 Q10 -22 8 -6 Q6 8 -6 8 Q-18 8 -20 -6 Z" fill="#D98B3A" ${O}/>${shine(-12, -14, 3.4)}${face(-8, .75)}`,
    fish: `<path d="M-20 0 Q-6 -16 12 -6 L22 -14 L20 0 L22 14 L12 6 Q-6 16 -20 0 Z" fill="#F28B6B" ${O}/><path d="M-2 -8 Q2 0 -2 8" stroke="#D9674A" stroke-width="2" fill="none"/><circle cx="-12" cy="-2" r="2" fill="#33413A"/><path d="M-16 4 Q-14 6 -12 4" stroke="#33413A" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    shrimp: `<path d="M14 -12 Q-14 -18 -16 4 Q-14 18 4 16 L8 10 Q-6 12 -6 2 Q-4 -6 10 -4 Z" fill="#F7896B" ${O}/><path d="M-8 -10 L-4 -2 M-14 -2 L-6 2 M-12 8 L-4 6" stroke="#D9674A" stroke-width="1.8"/><path d="M4 16 L0 23 L10 21 Z" fill="#F7896B" ${O}/><circle cx="9" cy="-9" r="1.6" fill="#33413A"/>`,
    egg: `<path d="M-20 2 Q-22 -14 -8 -16 Q2 -24 12 -16 Q24 -12 20 2 Q22 16 6 18 Q-6 22 -14 14 Q-22 10 -20 2 Z" fill="#fff" ${O}/><circle cx="1" cy="0" r="9" fill="#F7C531" ${O}/>${shine(-2, -3, 2.6)}${face(0, .6)}`,
    cottage: `<path d="M-20 0 L20 0 Q18 18 0 18 Q-18 18 -20 0 Z" fill="#9CC8E8" ${O}/><path d="M-18 0 Q-16 -12 -8 -10 Q-4 -18 4 -12 Q12 -16 16 -6 Q20 -2 18 0 Z" fill="#FFFDF5" ${O}/>${face(9, .7)}`,
    cheese: `<path d="M-20 12 L-20 -2 L18 -16 L22 -2 L22 12 Z" fill="#F6C945" ${O}/><path d="M-20 -2 L22 -2" stroke="#33413A" stroke-width="2"/><circle cx="-8" cy="5" r="3" fill="#E0A82A"/><circle cx="10" cy="7" r="2.4" fill="#E0A82A"/><circle cx="4" cy="-7" r="2" fill="#E0A82A"/>`,
    milk: `<path d="M-12 -18 L12 -18 L10 20 L-10 20 Z" fill="#E9F3FB" ${O}/><path d="M-11 -6 L11 -6 L10 20 L-10 20 Z" fill="#fff" ${O}/>${face(6, .75)}`,
    beans: `${[[-10, -4, 20], [6, -8, -30], [12, 6, 10], [-4, 8, -10], [0, -2, 50]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="5.5" transform="rotate(${r} ${x} ${y})" fill="#B5533C" ${O}/>`).join("")}`,
    sausage: `<path d="M-20 -2 Q-20 -10 -12 -10 L12 -10 Q20 -10 20 -2 L20 2 Q20 10 12 10 L-12 10 Q-20 10 -20 2 Z" fill="#E2836C" ${O}/><path d="M-20 0 L-25 -3 M20 0 L25 -3" stroke="#33413A" stroke-width="2.4" stroke-linecap="round"/>${shine(-10, -5, 3)}${face(1, .7)}`,
    cutlet: `<ellipse rx="20" ry="13" fill="#9C5B32" ${O}/><path d="M-12 -4 Q-6 -8 0 -5 M4 2 Q10 -2 14 2 M-8 6 Q-4 3 0 6" stroke="#6E3D1F" stroke-width="1.8" fill="none" stroke-linecap="round"/>${shine(-10, -6, 3)}`,
    steak: `<path d="M-20 -4 Q-18 -18 0 -16 Q20 -16 20 0 Q20 16 2 16 Q-10 16 -12 8 Q-22 8 -20 -4 Z" fill="#B5533C" ${O}/><path d="M-6 -6 Q2 -10 10 -4 Q12 4 4 6 Q-4 6 -6 -6 Z" fill="#F2C0A0"/><path d="M-12 -8 L12 8 M-4 -12 L16 0" stroke="#7E3324" stroke-width="2" stroke-linecap="round" opacity=".6"/>`,
    // гарнир
    buckwheat: `<path d="M-22 12 Q-18 -14 0 -14 Q18 -14 22 12 Z" fill="#A9693A" ${O}/>${[[-10, 2], [-2, -6], [6, -2], [12, 6], [-4, 6], [2, 4], [-14, 8]].map(([x, y]) => `<path d="M${x} ${y - 2.5} L${x + 2.5} ${y + 2} L${x - 2.5} ${y + 2} Z" fill="#7A4724"/>`).join("")}${face(3, .7)}`,
    rice: `<path d="M-22 12 Q-18 -14 0 -14 Q18 -14 22 12 Z" fill="#FFFDF2" ${O}/>${[[-10, 0, 20], [-2, -6, -30], [6, -2, 40], [12, 6, -10], [-6, 6, 60], [2, 4, 0]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.3" transform="rotate(${r} ${x} ${y})" fill="#E6DFC2"/>`).join("")}${face(3, .7)}`,
    pasta: `<path d="M-20 10 Q-22 -6 -10 -12 Q4 -18 16 -8 Q24 4 16 12 Q0 18 -20 10 Z" fill="#F6D77C" ${O}/><path d="M-14 4 Q-6 -10 6 -4 Q14 2 6 8 Q-4 10 -2 2 Q2 -4 8 0 M-16 -2 Q-8 -12 4 -12" stroke="#D9AE3D" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    potato: `<path d="M-18 -4 Q-14 -16 2 -14 Q18 -14 19 0 Q20 14 4 15 Q-14 18 -18 6 Z" fill="#E3B66F" ${O}/><circle cx="-8" cy="-6" r="1.2" fill="#A97A3A"/><circle cx="10" cy="8" r="1.2" fill="#A97A3A"/>${shine(-8, -8, 3)}${face(2, .8)}`,
    fries: `<path d="M-14 -4 L14 -4 L11 20 L-11 20 Z" fill="#E8543F" ${O}/>${[-9, -4, 1, 6, 10].map((x, i) => `<rect x="${x - 2}" y="${-18 + (i % 2) * 4}" width="4.5" height="18" rx="1.5" fill="#F6CC4D" ${O}/>`).join("")}<path d="M-14 -4 L14 -4 L11 20 L-11 20 Z" fill="#E8543F" ${O}/>${face(9, .7)}`,
    bread: `<path d="M-18 16 L-18 -4 Q-22 -16 -8 -18 Q0 -20 8 -18 Q22 -16 18 -4 L18 16 Z" fill="#E2A65A" ${O}/><path d="M-13 13 L-13 -4 Q-16 -12 -6 -13 L6 -13 Q16 -12 13 -4 L13 13 Z" fill="#FBE3B5"/>${face(2, .75)}`,
    porridge: `<path d="M-22 -2 L22 -2 Q20 18 0 19 Q-20 18 -22 -2 Z" fill="#F28B6B" ${O}/><path d="M-20 -2 Q-12 -12 0 -9 Q12 -12 20 -2 Z" fill="#F6E7C8" ${O}/><circle cx="-6" cy="-6" r="2.6" fill="#8E5BC4"/><circle cx="4" cy="-7" r="2.6" fill="#E8434E"/>${face(8, .7)}`,
    grain: `<path d="M-22 12 Q-18 -14 0 -14 Q18 -14 22 12 Z" fill="#F2D38A" ${O}/>${face(3, .7)}`,
  };

  const RULES = [
    [/огур/, "cucumber"], [/помид|черри|томат/, "tomato"], [/брокк|брюссел/, "broccoli"], [/морков/, "carrot"],
    [/салат «греч|салат из свеж|салат овощ|рагу|овощи|винегрет|лечо|икра кабач/, "salad"],
    [/яблоко зел/, "greenapple"], [/лист|руккол|шпинат|зелен|сельдер|спарж/, "lettuce"], [/капуст/, "cabbage"], [/перец/, "redpepper"],
    [/кабач/, "zucchini"], [/баклаж/, "eggplant"], [/свекл/, "beet"], [/кукуруз/, "corn"], [/горош|стручк|эдамаме/, "peas"],
    [/авокад/, "avocado"], [/банан/, "banana"], [/яблок/, "apple"], [/груш/, "pear"],
    [/апельс|мандар|грейпф|лимон/, "orange"], [/киви/, "kiwi"], [/виноград/, "grapes"],
    [/клубн|ягод|малин|черник|голуб|вишн|череш|смород/, "berries"], [/арбуз|дын/, "watermelon"], [/гриб|шампин/, "mushroom"],
    [/тыкв|батат/, "pumpkin"], [/ананас|манго|персик|абрикос|нектар|слив|хурм|гранат|фрукт/, "peach"],
    [/лук|чеснок/, "onion"], [/редис/, "radish"], [/оливк|маслин/, "olive"],
    [/кревет|кальмар|миди|краб/, "shrimp"], [/яйц|омлет|яичн|белки/, "egg"],
    [/кур|индей|крыл|голен|наггетс/, "drumstick"],
    [/рыб|лосос|семг|горбуш|скумбр|сельд|хек|судак|тилап|минтай|треск|тунец|сайр|шпрот|икра/, "fish"],
    [/творог|сырок|творож/, "cottage"], [/сыр|моцар|брынз|фета|пармез/, "cheese"],
    [/йогурт|кефир|молок|ряженк|скир|айран|простокв|пудинг|сливк|сметан/, "milk"],
    [/фасол|чечев|нут|горох|хумус|тофу|со[ея]в/, "beans"], [/колбас|ветчин|сосис|сардел|бекон|паштет/, "sausage"],
    [/котлет|фарш|тефтел|печень/, "cutlet"], [/говяд|свин|баран|кролик|стейк|шашлык|гуляш|отбивн/, "steak"],
    [/греч/, "buckwheat"], [/макарон|спагет|лапш|паст|соба/, "pasta"], [/фри/, "fries"],
    [/картоф|пюре|драник/, "potato"], [/рис|кускус|булгур|киноа|перлов|пшен|ячнев/, "rice"],
    [/хлеб|батон|багет|тост|булоч|лаваш|тортил|сушк|круасс/, "bread"], [/овся|мюсли|гранол|хлопь|манн|каша|отруб/, "porridge"],
  ];
  const DEF = { veg: "salad", prot: "steak", dairy: "milk", carb: "grain" };
  window.FOOD_ART = function (name, cat) {
    const n = String(name || "").toLowerCase().replace(/ё/g, "е");
    const hit = RULES.find(([re]) => re.test(n));
    return A[hit ? hit[1] : DEF[cat] || "salad"];
  };
})();
