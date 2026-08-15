// Plain vanilla JS - no build step, so any team member can open this file
// and understand the whole dashboard in one read.
//
// Assumes the dashboard is served by the same FastAPI app (mounted at
// /dashboard), so API_BASE is just the origin.
const API_BASE = window.location.origin;

let token = localStorage.getItem("tobaccoshield_token") || null;
let currentUser = null;
let currentCaseId = null;

const $ = (id) => document.getElementById(id);

async function api(path, opts = {}) {
  const headers = opts.headers || {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { ...opts, headers });
  if (res.status === 401) {
    logout();
    throw new Error("Session expired, please log in again.");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res;
}

function showApp() {
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("userBox").classList.remove("hidden");
  $("whoami").textContent = `${currentUser.full_name || currentUser.username} (${currentUser.role})`;
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem("tobaccoshield_token");
  $("appView").classList.add("hidden");
  $("userBox").classList.add("hidden");
  $("loginView").classList.remove("hidden");
}

async function login(username, password) {
  const form = new URLSearchParams();
  form.set("username", username);
  form.set("password", password);
  const res = await fetch(API_BASE + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!res.ok) throw new Error("Invalid username or password.");
  const data = await res.json();
  token = data.access_token;
  currentUser = data.user;
  localStorage.setItem("tobaccoshield_token", token);
  showApp();
  loadCases();
}

function badgeFor(text, kind) {
  const cls = kind ? `badge-${kind}` : "badge-neutral";
  return `<span class="badge ${cls}">${text || "—"}</span>`;
}

async function loadCases() {
  const statusFilter = $("statusFilter").value;
  const q = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : "";
  const cases = await api(`/cases${q}`);
  const body = $("caseTableBody");
  body.innerHTML = "";
  for (const c of cases) {
    const tr = document.createElement("tr");
    const created = new Date(c.created_at).toLocaleString();
    const riskBadge = c.risk_category ? badgeFor(c.risk_category, c.risk_category) : badgeFor("pending");
    const qualityBadge = c.quality_passed === null || c.quality_passed === undefined
      ? badgeFor("pending")
      : (c.quality_passed ? badgeFor("passed", "low") : badgeFor("failed", "high"));
    tr.innerHTML = `
      <td>${c.patient_name}</td>
      <td>${badgeFor(c.status)}</td>
      <td>${riskBadge}</td>
      <td>${qualityBadge}</td>
      <td>${created}</td>
      <td><button data-case="${c.id}" class="viewBtn">View</button></td>
    `;
    body.appendChild(tr);
  }
  document.querySelectorAll(".viewBtn").forEach((btn) => {
    btn.addEventListener("click", () => openCase(btn.dataset.case));
  });
}

async function openCase(caseId) {
  currentCaseId = caseId;
  const c = await api(`/cases/${caseId}`);

  $("caseTable").parentElement.classList.add("hidden");
  document.querySelector(".toolbar").classList.add("hidden");
  $("caseDetail").classList.remove("hidden");

  $("caseImage").src = c.image_url ? API_BASE + c.image_url : "";

  if (c.risk_assessment && c.risk_assessment.heatmap_url) {
    $("caseHeatmap").src = API_BASE + c.risk_assessment.heatmap_url;
    $("caseHeatmap").classList.remove("hidden");
  } else {
    $("caseHeatmap").classList.add("hidden");
  }

  const qa = c.quality_audit;
  $("qualityBlock").innerHTML = qa ? `
    <p>${badgeFor(qa.passed ? "PASSED" : "FAILED", qa.passed ? "low" : "high")}</p>
    ${!qa.passed ? `<p>Reason: <b>${qa.reason}</b> (all: ${qa.all_failed_reasons.join(", ")})</p>` : ""}
    <p>Blur: ${qa.blur_score ?? "—"} | Brightness: ${qa.brightness_score ?? "—"} |
       Glare: ${qa.glare_area_pct ?? "—"}% | Framing conf: ${qa.framing_confidence ?? "—"}</p>
    <p class="hint">Module: ${qa.module_version || "—"}</p>
  ` : `<p class="hint">Not yet checked.</p>`;

  const ra = c.risk_assessment;
  $("riskBlock").innerHTML = ra ? `
    <p>${badgeFor(ra.cannot_assess ? "CANNOT ASSESS" : ra.risk_category, ra.cannot_assess ? "cannot_assess" : ra.risk_category)}
       &nbsp; confidence: ${ra.confidence ?? "—"}</p>
    ${ra.cannot_assess ? `<p>Reason: ${ra.cannot_assess_reason || "—"}</p>` : ""}
    <p class="hint">Model: ${ra.model_version || "—"}</p>
  ` : `<p class="hint">Not yet assessed (image may still be pending quality check).</p>`;

  $("reviewHistory").innerHTML = c.reviews.length
    ? c.reviews.map(r => `
        <div class="review-entry">
          <b>${r.action.toUpperCase()}</b> by doctor ${r.doctor_id.slice(0, 8)}
          ${r.overridden_risk_category ? ` → ${r.overridden_risk_category}` : ""}
          ${r.comment_text ? `<br/>"${r.comment_text}"` : ""}
          <br/><span class="hint">${new Date(r.reviewed_at).toLocaleString()}</span>
        </div>`).join("")
    : `<p class="hint">No reviews yet.</p>`;
}

function closeDetail() {
  $("caseDetail").classList.add("hidden");
  $("caseTable").parentElement.classList.remove("hidden");
  document.querySelector(".toolbar").classList.remove("hidden");
  loadCases();
}

// ---------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("loginError").classList.add("hidden");
  try {
    await login($("loginUsername").value, $("loginPassword").value);
  } catch (err) {
    $("loginError").textContent = err.message;
    $("loginError").classList.remove("hidden");
  }
});

$("logoutBtn").addEventListener("click", logout);
$("refreshBtn").addEventListener("click", loadCases);
$("statusFilter").addEventListener("change", loadCases);
$("closeDetailBtn").addEventListener("click", closeDetail);

$("reviewAction").addEventListener("change", () => {
  $("overrideCategoryWrap").classList.toggle("hidden", $("reviewAction").value !== "override");
});

$("reviewForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const action = $("reviewAction").value;
  const payload = {
    action,
    overridden_risk_category: action === "override" ? $("overrideCategory").value : null,
    comment_text: $("reviewComment").value || null,
  };
  try {
    await api(`/cases/${currentCaseId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    $("reviewComment").value = "";
    await openCase(currentCaseId);
  } catch (err) {
    alert("Review failed: " + err.message);
  }
});

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
(async function boot() {
  if (token) {
    try {
      currentUser = await api("/auth/me");
      showApp();
      loadCases();
    } catch (e) {
      logout();
    }
  }
})();
