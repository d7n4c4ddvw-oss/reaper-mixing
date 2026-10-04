const DEFAULT_REAPER_PORT = 8080;
const MIXER_PAGE = "mix.html";
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

  const isPrivate192 =
    /^192\.168\.\d{1,3}$/.test(prefix);

  const isPrivate10 =
    /^10\.\d{1,3}\.\d{1,3}$/.test(prefix);

  const isPrivate172 =
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}$/.test(prefix);

  return isPrivate192 || isPrivate10 || isPrivate172;
}

function getBaseUrl(host, port) {
  return `http://${normalizeHost(host)}:${validPort(port)}`;
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

function showProgress(current, total, prefix) {
  const percent = Math.round((current / total) * 100);

  results.innerHTML = `
    <div class="scan-progress">
      <strong>Buscando REAPER en ${escapeHTML(prefix)}.x</strong>

      <span>
        Revisando ${current} de ${total} direcciones…
      </span>

      <div class="scan-progress-bar">
        <i style="width:${percent}%"></i>
      </div>
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

  const serverKey = `${cleanHost}:${cleanPort}`;

  const updated = getSavedServers()
    .filter(server => {
      return `${server.host}:${server.port}` !== serverKey;
    });

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
    savedList.innerHTML = `
      <span class="saved-empty">
        Todavía no hay estaciones guardadas.
      </span>
    `;

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

function renderServer(host, port, label = "REAPER encontrado") {
  const cleanHost = normalizeHost(host);
  const cleanPort = validPort(port);

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
  La forma más útil de detectar REAPER:

  Intentamos cargar /main.js de REAPER.
  Si carga, esa IP está exponiendo la Web Interface.

  No usamos fetch no-cors porque puede responder opaque
  incluso en servidores que no son REAPER.
*/
function probeReaper(host, port, timeoutMs = 750) {
  return new Promise(resolve => {
    const script = document.createElement("script");
    const url =
      `${getBaseUrl(host, port)}/main.js?scan=${Date.now()}`;

    let finished = false;

    function finish(found) {
      if (finished) {
        return;
      }

      finished = true;

      clearTimeout(timer);

      script.onload = null;
      script.onerror = null;

      script.remove();

      resolve(found);
    }

    const timer = window.setTimeout(() => {
      finish(false);
    }, timeoutMs);

    script.async = true;
    script.src = url;

    script.onload = () => {
      finish(true);
    };

    script.onerror = () => {
      finish(false);
    };

    document.head.appendChild(script);
  });
}

async function searchLocalNetwork() {
  if (isSearching) {
    return;
  }

  const prefix = String(networkPrefixInput.value || "")
    .trim()
    .replace(/\.$/, "");

  if (!validPrefix(prefix)) {
    showEmpty(
      "Escribe los primeros tres bloques de tu red. Ejemplo: 192.168.100",
      icons.alert
    );

    networkPrefixInput.focus();

    return;
  }

  const port = validPort(portInput.value);

  isSearching = true;

  searchBtn.disabled = true;
  searchBtn.classList.add("loading");

  searchText.textContent = "Buscando REAPER…";

  const hosts = [];

  for (let lastNumber = 2; lastNumber <= 254; lastNumber += 1) {
    hosts.push(`${prefix}.${lastNumber}`);
  }

  let foundHost = "";

  try {
    /*
      Busca 12 IPs al mismo tiempo.
      Esto es más rápido, pero no satura el celular.
    */
    const batchSize = 12;

    for (
      let start = 0;
      start < hosts.length;
      start += batchSize
    ) {
      const batch = hosts.slice(start, start + batchSize);

      const progress =
        Math.min(start + batch.length, hosts.length);

      showProgress(progress, hosts.length, prefix);

      const batchResults = await Promise.all(
        batch.map(host => probeReaper(host, port))
      );

      const foundIndex = batchResults.findIndex(Boolean);

      if (foundIndex !== -1) {
        foundHost = batch[foundIndex];
        break;
      }
    }

    if (!foundHost) {
      showEmpty(
        "No encontré REAPER automáticamente.<br>" +
        "Verifica que el celular y la PC estén en la misma Wi‑Fi, REAPER esté abierto y la Web Interface use el puerto 8080.",
        icons.alert
      );

      return;
    }

    hostInput.value = foundHost;
    portInput.value = port;

    renderServer(
      foundHost,
      port,
      "Estación REAPER encontrada"
    );
  } catch (error) {
    console.error(error);

    showEmpty(
      "Chrome bloqueó la búsqueda en red local. Si aparece un aviso de permiso de red, selecciona Permitir. También puedes usar la conexión manual.",
      icons.alert
    );
  } finally {
    isSearching = false;

    searchBtn.disabled = false;
    searchBtn.classList.remove("loading");

    searchText.textContent =
      "Buscar REAPER en la red local";
  }
}

async function connect(host, port) {
  const cleanHost = normalizeHost(host);
  const cleanPort = validPort(port);

  if (!cleanHost) {
    hostInput.focus();

    showEmpty(
      "Escribe la dirección IPv4 de tu PC. Ejemplo: 192.168.100.79",
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

  const available = await probeReaper(
    cleanHost,
    cleanPort,
    2500
  );

  connectBtn.disabled = false;
  connectBtn.innerHTML = originalButton;

  if (!available) {
    showEmpty(
      `No respondió ${escapeHTML(cleanHost)}:${cleanPort}.<br>` +
      "Revisa IP, Wi‑Fi, Firewall de Windows, REAPER y puerto 8080.",
      icons.alert
    );

    return;
  }

  saveServer(cleanHost, cleanPort);

  renderServer(
    cleanHost,
    cleanPort,
    "REAPER listo para abrir"
  );

  /*
    Espera un instante solo para que se vea el resultado.
    Luego abre mix.html y le pasa host/puerto.
  */
window.location.href = getReaperUrl(
  cleanHost,
  cleanPort
);

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