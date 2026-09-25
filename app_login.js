// Variabel penampung PIN digital lock sementara
let currentPinInput = "";

function pressKey(num) {
  if (currentPinInput.length < 12) {
    currentPinInput += num;
    updateLockDisplay();
  }
}

function backspaceLock() {
  currentPinInput = currentPinInput.slice(0, -1);
  updateLockDisplay();
}

function clearLock() {
  currentPinInput = "";
  updateLockDisplay();
}

function updateLockDisplay() {
  const displayEl = document.getElementById("lockScreenDisplay");
  const hiddenPasswordInput = document.getElementById("password");

  if (hiddenPasswordInput) {
    hiddenPasswordInput.value = currentPinInput;
  }

  if (currentPinInput.length === 0) {
    displayEl.textContent = "____";
    displayEl.style.color = "#00ffcc";
  } else {
    displayEl.textContent = "• ".repeat(currentPinInput.length).trim();
    displayEl.style.color = "#22c55e";
  }
}

// Fungsi reset yang dipanggil otomatis jika login gagal
window.resetLoginSlider = function () {
  currentPinInput = "";
  updateLockDisplay();
};

async function loginSystem() {
  const u = document.getElementById("username").value;
  const p = document.getElementById("password").value;

  if (!u || !p) {
    if (typeof toast === "function")
      toast("Username dan PIN harus diisi", "err");
    else alert("Username dan PIN harus diisi");
    return;
  }

  if (typeof showLoading === "function") showLoading();

  try {
   // const res = await fetch("http://localhost:3000/api/login", {
const res = await fetch("/api/login", {

      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
    });

    const contentType = res.headers.get("content-type");
    if (!res.ok || !contentType || !contentType.includes("application/json")) {
      if (typeof hideLoading === "function") hideLoading();
      if (typeof toast === "function") {
        toast("Server tidak merespon dengan benar (404/500)", "err");
      } else {
        alert("Gagal: Endpoint API tidak ditemukan atau server bermasalah.");
      }
      return;
    }

    const data = await res.json();

    if (data.success) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("nama", data.user.nama);
      localStorage.setItem("cabang", data.user.kode_cabang);
      localStorage.setItem("role", data.user.role);
      localStorage.setItem("group", data.user.group);
      localStorage.setItem("gambar_group", data.user.gambar_group);

      if (typeof toast === "function") {
        toast("Login Berhasil! Cabang: " + data.user.kode_cabang, "ok");
      } else {
        alert("Login Berhasil! Cabang: " + data.user.kode_cabang);
      }

      document.getElementById("loginBox").style.display = "none";

      if (data.user.role === "Viewer") {
        setTimeout(function () {
          window.location.href = "laporan.html";
        }, 500);
        return;
      }

      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      if (typeof hideLoading === "function") hideLoading();
      if (typeof toast === "function") toast("Gagal: " + data.message, "err");
      else alert("Gagal: " + data.message);

      if (typeof window.resetLoginSlider === "function") {
        window.resetLoginSlider();
      }
    }
  } catch (error) {
    if (typeof hideLoading === "function") hideLoading();
    console.error("Login error:", error);
    if (typeof toast === "function")
      toast("Terjadi kesalahan koneksi server", "err");

    if (typeof window.resetLoginSlider === "function") {
      window.resetLoginSlider();
    }
  }
}

function doLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("nama");
  localStorage.removeItem("cabang");
  localStorage.removeItem("role");
  localStorage.removeItem("group");
  localStorage.removeItem("gambar_group");

  if (typeof toast === "function") {
    toast("Berhasil logout, mengalihkan ke Dashboard...", "ok");
  }

  setTimeout(() => {
    window.location.href = "index.html";
  }, 800);
}

function refreshApp() {
  if (typeof navigate === "function" && typeof currentPanel !== "undefined") {
    showLoading();
    setTimeout(() => {
      navigate(currentPanel);
      hideLoading();
      toast("Data berhasil diperbarui", "ok");
    }, 300);
  } else {
    window.location.reload();
  }
}

document.addEventListener("DOMContentLoaded", function () {
  var btnToggle = document.getElementById("btnToggleMenu");
  var btnHamburger = document.getElementById("btnHamburger");
  var sidebar = document.getElementById("sidebar");
  var iconToggle = btnToggle.querySelector("i");

  function hideMenu() {
    sidebar.classList.add("hidden-menu");
    sidebar.classList.remove("open");
    iconToggle.classList.remove("fa-angles-left");
    iconToggle.classList.add("fa-angles-right");
  }

  function showMenu() {
    sidebar.classList.remove("hidden-menu");
    iconToggle.classList.remove("fa-angles-right");
    iconToggle.classList.add("fa-angles-left");
  }

  btnToggle.addEventListener("click", function () {
    if (sidebar.classList.contains("hidden-menu")) {
      showMenu();
    } else {
      hideMenu();
    }
  });

  btnHamburger.addEventListener("click", function (e) {
    e.stopPropagation();
    if (sidebar.classList.contains("hidden-menu")) {
      showMenu();
    } else {
      sidebar.classList.toggle("open");
    }
  });

  document.addEventListener("click", function (e) {
    if (
      window.innerWidth <= 768 &&
      sidebar.classList.contains("open") &&
      !sidebar.contains(e.target) &&
      !btnHamburger.contains(e.target)
    ) {
      sidebar.classList.remove("open");
    }
  });
});
