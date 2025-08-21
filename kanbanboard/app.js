/* Kanzu — Kanban (Zoom + Multi-boards + GitHub OAuth Gists)
 * - Click "Sign in with GitHub" (OAuth). No manual tokens.
 * - Tiny serverless endpoint exchanges ?code for an access token.
 * - Same gist sync features as before.
 */

/////////////////////// Utilities ///////////////////////
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const daysBetween = (a, b) => Math.round((b - a) / (1000*60*60*24));
const parseDate = (v) => v ? new Date(v + "T00:00:00") : null;

const toast = (() => { let t=null; return (msg, ms=1800) => {
  const el = $("#toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(t); t = setTimeout(() => el.classList.remove("show"), ms);
};})();

const saveBlobJSONDownload = (name, dataObj) => {
  const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = name.endsWith(".json") ? name : `${name}.json`;
  document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove();
};
const sleep = (ms) => new Promise(r=>setTimeout(r,ms));
const slugify = (s)=> (s||"kanban").toLowerCase().replace(/[^\w\-]+/g,"-");
const escapeHTML = (s)=> (s||"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/////////////////////// Keys & State ///////////////////////
const INDEX_KEY  = "kanzu.index.v1";
const BOARD_PREFIX = "kanzu.board.";
const UNDO_KEY   = "kanzu.undo";
const THEME_KEY  = "kanzu.theme";
const GIST_TOKEN_KEY = "kanzu.github.oauth.token";
const OAUTH_STATE_KEY = "kanzu.github.oauth.state";

let boardsIndex = [];
let board = null; let currentBoardId = null;
let autoGitTimer = null;

// GitHub API state
let githubToken = null;
let githubUser = null;
let gistBoardsCache = [];

/////////////////////// Board Model ///////////////////////
function defaultBoard(){
  return {
    version: 2,
    id: uid(),
    title: "My Kanban",
    settings: { theme: (localStorage.getItem(THEME_KEY)||"dark"), zoom: 1.0 },
    meta: { gistId: null, gistFile: null, githubSync: false, lastSync: 0 },
    columns: [
      { id: uid(), name: "Todo", order: 0, cards: [
        { id: uid(), title: "Click me to edit ✨", desc: "You can change color, add due date, and drag me around.", color: "#ffd166", due: null, created: Date.now(), updated: Date.now() }
      ]},
      { id: uid(), name: "Doing", order: 1, cards: [] },
      { id: uid(), name: "Done", order: 2, cards: [] },
    ]
  };
}

/////////////////////// Index & Local Save ///////////////////////
function loadIndex(){ try { boardsIndex = JSON.parse(localStorage.getItem(INDEX_KEY)) || []; } catch { boardsIndex = []; } }
function saveIndex(){ localStorage.setItem(INDEX_KEY, JSON.stringify(boardsIndex)); }
function saveBoardLocal(b){
  localStorage.setItem(BOARD_PREFIX + b.id, JSON.stringify(b));
  const i = boardsIndex.findIndex(x => x.id === b.id);
  const meta = { id: b.id, title: b.title, updated: Date.now(),
    source: b.meta?.gistId ? "github" : "local",
    gistId: b.meta?.gistId || null, gistFile: b.meta?.gistFile || null
  };
  if (i >= 0) boardsIndex[i] = { ...boardsIndex[i], ...meta }; else boardsIndex.push(meta);
  saveIndex();
}
function loadBoardLocal(id){ const raw = localStorage.getItem(BOARD_PREFIX + id); if (!raw) return null; try { return JSON.parse(raw); } catch { return null; } }

function migrateFromSingleBoardIfNeeded(){
  const legacy = localStorage.getItem("kanzu.board.v1");
  if (!legacy) return;
  try {
    const old = JSON.parse(legacy);
    const nb = defaultBoard();
    nb.columns = old.columns || nb.columns;
    nb.title = (localStorage.getItem("kanzu.title") || "My Kanban");
    nb.settings.theme = (localStorage.getItem(THEME_KEY) || "dark");
    saveBoardLocal(nb);
    localStorage.removeItem("kanzu.board.v1"); localStorage.removeItem("kanzu.title");
    toast("Migrated your old board ✅");
  } catch {}
}

/////////////////////// Rendering ///////////////////////
const boardEl = $("#board");
const colTpl = $("#column-template");
const cardTpl = $("#card-template");

function applyTheme(theme){ document.body.dataset.theme = theme || "dark"; localStorage.setItem(THEME_KEY, document.body.dataset.theme); }
function applyZoom(z){
  z = clamp(z, 0.6, 1.5);
  document.documentElement.style.setProperty("--zoom", z);
  const pct = Math.round(z*100); $("#zoom-range").value = pct; $("#zoom-label").textContent = `${pct}%`;
}
function bindTitle(){
  const h1 = $("#board-title");
  h1.textContent = board.title || "My Kanban";
  h1.addEventListener("input", () => {
    board.title = h1.textContent.trim() || "My Kanban";
    saveBoardLocal(board); scheduleGitSync("title");
  });
}
function renumberColumnOrders(){ board.columns.forEach((c,i)=>c.order=i); }

function render(){
  board.columns.sort((a,b)=>a.order-b.order);
  saveBoardLocal(board);
  bindTitle(); applyTheme(board.settings?.theme || "dark"); applyZoom(board.settings?.zoom ?? 1);
  boardEl.innerHTML = "";
  for (const col of board.columns){
    const node = colTpl.content.firstElementChild.cloneNode(true);
    node.dataset.columnId = col.id;

    const titleEl = $(".column-title", node);
    titleEl.textContent = col.name;
    titleEl.addEventListener("blur", () => {
      col.name = titleEl.textContent.trim() || "Untitled";
      saveBoardLocal(board); scheduleGitSync("rename column"); toast("Column renamed");
    });

    const cardsEl = $(".cards", node);
    const menuBtn = $(".column-menu-btn", node);
    const menu = $(".column-menu", node);
    menuBtn.addEventListener("click", (e)=>{ e.stopPropagation(); menu.hidden = !menu.hidden; });
    document.addEventListener("click", ()=> menu.hidden = true);
    $(".rename-col", menu).addEventListener("click", ()=>{ titleEl.focus(); menu.hidden=true; });
    $(".delete-col", menu).addEventListener("click", ()=>{
      if (board.columns.length <= 1){ toast("You need at least one column"); return; }
      pushUndo({ type: "delete-column", payload: structuredClone(col) });
      board.columns = board.columns.filter(c=>c.id!==col.id); renumberColumnOrders(); render(); scheduleGitSync("delete column"); toast("Column deleted — Undo available");
    });

    const newCard = ()=> openCardModal({ columnId: col.id });
    $(".add-card-btn", node).addEventListener("click", newCard);
    $(".add-card-cta", node).addEventListener("click", newCard);

    for (const c of col.cards) cardsEl.appendChild(renderCard(col, c));

    enableColumnDrag(node); enableCardDrop(cardsEl, col.id);
    boardEl.appendChild(node);
  }
  applyFilter($("#search").value.trim());
}

function renderCard(col, card){
  const node = cardTpl.content.firstElementChild.cloneNode(true);
  node.dataset.cardId = card.id;
  $(".color-strip", node).style.background = card.color || "var(--accent)";
  $(".card-title", node).textContent = card.title;

  const descEl = $(".card-desc", node);
  descEl.textContent = (card.desc||"").trim();
  descEl.style.display = descEl.textContent ? "" : "none";

  const dueEl = $(".due", node);
  const due = parseDate(card.due);
  if (due){
    const today = new Date(); today.setHours(0,0,0,0);
    const diff = daysBetween(today, due);
    let cls="future", label=`Due in ${diff} day${Math.abs(diff)===1?"":"s"}`;
    if (diff < 0){ cls="overdue"; label=`${Math.abs(diff)} day${Math.abs(diff)===1?"":"s"} late`; }
    else if (diff <= 3){ cls="soon"; label=`Due in ${diff} day${diff===1?"":"s"}`; }
    dueEl.textContent = label + ` • ${due.toISOString().slice(0,10)}`; dueEl.classList.add(cls);
  } else dueEl.textContent = "No due date";

  const open = ()=> openCardModal({ columnId: col.id, cardId: card.id });
  $(".edit-btn", node).addEventListener("click", open);
  node.addEventListener("dblclick", open);

  enableCardDrag(node);
  return node;
}

/////////////////////// Card/Column Ops ///////////////////////
function addColumn(name="New Column"){
  const next = board.columns.length ? Math.max(...board.columns.map(c=>c.order))+1 : 0;
  board.columns.push({ id: uid(), name, order: next, cards: [] });
  render(); scheduleGitSync("add column"); toast("Column added");
}
function addCard(columnId, data){
  const col = board.columns.find(c=>c.id===columnId); if (!col) return;
  const nc = { id: uid(), title:(data.title||"Untitled").trim(), desc:(data.desc||"").trim(), color:data.color||"#6aa5ff", due:data.due||null, created:Date.now(), updated:Date.now() };
  col.cards.unshift(nc); saveBoardLocal(board); render(); scheduleGitSync("add card"); toast("Card added"); return nc.id;
}
function updateCard(columnId, cardId, patch){
  const col = board.columns.find(c=>c.id===columnId); const card = col?.cards.find(x=>x.id===cardId); if (!card) return;
  Object.assign(card, patch); card.updated = Date.now();
  saveBoardLocal(board); render(); scheduleGitSync("update card"); toast("Card updated");
}
function deleteCard(columnId, cardId){
  const col = board.columns.find(c=>c.id===columnId); if (!col) return;
  const idx = col.cards.findIndex(c=>c.id===cardId); if (idx===-1) return;
  const [removed] = col.cards.splice(idx,1);
  pushUndo({ type:"delete-card", payload:{ columnId, card: removed } });
  saveBoardLocal(board); render(); scheduleGitSync("delete card"); toast("Card deleted — Undo available");
}

/////////////////////// Drag ///////////////////////
function enableColumnDrag(colEl){
  colEl.addEventListener("dragstart", (e)=>{ if (e.target!==colEl) return; e.dataTransfer.setData("text/column-id", colEl.dataset.columnId); colEl.setAttribute("aria-grabbed","true"); });
  colEl.addEventListener("dragend", ()=> colEl.removeAttribute("aria-grabbed"));
  colEl.addEventListener("dragover", (e)=>{ e.preventDefault(); const id=e.dataTransfer.getData("text/column-id"); if (id) colEl.classList.add("drag-over"); });
  colEl.addEventListener("dragleave", ()=> colEl.classList.remove("drag-over"));
  colEl.addEventListener("drop", (e)=>{
    e.preventDefault(); colEl.classList.remove("drag-over");
    const draggingId = e.dataTransfer.getData("text/column-id");
    if (!draggingId || draggingId===colEl.dataset.columnId) return;
    const from = board.columns.findIndex(c=>c.id===draggingId);
    const to = board.columns.findIndex(c=>c.id===colEl.dataset.columnId);
    if (from<0||to<0) return;
    const [moved] = board.columns.splice(from,1); board.columns.splice(to,0,moved);
    renumberColumnOrders(); render(); scheduleGitSync("reorder columns"); toast("Column reordered");
  });
}
function enableCardDrag(cardEl){
  cardEl.addEventListener("dragstart", (e)=>{ cardEl.classList.add("dragging"); e.dataTransfer.effectAllowed="move";
    e.dataTransfer.setData("text/card-id", cardEl.dataset.cardId);
    e.dataTransfer.setData("text/src-col-id", cardEl.closest(".column").dataset.columnId);
  });
  cardEl.addEventListener("dragend", ()=> cardEl.classList.remove("dragging"));
}
function enableCardDrop(cardsEl, toColumnId){
  cardsEl.addEventListener("dragover", (e)=>{
    if (!e.dataTransfer) return;
    const hasCard = e.dataTransfer.types.includes("text/card-id");
    const hasColumn = e.dataTransfer.types.includes("text/column-id");
    if (!hasCard && !hasColumn) return;
    e.preventDefault();
    if (hasCard){
      const after = getCardAfter(cardsEl, e.clientY);
      const dragging = $(".card.dragging");
      if (!dragging) return;
      if (after==null) cardsEl.appendChild(dragging); else cardsEl.insertBefore(dragging, after);
    }
  });
  cardsEl.addEventListener("drop", (e)=>{
    e.preventDefault();
    const cardId = e.dataTransfer.getData("text/card-id");
    const srcColId = e.dataTransfer.getData("text/src-col-id");
    if (!cardId || !srcColId) return;

    if (srcColId === toColumnId){
      const col = board.columns.find(c=>c.id===toColumnId);
      const domIds = $$(".card", cardsEl).map(n=>n.dataset.cardId);
      col.cards.sort((a,b)=>domIds.indexOf(a.id)-domIds.indexOf(b.id));
      saveBoardLocal(board); scheduleGitSync("reorder cards"); toast("Card reordered"); return;
    }
    const srcCol = board.columns.find(c=>c.id===srcColId);
    const dstCol = board.columns.find(c=>c.id===toColumnId);
    const idx = srcCol?.cards.findIndex(c=>c.id===cardId) ?? -1;
    if (!srcCol || !dstCol || idx===-1) return;
    const [moved] = srcCol.cards.splice(idx,1);
    dstCol.cards.unshift(moved);
    saveBoardLocal(board); render(); scheduleGitSync("move card"); toast("Card moved");
  });
}
function getCardAfter(container, y){
  const els = [...container.querySelectorAll(".card:not(.dragging)")];
  return els.reduce((closest, child)=>{
    const box = child.getBoundingClientRect(); const offset = y - (box.top + box.height/2);
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

/////////////////////// Modal Editor ///////////////////////
const modal = $("#card-modal");
const fields = { id: $("#card-id"), columnId: $("#card-column-id"), title: $("#card-title"), desc: $("#card-desc"), color: $("#card-color"), due: $("#card-due") };
function openCardModal({ columnId, cardId }){
  const isNew = !cardId; $("#modal-title").textContent = isNew ? "Add Card" : "Edit Card";
  $("#delete-card").style.display = isNew ? "none" : "";
  fields.columnId.value = columnId; fields.id.value = cardId || "";
  if (isNew){ fields.title.value=""; fields.desc.value=""; fields.color.value="#ffd166"; fields.due.value=""; }
  else {
    const col = board.columns.find(c=>c.id===columnId); const card = col.cards.find(c=>c.id===cardId);
    fields.title.value = card.title; fields.desc.value = card.desc || ""; fields.color.value = /^#[0-9a-f]{6}$/i.test(card.color) ? card.color : "#6aa5ff"; fields.due.value = card.due || "";
  }
  modal.showModal(); fields.title.focus();
}
$("#close-modal").addEventListener("click", ()=> modal.close());
$("#cancel-card").addEventListener("click", ()=> modal.close());
$("#save-card").addEventListener("click", (e)=>{
  e.preventDefault();
  if (!fields.title.value.trim()){ toast("Title is required"); fields.title.focus(); return; }
  const patch = { title: fields.title.value.trim(), desc: fields.desc.value.trim(), color: fields.color.value, due: fields.due.value || null };
  const id = fields.id.value, colId = fields.columnId.value;
  if (!id) addCard(colId, patch); else updateCard(colId, id, patch);
  modal.close();
});
$("#delete-card").addEventListener("click", ()=>{
  const id = fields.id.value, colId = fields.columnId.value; if (!id) return;
  deleteCard(colId, id); modal.close();
});

/////////////////////// Search / Filter ///////////////////////
function applyFilter(query){
  const q = (query||"").toLowerCase();
  for (const card of $$(".card", boardEl)){
    const title = $(".card-title", card)?.textContent.toLowerCase() || "";
    const desc = $(".card-desc", card)?.textContent.toLowerCase() || "";
    const due = $(".due", card)?.textContent.toLowerCase() || "";
    const hit = !q || title.includes(q) || desc.includes(q) || due.includes(q);
    card.style.display = hit ? "" : "none";
  }
}
$("#search").addEventListener("input", (e)=> applyFilter(e.target.value));
window.addEventListener("keydown", (e)=>{ if (e.key === "/" && document.activeElement !== $("#search") && !["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)){ e.preventDefault(); $("#search").focus(); }});
window.addEventListener("keydown", (e)=>{ if (e.key.toLowerCase()==="n" && !modal.open){ const first = board?.columns?.[0]?.id; if (first) openCardModal({ columnId: first }); }});

/////////////////////// Undo ///////////////////////
function pushUndo(entry){ localStorage.setItem(UNDO_KEY, JSON.stringify({ ts: Date.now(), entry })); }
function popUndo(){ const raw = localStorage.getItem(UNDO_KEY); if (!raw) return null; localStorage.removeItem(UNDO_KEY); try{ return JSON.parse(raw).entry; }catch{ return null; } }
window.addEventListener("keydown", (e)=>{
  if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="z"){
    const u = popUndo(); if (!u) return;
    if (u.type === "delete-card"){
      const { columnId, card } = u.payload; const col = board.columns.find(c=>c.id===columnId);
      if (col){ col.cards.unshift(card); render(); scheduleGitSync("undo card"); toast("Undo: card restored"); }
    } else if (u.type === "delete-column"){
      board.columns.push(u.payload); renumberColumnOrders(); render(); scheduleGitSync("undo column"); toast("Undo: column restored");
    }
  }
});

/////////////////////// Boards Modal ///////////////////////
const boardsModal = $("#boards-modal");
const localList = $("#local-list");
const githubList = $("#github-list");

$("#boards-btn").addEventListener("click", ()=>{ refreshBoardsLists(); boardsModal.showModal(); });
$("#close-boards").addEventListener("click", ()=> boardsModal.close());
$("#open-selected").addEventListener("click", openSelectedBoard);
$("#new-board").addEventListener("click", ()=>{ const b=defaultBoard(); saveBoardLocal(b); loadBoardById(b.id); boardsModal.close(); toast("New board created"); });
$("#dup-board").addEventListener("click", ()=>{
  const nb = structuredClone(board); nb.id=uid(); nb.title = board.title + " (Copy)";
  nb.meta.gistId=null; nb.meta.gistFile=null; nb.meta.githubSync=false;
  saveBoardLocal(nb); loadBoardById(nb.id); boardsModal.close(); toast("Duplicated board");
});
$("#del-board").addEventListener("click", ()=>{
  if (!confirm("Delete current board from local storage? (Gist, if any, remains)")) return;
  localStorage.removeItem(BOARD_PREFIX + board.id);
  boardsIndex = boardsIndex.filter(x=>x.id!==board.id); saveIndex();
  if (boardsIndex.length) loadBoardById(boardsIndex[0].id);
  else { const b=defaultBoard(); saveBoardLocal(b); loadBoardById(b.id); }
  boardsModal.close(); toast("Board deleted locally");
});

function refreshBoardsLists(){
  localList.innerHTML = boardsIndex.map(m=> `<li><label><input type="radio" name="pickBoard" value="${m.id}" ${m.id===currentBoardId?'checked':''}/> ${escapeHTML(m.title)}</label><span class="meta">${new Date(m.updated||Date.now()).toLocaleString()}</span></li>`).join("")
    || `<li class="muted">No local boards yet.</li>`;

  githubList.innerHTML = githubToken ? "" : `<li class="muted">Sign in to list Gists.</li>`;
  if (!githubToken) return;
  if (!gistBoardsCache.length) githubList.innerHTML = `<li class="muted">No matching Gists found.</li>`;
  gistBoardsCache.forEach(g=>{
    const id = `gist-${g.id}::${g.filename}`;
    const li = document.createElement("li");
    li.innerHTML = `<label><input type="radio" name="pickBoard" value="${id}"/> ${escapeHTML(g.filename)}</label><span class="meta">${new Date(g.updated_at).toLocaleString()}</span>`;
    githubList.appendChild(li);
  });
}
function openSelectedBoard(){
  const sel = document.querySelector('input[name="pickBoard"]:checked'); if (!sel){ toast("Pick a board first"); return; }
  const val = sel.value;
  if (val.startsWith("gist-")){ const [_, rest] = val.split("gist-"); const [id, filename] = rest.split("::"); openGistBoard(id, filename); }
  else { loadBoardById(val); }
  boardsModal.close();
}

/////////////////////// Import / Export ///////////////////////
$("#export-btn").addEventListener("click", ()=>{ saveBlobJSONDownload(`${slugify(board.title)}.kanban.json`, board); toast("Exported!"); });
$("#import-file").addEventListener("change", async (e)=>{
  const file = e.target.files?.[0]; if (!file) return;
  try{
    const text = await file.text(); const data = JSON.parse(text);
    if (!data?.columns || !Array.isArray(data.columns)) throw new Error("Invalid file");
    if (confirm("Import file as a NEW board? (Cancel = merge into current)")){
      const nb = { ...data, id: uid(), settings: (data.settings||{ theme: document.body.dataset.theme, zoom: 1 }) };
      saveBoardLocal(nb); loadBoardById(nb.id); toast("Imported as new board");
    } else { mergeBoardsIntoCurrent(data); toast("Merged into current board"); }
  } catch { toast("Failed to import: invalid JSON"); } finally { e.target.value=""; }
});
function mergeBoardsIntoCurrent(other){
  for (const inc of other.columns || []){
    const existing = board.columns.find(c=>c.name===inc.name);
    if (existing){
      const sig = c => `${(c.title||"").trim()}|${c.due||""}`; const have = new Set(existing.cards.map(sig));
      for (const card of inc.cards||[]){ if (!have.has(sig(card))) existing.cards.push({ ...card, id: uid() }); }
    } else {
      board.columns.push({ ...inc, id: uid(), cards: (inc.cards||[]).map(c=>({...c, id: uid()})) });
    }
  }
  renumberColumnOrders(); saveBoardLocal(board); render(); scheduleGitSync("merge import");
}

/////////////////////// Theme + Zoom ///////////////////////
$("#theme-toggle").addEventListener("click", ()=>{
  if (!board){ applyTheme(document.body.dataset.theme==="light"?"dark":"light"); return; }
  board.settings.theme = document.body.dataset.theme==="light"?"dark":"light";
  applyTheme(board.settings.theme); saveBoardLocal(board); scheduleGitSync("theme");
});
const zoomRange = $("#zoom-range");
$("#zoom-out").addEventListener("click", ()=> setZoomPct(+zoomRange.value - 5));
$("#zoom-in").addEventListener("click", ()=> setZoomPct(+zoomRange.value + 5));
zoomRange.addEventListener("input", (e)=> setZoomPct(+e.target.value));
function setZoomPct(pct){
  pct = clamp(pct, 60, 150);
  const z = Math.round(pct)/100; applyZoom(z);
  if (board){ board.settings.zoom = z; saveBoardLocal(board); }
}

/////////////////////// New Board ///////////////////////
$("#reset-btn").addEventListener("click", ()=>{
  if (!board) return;
  if (!confirm("Create a fresh board? This will replace the current board (export first if needed).")) return;
  const fresh = defaultBoard(); fresh.id = board.id;
  fresh.meta.gistId = board.meta.gistId; fresh.meta.gistFile = board.meta.gistFile; fresh.meta.githubSync = board.meta.githubSync;
  board = fresh; saveBoardLocal(board); render(); scheduleGitSync("reset"); toast("New board created");
});

/////////////////////// GitHub (OAuth + Gists) ///////////////////////
const GH_API = "https://api.github.com";

function setGithubStatus(text){ $("#github-status").textContent = text; $("#modal-github-status").textContent = text; }
function loadGithubToken(){ githubToken = localStorage.getItem(GIST_TOKEN_KEY) || null; setGithubStatus(githubToken ? "GitHub: Signed in" : "GitHub: Signed out"); }
function saveGithubToken(t){ if (t) localStorage.setItem(GIST_TOKEN_KEY, t); else localStorage.removeItem(GIST_TOKEN_KEY); loadGithubToken(); }

function beginGithubLogin(){
  const { GITHUB_CLIENT_ID, SCOPE } = window.KANZU_OAUTH || {};
  if (!GITHUB_CLIENT_ID){ alert("Missing GITHUB_CLIENT_ID in index.html"); return; }
  const state = Math.random().toString(36).slice(2);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  const redirectUri = window.location.origin + window.location.pathname; // return to this page
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", SCOPE || "gist");
  url.searchParams.set("state", state);
  window.location.href = url.toString();
}

async function maybeFinishGithubLogin(){
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code"); const state = params.get("state");
  if (!code) return;
  try{
    const expected = sessionStorage.getItem(OAUTH_STATE_KEY);
    if (!expected || expected !== state) throw new Error("State mismatch");
    // exchange via serverless function
    const res = await fetch((window.KANZU_OAUTH?.EXCHANGE_ENDPOINT)||"/api/github-exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri: window.location.origin + window.location.pathname })
    });
    if (!res.ok) throw new Error("Exchange failed");
    const json = await res.json();
    if (!json.access_token) throw new Error("No access token");
    saveGithubToken(json.access_token);
    // cleanup URL
    history.replaceState({}, document.title, window.location.pathname);
    // fetch user + gists
    githubUser = await ghGET("/user"); setGithubStatus(`GitHub: ${githubUser.login}`);
    gistBoardsCache = await listGistBoards();
    toast("Signed in with GitHub");
  } catch(e){
    console.warn(e);
    toast("GitHub sign-in failed");
  } finally {
    sessionStorage.removeItem(OAUTH_STATE_KEY);
  }
}

async function ghGET(path){
  if (!githubToken) throw new Error("Not signed in");
  const res = await fetch(GH_API + path, { headers: { "Authorization": `token ${githubToken}`, "Accept": "application/vnd.github+json" }});
  if (!res.ok) throw new Error(`GitHub GET ${path} failed: ${res.status}`);
  return res.json();
}
async function ghPOST(path, body){
  if (!githubToken) throw new Error("Not signed in");
  const res = await fetch(GH_API + path, {
    method: "POST",
    headers: { "Authorization": `token ${githubToken}`, "Accept": "application/vnd.github+json", "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`GitHub POST ${path} failed: ${res.status}`); return res.json();
}
async function ghPATCH(path, body){
  if (!githubToken) throw new Error("Not signed in");
  const res = await fetch(GH_API + path, {
    method: "PATCH",
    headers: { "Authorization": `token ${githubToken}`, "Accept": "application/vnd.github+json", "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`GitHub PATCH ${path} failed: ${res.status}`); return res.json();
}

async function listGistBoards(){
  if (!githubToken) return [];
  let page = 1; const out = [];
  while (page <= 3){
    const res = await fetch(`${GH_API}/gists?per_page=100&page=${page}`, { headers: { "Authorization": `token ${githubToken}`, "Accept": "application/vnd.github+json" }});
    if (!res.ok) break;
    const arr = await res.json(); if (!arr?.length) break;
    for (const g of arr){
      const files = Object.values(g.files || {});
      const f = files.find(f => f && f.filename && f.filename.endsWith(".kanban.json"));
      if (f) out.push({ id: g.id, filename: f.filename, updated_at: g.updated_at, description: g.description || "" });
    }
    page++;
  }
  gistBoardsCache = out; return out;
}

async function openGistBoard(gistId, filename){
  try{
    const g = await ghGET(`/gists/${gistId}`);
    const files = g.files || {};
    let file = files[filename] || Object.values(files).find(f => f && f.filename && f.filename.endsWith(".kanban.json"));
    if (!file?.content) throw new Error("File content missing");
    const data = JSON.parse(file.content);
    if (!data?.columns || !Array.isArray(data.columns)) throw new Error("Invalid kanban JSON");
    if (!data.id) data.id = uid();
    data.meta = data.meta || {};
    data.meta.gistId = gistId; data.meta.gistFile = file.filename; data.meta.githubSync = true;
    saveBoardLocal(data); loadBoardById(data.id); toast("Opened from GitHub Gist");
  } catch(e){ console.warn(e); toast("Failed to open Gist"); }
}

async function saveCurrentToGithub(createNew=false){
  if (!githubToken){ toast("Sign in first"); return; }
  const content = JSON.stringify(board, null, 2);
  const desiredName = `${slugify(board.title)}.kanban.json`;
  try{
    if (createNew || !board.meta?.gistId){
      const res = await ghPOST("/gists", { description: "Kanzu Kanban Board", public: false, files: { [desiredName]: { content } }});
      board.meta.gistId = res.id; board.meta.gistFile = desiredName; board.meta.githubSync = true; board.meta.lastSync = Date.now();
      saveBoardLocal(board); await listGistBoards(); toast("Saved as new Gist");
    } else {
      const files = {}; const currentName = board.meta.gistFile || desiredName;
      if (currentName !== desiredName){ files[currentName] = { filename: desiredName, content }; }
      else { files[currentName] = { content }; }
      await ghPATCH(`/gists/${board.meta.gistId}`, { files });
      board.meta.gistFile = desiredName; board.meta.githubSync = true; board.meta.lastSync = Date.now();
      saveBoardLocal(board); await listGistBoards(); toast("Saved to GitHub");
    }
  } catch(e){ console.warn(e); toast("GitHub save failed"); }
}

function scheduleGitSync(){ if (!board?.meta?.githubSync && !board?.meta?.gistId) return; if (scheduleGitSync._t) clearTimeout(scheduleGitSync._t); scheduleGitSync._t = setTimeout(()=> saveCurrentToGithub(false), 1200); }
$("#connect-github").addEventListener("click", beginGithubLogin);
$("#save-github").addEventListener("click", ()=>{ if (board) saveCurrentToGithub(!board.meta?.gistId); });
$("#save-as-github").addEventListener("click", ()=>{ if (board) saveCurrentToGithub(true); });
$("#refresh-github").addEventListener("click", async ()=>{ await listGistBoards(); if ($("#boards-modal").open) refreshBoardsLists(); toast("GitHub refreshed"); });

/////////////////////// Load / Boot ///////////////////////
function loadBoardById(id){ const b = loadBoardLocal(id); if (!b){ toast("Board not found"); return; } currentBoardId = id; board = b; render(); }

function autoPullGithubPeriodically(){
  if (autoGitTimer) clearInterval(autoGitTimer);
  autoGitTimer = setInterval(async ()=>{
    if (!githubToken || !board?.meta?.gistId) return;
    try{
      const g = await ghGET(`/gists/${board.meta.gistId}`);
      const f = g.files?.[board.meta.gistFile] || Object.values(g.files||{}).find(x=>x.filename.endsWith(".kanban.json"));
      if (!f) return;
      const remoteUpdated = new Date(g.updated_at).getTime();
      const localUpdated = boardsIndex.find(x=>x.id===board.id)?.updated || 0;
      if (remoteUpdated > localUpdated + 1000 && f.content){
        const data = JSON.parse(f.content);
        if (data?.columns){
          data.id = board.id; data.meta = data.meta || {};
          data.meta.gistId = board.meta.gistId; data.meta.gistFile = f.filename; data.meta.githubSync = true;
          board = data; saveBoardLocal(board); render(); toast("Pulled latest from GitHub");
        }
      }
    }catch(e){ /* ignore periodic failures */ }
  }, 60000);
}

async function boot(){
  applyTheme(localStorage.getItem(THEME_KEY)||"dark");
  loadGithubToken();

  // Finish OAuth if we have ?code in URL:
  await maybeFinishGithubLogin();

  // Try resolving user + list gists if already signed in:
  if (githubToken){
    ghGET("/user").then(u=>{ githubUser=u; setGithubStatus(`GitHub: ${u.login}`); return listGistBoards(); })
                  .catch(()=>{ saveGithubToken(null); setGithubStatus("GitHub: Signed out"); });
  }

  loadIndex(); migrateFromSingleBoardIfNeeded(); loadIndex();

  if (!boardsIndex.length){ const b = defaultBoard(); saveBoardLocal(b); loadBoardById(b.id); }
  else { boardsIndex.sort((a,b)=>(b.updated||0)-(a.updated||0)); loadBoardById(boardsIndex[0].id); }

  $("#search").addEventListener("focus", ()=> $("#search").select());
  document.addEventListener("keydown", (e)=>{ if (e.key==="Escape"){ for (const m of $$(".column-menu")) m.hidden = true; if (modal.open) modal.close(); if ($("#boards-modal").open) $("#boards-modal").close(); } });

  autoPullGithubPeriodically();
}

boot();
