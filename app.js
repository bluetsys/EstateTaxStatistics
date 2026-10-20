const $ = (id) => document.getElementById(id),
  years = [...new Set(Object.values(DATA).flatMap((x) => Object.keys(x)))].sort((a, b) => b - a),
  NF = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }),
  N2 = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });
$("year").innerHTML = years.map((x) => `<option>${x}</option>`).join("");
const KEYS = ["피상속인수", "총상속재산가액", "상속세과세가액", "과세표준", "산출세액"];
function dataset(type, year) {
  return DATA[type]?.[year] || null;
}
function idx(d, key) {
  return (
    d?.metrics.findIndex(
      (m) => m.label.replace(/\s/g, "") === key.replace(/\s/g, "") && m.sub === "소계",
    ) ?? -1
  );
}
function val(d, row, key) {
  let i = idx(d, key);
  return i < 0 || !row ? null : row.values[i];
}
function total(d) {
  return (
    d?.rows.find((r) => r.group === "합계") || d?.rows.find((r) => r.segment === "소계") || null
  );
}
function number(n, dec = 0) {
  return n == null || !Number.isFinite(n) ? "—" : (dec ? N2 : NF).format(n);
}
function amount(n) {
  return n == null ? "—" : number(n / 100, 2) + "억 원";
}
function per(d, row, key) {
  let n = val(d, row, "피상속인수"),
    a = val(d, row, key);
  return n > 0 && a != null ? a / n : null;
}
function titleRow(label, v, foot) {
  return `<div class="card"><small>${label}</small><strong>${v}</strong><footer>${foot}</footer></div>`;
}
function metric(type, year, key) {
  let d = dataset(type, year);
  return val(d, total(d), key);
}
const TREND = [
  ["피상속인수", "피상속인수 (명)"],
  ["총상속재산가액", "총상속재산가액 (조 원)"],
  ["과세표준", "과세표준 (조 원)"],
  ["산출세액", "산출세액 (조 원)"],
  ["per", "1인당 평균 상속재산 (억 원)"],
];
$("trendMetric").innerHTML = TREND.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
function selectedTypes() {
  return $("mode").value === "both" ? ["신고", "결정"] : [$("mode").value];
}
function cardRender() {
  let y = $("year").value,
    types = selectedTypes(),
    s = dataset("신고", y),
    d = dataset("결정", y),
    cards = [];
  for (let type of types) {
    let o = dataset(type, y),
      row = total(o),
      n = val(o, row, "피상속인수"),
      a = val(o, row, "총상속재산가액"),
      tax = val(o, row, "과세표준"),
      due = type === "신고" ? "자진납부할세액" : "총결정세액";
    cards.push(
      titleRow(`${type} · 피상속인수`, n == null ? "자료 없음" : number(n) + "명", "집계 인원"),
    );
    cards.push(
      titleRow(
        `${type} · 총상속재산가액`,
        amount(a),
        a == null ? "공표되지 않음" : `1인당 ${amount(per(o, row, "총상속재산가액"))}`,
      ),
    );
    cards.push(
      titleRow(`${type} · 과세표준`, amount(tax), `1인당 ${amount(per(o, row, "과세표준"))}`),
    );
    cards.push(
      titleRow(`${type} · ${due}`, amount(val(o, row, due)), `1인당 ${amount(per(o, row, due))}`),
    );
  }
  $("cards").innerHTML = cards.join("");
}
function trendV(type, y, key) {
  let d = dataset(type, y),
    row = total(d);
  if (!d || !row) return null;
  if (key === "per") {
    let x = per(d, row, "총상속재산가액");
    return x === null ? null : x / 100;
  }
  let x = val(d, row, key);
  return x == null ? null : key === "피상속인수" ? x : x / 1e6;
}
function trend() {
  let key = $("trendMetric").value,
    types = selectedTypes(),
    ys = years.slice().reverse(),
    all = types.flatMap((t) => ys.map((y) => trendV(t, y, key))).filter((x) => x != null);
  if (!all.length) {
    $("trend").innerHTML = "자료 없음";
    return;
  }
  let max = Math.max(...all) * 1.12 || 1,
    W = 740,
    H = 280,
    L = 65,
    R = 18,
    T = 20,
    B = 38,
    sw = W - L - R,
    sh = H - T - B,
    px = (i) => L + (i * sw) / (ys.length - 1),
    py = (v) => T + sh - (v / max) * sh;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="연도별 지표 추세">`;
  for (let j = 0; j <= 4; j++) {
    let v = (max * j) / 4,
      y = py(v);
    svg += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="#e5ebf3"/><text x="${L - 8}" y="${y + 4}" fill="#617089" text-anchor="end" font-size="11">${number(v, 2)}</text>`;
  }
  ys.forEach((y, i) => {
    if (i % 2 === 0 || i === ys.length - 1)
      svg += `<text x="${px(i)}" y="${H - 13}" text-anchor="middle" fill="#647590" font-size="10">${y}</text>`;
  });
  for (let type of types) {
    let color = type === "신고" ? "#3778e5" : "#11a996",
      values = ys.map((y) => trendV(type, y, key));
    let path = "",
      active = false;
    for (let i = 0; i < values.length; i++) {
      let v = values[i];
      if (v == null) {
        active = false;
        continue;
      }
      path += (active ? " L" : " M") + px(i) + " " + py(v);
      active = true;
    }
    svg += `<path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
    values.forEach((v, i) => {
      if (v != null)
        svg += `<circle cx="${px(i)}" cy="${py(v)}" r="3" fill="${color}"><title>${type} ${ys[i]}년: ${number(v, 2)}</title></circle>`;
    });
  }
  svg += "</svg>";
  $("trend").innerHTML = svg;
}
function comparison() {
  let y = $("year").value,
    rows = [
      ["피상속인수", "명"],
      ["총상속재산가액", "억"],
      ["상속세과세가액", "억"],
      ["과세표준", "억"],
      ["산출세액", "억"],
    ];
  let html =
    '<div style="overflow:auto"><table><thead><tr><th>지표</th><th>신고</th><th>결정</th><th>결정−신고</th></tr></thead><tbody>';
  for (let [key, unit] of rows) {
    let a = metric("신고", y, key),
      b = metric("결정", y, key),
      f = (v) => (unit === "명" ? number(v) : amount(v));
    html += `<tr><td>${key}</td><td>${f(a)}</td><td>${f(b)}</td><td class="${b != null && a != null ? (b - a >= 0 ? "positive" : "negative") : ""}">${a != null && b != null ? (b >= a ? "+" : "") + f(b - a) : "—"}</td></tr>`;
  }
  for (let [key, label] of [
    ["총상속재산가액", "1인당 상속재산"],
    ["과세표준", "1인당 과세표준"],
    ["산출세액", "1인당 산출세액"],
  ]) {
    let a = per(dataset("신고", y), total(dataset("신고", y)), key),
      b = per(dataset("결정", y), total(dataset("결정", y)), key);
    html += `<tr><td>${label}</td><td>${amount(a)}</td><td>${amount(b)}</td><td>${a != null && b != null ? (b >= a ? "+" : "") + amount(b - a) : "—"}</td></tr>`;
  }
  html += "</tbody></table></div>";
  $("compare").innerHTML = html;
}
function distribution(kind) {
  let prefix = kind === "asset" ? "group" : "tax",
    type = $(prefix + "Mode").value,
    d = dataset(type, $("year").value),
    key = $(prefix === "group" ? "groupMetric" : "taxMetric").value,
    group = kind === "asset" ? "총상속재산가액등규모별" : "과세표준규모별",
    rows = (d?.rows || []).filter(
      (r) => r.group === group && r.segment !== "소계" && r.segment !== "경정",
    );
  let vk = (r) =>
      key === "per" ? per(d, r, kind === "asset" ? "총상속재산가액" : "과세표준") : val(d, r, key),
    max = Math.max(0, ...rows.map(vk).filter((x) => x != null)),
    s = rows
      .map((r) => {
        let v = vk(r),
          pct = v != null && max > 0 ? (v / max) * 100 : 0,
          shown = key === "per" ? amount(v) : key === "피상속인수" ? number(v) : amount(v);
        return `<div class="barrow"><span>${r.segment}</span><div class="track"><div class="fill ${type === "결정" ? "decision" : ""}" style="width:${pct}%"></div></div><span class="num">${shown}</span></div>`;
      })
      .join("");
  $(kind === "asset" ? "distribution" : "taxDistribution").innerHTML =
    s || '<p class="muted">해당 연도 구간 자료가 없습니다.</p>';
}
function insightMetric(t, y, k) {
  let d = dataset(t, String(y)),
    r = total(d);
  return k === "per" ? per(d, r, "총상속재산가액") : val(d, r, k);
}
function pct(v) {
  return v == null || !Number.isFinite(v) ? "—" : (v > 0 ? "+" : "") + number(v, 1) + "%";
}
function delta(t, y, k) {
  let a = insightMetric(t, y, k),
    b = insightMetric(t, y - 1, k);
  return a != null && b > 0 ? (a / b - 1) * 100 : null;
}
function insightBox(label, value, detail) {
  return `<div class="insight"><small>${label}</small><strong>${value}</strong><em>${detail}</em></div>`;
}
function percentOf(n, d) {
  return d > 0 && n != null ? (n / d) * 100 : null;
}
function typedYears(t) {
  return Object.keys(DATA[t])
    .map(Number)
    .sort((a, b) => a - b);
}
function moneyDiff(x) {
  return x == null ? "—" : (x > 0 ? "+" : "") + amount(x);
}
function renderInsights() {
  const t = $("insightType").value,
    y = Number($("year").value),
    d = dataset(t, String(y)),
    r = total(d);
  if (!d) {
    [
      "insightCards",
      "narrative",
      "decomposition",
      "concentration",
      "growthChart",
      "longTerm",
    ].forEach((id) => ($(id).innerHTML = '<p class="muted">해당 연도 자료 없음</p>'));
    return;
  }
  const n = insightMetric(t, y, "피상속인수"),
    a = insightMetric(t, y, "총상속재산가액"),
    avg = insightMetric(t, y, "per"),
    tax = insightMetric(t, y, "과세표준"),
    bill = insightMetric(t, y, t === "신고" ? "자진납부할세액" : "총결정세액");
  const yn = delta(t, y, "피상속인수"),
    ya = delta(t, y, "총상속재산가액"),
    yp = delta(t, y, "per");
  const rows = d.rows.filter(
    (x) => x.group === "총상속재산가액등규모별" && !["소계", "경정"].includes(x.segment),
  );
  let high = rows.filter((x) =>
    ["30억 이하", "50억 이하", "100억 이하", "500억 이하", "500억 초과"].includes(x.segment),
  );
  let hn = high
      .map((x) => val(d, x, "피상속인수"))
      .filter((x) => x != null)
      .reduce((a, b) => a + b, 0),
    ha = high
      .map((x) => val(d, x, "총상속재산가액"))
      .filter((x) => x != null)
      .reduce((a, b) => a + b, 0),
    np = percentOf(hn, n),
    ap = percentOf(ha, a);
  let validHigh =
    high.length === 5 &&
    high.every((x) => val(d, x, "피상속인수") != null && val(d, x, "총상속재산가액") != null);
  $("insightCards").innerHTML =
    insightBox("전체 상속재산 전년 대비", pct(ya), `${y - 1}년 대비`) +
    insightBox("피상속인수 전년 대비", pct(yn), `${number(n)}명`) +
    insightBox("1인당 평균재산 전년 대비", pct(yp), `${amount(avg)} / 인`) +
    insightBox(
      "고액 재산 집중 비중",
      validHigh ? number(ap, 1) + "%" : "—",
      "20억 원 초과 구간의 재산 점유율",
    );
  let lines = [];
  if (ya != null && yn != null && yp != null)
    lines.push(
      `<p><b>① 총재산 변화:</b> ${y}년 ${t} 총상속재산은 전년보다 <b>${pct(ya)}</b> 변했습니다. 같은 기간 피상속인수는 ${pct(yn)}, 1인당 평균 재산은 ${pct(yp)} 변했습니다. 따라서 총액의 증감을 인원 규모와 1인당 규모로 나눠 확인할 수 있습니다.</p>`,
    );
  else lines.push("<p>① 전년도와 동일한 지표가 확인되지 않아 전년 증감 해석은 생략했습니다.</p>");
  if (validHigh)
    lines.push(
      `<p><b>② 집중도:</b> 20억 원 초과 구간은 인원의 <b>${number(np, 1)}%</b>이지만 총상속재산의 <b>${number(ap, 1)}%</b>를 차지합니다. 재산 점유율과 인원 점유율의 차이는 ${number(ap - np, 1)}%p입니다.</p>`,
    );
  if (tax != null && a > 0)
    lines.push(
      `<p><b>③ 과세표준 구조:</b> 과세표준은 총상속재산의 <b>${number((tax / a) * 100, 1)}%</b> 수준입니다. 이는 단순 비율로, 각종 공제·가산·비과세 항목이 존재하므로 실효세율이나 공제율로 해석해서는 안 됩니다.</p>`,
    );
  if (bill != null && tax > 0)
    lines.push(
      `<p><b>④ 세액 지표:</b> ${t === "신고" ? "자진납부할세액" : "총결정세액"}은 ${amount(bill)}이며 과세표준 대비 ${number((bill / tax) * 100, 1)}%입니다. 단순 집계 비율로 개인별 실제 부담률과 다릅니다.</p>`,
    );
  $("narrative").innerHTML =
    lines.join("") +
    '<p class="muted" style="font-size:12px">※ 관찰된 통계적 관계를 설명한 것이며 세법 개정·자산 가격 변화 등 외부 원인을 단정하지 않습니다.</p>';
  let pn = insightMetric(t, y - 1, "피상속인수"),
    pa = insightMetric(t, y - 1, "총상속재산가액"),
    pm = insightMetric(t, y - 1, "per");
  if (n > 0 && pn > 0 && avg != null && pm != null && a != null && pa != null) {
    let people = (n - pn) * pm,
      person = n * (avg - pm),
      sum = a - pa;
    let biggest = Math.max(Math.abs(people), Math.abs(person), 1);
    $("decomposition").innerHTML =
      `<div class="measure"><div class="ends"><span>전년도 총재산</span><b>${amount(pa)}</b></div></div><div class="measure"><div class="ends"><span>인원 변화 효과</span><b>${moneyDiff(people)}</b></div><div class="track"><div class="fill" style="width:${(Math.abs(people) / biggest) * 100}%"></div></div></div><div class="measure"><div class="ends"><span>1인당 평균 변화 효과</span><b>${moneyDiff(person)}</b></div><div class="track"><div class="fill decision" style="width:${(Math.abs(person) / biggest) * 100}%"></div></div></div><div class="measure"><div class="ends"><span>올해 총재산</span><b>${amount(a)}</b></div></div><p class="muted" style="font-size:12px">검산: 두 효과 합계 ${moneyDiff(people + person)} = 총변화 ${moneyDiff(sum)}. 음수 효과는 감소 방향입니다.</p>`;
  } else $("decomposition").innerHTML = '<p class="muted">전년도 비교 가능한 자료가 없습니다.</p>';
  if (validHigh && n > 0 && a > 0) {
    let ratio = np > 0 ? ap / np : null;
    $("concentration").innerHTML =
      `<div class="measure"><div class="ends"><span>20억 초과 구간 인원 비중</span><b>${number(np, 2)}%</b></div><div class="track"><div class="fill" style="width:${Math.min(np, 100)}%"></div></div></div><div class="measure"><div class="ends"><span>20억 초과 구간 재산 비중</span><b>${number(ap, 2)}%</b></div><div class="track"><div class="fill decision" style="width:${Math.min(ap, 100)}%"></div></div></div><p>같은 구간이 전체 재산에서 차지하는 비중은 인원 비중의 <b>${number(ratio, 2)}배</b>입니다.</p><p class="muted" style="font-size:12px">구간은 '20억 이하' 다음 단계인 '30억 이하'부터 집계합니다. 공개된 구간 통계에서 계산한 값입니다.</p>`;
  } else
    $("concentration").innerHTML =
      '<p class="muted">이 연도는 구간별 수치가 부족하여 집중도를 계산하지 않았습니다.</p>';
  const k = $("growthKey").value,
    ys = typedYears(t)
      .filter((z) => z <= y)
      .slice(-12),
    vs = ys.map((z) => delta(t, z, k));
  let min = Math.min(0, ...vs.filter(Number.isFinite)),
    max = Math.max(0, ...vs.filter(Number.isFinite));
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    $("growthChart").innerHTML = "—";
  } else {
    let W = 740,
      H = 275,
      L = 58,
      R = 15,
      T = 20,
      B = 45,
      top = Math.max(Math.abs(min), Math.abs(max), 1) * 1.15,
      mid = T + (H - T - B) / 2,
      scale = (H - T - B) / 2 / top,
      bw = (W - L - R) / Math.max(ys.length, 1);
    let svg = `<svg viewBox="0 0 ${W} ${H}"><line x1="${L}" y1="${mid}" x2="${W - R}" y2="${mid}" stroke="#8fa1b9"/><text x="${L - 5}" y="${mid - 3}" font-size="11" text-anchor="end">0%</text>`;
    vs.forEach((v, i) => {
      let x = L + i * bw + bw * 0.17,
        bar = Math.abs((v || 0) * scale);
      if (v != null)
        svg += `<rect x="${x}" y="${v >= 0 ? mid - bar : mid}" width="${bw * 0.66}" height="${bar}" fill="${v >= 0 ? "#3778e5" : "#dc7777"}"><title>${ys[i]}년 전년 대비 ${pct(v)}</title></rect>`;
      svg += `<text x="${x + bw * 0.33}" y="${H - 15}" text-anchor="middle" fill="#67758b" font-size="11">${String(ys[i]).slice(2)}</text>`;
    });
    svg += "</svg>";
    $("growthChart").innerHTML =
      svg +
      '<div class="muted" style="font-size:12px">파란색: 증가 / 붉은색: 감소 · 직전 연도와 비교</div>';
  }
  const all = typedYears(t).filter((z) => z <= y),
    first = all.find((z) => insightMetric(t, z, "총상속재산가액") > 0),
    a0 = first != null ? insightMetric(t, first, "총상속재산가액") : null,
    ratio = a0 > 0 ? a / a0 : null,
    vals = all
      .map((z) => ({ y: z, value: insightMetric(t, z, "총상속재산가액") }))
      .filter((x) => x.value != null),
    peak = vals.reduce((p, c) => (!p || c.value > p.value ? c : p), null),
    minRow = vals.reduce((p, c) => (!p || c.value < p.value ? c : p), null),
    rank = [...vals].sort((p, c) => c.value - p.value).findIndex((x) => x.y === y) + 1;
  let cagr =
    first != null && y > first && ratio > 0 ? (Math.pow(ratio, 1 / (y - first)) - 1) * 100 : null;
  $("longTerm").innerHTML =
    `<table class="minitable"><tbody><tr><td>비교 시작 연도</td><td>${first ?? "—"}년</td></tr><tr><td>시작 연도 총재산</td><td>${amount(a0)}</td></tr><tr><td>${y}년 총재산 / 시작 대비</td><td>${amount(a)} / ${number(ratio, 2)}배</td></tr><tr><td>기간 연평균 증가율(CAGR)</td><td>${pct(cagr)}</td></tr><tr><td>과거 최고 총재산</td><td>${peak ? `${peak.y}년 · ${amount(peak.value)}` : "—"}</td></tr><tr><td>과거 최저 총재산</td><td>${minRow ? `${minRow.y}년 · ${amount(minRow.value)}` : "—"}</td></tr><tr><td>선택 연도 순위</td><td>${rank || "—"} / ${vals.length}개 연도</td></tr></tbody></table><p class="muted" style="font-size:12px">명목 금액 기준이며 물가 조정 전입니다. 조사·과세 대상의 변화가 포함될 수 있습니다.</p>`;
}
let exported = [];
function tableRender() {
  let type = $("tableMode").value,
    y = $("year").value,
    d = dataset(type, y);
  if (!d) {
    $("thead").innerHTML = "";
    $("tbody").innerHTML = "";
    return;
  }
  let group = $("tableGroup").value,
    q = $("search").value.trim().toLowerCase(),
    rows = d.rows.filter(
      (r) =>
        (group === "all" || r.group === group) &&
        `${r.group} ${r.segment}`.toLowerCase().includes(q),
    );
  let heads = [
    "구분",
    "규모",
    ...d.metrics.map((m) => m.label + (m.sub === "소계" ? "" : ` · ${m.sub}`) + ` (${m.unit})`),
    "1인당 총상속재산 (억 원)",
    "1인당 과세표준 (억 원)",
  ];
  exported = [
    heads,
    ...rows.map((r) => [
      r.group,
      r.segment,
      ...r.values.map((v) => (v == null ? "" : v)),
      per(d, r, "총상속재산가액") == null ? "" : per(d, r, "총상속재산가액") / 100,
      per(d, r, "과세표준") == null ? "" : per(d, r, "과세표준") / 100,
    ]),
  ];
  $("thead").innerHTML = "<tr>" + heads.map((x) => `<th>${x}</th>`).join("") + "</tr>";
  $("tbody").innerHTML = rows
    .map(
      (r) =>
        `<tr><td>${r.group}</td><td>${r.segment}</td>${r.values.map((v) => `<td>${number(v)}</td>`).join("")}<td>${number(per(d, r, "총상속재산가액") == null ? null : per(d, r, "총상속재산가액") / 100, 2)}</td><td>${number(per(d, r, "과세표준") == null ? null : per(d, r, "과세표준") / 100, 2)}</td></tr>`,
    )
    .join("");
  $("tableCaption").textContent =
    `${y}년 · ${type} · ${rows.length}개 행 · ${d.metrics.length}개 원지표 (단위: 명, 백만원 / 1인당 평균: 억 원)`;
}


function mortalityCount(t, y) {
  let d = dataset(t, String(y));
  return d ? val(d, total(d), "피상속인수") : null;
}
function mortalityRate(t, y) {
  let deaths = MORTALITY[String(y)]?.["사망자수(명)"],
    n = mortalityCount(t, y);
  return deaths > 0 && n != null ? (n / deaths) * 100 : null;
}
function mortalitySVG(lines, unit = "", opts = {}) {
  const W = 820,
    H = 330,
    PL = 65,
    PR = 30,
    PT = 25,
    PB = 47,
    vals = lines.flatMap((l) => l.data.map((x) => x.v).filter((v) => Number.isFinite(v))),
    mx = Math.max(...vals, 1),
    mn = opts.zero ? 0 : Math.min(...vals, 0),
    range = mx - mn || 1,
    lo = opts.zero ? 0 : mn - range * 0.06,
    hi = mx + range * 0.1,
    yy = (v) => PT + ((hi - v) / (hi - lo)) * (H - PT - PB),
    xx = (y) => PL + ((y - 2006) / 19) * (W - PL - PR),
    colors = ["#3b7be8", "#e18b42", "#32a691"];
  let out = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="연도별 사망과 상속세 지표 시계열" style="width:100%;height:auto">`;
  for (let i = 0; i <= 4; i++) {
    let v = lo + ((hi - lo) * i) / 4,
      z = yy(v);
    out += `<line x1="${PL}" x2="${W - PR}" y1="${z}" y2="${z}" stroke="#dfe7f2"/><text x="${PL - 8}" y="${z + 4}" font-size="11" fill="#667" text-anchor="end">${number(v, opts.decimals ?? 1)}${unit}</text>`;
  }
  for (let y = 2006; y <= 2025; y += 3)
    out += `<text x="${xx(y)}" y="${H - 19}" text-anchor="middle" font-size="12" fill="#667">${y}</text>`;
  lines.forEach((l, i) => {
    let col = colors[i % colors.length],
      run = [];
    function push() {
      if (run.length) {
        out += `<polyline points="${run.join(" ")}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
        run = [];
      }
    }
    l.data.forEach((p) => {
      if (!Number.isFinite(p.v)) {
        push();
        return;
      }
      run.push(xx(p.y) + "," + yy(p.v));
    });
    push();
    l.data.forEach((p) => {
      if (Number.isFinite(p.v)) {
        out += `<circle cx="${xx(p.y)}" cy="${yy(p.v)}" r="3.5" fill="${col}"><title>${l.label} ${p.y}년: ${number(p.v, 2)}${unit}</title></circle>`;
      }
    });
  });
  out +=
    '</svg><div style="display:flex;gap:16px;flex-wrap:wrap;margin:6px 0 12px">' +
    lines
      .map(
        (l, i) =>
          `<span style="font-size:12px;color:${colors[i % colors.length]}">● ${l.label}</span>`,
      )
      .join("") +
    "</div>";
  return out;
}
function renderMortality() {
  let y = Number($("year").value),
    r = MORTALITY[String(y)] || {},
    n = r["사망자수(명)"],
    c = r["조사망률(천명당)"],
    life = r["기대수명(출생시 기대여명)"],
    sn = mortalityCount("신고", y),
    dn = mortalityCount("결정", y),
    sr = mortalityRate("신고", y),
    dr = mortalityRate("결정", y),
    pv = MORTALITY[String(y - 1)]?.["사망자수(명)"],
    dy = pv ? (n / pv - 1) * 100 : null;
  $("mortalityCards").innerHTML =
    insightBox("전체 사망자수", number(n) + "명", "전년 대비 " + pct(dy)) +
    insightBox(
      "사망자 대비 신고 인원",
      sr == null ? "—" : number(sr, 2) + "%",
      number(sn) + "명 / 사망자 " + number(n) + "명",
    ) +
    insightBox(
      "사망자 대비 결정 인원",
      dr == null ? "—" : number(dr, 2) + "%",
      number(dn) + "명 / 사망자 " + number(n) + "명",
    ) +
    insightBox(
      "조사망률 · 기대수명",
      number(c, 1) + "‰",
      life == null ? "기대수명 미제공" : `기대수명 ${number(life, 1)}세`,
    );
  let sy = mortalityRate("신고", y - 1),
    dprev = mortalityRate("결정", y - 1),
    start = mortalityRate("신고", 2006),
    startD = mortalityRate("결정", 2007),
    chg = (v, o) => (v != null && o != null ? v - o : null),
    ratefmt = (x) => (x == null ? "—" : (x >= 0 ? "+" : "") + number(x, 2) + "%p");
  let body = `<p><b>① 사망자 규모:</b> ${y}년 사망자는 <b>${number(n)}명</b>으로 전년 대비 <b>${pct(dy)}</b> 변화했습니다. 조사망률은 인구 1천 명당 <b>${number(c, 1)}명</b>입니다.</p><p><b>② 신고와의 비교:</b> 같은 연도 사망자 100명당 신고 피상속인수는 <b>${sr == null ? "자료 없음" : number(sr, 2) + "명"}</b>에 해당하며, 전년 대비 ${ratefmt(chg(sr, sy))} 변했습니다. 2006년 대비 ${ratefmt(chg(sr, start))}입니다.</p><p><b>③ 결정과의 비교:</b> 사망자 100명당 결정 피상속인수는 <b>${dr == null ? "자료 없음" : number(dr, 2) + "명"}</b>에 해당하며 전년 대비 ${ratefmt(chg(dr, dprev))} 변했습니다. 2007년 대비 ${ratefmt(chg(dr, startD))}입니다.</p>`;
  if (life == null)
    body +=
      "<p><b>④ 기대수명:</b> 해당 연도 기대수명은 CSV에서 미제공으로 표시되어 있습니다. 수치를 추정하지 않았습니다.</p>";
  else
    body += `<p><b>④ 기대수명:</b> 전체 ${number(life, 1)}세, 남자 ${number(r["기대수명(출생시 기대여명) - 남"], 1)}세, 여자 ${number(r["기대수명(출생시 기대여명) - 여"], 1)}세입니다.</p>`;
  $("mortalityNarrative").innerHTML =
    body +
    '<p style="font-size:12px;color:#687890">※ 이 비율은 동일 연도 수치를 비교한 관측 지표이며 사망자별 신고·결정 여부를 연결한 코호트 분석이 아닙니다. 세제 변화, 과세 대상 범위 및 행정 처리시차 영향을 구분할 수 없습니다.</p>';
  const years = Array.from({ length: 20 }, (_, i) => 2006 + i),
    line = (label, fun) => ({ label, data: years.map((y) => ({ y, v: fun(y) })) }),
    k = $("mortalityMetric").value;
  let lines = [],
    unit = "",
    opts = {};
  if (k === "rate") {
    lines = [
      line("신고 인원 / 사망자 (%)", (y) => mortalityRate("신고", y)),
      line("결정 인원 / 사망자 (%)", (y) => mortalityRate("결정", y)),
    ];
    unit = "%";
    opts = { zero: true };
  } else if (k === "persons") {
    lines = [
      line("전체 사망자수", (y) => MORTALITY[String(y)]?.["사망자수(명)"]),
      line("신고 피상속인수", (y) => mortalityCount("신고", y)),
      line("결정 피상속인수", (y) => mortalityCount("결정", y)),
    ];
    unit = "명";
    opts = { zero: true, decimals: 0 };
  } else if (k === "crude") {
    lines = [line("조사망률", (y) => MORTALITY[String(y)]?.["조사망률(천명당)"])];
    unit = "‰";
  } else if (k === "life") {
    lines = [
      line("전체", (y) => MORTALITY[String(y)]?.["기대수명(출생시 기대여명)"]),
      line("남자", (y) => MORTALITY[String(y)]?.["기대수명(출생시 기대여명) - 남"]),
      line("여자", (y) => MORTALITY[String(y)]?.["기대수명(출생시 기대여명) - 여"]),
    ];
    unit = "세";
  } else {
    const rebase = (f, y) => {
      let a = f(y),
        b = f(2007);
      return Number.isFinite(a) && Number.isFinite(b) && b > 0 ? (a / b) * 100 : null;
    };
    lines = [
      line("사망자수 (2007=100)", (y) => rebase((z) => MORTALITY[String(z)]?.["사망자수(명)"], y)),
      line("신고 인원 (2007=100)", (y) => rebase((z) => mortalityCount("신고", z), y)),
      line("결정 인원 (2007=100)", (y) => rebase((z) => mortalityCount("결정", z), y)),
    ];
    unit = "";
    opts = { zero: true };
  }
  $("mortalityPlot").innerHTML = mortalitySVG(lines, unit, opts);
  let table = `<table class="minitable"><thead><tr><th>연도</th><th>사망자(명)</th><th>신고(명)</th><th>결정(명)</th><th>사망자 대비 신고(%)</th><th>사망자 대비 결정(%)</th><th>조사망률(‰)</th><th>기대수명(세)</th></tr></thead><tbody>`;
  for (let z = 2006; z <= 2025; z++) {
    let obj = MORTALITY[String(z)];
    table += `<tr ${z === y ? 'style="background:#eaf2ff;font-weight:700"' : ""}><td>${z}</td><td>${number(obj["사망자수(명)"])}</td><td>${number(mortalityCount("신고", z))}</td><td>${number(mortalityCount("결정", z))}</td><td>${number(mortalityRate("신고", z), 2)}</td><td>${number(mortalityRate("결정", z), 2)}</td><td>${number(obj["조사망률(천명당)"], 1)}</td><td>${number(obj["기대수명(출생시 기대여명)"], 1)}</td></tr>`;
  }
  $("mortalityTable").innerHTML = table + "</tbody></table>";
}
$("mortalityMetric").addEventListener("change", renderMortality);

function render() {
  renderMortality();
  renderInsights();
  cardRender();
  comparison();
  trend();
  distribution("asset");
  distribution("tax");
  tableRender();
}
[
  "insightType",
  "growthKey",
  "year",
  "mode",
  "trendMetric",
  "groupMetric",
  "groupMode",
  "taxMetric",
  "taxMode",
  "tableMode",
  "tableGroup",
].forEach((id) => $(id).addEventListener("change", render));
$("search").addEventListener("input", tableRender);
$("export").addEventListener("click", () => {
  let csv =
      "\ufeff" +
      exported
        .map((row) => row.map((v) => '"' + String(v ?? "").replaceAll('"', '""') + '"').join(","))
        .join("\r\n"),
    blob = new Blob([csv], { type: "text/csv;charset=utf-8" }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `상속세_${$("tableMode").value}_${$("year").value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});
render();
