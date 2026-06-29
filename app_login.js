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
function renderLoginOverlay() {
  // Jika elemen sudah ada, jangan buat lagi
  if (document.getElementById("loginOverlay")) return;

  var html =
    '<div id="loginOverlay" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.95); z-index: 99999; display: flex; align-items: center; justify-content: center;">' +
    '<div style="background: var(--card, #fff); padding: 2rem; border-radius: 12px; width: 100%; max-width: 380px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">' +
    '<div style="text-align: center; margin-bottom: 1.5rem">' +
    '<i class="fa-solid fa-building-columns" style="font-size: 2.5rem; color: var(--accent, #3b82f6); margin-bottom: 0.5rem;"></i>' +
    '<h2 style="margin: 0; font-size: 1.3rem">Sistem Pembukuan</h2>' +
    '<p style="margin: 0; font-size: 0.8rem; color: var(--muted, #6b7280)">Masuk ke akun cabang Anda</p>' +
    "</div>" +
    '<div id="loginError" style="display: none; background: #fef2f2; color: #dc2626; padding: 0.6rem; border-radius: 6px; font-size: 0.8rem; margin-bottom: 1rem; text-align: center;"></div>' +
    '<div class="fg" style="margin-bottom: 1rem">' +
    "<label>Username</label>" +
    '<input type="text" id="loginUser" placeholder="Masukkan username" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #d1d5db;" />' +
    "</div>" +
    '<div class="fg" style="margin-bottom: 1.2rem">' +
    "<label>Password</label>" +
    '<input type="password" id="loginPass" placeholder="Masukkan password" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #d1d5db;" />' +
    "</div>" +
    '<button id="btnLogin" class="btn btn-a" style="width: 100%; padding: 12px; font-size: 1rem; font-weight: bold" onclick="doLogin()">' +
    '<i class="fa-solid fa-right-to-bracket"></i> MASUK' +
    "</button>" +
    "</div>" +
    "</div>";

  // Suntikkan HTML login ke dalam elemen body
  document.body.insertAdjacentHTML("beforeend", html);
}
