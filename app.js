const DEFAULT_REAPER_PORT = 8080;
const STORAGE_KEY = "multitracks-remote-reaper-hosts";

const searchBtn = document.getElementById("searchBtn");
const searchText = document.getElementById("searchText");
const results = document.getElementById("results");

const networkPrefixInput = document.getElementById("networkPrefixInput");

const hostInput = document.getElementById("hostInput");
const portInput = document.getElementById("portInput");
const connectBtn = document.getElementById("connectBtn");
const savedList = document.getElementById("savedList");

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

function isValidPrefix(value) {
  const prefix = String(value || "")
    .trim()
    .replace(/\.$/, "");

  return (
    /^192\.168\.\d{1,3}$/.test(prefix) ||
    /^10\.\d{1,3}\.\d{1,3}$/.test(prefix) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}$/.test(prefix)
  );
}

function showMessage(message) {
  results.innerHTML = `
    <div class="empty-state">
      <span>${message}</span>
    </div>
  `;
}

function getSavedStations() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveStation(host, port) {
  const cleanHost = normalizeHost(host);
  const cleanPort = normalizePort(port);

  if (!cleanHost) {
    return;
  }

  const id = `${cleanHost}:${cleanPort}`;

  const stations = getSavedStations()
    .filter(station => {
      return `${station.host}:${station.port}` !== id;
    });

  stations.unshift({
    host: cleanHost,
    port: cleanPort
  });

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(stations.slice(0, 8))
  );

  renderSavedStations();
}

function renderSavedStations() {
  const stations = getSavedStations();

  if (!stations.length) {
    savedList.innerHTML = `
      <span class="saved-empty">
        Todavía no hay estaciones guardadas.
      </span>
    `;

    return;
  }

  savedList.innerHTML = stations.map(station => `
    <button
      type="button"
      data-host="${station.host}"
      data-port="${station.port}"
    >
      ✓ ${station.host}:${station.port}
    </button>
  `).join("");

  savedList.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      hostInput.value = button.dataset.host;
      portInput.value = button.dataset.port;

      openReaper(
        button.dataset.host,
        button.dataset.port
      );
    });
  });
}

function prepareNetwork() {
  const prefix = String(networkPrefixInput.value || "")
    .trim()
    .replace(/\.$/, "");

  if (!isValidPrefix(prefix)) {
    showMessage(
      "Escribe el prefijo de red correctamente. Ejemplo: 192.168.100"
    );

    networkPrefixInput.focus();

    return;
  }

  hostInput.value = `${prefix}.`;
  hostInput.focus();

  searchText.textContent = "IP preparada";

  showMessage(
    `Completa la IP de tu PC en el campo derecho. Ejemplo: ${prefix}.79`
  );

  setTimeout(() => {
    searchText.textContent = "Usar esta red";
  }, 1500);
}

function openReaper(host, port) {
  const cleanHost = normalizeHost(host);
  const cleanPort = normalizePort(port);

  if (!cleanHost || cleanHost.endsWith(".")) {
    showMessage(
      "Completa la IPv4 de tu PC. Ejemplo: 192.168.100.79"
    );

    hostInput.focus();

    return;
  }

  const reaperUrl = `http://${cleanHost}:${cleanPort}`;

  saveStation(cleanHost, cleanPort);

  showMessage(
    `Abriendo REAPER en ${cleanHost}:${cleanPort}…`
  );

  /*
    El navegador abrirá REAPER directamente.
    No hacemos fetch desde GitHub Pages porque Chrome bloquea
    las verificaciones HTTPS → HTTP local.
  */
  window.location.assign(reaperUrl);
}

searchBtn.addEventListener("click", prepareNetwork);

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

window.addEventListener("load", () => {
  portInput.value = DEFAULT_REAPER_PORT;

  renderSavedStations();

  showMessage(
    "Escribe el prefijo de tu red y pulsa Usar esta red."
  );
});