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
  `,

  network: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
      <path d="M8.5 16a6 6 0 0 1 7 0"></path>
      <path d="M12 20h.01"></path>
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

function validPort(value) {
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

function validPrefix(value) {
  const prefix = String(value || "")
    .trim()
    .replace(/\.$/, "");

  return (
    /^192\.168\.\d{1,3}$/.test(prefix) ||
    /^10\.\d{1,3}\.\d{1,3}$/.test(prefix) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}$/.test(prefix)
  );
}

function getReaperUrl(host, port) {
  const cleanHost = normalizeHost(host);
  const cleanPort = validPort(port);

  return `http://${cleanHost}:${cleanPort}`;
}

function showEmpty(message, icon = icons.clock) {
  results.innerHTML = `
    <div class="empty-state">
      ${icon}
      <span>${message}</span>
    </div>
  `;
}

function getSavedServers() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    if (!Array.isArray(saved)) {
      return [];
    }

    return saved.filter(server => {
      return server &&
        typeof server.host === "string" &&
        Number.isFinite(Number(server.port));
    });
  } catch {
    return [];
  }
}

function saveServer(host, port) {
  const cleanHost = normalizeHost(host);
  const cleanPort = validPort(port);

  if (!cleanHost) {
    return;
  }

  const key = `${cleanHost}:${cleanPort}`;

  const servers = getSavedServers()
    .filter(server => {
      return `${server.host}:${server.port}` !== key;
    });

  servers.unshift({
    host: cleanHost,
    port: cleanPort,
    lastUsed: Date.now()
  });

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(servers.slice(0, 10))
  );

  renderSavedServers();
}

function renderSavedServers() {
  const servers = getSavedServers();

  if (!servers.length) {
    savedList.innerHTML = `
      <span class="saved-empty">
        Todavía no hay estaciones guardadas.
      </span>
    `;

    return;
  }

  savedList.innerHTML = servers.map(server => `
    <button
      type="button"
      data-host="${escapeHTML(server.host)}"
      data-port="${server.port}"
      title="Conectar a ${escapeHTML(server.host)}:${server.port}"
    >
      ${icons.check}
      ${escapeHTML(server.host)}:${server.port}
    </button>
  `).join("");

  savedList.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      const host = button.dataset.host;
      const port = Number(button.dataset.port);

      hostInput.value = host;
      portInput.value = port;

      connect(host, port);
    });
  });
}

function renderServer(host, port, label = "REAPER encontrado") {
  const cleanHost = normalizeHost(host);
  const cleanPort = validPort(port);

  if (!cleanHost) {
    return;
  }

  results.innerHTML = "";

  const item = document.createElement("article");

  item.className = "server-card";

  item.innerHTML = `
    <div class="server-icon">
      ${icons.workstation}
    </div>

    <div class="server-info">
      <strong>${escapeHTML(label)}</strong>
      <small>${escapeHTML(cleanHost)}:${cleanPort}</small>
    </div>

    <button class="connect-button" type="button">
      ${icons.connect}
      Conectar
    </button>
  `;

  item.querySelector(".connect-button")
    .addEventListener("click", () => {
      connect(cleanHost, cleanPort);
    });

  results.appendChild(item);
}

/*
  GitHub Pages usa HTTPS. Chrome bloquea escanear
  automáticamente toda la red local HTTP.

  Este botón prepara el campo de IP correctamente.
  Luego solo escribes el último número de la PC.

  Ejemplo:
  Red: 192.168.100
  Resultado: 192.168.100.
  Agregas: 79
*/
function searchLocalNetwork() {
  const prefix = String(networkPrefixInput.value || "")
    .trim()
    .replace(/\.$/, "");

  if (!validPrefix(prefix)) {
    showEmpty(
      "Escribe los tres primeros bloques de tu red. Ejemplo: 192.168.100",
      icons.alert
    );

    networkPrefixInput.focus();

    return;
  }

  hostInput.value = `${prefix}.`;
  hostInput.focus();

  showEmpty(
    `Chrome no permite escanear automáticamente todos los dispositivos desde una página pública.<br><br>` +
    `Completa la dirección de tu PC en la conexión directa. Ejemplo: <strong>${escapeHTML(prefix)}.79</strong>`,
    icons.alert
  );
}

function connect(host, port) {
  const cleanHost = normalizeHost(host);
  const cleanPort = validPort(port);

  if (!cleanHost || cleanHost.endsWith(".")) {
    hostInput.focus();

    showEmpty(
      "Completa la IPv4 de tu PC. Ejemplo: 192.168.100.79",
      icons.alert
    );

    return;
  }

  const originalButton = connectBtn.innerHTML;

  connectBtn.disabled = true;

  connectBtn.innerHTML = `
    ${icons.clock}
    Abriendo REAPER…
  `;

  renderServer(
    cleanHost,
    cleanPort,
    "Abriendo Web Interface de REAPER"
  );

  saveServer(cleanHost, cleanPort);

  /*
    No usamos fetch ni probe aquí.
    Una página HTTPS de GitHub no puede verificar de forma fiable
    un servidor HTTP local. Navegar directamente sí funciona.
  */
  window.setTimeout(() => {
    window.location.href =
      getReaperUrl(cleanHost, cleanPort);
  }, 250);

  window.setTimeout(() => {
    connectBtn.disabled = false;
    connectBtn.innerHTML = originalButton;
  }, 1000);
}

searchBtn.addEventListener("click", searchLocalNetwork);

connectBtn.addEventListener("click", () => {
  connect(
    hostInput.value,
    portInput.value
  );
});

hostInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    connect(
      hostInput.value,
      portInput.value
    );
  }
});

portInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    connect(
      hostInput.value,
      portInput.value
    );
  }
});

networkPrefixInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    searchLocalNetwork();
  }
});

window.addEventListener("load", () => {
  portInput.value = DEFAULT_REAPER_PORT;

  renderSavedServers();

  showEmpty(
    "Escribe el prefijo de tu red y pulsa Buscar REAPER.",
    icons.clock
  );
});