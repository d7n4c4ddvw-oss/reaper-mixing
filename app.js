const DEFAULT_REAPER_PORT = 8080;
const REAPER_MIXER_PAGE = "/mix.html";
const STORAGE_KEY = "multitracks-remote-reaper-hosts";

const searchBtn = document.getElementById("searchBtn");
const searchText = document.getElementById("searchText");
const results = document.getElementById("results");

const hostInput = document.getElementById("hostInput");
const portInput = document.getElementById("portInput");
const connectBtn = document.getElementById("connectBtn");
const savedList = document.getElementById("savedList");

let isSearching = false;

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
      <rect x="3" y="4" width="18" height="13" rx="2"></rect>
      <path d="M8 21h8"></path>
      <path d="M12 17v4"></path>
      <path d="M7 10h.01"></path>
      <path d="M12 10h.01"></path>
      <path d="M17 10h.01"></path>
    </svg>
  `
};

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
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

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return DEFAULT_REAPER_PORT;
  }

  return port;
}

function getBaseUrl(host, port) {
  return `http://${host}:${port}`;
}

function getMixerUrl(host, port) {
  return `${getBaseUrl(host, port)}${REAPER_MIXER_PAGE}`;
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
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    if (!Array.isArray(saved)) {
      return [];
    }

    return saved.filter(server =>
      server &&
      typeof server.host === "string" &&
      Number.isFinite(Number(server.port))
    );
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

  const updated = getSavedServers()
    .filter(server => `${server.host}:${server.port}` !== key);

  updated.unshift({
    host: cleanHost,
    port: cleanPort,
    lastUsed: Date.now()
  });

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(updated.slice(0, 10))
  );

  renderSavedServers();
}

function renderSavedServers() {
  const saved = getSavedServers();

  if (!saved.length) {
    savedList.innerHTML = "";
    return;
  }

  savedList.innerHTML = saved.map(server => `
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

function renderServer(host, port, label = "Estación REAPER disponible") {
  const cleanHost = normalizeHost(host);
  const cleanPort = validPort(port);

  if (!cleanHost) {
    return;
  }

  results.innerHTML = "";

  const item = document.createElement("article");

  item.className = "server-card";
  item.dataset.server = `${cleanHost}:${cleanPort}`;

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

  item.querySelector(".connect-button").addEventListener("click", () => {
    connect(cleanHost, cleanPort);
  });

  results.appendChild(item);
}

/*
  Prueba si existe un servidor HTTP en el host y puerto indicado.

  El navegador no puede asegurar que sea REAPER por CORS,
  pero sí puede indicar que el host respondió por HTTP.
*/
async function probe(host, port, timeout = 1800) {
  const controller = new AbortController();

  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    await fetch(`${getBaseUrl(host, port)}/`, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal
    });

    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/*
  Solo prueba direcciones útiles.
  No escanea decenas de IPs y por eso no llena la pantalla
  de falsos resultados.
*/
function candidateHosts() {
  const hosts = [];

  const typedHost = normalizeHost(hostInput.value);
  const currentHost = location.hostname;

  /*
    Primero prueba la IP que escribió el usuario.
  */
  if (typedHost) {
    hosts.push(typedHost);
  }

  /*
    Si la web fue abierta desde una IP de LAN, también la prueba.
  */
  if (
    currentHost &&
    currentHost !== "localhost" &&
    currentHost !== "127.0.0.1"
  ) {
    hosts.push(currentHost);
  }

  /*
    Solo para probar desde la misma PC.
  */
  hosts.push("localhost", "127.0.0.1");

  return [...new Set(hosts)];
}

async function searchLocalNetwork() {
  if (isSearching) {
    return;
  }

  isSearching = true;

  const port = validPort(portInput.value);
  const hosts = candidateHosts();

  searchBtn.disabled = true;
  searchBtn.classList.add("loading");
  searchText.textContent = "Verificando estación REAPER…";

  showEmpty(
    "Comprobando las direcciones disponibles…",
    icons.clock
  );

  let foundHost = null;

  for (const host of hosts) {
    searchText.textContent = `Verificando ${host}:${port}…`;

    const online = await probe(host, port);

    if (online) {
      foundHost = host;
      break;
    }
  }

  isSearching = false;

  searchBtn.disabled = false;
  searchBtn.classList.remove("loading");
  searchText.textContent = "Buscar REAPER en la red local";

  if (!foundHost) {
    showEmpty(
      "No se encontró REAPER automáticamente.<br>" +
      "Escribe la dirección IPv4 de tu PC y pulsa conectar.",
      icons.alert
    );

    return;
  }

  const isLocal =
    foundHost === "localhost" ||
    foundHost === "127.0.0.1";

  renderServer(
    foundHost,
    port,
    isLocal
      ? "REAPER local en este PC"
      : "Estación REAPER disponible"
  );
}

async function connect(host, port) {
  const cleanHost = normalizeHost(host);
  const cleanPort = validPort(port);

  if (!cleanHost) {
    hostInput.focus();

    showEmpty(
      "Escribe la dirección IPv4 de tu PC.<br>" +
      "Ejemplo: 192.168.1.20",
      icons.alert
    );

    return;
  }

  const originalButton = connectBtn.innerHTML;

  connectBtn.disabled = true;
  connectBtn.innerHTML = `
    ${icons.clock}
    Verificando conexión…
  `;

  showEmpty(
    `Conectando con ${escapeHTML(cleanHost)}:${cleanPort}…`,
    icons.network
  );

  const online = await probe(cleanHost, cleanPort, 2300);

  connectBtn.disabled = false;
  connectBtn.innerHTML = originalButton;

  if (!online) {
    showEmpty(
      `No respondió <strong>${escapeHTML(cleanHost)}:${cleanPort}</strong>.<br>` +
      "Revisa la IP, el puerto 8080, el Wi‑Fi y el Firewall de Windows.",
      icons.alert
    );

    return;
  }

  saveServer(cleanHost, cleanPort);

  renderServer(
    cleanHost,
    cleanPort,
    "REAPER listo para conectar"
  );

  /*
    IMPORTANTE:
    La web propia puede estar en puerto 5500,
    pero el mixer de REAPER siempre abre por puerto 8080.
  */
  window.setTimeout(() => {
    window.location.href = getMixerUrl(cleanHost, cleanPort);
  }, 300);
}

searchBtn.addEventListener("click", searchLocalNetwork);

connectBtn.addEventListener("click", () => {
  connect(hostInput.value, portInput.value);
});

hostInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    connect(hostInput.value, portInput.value);
  }
});

portInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    connect(hostInput.value, portInput.value);
  }
});

window.addEventListener("load", () => {
  renderSavedServers();

  /*
    IMPORTANTE:
    No usamos location.port porque esta web propia corre por 5500.
    REAPER usa 8080 por defecto.
  */
  portInput.value = DEFAULT_REAPER_PORT;

  showEmpty(
    "Pulsa buscar o escribe la dirección IPv4 de tu PC para conectar con REAPER.",
    icons.clock
  );
});