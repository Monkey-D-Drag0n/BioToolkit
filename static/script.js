"use strict";

const $ = (selector) => document.querySelector(selector);
const input = $("#sequenceInput");
let latest = null;
let chart = null;
let sequenceRevision = 0;
let currentRecord = null;

// Keep the selected appearance across reloads, while respecting dark mode by default.
const themeToggle = $("#themeToggle");
function applyTheme(theme) {
  const selected = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = selected;
  const lightActive = selected === "light";
  themeToggle.setAttribute("aria-label", `Switch to ${lightActive ? "dark" : "light"} theme`);
  themeToggle.title = `Switch to ${lightActive ? "dark" : "light"} theme`;
  themeToggle.querySelector(".theme-icon").textContent = lightActive ? "☾" : "☀";
  themeToggle.querySelector(".theme-label").textContent = lightActive ? "Dark" : "Light";
  document.querySelector('meta[name="theme-color"]').content = lightActive ? "#f3f6fb" : "#090d16";
  if (chart) {
    const style = getComputedStyle(document.documentElement);
    chart.options.scales.x.ticks.color = style.getPropertyValue("--chart-tick").trim();
    chart.options.scales.y.ticks.color = style.getPropertyValue("--chart-tick").trim();
    chart.options.scales.y.grid.color = style.getPropertyValue("--chart-grid").trim();
    chart.options.plugins.tooltip.backgroundColor = style.getPropertyValue("--panel-solid").trim();
    chart.options.plugins.tooltip.titleColor = style.getPropertyValue("--text").trim();
    chart.options.plugins.tooltip.bodyColor = style.getPropertyValue("--mint-bright").trim();
    chart.update("none");
  }
}
try { applyTheme(localStorage.getItem("biotoolkit-theme") || "dark"); }
catch { applyTheme("dark"); }
themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  applyTheme(next);
  try { localStorage.setItem("biotoolkit-theme", next); } catch { /* Theme still works for this page. */ }
});

// Small representative teaching samples. The 16S example is a short fragment.
const presets = {
  hemoglobin: {name:"Human HBB · NM_000518.5", accession:"NM_000518.5", sequence:"ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCCGTTACTGCCCTGTGGGGCAAGGTGAACGTGGATGAAGTTGGTGGTGAGGCCCTGGGCAGGTTGGTATCAAGGTTACAAGACAGGTTTAAGGAGACCAATAGAAACTGGGCATGTGGAGACAGAGAAGACTCTTGGGTTTCTGATAGGCACTGACTCTCTCTGCCTATTGGTCTATTTTCCCACCCTTAGGCTGCTGGTGGTCTACCCTTGGACCCAGAGGTTCTTTGAGTCCTTTGGGGATCTGTCCACTCCTGATGCTGTTATGGGCAACCCTAAGGTGAAGGCTCATGGCAAGAAAGTGCTCGGTGCCTTTAGTGATGGCCTGGCTCACCTGGACAACCTCAAGGGCACCTTTGCCACACTGAGTGAGCTGCACTGTGACAAGCTGCACGTGGATCCTGAGAACTTCAGGCTCCTGGGCAACGTGCTGGTCTGTGTGCTGGCCCATCACTTTGGCAAAGAATTCACCCCACCAGTGCAGGCTGCCTATCAGAAAGTGGTGGCTGGTGTGGCTAATGCCCTGGCCCACAAGTATCACTAAGCTCGCTTTCTTGCTGTCCAATTTCTATTAAAGGTTCCTTTGTTCCCTAAGTCCAACTACTAAACTGGGGGATATTATGAAGGGCCTTGAGCATCTGGATTCTGCCTAATAAAAAACATTTATTTTCATTGC"},
  insulin: {name:"Human INS · NM_000207.3", accession:"NM_000207.3", sequence:"ATGGCCCTGTGGATGCGCCTCCTGCCCCTGCTGGCGCTGCTGGCCCTCTGGGGACCTGACCCAGCCGCAGCCTTTGTGAACCAACACCTGTGCGGCTCACACCTGGTGGAAGCTCTCTACCTAGTGTGCGGGGAACGAGGCTTCTTCTACACACCCAAGACCCGCCGGGAGGCAGAGGACCTGCAGGTGGGGCAGGTGGAGCTGGGCGGGGGCCCTGGTGCAGGCAGCCTGCAGCCCTTGGCCCTGGAGGGGTCCCTGCAGAAGCGTGGCATTGTGGAACAATGCTGTACCAGCATCTGCTCCCTCTACCAGCTGGAGAACTACTGCAACTAG"},
  "16s": {name:"E. coli 16S rRNA · NR_024570.1", accession:"NR_024570.1", sequence:"AGAGTTTGATCCTGGCTCAGATTGAACGCTGGCGGCAGGCCTAACACATGCAAGTCGAACGGTAACAGGAAGAAGCTTGCTTCTTTGCTGACGAGTGGCGGACGGGTGAGTAATGTCTGGGAAACTGCCTGATGGAGGGGGATAACTACTGGAAACGGTAGCTAATACCGCATAACGTCGCAAGACCAAAGAGGGGGACCTTCGGGCCTCTTGCCATCGGATGTGCCCAGATGGGATTAGCTAGTAGGTGGGGTAACGGCTCACCTAGGCGACGATCCCTAGCTGGTCTGAGAGGATGACCAGCCACACTGGAACTGAGACACGGTCCAGACTCCTACGGGAGGCAGCAGTGGGGAATATTGCACAATGGGCGCAAGCCTGATGCAGCCATGCCGCGTGTATGAAGAAGGCCTTCGGGTTGTAAAGTACTTTCAGCGGGGAGGAAGGGAGTAAAGTTAATACCTTTGCTCATTGACGTTACCCGCAGAAGAAGCACCGGCTAACTCCGTGCCAGCAGCCGCGGTAATACGGAGGGTGCAAGCGTTAATCGGAATTACTGGGCGTAAAGCGCACGCAGGCGGTTTGTTAAGTCAGATGTGAAATCCCCGGGCTCAACCTGGGAACTGCATCTGATACTGGCAAGCTTGAGTCTCGTAGAGGGGGGTAGAATTCCAGGTGTAGCGGTGAAATGCGTAGAGATCTGGAGGAATACCGGTGGCGAAGGCGGCCCCCTGGACGAAGACTGACGCTCAGGTGCGAAAGCGTGGGGAGCAAACAGGATTAGATACCCTGGTAGTCCACGCCGTAAACGATGTCGACTTGGAGGTTGTGCCCTTGAGGCGTGGCTTCCGGAGCTAACGCGTTAAGTCGACCGCCTGGGGAGTACGGCCGCAAGGTTAAAACTCAAATGAATTGACGGGGGCCCGCACAAGCGGTGGAGCATGTGGTTTAATTCGATGCAACGCGAAGAACCTTACCTGGTCTTGACATCCACGGAAGTTTTCAGAGATGAGAATGTGCCTTCGGGAACCGTGAGACAGGTGCTGCATGGCTGTCGTCAGCTCGTGTTGTGAAATGTTGGGTTAAGTCCCGCAACGAGCGCAACCCTTATCCTTTGTTGCCAGCGGTCCGGCCGGGAACTCAAAGGAGACTGCCAGTGATAAACTGGAGGAAGGTGGGGATGACGTCAAGTCATCATGGCCCTTACGACCAGGGCTACACACGTGCTACAATGGCGCATACAAAGAGAAGCGACCTCGCGAGAGCAAGCGGACCTCATAAAGTGCGTCGTAGTCCGGATTGGAGTCTGCAACTCGACTCCATGAAGTCGGAATCGCTAGTAATCGTGGATCAGAATGCCACGGTGAATACGTTCCCGGGCCTTGTACACACCGCCCGTCACACCATGGGAGTGGGTTGCAAAAGAAGTAGGTAGCTTAACCTTCGGGAGGGCGCTTACCACTTTGTGATTCATGACTGGGGTGAAGTCGTAACAAGGTAACCGTAGGGGAACCTGCGGTTGGATCACCTCCTTA"}
};

function showError(message) { const box = $("#errorBox"); box.textContent = message; box.hidden = false; }
function clearError() { $("#errorBox").hidden = true; }
function formatNumber(number) { return Number(number).toLocaleString(); }

async function requestJson(url, options = {}, timeoutMs = 35000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {...options, signal:controller.signal});
    let data;
    try { data = await response.json(); }
    catch { throw new Error(`The server returned an unreadable response (${response.status}).`); }
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The request took too long. Please try again.");
    if (error instanceof TypeError) throw new Error("Could not connect to BioToolkit. Check that the local server is running.");
    throw error;
  } finally { clearTimeout(timeout); }
}

function isAnalysisResponse(data) {
  const restrictionRows = data?.restriction_analysis ?? data?.restriction;
  return data && Number.isFinite(data.length) && Number.isFinite(data.gc_content) &&
    data.counts && ["A","T","G","C","N"].every((base) => Number.isFinite(data.counts[base])) &&
    typeof (data.rna ?? data.transcript) === "string" && typeof data.protein === "string" &&
    Array.isArray(data.orfs) && data.orfs.every((orf) => orf && Number.isFinite(orf.start) && Number.isFinite(orf.end) &&
      ["+","-"].includes(orf.strand) && Number.isFinite(orf.frame) && Number.isFinite(orf.length) && typeof orf.protein === "string") &&
    Array.isArray(restrictionRows) && restrictionRows.every((item) => item && typeof item.enzyme === "string" &&
      typeof item.recognition_site === "string" && Number.isFinite(item.cut_count) && Array.isArray(item.cuts) && Array.isArray(item.fragment_sizes));
}

input.addEventListener("input", () => {
  sequenceRevision += 1;
  latest = null;
  currentRecord = null;
  $("#results").hidden = true;
  $("#sequenceMeta").textContent = input.value.trim() ? "SEQUENCE CHANGED · ANALYZE TO REFRESH" : "READY FOR INPUT";
  clearError();
});

document.querySelectorAll(".preset").forEach((button) => button.addEventListener("click", async () => {
  const sample = presets[button.dataset.preset];
  const requestRevision = sequenceRevision;
  latest = null;
  $("#results").hidden = true;
  clearError();
  document.querySelectorAll(".preset").forEach((item) => item.classList.toggle("active", item === button));
  document.querySelectorAll(".preset").forEach((item) => { item.disabled = true; });
  const status = $("#fetchStatus");
  status.textContent = `Fetching ${sample.accession}…`;
  status.style.color = "";
  let sequence = sample.sequence;
  let header = `${sample.name} · embedded sample fragment`;
  let loadedFromNcbi = false;
  let fetchedRecord = null;
  currentRecord = null;
  try {
    const params = new URLSearchParams({id:sample.accession});
    const record = await requestJson(`/api/fetch?${params}`, {headers:{"Accept":"application/json"}}, 25000);
    if (typeof record.sequence !== "string" || !record.sequence || typeof record.id !== "string") {
      throw new Error("NCBI returned an incomplete sample record.");
    }
    sequence = record.sequence;
    header = `${record.id} ${record.description}${record.organism ? ` · ${record.organism}` : ""}`;
    loadedFromNcbi = true;
    fetchedRecord = record;
  } catch (error) {
    if (sequenceRevision === requestRevision) {
      showError(`${sample.accession} could not be fetched; the embedded DNA fragment is loaded. ${error.message}`);
    }
  } finally {
    document.querySelectorAll(".preset").forEach((item) => { item.disabled = false; });
  }
  if (sequenceRevision !== requestRevision) {
    status.textContent = "Input changed · sample not applied";
    status.style.color = "var(--quiet)";
    return;
  }
  sequenceRevision += 1;
  input.value = `>${header}\n${sequence}`;
  currentRecord = fetchedRecord;
  $("#sequenceMeta").textContent = `${formatNumber(sequence.length)} bases · ${loadedFromNcbi ? sample.accession : "offline sample"}`;
  status.textContent = loadedFromNcbi ? "RefSeq loaded" : "Offline sample loaded";
  status.style.color = loadedFromNcbi ? "var(--mint-bright)" : "#f2c879";
}));

$("#analyzeBtn").addEventListener("click", async () => {
  clearError();
  const button = $("#analyzeBtn"); button.disabled = true; button.textContent = "Analyzing…";
  try {
    const data = await requestJson("/analyze", {method:"POST", headers:{"Content-Type":"application/json", "Accept":"application/json"}, body:JSON.stringify({sequence:input.value})});
    if (!isAnalysisResponse(data)) throw new Error("The analysis response was incomplete. Please retry.");
    latest = data; render(data); $("#results").hidden = false;
    $("#sequenceMeta").textContent = `${formatNumber(data.length)} bases · analysis ready`;
    $("#results").scrollIntoView({behavior:"smooth", block:"start"});
  } catch (error) { showError(error.message || "Analysis failed. Please try again."); }
  finally { button.disabled = false; button.innerHTML = '<span class="button-icon">⌁</span> Analyze sequence <span class="arrow">↗</span>'; }
});

function render(data) {
  const rna = data.rna ?? data.transcript;
  const restrictionRows = data.restriction_analysis ?? data.restriction ?? [];
  renderRecordDetails(currentRecord);
  $("#lengthStat").textContent = formatNumber(data.length);
  $("#gcStat").textContent = `${data.gc_content}%`;
  $("#orfStat").textContent = formatNumber(data.orfs.length);
  $("#cutStat").textContent = formatNumber(restrictionRows.reduce((sum, enzyme) => sum + enzyme.cut_count, 0));
  $("#transcriptOutput").textContent = rna;
  $("#proteinOutput").textContent = data.protein;
  $("#resultLabel").textContent = `Analysis complete · ${formatNumber(data.length)} bases`;
  if (window.Chart) {
    $("#chartUnavailable")?.remove();
    $("#baseChart").hidden = false;
    if (chart) chart.destroy();
    const style = getComputedStyle(document.documentElement);
    const tick = style.getPropertyValue("--chart-tick").trim();
    chart = new Chart($("#baseChart"), {type:"bar", data:{labels:["A","T","G","C","N"], datasets:[{data:[data.counts.A,data.counts.T,data.counts.G,data.counts.C,data.counts.N], backgroundColor:["#3b82f6","#60a5fa","#10b981","#34d399","#64748b"], borderRadius:5, maxBarThickness:42}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false},tooltip:{displayColors:false,backgroundColor:style.getPropertyValue("--panel-solid").trim(),titleColor:style.getPropertyValue("--text").trim(),bodyColor:style.getPropertyValue("--mint-bright").trim(),borderColor:"#3b82f6",borderWidth:1}}, scales:{x:{grid:{display:false},ticks:{font:{family:"DM Mono",size:11},color:tick},border:{display:false}},y:{beginAtZero:true,ticks:{precision:0,color:tick,font:{family:"Inter",size:10}},grid:{color:style.getPropertyValue("--chart-grid").trim()},border:{display:false}}}}});
  } else {
    $("#baseChart").hidden = true;
    if (!$("#chartUnavailable")) {
      const fallback = document.createElement("p"); fallback.id = "chartUnavailable";
      fallback.className = "empty-state";
      fallback.textContent = `Chart library unavailable · A ${data.counts.A} · T ${data.counts.T} · G ${data.counts.G} · C ${data.counts.C} · N ${data.counts.N}`;
      $(".chart-wrap").append(fallback);
    }
  }
  const orfBody = $("#orfTable"); orfBody.replaceChildren();
  $("#orfEmpty").hidden = data.orfs.length > 0;
  $("#orfMeta").textContent = data.orfs_truncated
    ? `Showing the first ${formatNumber(data.orfs.length)} ORFs · coordinates are 1-based`
    : "Complete ATG → stop ORFs · coordinates are 1-based";
  data.orfs.forEach((orf) => { const row = document.createElement("tr");
    [orf.start,orf.end].forEach((value) => { const cell=document.createElement("td");cell.textContent=value;row.append(cell); });
    const strand=document.createElement("td");const badge=document.createElement("span");
    badge.className=`strand ${orf.strand === "-" ? "reverse" : ""}`;badge.textContent=orf.strand === "+"?"Forward":"Reverse";strand.append(badge);row.append(strand);
    [orf.frame,orf.length].forEach((value) => { const cell=document.createElement("td");cell.textContent=value;row.append(cell); });
    const prot=document.createElement("td");prot.className="protein-cell";prot.textContent=orf.protein;row.append(prot);orfBody.append(row);
  });
  const digestBody=$("#restrictionTable");digestBody.replaceChildren();
  restrictionRows.forEach((item)=>{const row=document.createElement("tr");
    const values=[item.enzyme,item.recognition_site,item.cut_count,item.cuts.length?item.cuts.join(", "):"—",item.fragment_sizes.join(" · ")];
    values.forEach((value)=>{const cell=document.createElement("td");cell.textContent=value;row.append(cell);});digestBody.append(row);
  });
}

function renderRecordDetails(record) {
  const panel = $("#recordDetails");
  if (!record) { panel.hidden = true; return; }
  panel.hidden = false;
  $("#recordDescription").textContent = record.description || "NCBI sequence record";
  $("#recordAccession").textContent = record.id || "—";
  $("#recordOrganism").textContent = record.organism || "Not annotated";
  $("#recordMolecule").textContent = record.molecule_type || "Nucleotide";
  $("#recordGene").textContent = record.gene || "Not annotated";
  $("#recordProtein").textContent = record.protein_id || "Not annotated";
  $("#recordCds").textContent = record.cds_location || "Not annotated";
  $("#recordFunction").textContent = record.function || "Not annotated";
  const link = $("#ncbiRecordLink");
  link.href = record.ncbi_url || `https://www.ncbi.nlm.nih.gov/nuccore/${encodeURIComponent(record.id || "")}`;
}

$("#fetchBtn").addEventListener("click", async () => {
  const id=$("#ncbiId").value.trim(); const status=$("#fetchStatus");
  if (!id) { status.textContent="Enter an ID"; status.style.color="#ff9b8c"; $("#ncbiId").focus(); return; }
  const requestRevision=sequenceRevision;
  status.textContent="Fetching…"; status.style.color=""; $("#fetchBtn").disabled=true;
  try {
    const params=new URLSearchParams({id,db:"nuccore"});
    const data=await requestJson(`/api/fetch?${params}`, {headers:{"Accept":"application/json"}}, 25000);
    if (typeof data.sequence !== "string" || !data.sequence || typeof data.id !== "string") throw new Error("NCBI returned an incomplete sequence record.");
    if (sequenceRevision !== requestRevision) {
      status.textContent="Input changed · record not applied";status.style.color="var(--quiet)";return;
    }
    sequenceRevision+=1;
    input.value=`>${data.id} ${data.description}${data.organism?` | ${data.organism}`:""}\n${data.sequence}`;
    currentRecord=data;
    latest=null;$("#results").hidden=true;
    $("#fetchStatus").textContent="";
    $("#sequenceMeta").textContent=`${formatNumber(data.length)} bases · ${data.id}${data.resolved_from_protein?` · linked from ${data.resolved_from_protein}`:""}`;
    document.querySelectorAll(".preset").forEach((item)=>item.classList.remove("active"));
    status.textContent=data.resolved_from_protein?"Linked mRNA loaded · analyzing…":"Sequence loaded · analyzing…";status.style.color="var(--mint-bright)";clearError();
    $("#analyzeBtn").click();
  } catch(error) { status.textContent="Fetch failed";status.style.color="#ff9b8c";showError(error.message || "NCBI fetch failed. Please try again."); }
  finally { $("#fetchBtn").disabled=false; }
});

document.querySelectorAll(".copy").forEach((button)=>button.addEventListener("click",async()=>{
  if (!latest) return;
  const value=button.dataset.copy==="transcript"?(latest.rna ?? latest.transcript):latest.protein;
  try { await navigator.clipboard.writeText(value);button.textContent="Copied ✓";setTimeout(()=>button.innerHTML="Copy <span>⧉</span>",1200); }
  catch { showError("Clipboard access is unavailable in this browser."); }
}));

$("#downloadBtn").addEventListener("click",()=>{
  if (!latest) return;
  const fasta=`>BioToolkit_sequence length=${latest.length} GC=${latest.gc_content}%\n${latest.sequence.match(/.{1,70}/g).join("\n")}\n`;
  const url=URL.createObjectURL(new Blob([fasta],{type:"text/plain"}));const link=document.createElement("a");
  link.href=url;link.download="biotoolkit_sequence.fasta";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
