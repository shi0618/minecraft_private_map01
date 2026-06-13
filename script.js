// ─── デバイス判定 ─────────────────────────────────────────────
const isTouchDevice = () =>
  ('ontouchstart' in window) ||
  (navigator.maxTouchPoints > 0) ||
  (navigator.msMaxTouchPoints > 0);

let isMobile = isTouchDevice();

// サブタイトルにデバイス種別を表示
function updateSubtitle() {
  const mode = isMobile ? "モバイル版(タッチ)" : "デスクトップ版(マウス)";
  const hint = isMobile
    ? "タップでツールチップ / 長押しで座標コピー"
    : "ホバーで詳細 / クリックで座標コピー";
  document.getElementById("subtitle").textContent = `[${mode}]  ${hint}`;
}
updateSubtitle();

// リサイズ時にも再判定(タブレット回転など)
window.addEventListener('resize', () => {
  isMobile = isTouchDevice();
  updateSubtitle();
});

console.log(`[MapMode] ${isMobile ? "モバイル(タッチ)" : "デスクトップ(マウス)"}`);

// ─── 実測座標から計算した地図範囲 ───────────────────────────
// 右下: X=-73,  Z=1975
// 左下: X=-2120, Z=1975
// 横幅: 2120-73 = 2047 ≒ 2048
// 縦幅: 2048(4/4マップ固定)
// → 右上: X=-73,  Z=1975-2048=-73
// → 左上: X=-2120, Z=-73

const MAP_MIN_X = -2120;
const MAP_MAX_X =   -73;
const MAP_MIN_Z =   -73;
const MAP_MAX_Z =  1975;
const MAP_SIZE_X = MAP_MAX_X - MAP_MIN_X; // 2047
const MAP_SIZE_Z = MAP_MAX_Z - MAP_MIN_Z; // 2048

// ─── 座標データ ──────────────────────────────────────────────
const locations = [
  { name: "ワクワクする洞窟",           x: -911,  y:  73, z: 1832, type: "cave"    },
  { name: "前哨基地①",                 x: -1061, y:  99, z: 1778, type: "outpost" },
  { name: "ワクワクする洞窟2",          x: -1155, y:  97, z: 1820, type: "cave"    },
  { name: "ワクワクする洞窟3",          x: -1447, y:  63, z: 1836, type: "cave"    },
  { name: "前哨基地②",                 x: -1958, y:  69, z: 1390, type: "outpost" },
  { name: "オークの村①",               x: -1982, y:  78, z: 1237, type: "village" },
  { name: "茶色い村",                   x:   753, y:  76, z:  -351, type: "village" },
  { name: "砂の砦",                     x:  1185, y:  65, z:   325, type: "other"   },
  { name: "前哨基地③",                 x:   631, y:  71, z:   323, type: "outpost" },
  { name: "鍾乳石ポイント",             x: -1350, y:  67, z:   952, type: "other"   },
  { name: "ワクワクする洞窟4",          x: -1544, y:  61, z:   848, type: "cave"    },
  { name: "桜バイオーム隣接オークの村", x: -1282, y: 121, z:  1323, type: "village" },
  { name: "難破船",                     x:  -540, y:  62, z:  1370, type: "other"   },
  { name: "洞窟畑オークの村",           x:  -924, y: 109, z:   746, type: "village" },
  { name: "川落ちワクワク洞窟",         x: -1543, y:  63, z:   635, type: "cave"    },
  { name: "廃坑ネザーゲート",           x: -1860, y: 111, z:   928, type: "other"   },
  { name: "氷バイオーム近くの村",       x: -1494, y:  63, z:   234, type: "village" },
  { name: "ワクワク洞窟final",          x: -1283, y:  62, z:   501, type: "cave"    },
];

const HOME = { name: "拠点", x: -73, y: 76, z: -73 };

const TYPE_COLOR = {
  village: { bg: "#6ee7b7", label: "村" },
  cave:    { bg: "#fbbf24", label: "洞窟" },
  outpost: { bg: "#f87171", label: "前哨基地" },
  other:   { bg: "#a78bfa", label: "その他" },
};

// ─── 枠オフセット(スライダーで調整可能) ─────────────────────
// URLパラメータから初期値を復元
const urlP = new URLSearchParams(location.search);
let offsetH = parseFloat(urlP.get("oh") || "0.8"); // 左右%
let offsetV = parseFloat(urlP.get("ov") || "1.2"); // 上下%

document.getElementById("sliderH").value = offsetH;
document.getElementById("sliderV").value = offsetV;
document.getElementById("valH").textContent = offsetH.toFixed(1);
document.getElementById("valV").textContent = offsetV.toFixed(1);

// ─── 座標→% 変換(枠オフセット考慮) ─────────────────────────
function worldToPercent(worldX, worldZ) {
  // 枠を除いた地図領域の開始位置と幅(%単位)
  const mapStartX = offsetH;
  const mapStartZ = offsetV;
  const mapWidthPct  = 100 - offsetH * 2;
  const mapHeightPct = 100 - offsetV * 2;

  const px = mapStartX + (worldX - MAP_MIN_X) / MAP_SIZE_X * mapWidthPct;
  const pz = mapStartZ + (worldZ - MAP_MIN_Z) / MAP_SIZE_Z * mapHeightPct;
  return { px, pz };
}

function isInRange(x, z) {
  return x >= MAP_MIN_X && x <= MAP_MAX_X && z >= MAP_MIN_Z && z <= MAP_MAX_Z;
}

// ─── コピー共通関数(https必須のClipboard APIが使えない場合にフォールバック) ───
function copyText(text, onSuccess) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => fallbackCopy(text, onSuccess));
  } else {
    fallbackCopy(text, onSuccess);
  }
}
function fallbackCopy(text, onSuccess) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand("copy");
    onSuccess();
  } catch(e) {
    console.warn("コピー失敗:", e);
  }
  document.body.removeChild(ta);
}

// ─── ピン生成 ────────────────────────────────────────────────
const pinsLayer  = document.getElementById("pinsLayer");
const tooltip    = document.getElementById("tooltip");
const ttName     = document.getElementById("tt-name");
const ttType     = document.getElementById("tt-type");
const ttCoord    = document.getElementById("tt-coord");
const outOfRangeBox = document.getElementById("outOfRangeBox");
const coordsBar  = document.getElementById("coordsBar");

coordsBar.innerHTML =
  `X: ${MAP_MIN_X} ← → ${MAP_MAX_X} &nbsp;/&nbsp; Z: ${MAP_MIN_Z} ↑ ↓ ${MAP_MAX_Z}`;

const outOfRange = [];
let allPinData = [];

function makePin(config) {
  const { name, x, y, z, color, extraClass, typeLabel } = config;
  const { px, pz } = worldToPercent(x, z);

  const pin = document.createElement("div");
  pin.className = "pin" + (extraClass ? " " + extraClass : "");
  pin.style.left = px + "%";
  pin.style.top  = pz + "%";
  pin.dataset.x = x; pin.dataset.y = y; pin.dataset.z = z;
  pin.dataset.name = name; pin.dataset.typeLabel = typeLabel || "";

  const dot = document.createElement("div");
  dot.className = "pin-dot";
  dot.style.background = color;

  const lbl = document.createElement("div");
  lbl.className = "pin-label";
  lbl.textContent = name;

  pin.appendChild(dot);
  pin.appendChild(lbl);

  if (isMobile) {
    // ── タッチ用: タップでツールチップ表示、閉じるは他の場所タップのみ ──
    pin.addEventListener("touchend", (e) => {
      e.preventDefault();
      ttName.textContent  = name;
      ttType.textContent  = typeLabel || "";
      ttCoord.textContent = `X: ${x}  Y: ${y}  Z: ${z}`;
      const rect = pin.getBoundingClientRect();
      tooltip.style.left = Math.min(rect.left, window.innerWidth - 260) + "px";
      tooltip.style.top  = (rect.top - 90) + "px";
      tooltip.style.display = "block";
    });
    // タッチ用コピー(ツールチップが開いてる状態で500ms長押し)
    let holdTimer = null;
    pin.addEventListener("touchstart", (e) => {
      e.preventDefault(); // 長押しメニュー・テキスト選択を阻止
      holdTimer = setTimeout(() => {
        const text = `${name}  X:${x} Y:${y} Z:${z}`;
        copyText(text, () => {
          lbl.textContent = "コピーしました!";
          lbl.style.opacity = "1";
          setTimeout(() => { lbl.textContent = name; lbl.style.opacity = ""; }, 1500);
        });
      }, 500);
    });
    pin.addEventListener("touchend", () => { clearTimeout(holdTimer); });
  } else {
    // ── マウス用: 従来通り ──
    pin.addEventListener("mouseenter", () => {
      ttName.textContent  = name;
      ttType.textContent  = typeLabel || "";
      ttCoord.textContent = `X: ${x}  Y: ${y}  Z: ${z}`;
      tooltip.style.display = "block";
    });
    pin.addEventListener("mousemove", (e) => {
      tooltip.style.left = (e.clientX + 14) + "px";
      tooltip.style.top  = (e.clientY - 36) + "px";
    });
    pin.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });
    pin.addEventListener("click", () => {
      const text = `${name}  X:${x} Y:${y} Z:${z}`;
      copyText(text, () => {
        lbl.textContent = "コピーしました!";
        lbl.style.opacity = "1";
        setTimeout(() => { lbl.textContent = name; lbl.style.opacity = ""; }, 1500);
      });
    });
  }

  pinsLayer.appendChild(pin);
  allPinData.push({ pin, config });
}

function buildPins() {
  pinsLayer.innerHTML = "";
  allPinData = [];
  outOfRange.length = 0;

  locations.forEach(loc => {
    if (!isInRange(loc.x, loc.z)) { outOfRange.push(loc); return; }
    const tc = TYPE_COLOR[loc.type];
    makePin({ name: loc.name, x: loc.x, y: loc.y, z: loc.z, color: tc.bg, typeLabel: tc.label });
  });

  makePin({ name: HOME.name, x: HOME.x, y: HOME.y, z: HOME.z,
            color: "#ffffff", extraClass: "pin-home", typeLabel: "拠点" });

  if (outOfRange.length > 0) {
    outOfRangeBox.style.display = "block";
    outOfRangeBox.innerHTML = "<strong>地図範囲外のポイント:</strong><br>"
      + outOfRange.map(p => `${p.name}  X:${p.x} Z:${p.z}`).join("　/　");
  } else {
    outOfRangeBox.style.display = "none";
  }
}

// ─── スライダー操作 → リアルタイム再描画 ─────────────────────
function updateOffset() {
  offsetH = parseFloat(document.getElementById("sliderH").value);
  offsetV = parseFloat(document.getElementById("sliderV").value);
  document.getElementById("valH").textContent = offsetH.toFixed(1);
  document.getElementById("valV").textContent = offsetV.toFixed(1);
  buildPins();
}

document.getElementById("sliderH").addEventListener("input", updateOffset);
document.getElementById("sliderV").addEventListener("input", updateOffset);

// 値をURLに保存(ブックマーク用)
document.getElementById("saveBtn").addEventListener("click", () => {
  const url = new URL(location.href);
  url.searchParams.set("oh", offsetH.toFixed(1));
  url.searchParams.set("ov", offsetV.toFixed(1));
  history.replaceState(null, "", url.toString());
  document.getElementById("saveMsg").textContent = "URLを更新しました!";
  setTimeout(() => { document.getElementById("saveMsg").textContent = ""; }, 2000);
});

// ─── 初回描画 ────────────────────────────────────────────────
buildPins();

// モバイル: ピン以外タップでツールチップを閉じる
document.addEventListener("touchend", (e) => {
  if (!e.target.closest(".pin")) {
    tooltip.style.display = "none";
  }
});

// ─── 画像フォールバック ───────────────────────────────────────
const mapImg  = document.getElementById("mapImg");
const fallback = document.getElementById("fallback");
mapImg.addEventListener("error", () => { mapImg.style.display = "none"; fallback.style.display = "flex"; });
mapImg.addEventListener("load",  () => { fallback.style.display = "none"; mapImg.style.display = "block"; });