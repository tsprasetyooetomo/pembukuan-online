// Intercept semua error dan tampilkan ke layar + Simpan History
(function () {
  var termEl = document.getElementById("debugTerminal");
  var logsEl = document.getElementById("debugLogs");
  const STORAGE_KEY = "debug_terminal_history";

  if (!termEl) return;

  // =========================================================================
  // ✅ 1. ATUR CSS TERMINAL (MINIMALIS & RESPONSIV)
  // =========================================================================
  termEl.style.position = "fixed";
  termEl.style.top = "10px";
  termEl.style.right = "10px";
  termEl.style.width = "320px"; /* Diperkecil lebarnya */
  termEl.style.height = "350px"; /* Diperkecil tingginya */
  termEl.style.maxHeight = "90vh";
  termEl.style.zIndex = "99999";
  termEl.style.display = "flex";
  termEl.style.flexDirection = "column";
  termEl.style.transition = "height 0.2s ease";
  termEl.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)";
  termEl.style.fontSize = "11px"; /* Font lebih kecil */
  termEl.style.fontFamily = "monospace";

  if (logsEl) {
    logsEl.style.flex = "1";
    logsEl.style.overflowY = "auto";
    logsEl.style.padding = "5px";
  }

  // =========================================================================
  // ✅ 2. LOGIKA MOVABLE / DRAGGABLE (KIRI & KANAN)
  // =========================================================================
  var headerEl = termEl.querySelector(".dbg-header");
  if (headerEl) {
    headerEl.style.cursor = "move";
    headerEl.style.display = "flex";
    headerEl.style.alignItems = "center";
    headerEl.style.padding = "4px 8px";

    var isDragging = false;
    var startX = 0;
    var initialRight = 0;

    headerEl.addEventListener("mousedown", function (e) {
      if (e.target.tagName === "BUTTON") return; /* Abaikan klik tombol */
      isDragging = true;
      startX = e.clientX;
      initialRight = window.innerWidth - termEl.getBoundingClientRect().right;
      document.body.style.userSelect = "none";
    });

    window.addEventListener("mousemove", function (e) {
      if (!isDragging) return;
      var deltaX = e.clientX - startX;
      var newRight = initialRight - deltaX;
      var maxRight = window.innerWidth - termEl.offsetWidth;
      if (newRight < 0) newRight = 0;
      if (newRight > maxRight) newRight = maxRight;

      termEl.style.right = newRight + "px";
      termEl.style.left = "auto";
    });

    window.addEventListener("mouseup", function () {
      if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = "auto";
      }
    });
  }

  // =========================================================================
  // ✅ 3. MANAJEMEN RIWAYAT LOG (DENGAN URUTAN YANG BENAR)
  // =========================================================================
  function loadHistory() {
    if (!logsEl) return;
    var savedLogs = localStorage.getItem(STORAGE_KEY);
    if (savedLogs) {
      try {
        var logsArray = JSON.parse(savedLogs);
        logsEl.innerHTML = "";
        /* Loop dari belakang ke depan agar urutan prepend konsisten */
        for (var i = logsArray.length - 1; i >= 0; i--) {
          var logItem = logsArray[i];
          var line = document.createElement("div");
          line.className = logItem.isError ? "dbg-line dbg-err" : "dbg-line";
          line.textContent = logItem.text;
          logsEl.prepend(line);
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }

  function saveToHistory(text, isError) {
    try {
      var savedLogs = localStorage.getItem(STORAGE_KEY);
      var logsArray = savedLogs ? JSON.parse(savedLogs) : [];

      logsArray.unshift({ text: text, isError: isError });

      if (logsArray.length > 200) {
        logsArray = logsArray.slice(0, 200);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(logsArray));
    } catch (e) {}
  }

  loadHistory();

  // =========================================================================
  // ✅ 4. JAM REALTIME & NAVIGASI (MINIMIZE, CLOSE, CLEAR)
  // =========================================================================
  var titleSpan = headerEl ? headerEl.querySelector("span") : null;
  if (titleSpan) {
    var clockSpan = document.createElement("span");
    clockSpan.id = "dbgLiveClock";
    clockSpan.style.cssText =
      "margin-left: 6px; color: #38bdf8; font-size:10px;";
    clockSpan.textContent = "--:--:--";
    titleSpan.appendChild(clockSpan);

    setInterval(function () {
      var now = new Date();
      var h = String(now.getHours()).padStart(2, "0");
      var m = String(now.getMinutes()).padStart(2, "0");
      var s = String(now.getSeconds()).padStart(2, "0");
      clockSpan.textContent = h + ":" + m + ":" + s;
    }, 1000);

    // Container Tombol Aksi
    var btnContainer = document.createElement("div");
    btnContainer.style.cssText =
      "margin-left: auto; display: flex; gap: 4px; align-items: center;";

    // Tombol Clear Log
    var clearBtn = document.createElement("button");
    clearBtn.textContent = "🗑️";
    clearBtn.title = "Clear Log";
    clearBtn.style.cssText =
      "background:none; border:none; cursor:pointer; font-size:11px; padding:2px;";
    clearBtn.onclick = function () {
      if (confirm("Hapus semua riwayat log debug?")) {
        localStorage.removeItem(STORAGE_KEY);
        if (logsEl) logsEl.innerHTML = "";
      }
    };
    btnContainer.appendChild(clearBtn);

    // Tombol Minimize
    var minBtn = document.createElement("button");
    minBtn.textContent = "➖";
    minBtn.title = "Minimize";
    minBtn.style.cssText =
      "background:none; border:none; cursor:pointer; font-size:10px; padding:2px;";
    var isMinimized = false;
    minBtn.onclick = function () {
      if (!isMinimized) {
        termEl.style.height = "30px"; /* Hanya menyisakan header */
        if (logsEl) logsEl.style.display = "none";
        minBtn.textContent = "🔲";
      } else {
        termEl.style.height = "350px";
        if (logsEl) logsEl.style.display = "block";
        minBtn.textContent = "➖";
      }
      isMinimized = !isMinimized;
    };
    btnContainer.appendChild(minBtn);

    // Tombol Close
    var closeBtn = document.createElement("button");
    closeBtn.textContent = "❌";
    closeBtn.title = "Tutup Terminal";
    closeBtn.style.cssText =
      "background:none; border:none; cursor:pointer; font-size:10px; padding:2px;";
    closeBtn.onclick = function () {
      if (
        confirm(
          "Tutup terminal debug? (Muat ulang halaman untuk memunculkan kembali)",
        )
      ) {
        termEl.style.display = "none";
      }
    };
    btnContainer.appendChild(closeBtn);

    headerEl.appendChild(btnContainer);
  }

  function showDbg(msg, isError) {
    if (!termEl || !logsEl || termEl.style.display === "none") return;

    var timestamp = new Date().toLocaleTimeString();
    var fullText = (isError ? "❌ " : "✅ ") + timestamp + " | " + msg;

    var line = document.createElement("div");
    line.className = isError ? "dbg-line dbg-err" : "dbg-line";
    line.style.padding = "2px 4px";
    line.style.borderBottom = "1px solid #334155";
    line.textContent = fullText;
    logsEl.prepend(line);

    saveToHistory(fullText, isError);
  }

  // =========================================================================
  // ✅ 5. INTERCEPTOR & INTERFACE ERROR OVERRIDE
  // =========================================================================
  window.onerror = function (msg, url, lineNo, columnNo, error) {
    showDbg("ERR: " + msg + " (L:" + lineNo + ")", true);
    return false;
  };

  window.addEventListener("unhandledrejection", function (event) {
    showDbg("PROMISE ERR: " + event.reason, true);
  });

  var originalErr = console.error;
  console.error = function () {
    var msg = Array.from(arguments).join(" ");
    showDbg(msg, true);
    originalErr.apply(console, arguments);
  };

  var originalLog = console.log;
  console.log = function () {
    var msg = Array.from(arguments).join(" ");
    showDbg(msg, false);
    originalLog.apply(console, arguments);
  };

  console.log("Debug Terminal Aktif.");
  console.log("Navigate ke 6: " + currentPanel);
})();
