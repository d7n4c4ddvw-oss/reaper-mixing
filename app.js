const DEFAULT_REAPER_PORT = 8080;
const STORAGE_KEY = "multitracks-remote-reaper-hosts";

const searchBtn = document.getElementById("searchBtn");
const searchText = document.getElementById("searchText");
const results = document.getElementById("results");

const networkPrefixInput = document.getElementById(
  "networkPrefixInput"
);

const hostInput = document.getElementById("hostInput");
const portInput = document.getElementById("portInput");
const connectBtn = document.getElementById("connectBtn");
const savedList = document.getElementById("savedList");

const icons = {
  workstation: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="4" width="18" height="13" rx="2"></rect>
      <path d="M8 21h8"></path>
      <path d="M12 17v4"></path>
    </svg>
  `,

  connect: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
      <path d="M5 12h13"></path>
      <path d="m13 6 6 6-6 6"></path>
    </svg>
  `,

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

  clock: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <circle cx="12" cy="12" r="8"></circle>
      <path d="M12 8v4l3 2"></path>
    </svg>
  `,

  alert: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M12 8v4"></path>
      <path d="M12 16h.01"></path>
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

function validNetworkPrefix(value) {
  const prefix = String(value || "")
    .trim()
    .replace(/\.$/, "");

  return (
    /^192\.168\.\d{1,3}$/.test(prefix) ||
    /^10\.\d{1,3}\.\d{1,3}$/.test(prefix) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}$/.test(prefix)
  );
}

function buildReaperUrl(host, port) {
  const cleanHost = normalizeHost(host);
  const cleanPort = normalizePort(port);

  return `http://${cleanHost}:${cleanPort}`;
}

function showMessage(message, icon = icons.clock) {
  results.innerHTML = `
    <div class="empty-state">
      ${icon}
      <span>${message}</span>
    </div>
  `;
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

  if (!cleanHost) {
    return;
  }

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

  setStations(stations.slice(0, 8));

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
      <span class="saved-empty">
        Todavía no hay estaciones guardadas en este dispositivo.
      </span>
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
        title="Quitar esta estación"
      >
        ${icons.trash}
      </button>
    </div>
  `).join("");

  savedList
    .querySelectorAll(".saved-station-connect")
    .forEach(button => {
      button.addEventListener("click", () => {
        const host = button.dataset.host;
        const port = Number(button.dataset.port);

        hostInput.value = host;
        portInput.value = port;

        openReaper(host, port);
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

function showStationReady(host, port, message) {
  const cleanHost = normalizeHost(host);
  const cleanPort = normalizePort(port);

  results.innerHTML = `
    <article class="server-card">
      <div class="server-icon">
        ${icons.workstation}
      </div>

      <div class="server-info">
        <strong>${escapeHTML(message)}</strong>
        <small>${escapeHTML(cleanHost)}:${cleanPort}</small>
      </div>

      <button
        class="connect-button"
        id="openFoundStationBtn"
        type="button"
      >
        ${icons.connect}
        Abrir
      </button>
    </article>
  `;

  document
    .getElementById("openFoundStationBtn")
    .addEventListener("click", () => {
      openReaper(cleanHost, cleanPort);
    });
}

function prepareNetworkPrefix() {
  const prefix = String(networkPrefixInput.value || "")
    .trim()
    .replace(/\.$/, "");

  if (!validNetworkPrefix(prefix)) {
    showMessage(
      "Escribe los tres primeros bloques de tu red. Ejemplo: 192.168.100",
      icons.alert
    );

    networkPrefixInput.focus();

    return;
  }

  hostInput.value = `${prefix}.`;
  hostInput.focus();

  searchText.textContent = "IP preparada";

  showMessage(
    `Completa el último número de la IPv4 de tu PC. Ejemplo: ${escapeHTML(prefix)}.79`,
    icons.clock
  );

  setTimeout(() => {
    searchText.textContent = "Usar esta red";
  }, 1500);
}

function openReaper(host, port) {
  const cleanHost = normalizeHost(host);
  const cleanPort = normalizePort(port);

  if (!cleanHost || cleanHost.endsWith(".")) {
    hostInput.focus();

    showMessage(
      "Completa la dirección IPv4 de tu PC. Ejemplo: 192.168.100.79",
      icons.alert
    );

    return;
  }

  saveStation(cleanHost, cleanPort);

  showStationReady(
    cleanHost,
    cleanPort,
    "Abriendo REAPER…"
  );

  /*
    Esto abre directamente la Web Interface de REAPER.
    Tu navegador puede navegar a esa IP local aunque
    la página principal esté publicada en GitHub Pages.
  */
  window.setTimeout(() => {
    window.location.href = buildReaperUrl(
      cleanHost,
      cleanPort
    );
  }, 250);
}

searchBtn.addEventListener(
  "click",
  prepareNetworkPrefix
);

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

networkPrefixInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    prepareNetworkPrefix();
  }
});

window.addEventListener("load", () => {
  portInput.value = DEFAULT_REAPER_PORT;

  renderSavedStations();

  showMessage(
    "Agrega la dirección IPv4 de REAPER una vez. Quedará guardada solo en este dispositivo.",
    icons.clock
  );
});