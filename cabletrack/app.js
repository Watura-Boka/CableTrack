const HEADERS = ["DATE","JOB NUMBER","","LOCATION","DB","SERVICE","DETAILS","Fault","By Whom","Done","Date","Status","Permit"];
const PAGE_SIZE = 30;
let supabaseClient, jobs = [], filteredJobs = [], currentPage = 1, editingId = null, toastTimer;

const $ = (id) => document.getElementById(id);
const config = window.CABLETRACK_CONFIG || {};
const configured = config.SUPABASE_URL && config.SUPABASE_ANON_KEY &&
  !config.SUPABASE_URL.includes("PASTE_") && !config.SUPABASE_ANON_KEY.includes("PASTE_");

function notify(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}
function setConnection(state, message) {
  const el = $("connection"); el.className = "connection " + state; el.innerHTML = `<i></i>${message}`;
}
function statusOf(cells) {
  const s = String(cells?.[11] ?? "").trim().toLowerCase();
  if (s === "finished" || s === "finshed") return "Finished";
  if (s === "failed") return "Failed";
  return "Pending";
}
function cleanCells(cells) {
  const out = Array.isArray(cells) ? [...cells] : [];
  while (out.length < HEADERS.length) out.push(null);
  out.length = HEADERS.length;
  if (String(out[11] ?? "").trim().toLowerCase() === "finshed") out[11] = "Finished";
  return out;
}
function dateForInput(value) {
  if (!value) return "";
  const s = String(value).trim();
  let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2})$/);
  if (m) return `20${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  if (/^\d{1,2}[\/.-]\d{1,2}[\/.-]/.test(s)) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function displayDate(value) {
  if (!value) return "";
  const d = dateForInput(value);
  if (!d) return String(value);
  const [y,m,day] = d.split("-");
  return `${day}/${m}/${y}`;
}
function dateBetween(value, from, to) {
  if (!from && !to) return true;
  const parsed = dateForInput(value);
  if (!parsed) return false;
  return (!from || parsed >= from) && (!to || parsed <= to);
}
function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function uniqueValues(index) {
  return [...new Set(jobs.map(j => String(j.cells[index] ?? "").trim()).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b));
}
function fillSelect(id, values, label) {
  const el = $(id), old = el.value;
  el.innerHTML = `<option value="">${label}</option>` + values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  if (values.includes(old)) el.value = old;
}
function countUp(id, to) {
  const el = $(id), from = parseInt(el.textContent) || 0;
  if (from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = to; return; }
  const t0 = performance.now(), dur = 700;
  (function step(t) {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}
function updateStats() {
  countUp("totalCount", jobs.length);
  countUp("finishedCount", jobs.filter(j => statusOf(j.cells) === "Finished").length);
  countUp("failedCount", jobs.filter(j => statusOf(j.cells) === "Failed").length);
  countUp("pendingCount", jobs.filter(j => statusOf(j.cells) === "Pending").length);
}
function renderFilters() {
  fillSelect("byWhomFilter", uniqueValues(8), "All By Whom");
  fillSelect("doneFilter", uniqueValues(9), "All Done");
}
function applyFilters(keepPage) {
  const q = $("searchInput").value.trim().toLowerCase();
  const status = $("statusFilter").value, by = $("byWhomFilter").value, done = $("doneFilter").value;
  const from = $("fromDate").value, to = $("toDate").value;
  filteredJobs = jobs.filter(job => {
    const c = job.cells;
    const matchesText = !q || c.some(v => String(v ?? "").toLowerCase().includes(q));
    const matchesStatus = !status || statusOf(c) === status;
    const matchesBy = !by || String(c[8] ?? "").trim() === by;
    const matchesDone = !done || String(c[9] ?? "").trim() === done;
    return matchesText && matchesStatus && matchesBy && matchesDone && dateBetween(c[0], from, to);
  });
  const pages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  currentPage = keepPage === true ? Math.min(currentPage, pages) : 1;
  renderTable();
}
function renderTable() {
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredJobs.slice(start, start + PAGE_SIZE);
  $("tableHead").innerHTML = HEADERS.map((h,i) => `<th>${escapeHtml(h || " ")}</th>`).join("") + "<th> </th>";
  if (!pageRows.length) {
    $("jobsBody").innerHTML = `<tr><td colspan="${HEADERS.length+1}" class="empty-cell">No matching jobs found. Try changing your search or filters.</td></tr>`;
  } else {
    $("jobsBody").innerHTML = pageRows.map((job, n) => {
      const cells = cleanCells(job.cells);
      const values = cells.map((v,i) => {
        if (i === 11) {
          const s = statusOf(cells), cls = s.toLowerCase();
          return `<td data-i="${i}" data-label="${escapeHtml(HEADERS[i])}"><span class="status-pill status-${cls}">${s}</span></td>`;
        }
        return `<td data-i="${i}" data-label="${escapeHtml(HEADERS[i])}" title="${escapeHtml(v ?? "")}">${escapeHtml(i === 0 || i === 10 ? displayDate(v) : (v ?? ""))}</td>`;
      }).join("");
      return `<tr data-id="${escapeHtml(job.id)}" style="--i:${n}" tabindex="0" aria-label="Edit job">${values}<td data-i="x"><span class="edit-link">Edit →</span></td></tr>`;
    }).join("");
  }
  $("resultCount").textContent = `Showing ${filteredJobs.length ? start+1 : 0}–${Math.min(start+PAGE_SIZE,filteredJobs.length)} of ${filteredJobs.length} jobs`;
  $("pageInfo").textContent = `Page ${filteredJobs.length ? currentPage : 0} of ${Math.max(1,Math.ceil(filteredJobs.length/PAGE_SIZE))}`;
  $("prevPage").disabled = currentPage <= 1;
  $("nextPage").disabled = currentPage >= Math.ceil(filteredJobs.length/PAGE_SIZE);
}
function renderAll() {
  updateStats(); renderFilters(); applyFilters(true);
  $("setupCard").hidden = jobs.length !== 0;
}
function formField(index, cells) {
  const header = HEADERS[index] || "(blank column)";
  const val = cells[index] ?? "";
  const wide = [3,6].includes(index) ? " field-wide" : "";
  let control = "";
  if (index === 11) {
    control = `<select id="field-${index}"><option value="">(blank / Pending)</option><option value="Finished" ${String(val).toLowerCase()==="finished"?"selected":""}>Finished</option><option value="Failed" ${String(val).toLowerCase()==="failed"?"selected":""}>Failed</option></select>`;
  } else if (index === 8 || index === 9) {
    const listId = `suggest-${index}`;
    const opts = uniqueValues(index).map(v => `<option value="${escapeHtml(v)}"></option>`).join("");
    control = `<input id="field-${index}" list="${listId}" value="${escapeHtml(val)}" autocomplete="off"><datalist id="${listId}">${opts}</datalist>`;
  } else {
    const type = (index === 0 || index === 10) ? "text" : "text";
    control = `<input id="field-${index}" type="${type}" value="${escapeHtml(index===0||index===10 ? displayDate(val) : val)}" placeholder="${index===0||index===10 ? "DD/MM/YYYY" : ""}">`;
  }
  return `<div class="field${wide}" style="--n:${index}"><label for="field-${index}">${escapeHtml(header || " ")}</label>${control}</div>`;
}
function openModal(job=null) {
  editingId = job?.id ?? null;
  const cells = cleanCells(job?.cells ?? Array(HEADERS.length).fill(""));
  $("modalTitle").textContent = editingId ? "Edit Job" : "Add New Job";
  $("deleteJobBtn").hidden = !editingId;
  $("formFields").innerHTML = HEADERS.map((_,i) => formField(i,cells)).join("");
  $("jobModal").hidden = false;
  document.body.style.overflow = "hidden";
  $("field-0").focus();
}
function closeModal() { $("jobModal").hidden = true; document.body.style.overflow = ""; editingId = null; }
function readForm() {
  const cells = [];
  for (let i=0;i<HEADERS.length;i++) {
    let value = $(`field-${i}`).value.trim();
    if ((i===0 || i===10) && value) {
      const d = dateForInput(value);
      if (d) value = displayDate(d);
    }
    cells.push(value === "" ? null : value);
  }
  return cells;
}
async function saveJob(event) {
  event.preventDefault();
  const cells = readForm();
  $("saveBtn").disabled = true; $("saveBtn").textContent = "Saving…";
  try {
    if (editingId) {
      const {error} = await supabaseClient.from("jobs").update({cells}).eq("id",editingId);
      if (error) throw error;
      const item = jobs.find(j=>j.id===editingId); if(item) item.cells=cells;
      notify("Job updated successfully.");
    } else {
      const {data,error} = await supabaseClient.from("jobs").insert({cells}).select().single();
      if (error) throw error;
      jobs.unshift(data); notify("New job added successfully.");
    }
    closeModal(); renderAll();
  } catch (e) { console.error(e); notify("Could not save. Check your connection and Supabase setup."); }
  finally { $("saveBtn").disabled=false; $("saveBtn").textContent="Save Job"; }
}
async function deleteJob() {
  if (!editingId || !confirm("Delete this job permanently? This cannot be undone.")) return;
  const id=editingId;
  try {
    const {error}=await supabaseClient.from("jobs").delete().eq("id",id);
    if(error) throw error;
    jobs=jobs.filter(j=>j.id!==id); closeModal(); renderAll(); notify("Job deleted.");
  } catch(e) { console.error(e); notify("Could not delete this job."); }
}
function exportExcel(rows, filename) {
  if (!window.XLSX) { notify("Excel export library did not load. Check your internet connection."); return; }
  const data = [HEADERS, ...rows.map(j => cleanCells(j.cells).map((v,i) => (i===0||i===10) ? displayDate(v) : (v ?? "")))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [13,16,3,34,22,15,22,14,17,17,13,13,14].map(wch=>({wch}));
  ws["!autofilter"] = {ref: XLSX.utils.encode_range({s:{r:0,c:0},e:{r:data.length-1,c:HEADERS.length-1}})};
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"CABLE FAULT");
  XLSX.writeFile(wb,filename);
}
async function loadJobs() {
  if (!configured) {
    setConnection("offline","Setup required");
    $("jobsBody").innerHTML = `<tr><td colspan="14" class="empty-cell">Add your Supabase URL and anon key in config.js, then refresh this page.</td></tr>`;
    $("resultCount").textContent="Supabase is not configured";
    return;
  }
  supabaseClient = window.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_ANON_KEY);
  try {
    let data=[];
    for(let from=0;;from+=1000){
      const r=await supabaseClient.from("jobs").select("*").order("created_at",{ascending:false}).range(from,from+999);
      if(r.error) throw r.error;
      data=data.concat(r.data||[]);
      if((r.data||[]).length<1000) break;
    }
    jobs=data.map(j=>({...j,cells:cleanCells(j.cells)}));
    setConnection("online","Connected");
    renderAll();
  } catch(e) {
    console.error(e); setConnection("offline","Connection error");
    $("jobsBody").innerHTML=`<tr><td colspan="14" class="empty-cell">Could not connect. Check that the Supabase table and policies have been created, then refresh.</td></tr>`;
    notify("Database connection failed.");
  }
}
async function importStarterData() {
  if (!supabaseClient) return;
  const btn=$("importBtn"); btn.disabled=true; btn.textContent="Importing…";
  try {
    const check=await supabaseClient.from("jobs").select("id",{count:"exact",head:true});
    if(check.error) throw check.error;
    if(check.count>0) { notify("The database already contains jobs. Import cancelled to avoid duplicates."); await loadJobs(); return; }
    let response=await fetch("data/initial-data.json");
    if(!response.ok) response=await fetch("initial-data.json");
    if(!response.ok) throw new Error("Could not load initial-data.json");
    const starter=await response.json();
    for(let i=0;i<starter.rows.length;i+=50) {
      const batch=starter.rows.slice(i,i+50).map(row=>({cells:cleanCells(row)}));
      const {error}=await supabaseClient.from("jobs").insert(batch);
      if(error) throw error;
      btn.textContent=`Importing… ${Math.min(i+50,starter.rows.length)} / ${starter.rows.length}`;
    }
    notify(`${starter.rows.length} records imported successfully.`);
    await loadJobs();
  } catch(e) {
    console.error(e); notify("Import failed. Check your Supabase setup and try again.");
  } finally { btn.disabled=false; btn.textContent="Import original records"; }
}
function bindEvents() {
  $("addJobBtn").onclick=$("addJobBtn2").onclick=()=>openModal();
  $("closeModalBtn").onclick=$("cancelBtn").onclick=closeModal;
  $("jobModal").addEventListener("click",e=>{if(e.target===$("jobModal"))closeModal();});
  $("jobForm").addEventListener("submit",saveJob);
  $("deleteJobBtn").onclick=deleteJob;
  $("jobsBody").addEventListener("click",e=>{const tr=e.target.closest("tr[data-id]");if(tr){const job=jobs.find(j=>String(j.id)===tr.dataset.id);if(job)openModal(job);}});
  $("jobsBody").addEventListener("keydown",e=>{if(e.key==="Enter"){const tr=e.target.closest("tr[data-id]");if(tr){const job=jobs.find(j=>String(j.id)===tr.dataset.id);if(job)openModal(job);}}});
  ["searchInput","statusFilter","byWhomFilter","doneFilter","fromDate","toDate"].forEach(id=>$(id).addEventListener(id==="searchInput"?"input":"change",()=>applyFilters()));
  $("clearFiltersBtn").onclick=()=>{["searchInput","statusFilter","byWhomFilter","doneFilter","fromDate","toDate"].forEach(id=>$(id).value="");applyFilters();};
  $("prevPage").onclick=()=>{if(currentPage>1){currentPage--;renderTable();}};
  $("nextPage").onclick=()=>{if(currentPage<Math.ceil(filteredJobs.length/PAGE_SIZE)){currentPage++;renderTable();}};
  $("exportAllBtn").onclick=()=>exportExcel(jobs,"CableTrack_All_Jobs.xlsx");
  $("exportFilteredBtn").onclick=()=>exportExcel(filteredJobs,"CableTrack_Filtered_Jobs.xlsx");
  $("importBtn").onclick=importStarterData;
  $("filterToggle").onclick=()=>{const f=$("filtersBox"),o=f.classList.toggle("open");$("filterToggle").setAttribute("aria-expanded",o);};
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("jobModal").hidden)closeModal();});
}
bindEvents();
loadJobs();
