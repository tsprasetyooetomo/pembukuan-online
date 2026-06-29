// ================================================================
// SISTEM LOGIN FRONTEND
// ================================================================
var AUTH_TOKEN = localStorage.getItem("authToken") || null;
var CURRENT_USER = JSON.parse(localStorage.getItem("currentUser") || "null");

// Cek sesi saat halaman dimuat
function checkAuth() {
  if (!AUTH_TOKEN || !CURRENT_USER) {
    document.getElementById("loginOverlay").style.display = "flex";
    return false;
  }
  document.getElementById("loginOverlay").style.display = "none";
  return true;
}

// Fungsi Login
async function doLogin() {
  var username = document.getElementById("loginUser").value.trim();
  var password = document.getElementById("loginPass").value.trim();
  var errBox = document.getElementById("loginError");

  if (!username || !password) {
    errBox.style.display = "block";
    errBox.innerText = "Username dan Password wajib diisi!";
    return;
  }

  try {
    var res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    var data = await res.json();

    if (data.success) {
      AUTH_TOKEN = data.token;
      CURRENT_USER = data.user;
      localStorage.setItem("authToken", AUTH_TOKEN);
      localStorage.setItem("currentUser", JSON.stringify(CURRENT_USER));

      // Sembunyikan overlay login
      document.getElementById("loginOverlay").style.display = "none";

      // Load ulang panel utama
      navigate(currentPanel);
      toast("Selamat datang, " + CURRENT_USER.nama, "ok");
    } else {
      errBox.style.display = "block";
      errBox.innerText = data.message || "Login gagal!";
    }
  } catch (e) {
    errBox.style.display = "block";
    errBox.innerText = "Tidak dapat terhubung ke server";
  }
}

// Override fungsi fetch bawaan agar selalu menyertakan Token
var originalFetch = window.fetch;
window.fetch = function (url, options = {}) {
  if (AUTH_TOKEN && url.startsWith("/api")) {
    if (!options.headers) options.headers = {};
    options.headers["Authorization"] = "Bearer " + AUTH_TOKEN;
  }
  return originalFetch(url, options);
};

// Fungsi Logout
async function doLogout() {
  try {
    await fetch("/api/logout", { method: "POST" });
  } catch (e) {}

  AUTH_TOKEN = null;
  CURRENT_USER = null;
  localStorage.removeItem("authToken");
  localStorage.removeItem("currentUser");

  checkAuth(); // Tampilkan kembali layar login
}

// Panggil saat load
checkAuth();
