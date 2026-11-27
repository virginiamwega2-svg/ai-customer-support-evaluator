const elements = {
  datasetSelect: document.querySelector("#dataset-select"),
  datasetDescription: document.querySelector("#dataset-description"),
  evaluationStatus: document.querySelector("#evaluation-status"),
  overviewMetrics: document.querySelector("#overview-metrics"),
  dimensionResults: document.querySelector("#dimension-results"),
  scenarioSearch: document.querySelector("#scenario-search"),
  scenarioList: document.querySelector("#scenario-list"),
  scenarioDetail: document.querySelector("#scenario-detail"),
  llmStatus: document.querySelector("#llm-status")
};

let currentData = null;
let selectedScenarioId = null;

const number = (value) =>
  new Intl.NumberFormat().format(value);

const percentage = (value) =>
  value === null || value === undefined
    ? "N/A"
    : `${value.toFixed(1)}%`;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function metricCard(label, value, note) {
  return `
    <article class="metric-card">
      <p class="metric-label">${escapeHtml(label)}</p>
      <p class="metric-value">${escapeHtml(value)}</p>
      <p class="metric-note">${escapeHtml(note)}</p>
    </article>
  `;
}

function renderOverview(data) {
  const totalMatches = data.dimensions.reduce(
    (total, dimension) => total + dimension.exactMatches,
    0
  );

  const totalComparisons = data.dimensions.reduce(
    (total, dimension) => total + dimension.totalResponses,
    0
  );

  const totalUnknown = data.dimensions.reduce(
    (total, dimension) => total + dimension.verdictCounts.unknown,
    0
  );

  elements.overviewMetrics.innerHTML = [
    metricCard("Scenarios", number(data.scenarioCount), "Evaluation cases"),
    metricCard("Responses", number(data.responseCount), "Candidate responses"),
    metricCard(
      "Exact verdict matches",
      `${percentage(totalComparisons ? totalMatches / totalComparisons * 100 : null)}`,
      `${number(totalMatches)} of ${number(totalComparisons)} dimension comparisons`
    ),
    metricCard("Unknown verdicts", number(totalUnknown), "Evaluator abstentions across dimensions")
  ].join("");

  elements.evaluationStatus.textContent = "Evaluation complete";
  elements.datasetDescription.textContent =
    `${number(data.scenarioCount)} scenarios · ${number(data.responseCount)} responses · deterministic evaluation`;
}

function renderDimensions(dimensions) {
  elements.dimensionResults.innerHTML = dimensions.map((dimension) => {
    const matrix = dimension.confusionMatrix;

    return `
      <article class="dimension-card">
        <h3>${escapeHtml(dimension.label)}</h3>
        <div class="dimension-score">
          <strong>${escapeHtml(percentage(dimension.exactAccuracy))}</strong>
          <span>${number(dimension.exactMatches)} / ${number(dimension.totalResponses)} exact matches</span>
        </div>
        <div class="progress-track"
             role="progressbar"
             aria-label="${escapeHtml(dimension.label)} exact accuracy"
             aria-valuemin="0"
             aria-valuemax="100"
             aria-valuenow="${dimension.exactAccuracy ?? 0}">
          <div class="progress-fill"
               style="width: ${dimension.exactAccuracy ?? 0}%"></div>
        </div>
        <div class="dimension-stats">
          <span>Coverage: ${escapeHtml(percentage(dimension.coverage))}</span>
          <span>Abstention: ${escapeHtml(percentage(dimension.abstentionRate))}</span>
        </div>
        <div class="dimension-stats">
          <span>Pass: ${number(dimension.verdictCounts.pass)}</span>
          <span>Fail: ${number(dimension.verdictCounts.fail)}</span>
          <span>Unknown: ${number(dimension.verdictCounts.unknown)}</span>
        </div>
        <div class="dimension-stats">
          <span>TP ${number(matrix.truePositive)}</span>
          <span>FP ${number(matrix.falsePositive)}</span>
          <span>FN ${number(matrix.falseNegative)}</span>
          <span>TN ${number(matrix.trueNegative)}</span>
        </div>
      </article>
    `;
  }).join("");
}

function verdictBadge(verdict) {
  const safeVerdict = ["pass", "fail", "unknown"].includes(verdict)
    ? verdict
    : "unknown";

  return `<span class="verdict ${safeVerdict}">${escapeHtml(safeVerdict)}</span>`;
}

function renderScenarios() {
  if (!currentData) return;

  const query = elements.scenarioSearch.value.trim().toLowerCase();

  const filtered = currentData.scenarios.filter((scenario) => {
    const searchable = [
      scenario.id,
      scenario.scenario,
      scenario.customerMessage
    ].join(" ").toLowerCase();

    return searchable.includes(query);
  });

  if (!filtered.some((scenario) => scenario.id === selectedScenarioId)) {
    selectedScenarioId = filtered[0]?.id ?? null;
  }

  if (filtered.length === 0) {
    elements.scenarioList.innerHTML =
      '<p class="empty-message">No scenarios match your search.</p>';
    elements.scenarioDetail.innerHTML =
      '<p class="empty-message">Choose a different search term.</p>';
    return;
  }

  elements.scenarioList.innerHTML = filtered.map((scenario) => `
    <button
      type="button"
      class="scenario-item ${scenario.id === selectedScenarioId ? "selected" : ""}"
      data-scenario-id="${escapeHtml(scenario.id)}"
      aria-pressed="${scenario.id === selectedScenarioId}">
      <strong>${escapeHtml(scenario.id)}</strong>
      <span>${escapeHtml(scenario.scenario)}</span>
    </button>
  `).join("");

  renderScenarioDetail(
    filtered.find((scenario) => scenario.id === selectedScenarioId)
  );
}

function renderEvidence(evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    return '<p class="reason-text">No structured evidence recorded for this evaluation.</p>';
  }

  return `
    <ul class="evidence-list">
      ${evidence.map((item) => `
        <li>
          <strong>${escapeHtml(item.claimType ?? "Evidence")}:</strong>
          ${escapeHtml(item.claimedValue ?? "No claimed value")}
          <br>
          Verified value: ${escapeHtml(item.verifiedValue ?? "Not available")}
          <br>
          Verified source: ${escapeHtml(item.verifiedSource ?? "Not available")}
          <br>
          Response excerpt: "${escapeHtml(item.responseExcerpt ?? "")}"
          <br>
          Character range: ${escapeHtml(item.startIndex ?? "N/A")}–${escapeHtml(item.endIndex ?? "N/A")}
        </li>
      `).join("")}
    </ul>
  `;
}

function renderScenarioDetail(scenario) {
  if (!scenario) return;

  const context = Object.entries(scenario.context ?? {})
    .map(([key, value]) => `
      <p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</p>
    `).join("");

  const dimensions = currentData.dimensions;

  const responses = scenario.responses.map((response) => {
    const evaluations = dimensions.map((dimension) => {
      const evaluation = response.evaluations[dimension.key];
      const result = evaluation.result;

      return `
        <div class="detail-block">
          <h4>${escapeHtml(dimension.label)}</h4>
          <div class="verdict-row">
            <span>Expected ${verdictBadge(evaluation.expectedVerdict)}</span>
            <span>Actual ${verdictBadge(evaluation.actualVerdict)}</span>
          </div>
          <p class="reason-text">${escapeHtml(result.reason ?? "No evaluation reason provided.")}</p>
          ${renderEvidence(result.evidence)}
        </div>
      `;
    }).join("");

    return `
      <article class="response-card">
        <h4>Response ${escapeHtml(response.responseId)}</h4>
        <p class="response-text">${escapeHtml(response.text)}</p>
        ${evaluations}
      </article>
    `;
  }).join("");

  elements.scenarioDetail.innerHTML = `
    <div class="detail-heading">
      <div>
        <p class="eyebrow">${escapeHtml(scenario.id)}</p>
        <h3>${escapeHtml(scenario.scenario)}</h3>
      </div>
    </div>

    <div class="detail-block">
      <h4>Customer message</h4>
      <p>${escapeHtml(scenario.customerMessage)}</p>
    </div>

    <div class="detail-block">
      <h4>Verified business context</h4>
      ${context || '<p>No context supplied.</p>'}
    </div>

    <div class="detail-block">
      <h4>Expected behavior</h4>
      <p>${escapeHtml(scenario.expectedBehavior ?? "Not specified.")}</p>
    </div>

    <div class="detail-block">
      <h4>Reference answer</h4>
      <p>${escapeHtml(scenario.referenceAnswer ?? "Not supplied.")}</p>
    </div>

    <div class="detail-block">
      <h4>Candidate responses and evaluations</h4>
      ${responses}
    </div>
  `;
}

async function loadDataset(datasetName) {
  elements.evaluationStatus.textContent = "Loading";
  elements.overviewMetrics.innerHTML =
    '<p class="loading-message">Loading evaluation metrics…</p>';

  try {
    const response = await fetch(
      `/api/benchmark?dataset=${encodeURIComponent(datasetName)}`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      throw new Error("The evaluation API returned an error.");
    }

    const data = await response.json();

    if (!Array.isArray(data.dimensions) || !Array.isArray(data.scenarios)) {
      throw new Error("The evaluation API returned an unexpected response.");
    }

    currentData = data;
    selectedScenarioId = data.scenarios[0]?.id ?? null;

    renderOverview(data);
    renderDimensions(data.dimensions);
    renderScenarios();

    elements.llmStatus.textContent =
      data.llmEvaluation?.message ??
      "Live LLM-as-a-Judge results are not included in this dashboard.";
  } catch (error) {
    currentData = null;
    elements.evaluationStatus.textContent = "Unavailable";
    elements.overviewMetrics.innerHTML =
      `<p class="error-message">${escapeHtml(error.message)}</p>`;
    elements.dimensionResults.innerHTML = "";
    elements.scenarioList.innerHTML = "";
    elements.scenarioDetail.innerHTML = "";
  }
}

elements.datasetSelect.addEventListener("change", (event) => {
  loadDataset(event.target.value);
});

elements.scenarioSearch.addEventListener("input", renderScenarios);

elements.scenarioList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-scenario-id]");

  if (!button || !currentData) return;

  selectedScenarioId = button.dataset.scenarioId;
  renderScenarios();
});

loadDataset(elements.datasetSelect.value);
