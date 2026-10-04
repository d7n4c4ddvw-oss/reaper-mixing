const DEFAULT_REAPER_PORT = 8080;
const STORAGE_KEY = "multitracks-remote-reaper-hosts";

const hostInput = document.getElementById("hostInput");
const portInput = document.getElementById("portInput");

const connectBtn = document.getElementById("connectBtn");
const connectButtonText = document.getElementById(
  "connectButtonText"
);

const connectProgress = document.getElementById(
  "connectProgress"
);

const connectProgressText = document.getElementById(
  "connectProgressText"
);

const connectProgressPercent = document.getElementById(
  "connectProgressPercent"
);

const connectProgressFill = document.getElementById(
  "connectProgressFill"
);

const savedList = document.getElementById("savedList");

let progressTimer = null;

const icons = {
  check: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
      <path d="m5 12 4 4L19 6"></path>
    </svg>
  `,

  trash: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M4 7h16"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
      <path d="M9 7V4h6v3"></path>
      <path d="M6 7l1 14h10l1-14"></path>
    </svg>
  `,

  workstation: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="4" width="18" height="13" rx="2"></rect>
      <path d="M8 21h8"></path>
      <path d="M12 17v4"></path>
    </svg>
  `
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function normalizeHost(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

function normalizePort(value) {
  const port = Number(value);

  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    return DEFAULT_REAPER_PORT;
  }

  return port;
}

function validIPv4(host) {
  const parts = String(host).split(".");

  if (parts.length !== 4) {
    return false;
  }

  return parts.every(part => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }

    const number = Number(part);

    return number >= 0 && number <= 255;
  });
}

function buildReaperUrl(host, port) {
  return `http://${normalizeHost(host)}:${normalizePort(port)}`;
}

function getStations() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    if (!Array.isArray(stored)) {
      return [];
    }

    return stored.filter(station => {
      return station &&
        typeof station.host === "string" &&
        Number.isFinite(Number(station.port));
    });
  } catch {
    return [];
  }
}

function setStations(stations) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(stations)
  );
}

function saveStation(host, port) {
  const cleanHost = normalizeHost(host);
  const cleanPort = normalizePort(port);

  const stationId = `${cleanHost}:${cleanPort}`;

  const stations = getStations()
    .filter(station => {
      return `${station.host}:${station.port}` !== stationId;
    });

  stations.unshift({
    host: cleanHost,
    port: cleanPort,
    lastUsed: Date.now()
  });

  setStations(stations.slice(0, 10));

  renderSavedStations();
}

function deleteStation(host, port) {
  const cleanHost = normalizeHost(host);
  const cleanPort = normalizePort(port);
  const stationId = `${cleanHost}:${cleanPort}`;

  const stations = getStations()
    .filter(station => {
      return `${station.host}:${station.port}` !== stationId;
    });

  setStations(stations);

  renderSavedStations();
}

function setProgress(message) {
  connectProgress.classList.add("active");

  connectProgressText.textContent = message;
}

function resetProgress() {
  window.clearInterval(progressTimer);

  progressTimer = null;

  connectProgress.classList.remove("active");

  connectProgressText.textContent =
    "Listo para conectar";
}

function runOpenProgress(onComplete) {
  window.clearInterval(progressTimer);

  const messages = [
    "Guardando estación en este dispositivo…",
    "Preparando Web Interface de REAPER…",
    "Abriendo conexión local…",
    "REAPER listo. Abriendo…"
  ];

  let step = 0;

  setProgress(messages[step]);

  progressTimer = window.setInterval(() => {
    step += 1;

    if (step < messages.length) {
      setProgress(messages[step]);
      return;
    }

    window.clearInterval(progressTimer);

    window.setTimeout(onComplete, 250);
  }, 350);
}

function renderSavedStations() {
  const stations = getStations();

  if (!stations.length) {
    savedList.innerHTML = `
      <div class="empty-state">
        ${icons.workstation}

        <span>
          Todavía no hay sesiones guardadas en este dispositivo.
        </span>
      </div>
    `;

    return;
  }

  savedList.innerHTML = stations.map(station => `
    <div class="saved-station-row">
      <button
        class="saved-station-connect"
        type="button"
        data-host="${escapeHTML(station.host)}"
        data-port="${station.port}"
        title="Abrir REAPER en ${escapeHTML(station.host)}:${station.port}"
      >
        ${icons.check}

        <span>
          ${escapeHTML(station.host)}:${station.port}
        </span>
      </button>

      <button
        class="saved-station-delete"
        type="button"
        data-delete-host="${escapeHTML(station.host)}"
        data-delete-port="${station.port}"
        title="Eliminar estación guardada"
      >
        ${icons.trash}
      </button>
    </div>
  `).join("");

  savedList
    .querySelectorAll(".saved-station-connect")
    .forEach(button => {
      button.addEventListener("click", () => {
        hostInput.value = button.dataset.host;
        portInput.value = button.dataset.port;

        openReaper(
          button.dataset.host,
          button.dataset.port
        );
      });
    });

  savedList
    .querySelectorAll(".saved-station-delete")
    .forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();

        deleteStation(
          button.dataset.deleteHost,
          button.dataset.deletePort
        );
      });
    });
}

function openReaper(host, port) {
  const cleanHost = normalizeHost(host);
  const cleanPort = normalizePort(port);

  if (!cleanHost) {
    hostInput.focus();

    setProgress(
      0,
      "Escribe la dirección IPv4 de la PC."
    );

    return;
  }

  if (!validIPv4(cleanHost)) {
    hostInput.focus();

    setProgress(
      0,
      "La IPv4 no es válida. Ejemplo: 192.168.100.79"
    );

    return;
  }

  const reaperUrl = buildReaperUrl(
    cleanHost,
    cleanPort
  );

  connectBtn.disabled = true;

  connectButtonText.textContent =
    "Conectando…";

  saveStation(cleanHost, cleanPort);

  runOpenProgress(() => {
    window.location.href = reaperUrl;
  });
}

connectBtn.addEventListener("click", () => {
  openReaper(
    hostInput.value,
    portInput.value
  );
});

hostInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    openReaper(
      hostInput.value,
      portInput.value
    );
  }
});

portInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    openReaper(
      hostInput.value,
      portInput.value
    );
  }
});

window.addEventListener("pageshow", () => {
  connectBtn.disabled = false;

  connectButtonText.textContent =
    "Guardar y abrir REAPER";

  resetProgress();

  renderSavedStations();
});

window.addEventListener("load", () => {
  portInput.value = DEFAULT_REAPER_PORT;

  renderSavedStations();

  resetProgress();
});