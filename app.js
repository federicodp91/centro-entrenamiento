"use strict";

/* ===================== Datos y almacenamiento ===================== */

const STORE_KEY = "centro-entrenamiento.v1";

const CATEGORY_COLORS = {
  "Core": "#f59e0b",
  "Habilidades": "#8b5cf6",
  "Glúteos e isquios": "#ec4899",
  "Piernas": "#10b981",
  "Espalda y tracción": "#3b82f6",
  "Movilidad y flexibilidad": "#14b8a6",
  "Pliometría y cardio": "#ef4444",
  "Pecho y empuje": "#f97316",
  "Brazos": "#06b6d4",
  "Potencia (olímpicos y kettlebell)": "#a16207",
  "Hombros": "#6366f1",
  "Otros": "#6b7280",
};
const CATEGORIES = Object.keys(CATEGORY_COLORS);

function defaultState() {
  return {
    favs: [],
    custom: [],       // ejercicios agregados por el usuario
    overrides: {},    // id -> { categoria }
    notes: {},        // id -> texto
    routines: [],
    history: [],
    active: null,     // sesión en curso
    rest: null,       // { endsAt }
    defaultRest: 90,
    drive: { auto: true, connected: false, fileId: null, lastBackup: null },
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { /* almacenamiento no disponible */ }
  return defaultState();
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast("No se pudo guardar (almacenamiento lleno o bloqueado)"); }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function allExercises() {
  return window.EXERCISES.concat(state.custom).map(ex => {
    const o = state.overrides[ex.id];
    return o ? Object.assign({}, ex, o) : ex;
  });
}

let exIndex = new Map();
function reindex() {
  exIndex = new Map(allExercises().map(ex => [ex.id, ex]));
}
reindex();

function exById(id) {
  return exIndex.get(id) || { id, nombre: "(ejercicio eliminado)", categoria: "Otros", equipo: [] };
}

/* ===================== Utilidades ===================== */

const $ = sel => document.querySelector(sel);
const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmtDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(r).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function num(v) {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function setVolume(set) {
  const p = num(set.peso), r = num(set.reps);
  return p && r ? p * r : 0;
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 1800);
}

function dot(cat) {
  return `<span class="dot" style="background:${CATEGORY_COLORS[cat] || "#888"}"></span>`;
}

/* ===================== Navegación ===================== */

const ui = {
  tab: "ejercicios",
  search: "",
  cat: "",
  equipo: "",
  onlyFavs: false,
  editing: null,   // id de rutina en edición
};

const TITLES = { ejercicios: "Ejercicios", rutinas: "Rutinas", entrenar: "Entrenar", historial: "Historial" };

function go(tab) {
  ui.tab = tab;
  if (tab !== "rutinas") ui.editing = null;
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  render();
  window.scrollTo(0, 0);
}

function render() {
  $("#title").textContent = ui.editing ? "Editar rutina" : TITLES[ui.tab];
  $("#topActions").innerHTML = "";
  const views = { ejercicios: renderExercises, rutinas: renderRoutines, entrenar: renderTrain, historial: renderHistory };
  views[ui.tab]();
}

/* ===================== Ejercicios ===================== */

function filteredExercises() {
  const q = norm(ui.search.trim());
  return allExercises()
    .filter(ex =>
      (!q || norm(ex.nombre).includes(q)) &&
      (!ui.cat || ex.categoria === ui.cat) &&
      (!ui.equipo || ex.equipo.includes(ui.equipo)) &&
      (!ui.onlyFavs || state.favs.includes(ex.id)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function renderExercises() {
  $("#topActions").innerHTML = `<button class="btn sm primary" data-action="new-exercise">+ Ejercicio</button>`;
  const equipos = [...new Set(allExercises().flatMap(e => e.equipo))].sort((a, b) => a.localeCompare(b, "es"));
  const counts = {};
  allExercises().forEach(e => (counts[e.categoria] = (counts[e.categoria] || 0) + 1));

  $("#view").innerHTML = `
    <div class="search-row">
      <input type="search" id="search" placeholder="Buscar ejercicio…" value="${esc(ui.search)}" autocomplete="off">
    </div>
    <div class="chips">
      <button class="chip ${!ui.cat ? "active" : ""}" data-action="cat" data-cat="">Todos</button>
      ${CATEGORIES.filter(c => counts[c]).map(c =>
        `<button class="chip ${ui.cat === c ? "active" : ""}" data-action="cat" data-cat="${esc(c)}">${esc(c)} · ${counts[c]}</button>`).join("")}
    </div>
    <div class="filters">
      <select id="equipo">
        <option value="">Todo el equipamiento</option>
        ${equipos.map(e => `<option ${ui.equipo === e ? "selected" : ""}>${esc(e)}</option>`).join("")}
      </select>
      <button class="chip ${ui.onlyFavs ? "active" : ""}" data-action="only-favs">★ Favoritos</button>
    </div>
    <div class="count" id="count"></div>
    <ul class="list" id="exList"></ul>`;

  $("#search").addEventListener("input", e => { ui.search = e.target.value; renderExerciseList(); });
  $("#equipo").addEventListener("change", e => { ui.equipo = e.target.value; renderExerciseList(); });
  renderExerciseList();
}

function exerciseRow(ex, extra = "") {
  const isFav = state.favs.includes(ex.id);
  return `
    <li class="ex-item" data-id="${esc(ex.id)}">
      <div class="info" data-action="open-exercise" data-id="${esc(ex.id)}">
        <div class="name">${esc(ex.nombre)}</div>
        <div class="meta">${dot(ex.categoria)}${esc(ex.categoria)} · ${esc(ex.equipo.join(", "))}</div>
      </div>
      ${extra}
      <button class="icon-btn ${isFav ? "fav" : ""}" data-action="toggle-fav" data-id="${esc(ex.id)}" aria-label="Favorito">${isFav ? "★" : "☆"}</button>
    </li>`;
}

function renderExerciseList() {
  const list = filteredExercises();
  $("#count").textContent = `${list.length} ejercicio${list.length === 1 ? "" : "s"}`;
  $("#exList").innerHTML = list.length
    ? list.map(ex => exerciseRow(ex)).join("")
    : `<li class="empty"><span class="big">🔍</span>No hay ejercicios con esos filtros.</li>`;
}

function exerciseHistory(id) {
  const out = [];
  for (const s of state.history) {
    for (const it of s.items) {
      if (it.exId !== id) continue;
      const done = it.sets.filter(x => x.hecho);
      if (done.length) out.push({ fecha: s.inicio, sets: done });
    }
  }
  return out.sort((a, b) => b.fecha - a.fecha);
}

function openExercise(id) {
  const ex = exById(id);
  const isFav = state.favs.includes(id);
  const isCustom = state.custom.some(c => c.id === id);
  const hist = exerciseHistory(id);
  const best = Math.max(0, ...hist.flatMap(h => h.sets.map(s => num(s.peso) || 0)));
  const yt = "https://www.youtube.com/results?search_query=" + encodeURIComponent(ex.nombre + " ejercicio");

  openModal(`
    <div class="modal-head">
      <h2>${esc(ex.nombre)}</h2>
      <button class="icon-btn ${isFav ? "fav" : ""}" data-action="toggle-fav" data-id="${esc(id)}" data-refresh="modal">${isFav ? "★" : "☆"}</button>
      <button class="icon-btn" data-action="close-modal" aria-label="Cerrar">✕</button>
    </div>
    <div>${ex.equipo.map(e => `<span class="tag">${esc(e)}</span>`).join("")}</div>
    <label class="field"><span>Categoría</span>
      <select id="exCat">${CATEGORIES.map(c => `<option ${c === ex.categoria ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
    </label>
    <label class="field"><span>Notas (técnica, ajustes, progresión…)</span>
      <textarea id="exNote" placeholder="Ej: codos a 45°, bajar en 3 segundos">${esc(state.notes[id] || "")}</textarea>
    </label>
    <div class="row wrap">
      <a class="btn sm" href="${yt}" target="_blank" rel="noopener">▶ Ver en YouTube</a>
      ${state.active ? `<button class="btn sm" data-action="add-to-session" data-id="${esc(id)}">+ Al entrenamiento</button>` : ""}
      ${state.routines.length ? `
        <select id="exRoutine" style="flex:1;min-width:140px">
          <option value="">Agregar a rutina…</option>
          ${state.routines.map(r => `<option value="${r.id}">${esc(r.nombre)}</option>`).join("")}
        </select>` : ""}
    </div>
    <h3 style="margin:16px 0 6px;font-size:15px">Historial</h3>
    ${hist.length ? `
      <div class="sub" style="margin-bottom:6px">Mejor peso: <b>${best ? best + " kg" : "—"}</b> · ${hist.length} sesión(es)</div>
      ${hist.slice(0, 6).map(h => `
        <div class="hist-ex"><b>${fmtDate(h.fecha)}</b> — ${h.sets.map(s => esc(fmtSet(s))).join(", ")}</div>`).join("")}
    ` : `<div class="sub">Todavía no registraste este ejercicio.</div>`}
    ${isCustom ? `<button class="btn danger block" style="margin-top:16px" data-action="delete-exercise" data-id="${esc(id)}">Eliminar ejercicio</button>` : ""}
  `);

  $("#exCat").addEventListener("change", e => {
    state.overrides[id] = Object.assign({}, state.overrides[id], { categoria: e.target.value });
    save(); reindex(); if (ui.tab === "ejercicios") renderExercises();
    toast("Categoría actualizada");
  });
  $("#exNote").addEventListener("input", e => {
    if (e.target.value.trim()) state.notes[id] = e.target.value; else delete state.notes[id];
    save();
  });
  const sel = $("#exRoutine");
  if (sel) sel.addEventListener("change", e => {
    const r = state.routines.find(r => r.id === e.target.value);
    if (!r) return;
    r.items.push(newRoutineItem(id));
    save(); toast(`Agregado a “${r.nombre}”`);
    e.target.value = "";
  });
}

function fmtSet(s) {
  const p = num(s.peso);
  return p ? `${s.reps || "?"}×${p}kg` : `${s.reps || "?"}`;
}

function newExercise() {
  openModal(`
    <div class="modal-head"><h2>Nuevo ejercicio</h2>
      <button class="icon-btn" data-action="close-modal">✕</button></div>
    <label class="field"><span>Nombre</span><input type="text" id="nxName" placeholder="Ej: Remo con banda sentado"></label>
    <label class="field"><span>Categoría</span>
      <select id="nxCat">${CATEGORIES.map(c => `<option>${esc(c)}</option>`).join("")}</select></label>
    <label class="field"><span>Equipamiento (separado por comas)</span>
      <input type="text" id="nxEq" placeholder="Peso corporal"></label>
    <button class="btn primary block" data-action="save-exercise">Guardar</button>
  `);
  $("#nxName").focus();
}

function saveExercise() {
  const nombre = $("#nxName").value.trim();
  if (!nombre) return toast("Poné un nombre");
  if (allExercises().some(e => norm(e.nombre) === norm(nombre))) return toast("Ya existe un ejercicio con ese nombre");
  const equipo = $("#nxEq").value.split(",").map(s => s.trim()).filter(Boolean);
  state.custom.push({ id: "c-" + uid(), nombre, categoria: $("#nxCat").value, equipo: equipo.length ? equipo : ["Peso corporal"] });
  save(); reindex(); closeModal(); renderExercises(); toast("Ejercicio creado");
}

/* ===================== Rutinas ===================== */

function newRoutineItem(exId) {
  return { exId, series: 3, reps: "10", peso: "", descanso: state.defaultRest };
}

function renderRoutines() {
  if (ui.editing) return renderRoutineEditor();
  $("#topActions").innerHTML = `<button class="btn sm primary" data-action="new-routine">+ Rutina</button>`;
  if (!state.routines.length) {
    $("#view").innerHTML = `
      <div class="empty"><span class="big">📋</span>
        Armá tu primera rutina eligiendo ejercicios del catálogo.<br><br>
        <button class="btn primary" data-action="new-routine">Crear rutina</button></div>`;
    return;
  }
  $("#view").innerHTML = state.routines.map(r => `
    <div class="card">
      <div class="row">
        <div class="spacer">
          <h3>${esc(r.nombre)}</h3>
          <div class="sub">${r.items.length} ejercicio(s) · ${r.items.reduce((a, i) => a + (+i.series || 0), 0)} series</div>
        </div>
        <button class="btn primary" data-action="start-routine" data-id="${r.id}">▶ Empezar</button>
      </div>
      <div class="sub" style="margin-top:8px">${r.items.slice(0, 5).map(i => esc(exById(i.exId).nombre)).join(" · ")}${r.items.length > 5 ? " …" : ""}</div>
      <div class="row" style="margin-top:10px">
        <button class="btn sm" data-action="edit-routine" data-id="${r.id}">Editar</button>
        <button class="btn sm" data-action="dup-routine" data-id="${r.id}">Duplicar</button>
        <span class="spacer"></span>
        <button class="btn sm danger" data-action="delete-routine" data-id="${r.id}">Eliminar</button>
      </div>
    </div>`).join("");
}

function renderRoutineEditor() {
  const r = state.routines.find(r => r.id === ui.editing);
  if (!r) { ui.editing = null; return renderRoutines(); }
  $("#topActions").innerHTML = `<button class="btn sm primary" data-action="done-routine">Listo</button>`;
  $("#view").innerHTML = `
    <label class="field"><span>Nombre de la rutina</span>
      <input type="text" id="rName" value="${esc(r.nombre)}"></label>
    <div class="card">
      ${r.items.length ? r.items.map((it, i) => {
        const ex = exById(it.exId);
        return `
        <div class="item-edit" data-index="${i}">
          <div class="row">
            <div class="spacer"><b>${i + 1}. ${esc(ex.nombre)}</b><div class="prev">${dot(ex.categoria)}${esc(ex.categoria)}</div></div>
            <button class="icon-btn" data-action="move-item" data-dir="-1" data-index="${i}" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="icon-btn" data-action="move-item" data-dir="1" data-index="${i}" ${i === r.items.length - 1 ? "disabled" : ""}>↓</button>
            <button class="icon-btn" data-action="remove-item" data-index="${i}">🗑</button>
          </div>
          <div class="grid4">
            <label>Series<input type="number" min="1" inputmode="numeric" data-field="series" data-index="${i}" value="${esc(it.series)}"></label>
            <label>Reps / tiempo<input type="text" data-field="reps" data-index="${i}" value="${esc(it.reps)}" placeholder="10 o 30s"></label>
            <label>Peso (kg)<input type="text" inputmode="decimal" data-field="peso" data-index="${i}" value="${esc(it.peso)}" placeholder="—"></label>
            <label>Descanso (s)<input type="number" min="0" inputmode="numeric" data-field="descanso" data-index="${i}" value="${esc(it.descanso)}"></label>
          </div>
        </div>`;
      }).join("") : `<div class="empty" style="padding:20px">Sin ejercicios todavía.</div>`}
    </div>
    <button class="btn block" data-action="pick-for-routine">+ Agregar ejercicios</button>`;

  $("#rName").addEventListener("input", e => { r.nombre = e.target.value || "Rutina sin nombre"; save(); });
  $("#view").querySelectorAll("[data-field]").forEach(inp =>
    inp.addEventListener("input", e => {
      const it = r.items[+e.target.dataset.index];
      const f = e.target.dataset.field;
      it[f] = f === "series" || f === "descanso" ? Math.max(0, parseInt(e.target.value) || 0) : e.target.value;
      save();
    }));
}

function newRoutine() {
  const r = { id: uid(), nombre: `Rutina ${state.routines.length + 1}`, items: [] };
  state.routines.push(r);
  save();
  ui.editing = r.id;
  render();
}

/* Selector de ejercicios reutilizable (rutinas y sesión) */
function openPicker(title, onPick) {
  let q = "", cat = "";
  openModal(`
    <div class="modal-head"><h2>${esc(title)}</h2>
      <button class="btn sm primary" data-action="close-modal">Listo</button></div>
    <input type="search" id="pkSearch" placeholder="Buscar…" autocomplete="off">
    <div class="chips" id="pkCats" style="margin:0;padding-inline:0">
      <button class="chip active" data-cat="">Todos</button>
      ${state.favs.length ? `<button class="chip" data-cat="__favs">★ Favoritos</button>` : ""}
      ${CATEGORIES.map(c => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
    </div>
    <ul class="list picker-list" id="pkList"></ul>`);

  const draw = () => {
    const nq = norm(q.trim());
    const list = allExercises()
      .filter(ex => (!nq || norm(ex.nombre).includes(nq)) &&
        (!cat || (cat === "__favs" ? state.favs.includes(ex.id) : ex.categoria === cat)))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .slice(0, 150);
    $("#pkList").innerHTML = list.map(ex => `
      <li class="ex-item" data-pick="${esc(ex.id)}">
        <div class="info"><div class="name">${esc(ex.nombre)}</div>
        <div class="meta">${dot(ex.categoria)}${esc(ex.categoria)}</div></div>
        <span style="font-size:20px">＋</span>
      </li>`).join("") || `<li class="empty">Sin resultados</li>`;
  };
  $("#pkSearch").addEventListener("input", e => { q = e.target.value; draw(); });
  $("#pkCats").addEventListener("click", e => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    cat = b.dataset.cat;
    $("#pkCats").querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c === b));
    draw();
  });
  $("#pkList").addEventListener("click", e => {
    const li = e.target.closest("[data-pick]");
    if (!li) return;
    onPick(li.dataset.pick);
    li.classList.add("added");
    toast(`Agregado: ${exById(li.dataset.pick).nombre}`);
  });
  draw();
}

/* ===================== Entrenamiento ===================== */

function startSession(routine) {
  if (state.active && !confirm("Ya hay un entrenamiento en curso. ¿Descartarlo y empezar otro?")) return;
  state.active = {
    id: uid(),
    inicio: Date.now(),
    rutinaId: routine ? routine.id : null,
    rutinaNombre: routine ? routine.nombre : "Entrenamiento libre",
    items: routine ? routine.items.map(it => ({
      exId: it.exId,
      descanso: it.descanso,
      sets: Array.from({ length: Math.max(1, +it.series || 1) }, () => ({ reps: it.reps, peso: it.peso, hecho: false })),
    })) : [],
  };
  save();
  go("entrenar");
}

function addToSession(exId) {
  const last = lastPerformance(exId);
  state.active.items.push({
    exId,
    descanso: state.defaultRest,
    sets: last ? last.map(s => ({ reps: s.reps, peso: s.peso, hecho: false }))
               : [{ reps: "", peso: "", hecho: false }],
  });
  save();
}

function lastPerformance(exId) {
  const h = exerciseHistory(exId)[0];
  return h ? h.sets : null;
}

function renderTrain() {
  const s = state.active;
  if (!s) {
    $("#view").innerHTML = `
      <div class="empty"><span class="big">🏋️</span>No hay ningún entrenamiento en curso.</div>
      <button class="btn primary block" data-action="start-free">Empezar entrenamiento libre</button>
      ${state.routines.length ? `<h3 style="margin:20px 0 8px">O elegí una rutina</h3>` +
        state.routines.map(r => `
          <div class="card row">
            <div class="spacer"><h3>${esc(r.nombre)}</h3><div class="sub">${r.items.length} ejercicio(s)</div></div>
            <button class="btn primary" data-action="start-routine" data-id="${r.id}">▶</button>
          </div>`).join("") : ""}`;
    return;
  }

  $("#topActions").innerHTML = `<button class="btn sm danger" data-action="discard-session">Descartar</button>`;
  const doneSets = s.items.reduce((a, it) => a + it.sets.filter(x => x.hecho).length, 0);
  const totalSets = s.items.reduce((a, it) => a + it.sets.length, 0);

  $("#view").innerHTML = `
    <div class="session-head">
      <div><div class="sub">${esc(s.rutinaNombre)}</div><div class="timer" id="elapsed">${fmtDuration(Date.now() - s.inicio)}</div></div>
      <div style="text-align:right"><div class="sub">Series</div><b>${doneSets}/${totalSets}</b></div>
    </div>
    ${s.items.map((it, i) => {
      const ex = exById(it.exId);
      const prev = lastPerformance(it.exId);
      const note = state.notes[it.exId];
      return `
      <div class="card">
        <div class="row">
          <div class="spacer" data-action="open-exercise" data-id="${esc(it.exId)}" style="cursor:pointer">
            <h3>${esc(ex.nombre)}</h3>
            <div class="prev">${prev ? "Última vez: " + esc(prev.map(fmtSet).join(", ")) : "Primera vez"}${note ? " · 📝 " + esc(note.slice(0, 60)) : ""}</div>
          </div>
          <button class="icon-btn" data-action="remove-session-item" data-index="${i}" aria-label="Quitar">🗑</button>
        </div>
        <table class="sets">
          <thead><tr><th></th><th>Peso (kg)</th><th>Reps / tiempo</th><th></th></tr></thead>
          <tbody>
            ${it.sets.map((st, j) => `
              <tr class="${st.hecho ? "done" : ""}">
                <td class="n">${j + 1}</td>
                <td><input type="text" inputmode="decimal" data-sfield="peso" data-i="${i}" data-j="${j}" value="${esc(st.peso)}" placeholder="—"></td>
                <td><input type="text" data-sfield="reps" data-i="${i}" data-j="${j}" value="${esc(st.reps)}" placeholder="10"></td>
                <td class="ck"><button class="check ${st.hecho ? "on" : ""}" data-action="toggle-set" data-i="${i}" data-j="${j}">✓</button></td>
              </tr>`).join("")}
          </tbody>
        </table>
        <div class="row" style="margin-top:8px">
          <button class="btn sm" data-action="add-set" data-i="${i}">+ Serie</button>
          ${it.sets.length > 1 ? `<button class="btn sm" data-action="remove-set" data-i="${i}">− Serie</button>` : ""}
          <span class="spacer"></span>
          <span class="prev">Descanso ${it.descanso}s</span>
        </div>
      </div>`;
    }).join("")}
    <button class="btn block" data-action="pick-for-session">+ Agregar ejercicio</button>
    <button class="btn primary block" style="margin-top:10px" data-action="finish-session">Finalizar entrenamiento</button>`;

  $("#view").querySelectorAll("[data-sfield]").forEach(inp =>
    inp.addEventListener("input", e => {
      const d = e.target.dataset;
      s.items[+d.i].sets[+d.j][d.sfield] = e.target.value;
      save();
    }));
}

function finishSession() {
  const s = state.active;
  const items = s.items
    .map(it => ({ exId: it.exId, sets: it.sets.filter(x => x.hecho) }))
    .filter(it => it.sets.length);
  if (!items.length) {
    if (!confirm("No marcaste ninguna serie como hecha. ¿Terminar sin guardar?")) return;
  } else {
    state.history.unshift({ id: s.id, inicio: s.inicio, fin: Date.now(), rutinaNombre: s.rutinaNombre, items });
  }
  state.active = null;
  state.rest = null;
  save();
  updateRestBar();
  toast(items.length ? "¡Entrenamiento guardado! 💪" : "Entrenamiento terminado");
  go(items.length ? "historial" : "entrenar");
  if (items.length && state.drive.auto && state.drive.connected && driveConfigured()) backupToDrive();
}

/* Temporizador de descanso */
let audioCtx;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(t => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.2, audioCtx.currentTime + t);
      o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.15);
    });
  } catch (e) { /* audio no disponible */ }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

function startRest(sec) {
  if (!sec) return;
  state.rest = { endsAt: Date.now() + sec * 1000 };
  save();
  updateRestBar();
}

function updateRestBar() {
  const bar = $("#restBar");
  if (!state.rest) { bar.hidden = true; return; }
  const left = state.rest.endsAt - Date.now();
  if (left <= 0) {
    state.rest = null; save(); bar.hidden = true; beep(); toast("¡Fin del descanso!");
    return;
  }
  bar.hidden = false;
  $("#restTime").textContent = fmtDuration(left);
}

setInterval(() => {
  updateRestBar();
  const el = document.getElementById("elapsed");
  if (el && state.active) el.textContent = fmtDuration(Date.now() - state.active.inicio);
}, 250);

/* ===================== Historial ===================== */

function sessionVolume(s) {
  return s.items.reduce((a, it) => a + it.sets.reduce((b, st) => b + setVolume(st), 0), 0);
}

function driveStatusText() {
  if (driveBusy) return driveBusy;
  if (!driveConfigured()) return "Falta configurar la conexión con Google (ver README).";
  if (!state.drive.lastBackup) return "Todavía no hiciste ningún backup.";
  const d = new Date(state.drive.lastBackup);
  return `Último backup: ${fmtDate(d)} ${d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`;
}

function renderHistory() {
  $("#topActions").innerHTML = `<button class="btn sm primary" data-action="drive-backup">☁ Backup</button>`;
  const h = state.history;
  const weekAgo = Date.now() - 7 * 864e5;
  const totalVol = h.reduce((a, s) => a + sessionVolume(s), 0);

  $("#view").innerHTML = `
    <div class="card">
      <div class="row">
        <div class="spacer">
          <h3>☁ Backup en Google Drive</h3>
          <div class="sub" id="driveStatus">${esc(driveStatusText())}</div>
        </div>
        <button class="btn primary" data-action="drive-backup" ${driveBusy ? "disabled" : ""}>Hacer backup</button>
      </div>
      <label class="row" style="margin-top:10px;font-size:14px">
        <input type="checkbox" id="driveAuto" ${state.drive.auto ? "checked" : ""}>
        Backup automático al terminar cada entrenamiento
      </label>
      <button class="btn sm" style="margin-top:10px" data-action="drive-restore" ${driveBusy ? "disabled" : ""}>Restaurar desde Drive</button>
    </div>
    <div class="stats">
      <div class="stat"><b>${h.length}</b><span>Entrenamientos</span></div>
      <div class="stat"><b>${h.filter(s => s.inicio > weekAgo).length}</b><span>Últimos 7 días</span></div>
      <div class="stat"><b>${totalVol >= 1000 ? (totalVol / 1000).toFixed(1) + "t" : Math.round(totalVol) + "kg"}</b><span>Volumen total</span></div>
    </div>
    ${h.length ? h.map(s => `
      <details class="card">
        <summary class="row">
          <div class="spacer">
            <h3>${esc(s.rutinaNombre)}</h3>
            <div class="sub">${fmtDate(s.inicio)} · ${fmtDuration(s.fin - s.inicio)} · ${s.items.length} ejercicio(s)${sessionVolume(s) ? " · " + Math.round(sessionVolume(s)) + " kg" : ""}</div>
          </div>
          <span>▾</span>
        </summary>
        <div style="margin-top:10px">
          ${s.items.map(it => `<div class="hist-ex"><b>${esc(exById(it.exId).nombre)}</b>: ${esc(it.sets.map(fmtSet).join(", "))}</div>`).join("")}
          <button class="btn sm danger" style="margin-top:10px" data-action="delete-session" data-id="${s.id}">Eliminar</button>
        </div>
      </details>`).join("")
    : `<div class="empty"><span class="big">📈</span>Todavía no hay entrenamientos guardados.</div>`}`;

  $("#driveAuto").addEventListener("change", e => { state.drive.auto = e.target.checked; save(); });
}

/* ===================== Backup en Google Drive ===================== */

// El scope drive.file solo da acceso a los archivos que crea esta app, nada más de tu Drive.
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_FILE = "Centro de Entrenamiento - backup.json";
let driveToken = null;   // { value, exp }
let tokenClient = null;
let driveBusy = "";      // texto de estado mientras hay una operación en curso

function driveConfigured() {
  return !!(window.APP_CONFIG && window.APP_CONFIG.googleClientId);
}

// Se llama directo desde un toque del usuario para que Google pueda abrir su ventana de permiso.
function getDriveToken() {
  if (driveToken && Date.now() < driveToken.exp) return Promise.resolve(driveToken.value);
  return new Promise((resolve, reject) => {
    if (!(window.google && google.accounts && google.accounts.oauth2)) {
      return reject(new Error("No se pudo cargar Google. Revisá la conexión."));
    }
    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: window.APP_CONFIG.googleClientId,
        scope: DRIVE_SCOPE,
        callback: () => {},
      });
    }
    tokenClient.callback = resp => {
      if (resp.error) return reject(new Error("Google rechazó el permiso"));
      driveToken = { value: resp.access_token, exp: Date.now() + (resp.expires_in - 60) * 1000 };
      resolve(driveToken.value);
    };
    tokenClient.error_callback = err =>
      reject(new Error(err && err.type === "popup_closed" ? "Se cerró la ventana de Google" : "No se pudo conectar con Google"));
    tokenClient.requestAccessToken({ prompt: state.drive.connected ? "" : "consent" });
  });
}

async function driveFetch(url, opts = {}) {
  const token = await getDriveToken();
  const res = await fetch(url, Object.assign({}, opts, {
    headers: Object.assign({ Authorization: "Bearer " + token }, opts.headers),
  }));
  if (res.status === 401) {
    driveToken = null;
    throw new Error("La sesión de Google venció, tocá de nuevo");
  }
  return res;
}

async function findBackupFileId() {
  const q = encodeURIComponent(`name='${DRIVE_FILE}' and trashed=false`);
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&orderBy=modifiedTime desc&fields=files(id)`);
  if (!res.ok) throw new Error("Drive respondió " + res.status);
  const files = (await res.json()).files;
  return files.length ? files[0].id : null;
}

function backupPayload() {
  const copy = Object.assign({}, state, { active: null, rest: null });
  delete copy.drive;
  return JSON.stringify({ app: "centro-entrenamiento", version: 1, fecha: new Date().toISOString(), state: copy });
}

function setDriveBusy(text) {
  driveBusy = text;
  if (ui.tab === "historial") render();
}

async function backupToDrive() {
  if (!driveConfigured()) return toast("Falta configurar la conexión con Google (ver README)");
  if (driveBusy) return;
  const tokenReady = getDriveToken(); // pedir permiso ya, dentro del toque
  setDriveBusy("Guardando en Drive…");
  try {
    await tokenReady;
    state.drive.connected = true;
    const body = backupPayload();
    const id = state.drive.fileId || await findBackupFileId();
    let res = id && await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media&fields=id`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body,
    });
    if (!res || res.status === 404) {
      const b = "ce" + uid();
      const meta = JSON.stringify({ name: DRIVE_FILE, mimeType: "application/json" });
      res = await driveFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${b}` },
        body: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
              `--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`,
      });
    }
    if (!res.ok) throw new Error("Drive respondió " + res.status);
    state.drive.fileId = (await res.json()).id;
    state.drive.lastBackup = Date.now();
    save();
    toast("Backup guardado en Drive ✓");
  } catch (e) {
    toast(e.message);
  } finally {
    setDriveBusy("");
  }
}

async function restoreFromDrive() {
  if (!driveConfigured()) return toast("Falta configurar la conexión con Google (ver README)");
  if (driveBusy) return;
  const tokenReady = getDriveToken();
  setDriveBusy("Buscando backup en Drive…");
  try {
    await tokenReady;
    state.drive.connected = true;
    const id = await findBackupFileId();
    if (!id) throw new Error("No hay ningún backup en tu Drive todavía");
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
    if (!res.ok) throw new Error("Drive respondió " + res.status);
    const parsed = await res.json();
    if (!parsed.state) throw new Error("El backup de Drive no tiene un formato válido");
    const when = parsed.fecha ? new Date(parsed.fecha).toLocaleString("es") : "fecha desconocida";
    if (!confirm(`Backup del ${when} (${(parsed.state.history || []).length} entrenamientos).\n` +
                 "Esto reemplaza los datos de este celular. ¿Continuar?")) return;
    const drive = Object.assign({}, state.drive, { fileId: id });
    state = Object.assign(defaultState(), parsed.state, { drive });
    save(); reindex();
    toast("Datos restaurados desde Drive ✓");
  } catch (e) {
    toast(e.message);
  } finally {
    setDriveBusy("");
  }
}

/* ===================== Modal ===================== */

function openModal(html) {
  $("#modalBody").innerHTML = html;
  const d = $("#modal");
  if (!d.open) d.showModal();
}
function closeModal() {
  $("#modal").close();
}
$("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
$("#modal").addEventListener("close", () => { if (ui.tab !== "ejercicios") render(); });

/* ===================== Acciones ===================== */

const actions = {
  "cat": el => { ui.cat = el.dataset.cat; renderExercises(); },
  "only-favs": () => { ui.onlyFavs = !ui.onlyFavs; renderExercises(); },
  "open-exercise": el => openExercise(el.dataset.id),
  "toggle-fav": el => {
    const id = el.dataset.id, i = state.favs.indexOf(id);
    i >= 0 ? state.favs.splice(i, 1) : state.favs.push(id);
    save();
    if (el.dataset.refresh === "modal") openExercise(id);
    if (ui.tab === "ejercicios") renderExerciseList();
  },
  "new-exercise": newExercise,
  "save-exercise": saveExercise,
  "delete-exercise": el => {
    if (!confirm("¿Eliminar este ejercicio?")) return;
    state.custom = state.custom.filter(c => c.id !== el.dataset.id);
    save(); reindex(); closeModal(); renderExercises();
  },
  "close-modal": closeModal,

  "new-routine": newRoutine,
  "edit-routine": el => { ui.editing = el.dataset.id; render(); },
  "done-routine": () => { ui.editing = null; render(); },
  "dup-routine": el => {
    const r = state.routines.find(r => r.id === el.dataset.id);
    state.routines.push({ id: uid(), nombre: r.nombre + " (copia)", items: r.items.map(i => ({ ...i })) });
    save(); render();
  },
  "delete-routine": el => {
    if (!confirm("¿Eliminar esta rutina?")) return;
    state.routines = state.routines.filter(r => r.id !== el.dataset.id);
    save(); render();
  },
  "move-item": el => {
    const r = state.routines.find(r => r.id === ui.editing);
    const i = +el.dataset.index, j = i + +el.dataset.dir;
    [r.items[i], r.items[j]] = [r.items[j], r.items[i]];
    save(); render();
  },
  "remove-item": el => {
    const r = state.routines.find(r => r.id === ui.editing);
    r.items.splice(+el.dataset.index, 1);
    save(); render();
  },
  "pick-for-routine": () => {
    const r = state.routines.find(r => r.id === ui.editing);
    openPicker("Agregar a la rutina", id => { r.items.push(newRoutineItem(id)); save(); });
  },
  "start-routine": el => startSession(state.routines.find(r => r.id === el.dataset.id)),

  "start-free": () => startSession(null),
  "pick-for-session": () => openPicker("Agregar al entrenamiento", id => addToSession(id)),
  "add-to-session": el => { addToSession(el.dataset.id); toast("Agregado al entrenamiento"); },
  "toggle-set": el => {
    const it = state.active.items[+el.dataset.i], st = it.sets[+el.dataset.j];
    st.hecho = !st.hecho;
    save();
    if (st.hecho) startRest(it.descanso);
    renderTrain();
  },
  "add-set": el => {
    const it = state.active.items[+el.dataset.i], last = it.sets[it.sets.length - 1];
    it.sets.push({ reps: last ? last.reps : "", peso: last ? last.peso : "", hecho: false });
    save(); renderTrain();
  },
  "remove-set": el => { state.active.items[+el.dataset.i].sets.pop(); save(); renderTrain(); },
  "remove-session-item": el => {
    if (!confirm("¿Quitar este ejercicio del entrenamiento?")) return;
    state.active.items.splice(+el.dataset.index, 1); save(); renderTrain();
  },
  "finish-session": finishSession,
  "discard-session": () => {
    if (!confirm("¿Descartar el entrenamiento en curso? Se pierden los datos.")) return;
    state.active = null; state.rest = null; save(); updateRestBar(); render();
  },
  "rest-add": el => {
    if (!state.rest) return;
    state.rest.endsAt += +el.dataset.sec * 1000;
    save(); updateRestBar();
  },
  "rest-skip": () => { state.rest = null; save(); updateRestBar(); },

  "delete-session": el => {
    if (!confirm("¿Eliminar este entrenamiento del historial?")) return;
    state.history = state.history.filter(s => s.id !== el.dataset.id);
    save(); render();
  },
  "drive-backup": backupToDrive,
  "drive-restore": restoreFromDrive,
};

document.addEventListener("click", e => {
  const tab = e.target.closest(".tabs button");
  if (tab) return go(tab.dataset.tab);
  const el = e.target.closest("[data-action]");
  if (el && actions[el.dataset.action]) {
    e.preventDefault();
    actions[el.dataset.action](el);
  }
});

/* ===================== Inicio ===================== */

if (state.active) ui.tab = "entrenar";
go(ui.tab);
updateRestBar();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
