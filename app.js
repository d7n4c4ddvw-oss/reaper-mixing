const DEFAULT_REAPER_PORT = 8080;
const STORAGE_KEY = "multitracks-remote-reaper-hosts";

const hostInput = document.getElementById("hostInput");
const portInput = document.getElementById("portInput");

const connectBtn = document.getElementById("connectBtn");
const connectButtonText = document.getElementById(
  "connectButtonText"
);

const connectionStatus = document.getElementById(
  "connectionStatus"
);

const connectionStatusText = document.getElementById(
  "connectionStatusText"
);

const savedList = document.getElementById("savedList");

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

  computer: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
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

function isValidIPv4(host) {
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

function setStatus(message, type = "") {
  connectionStatus.className =
    `connection-status ${type}`.trim();

  connectionStatusText.textContent = message;
}

function resetStatus() {
  setStatus("Listo para conectar");
}

function getStations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stations = JSON.parse(raw || "[]");

    if (!Array.isArray(stations)) {
      return [];
    }

    return stations.filter(station => {
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

function renderSavedStations() {
  const stations = getStations();

  if (!stations.length) {
    savedList.innerHTML = `
      <div class="empty-state">
        ${icons.computer}
        <span>Todavía no hay sesiones guardadas.</span>
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
        <span>${escapeHTML(station.host)}:${station.port}</span>
      </button>

      <button
        class="saved-station-delete"
        type="button"
        data-host="${escapeHTML(station.host)}"
        data-port="${station.port}"
        title="Eliminar estación"
      >
        ${icons.trash}
      </button>
    </div>
  `).join("");

  savedList
    .querySelectorAll(".saved-station-connect")
    .forEach(button => {
      button.addEventListener("click", () => {
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
          button.dataset.host,
          button.dataset.port
        );
      });
    });
}

function openReaper(host, port) {
  const cleanHost = normalizeHost(host);
  const cleanPort = normalizePort(port);

  if (!isValidIPv4(cleanHost)) {
    hostInput.focus();

    setStatus(
      "Escribe una IPv4 válida. Ejemplo: 192.168.100.79",
      "error"
    );

    return;
  }

  const reaperUrl =
    `http://${cleanHost}:${cleanPort}`;

  saveStation(cleanHost, cleanPort);

  hostInput.value = cleanHost;
  portInput.value = cleanPort;

  connectBtn.disabled = true;

  connectButtonText.textContent =
    "Abriendo REAPER…";

  setStatus(
    "Conexión guardada. Abriendo REAPER…",
    "active"
  );

  /*
    Navegación directa: funciona desde celular si esta IP ya abre
    manualmente en Chrome.
  */
  window.location.href = reaperUrl;
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

  resetStatus();

  renderSavedStations();
});

window.addEventListener("load", () => {
  portInput.value = DEFAULT_REAPER_PORT;

  resetStatus();
  renderSavedStations();
});