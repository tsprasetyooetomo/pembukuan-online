/**
 * ============================================================================
 * MODUL: IMPOR DATA FOXPRO (DBF) KE POSTGRESQL ONLINE
 * ============================================================================
 * File ini menangani render UI, interaksi file upload, dan mengirim data biner
 * DBF langsung ke cloud server Railway.
 */

const AppImporFoxpro = {
  // Menggunakan origin host saat ini sebagai basis endpoint API Server
  API_URL: window.location.origin + "/api/impor-foxpro-online",

  /**
   * Mengembalikan string struktur HTML untuk di-render oleh fungsi navigate()
   */
  getHTML() {
    return `
      <div class="card" style="max-width: 700px; margin: 1rem auto; padding: 2rem; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
        <h2 style="margin-bottom: 1.5rem; font-family: 'Space Grotesk', sans-serif; font-size: 1.5rem; color: #fff; display: flex; align-items: center; gap: 0.75rem;">
          <i class="fa-solid fa-cloud-arrow-up" style="color: #3b82f6;"></i> Impor File DBF FoxPro Online
        </h2>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem; line-height: 1.5;">
          Fitur ini digunakan untuk mengunggah dan menyinkronkan data keuangan lokal dari FoxPro (.dbf) langsung ke database server cloud PostgreSQL Railway.
        </p>

        <form id="formImporFoxpro">
          <!-- Input Parameter Periode & Masa -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
            <div>
              <label style="display: block; color: #fff; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">Tahun Periode (4 Digit)</label>
              <input type="number" id="impPeriode" placeholder="Contoh: 2026" required min="2000" max="2099"
                style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-family: 'JetBrains Mono', monospace;">
            </div>
            <div>
              <label style="display: block; color: #fff; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">Kode Masa (2 Digit)</label>
              <input type="text" id="impMasa" placeholder="Contoh: 01" required maxlength="2"
                style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-family: 'JetBrains Mono', monospace;">
            </div>
          </div>

          <!-- Input Kode Cabang -->
          <div style="margin-bottom: 2rem;">
            <label style="display: block; color: #fff; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">Kode Cabang (Rest)</label>
            <input type="text" id="impCabang" placeholder="Contoh: 01" required
              style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-family: 'JetBrains Mono', monospace;">
          </div>

          <!-- Upload Area 1: File CDG (Golongan) -->
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: #fff; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">
              File Golongan (<span style="color: #60a5fa; font-family: monospace;">cdg*.dbf</span>)
            </label>
            <div style="position: relative; border: 2px dashed rgba(255,255,255,0.15); border-radius: 6px; padding: 1.5rem; text-align: center; background: rgba(0,0,0,0.1);">
              <input type="file" id="fileCdg" accept=".dbf" required style="position: absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer;">
              <div id="labelCdg" style="color: #94a3b8; font-size: 0.85rem;">
                <i class="fa-solid fa-file-excel" style="font-size: 1.5rem; margin-bottom: 0.5rem; display:block; color: #ef4444;"></i>
                Klik atau jatuhkan file <span style="color:#fff;">cdg*.dbf</span> di sini
              </div>
            </div>
          </div>

          <!-- Upload Area 2: File CDD (Perkiraan) -->
          <div style="margin-bottom: 2.5rem;">
            <label style="display: block; color: #fff; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">
              File Perkiraan (<span style="color: #60a5fa; font-family: monospace;">cdd*.dbf</span>)
            </label>
            <div style="position: relative; border: 2px dashed rgba(255,255,255,0.15); border-radius: 6px; padding: 1.5rem; text-align: center; background: rgba(0,0,0,0.1);">
              <input type="file" id="fileCdd" accept=".dbf" required style="position: absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer;">
              <div id="labelCdd" style="color: #94a3b8; font-size: 0.85rem;">
                <i class="fa-solid fa-file-excel" style="font-size: 1.5rem; margin-bottom: 0.5rem; display:block; color: #10b981;"></i>
                Klik atau jatuhkan file <span style="color:#fff;">cdd*.dbf</span> di sini
              </div>
            </div>
          </div>

          <!-- Tombol Submit -->
          <button type="submit" id="btnSubmitImpor" style="width: 100%; padding: 0.9rem; background: #3b82f6; border: none; border-radius: 4px; color: #fff; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 1rem; transition: opacity 0.2s;">
            <i class="fa-solid fa-cloud-arrow-up"></i> Kirim & Sinkronisasikan Data
          </button>
        </form>
      </div>
    `;
  },

  /**
   * Menginisialisasi event listeners setelah komponen masuk ke dalam DOM pohon HTML
   */
  initEvents() {
    const form = document.getElementById("formImporFoxpro");
    const fileCdg = document.getElementById("fileCdg");
    const fileCdd = document.getElementById("fileCdd");

    if (fileCdg) {
      fileCdg.addEventListener("change", () =>
        this.updateFileName(fileCdg, "labelCdg"),
      );
    }
    if (fileCdd) {
      fileCdd.addEventListener("change", () =>
        this.updateFileName(fileCdd, "labelCdd"),
      );
    }
    if (form) {
      form.addEventListener("submit", (e) => this.handleFormSubmit(e));
    }
  },

  /**
   * Mengubah teks label box dropzone saat file berhasil dipilih oleh user
   */
  updateFileName(inputEl, labelId) {
    const labelEl = document.getElementById(labelId);
    if (inputEl.files && inputEl.files[0]) {
      const file = inputEl.files[0];
      labelEl.innerHTML = `
        <i class="fa-solid fa-file-circle-check" style="font-size: 1.5rem; margin-bottom: 0.5rem; display:block; color: #10b981;"></i>
        <span style="color: #fff; font-weight: 500;">${file.name}</span><br>
        <span style="font-size: 0.75rem; color: #94a3b8;">${(file.size / 1024).toFixed(2)} KB</span>
      `;
    }
  },

  /**
   * Handler Ajax request pengiriman data multi-part form data
   */
  async handleFormSubmit(event) {
    event.preventDefault();

    const btnSubmit = document.getElementById("btnSubmitImpor");
    const loadingOv = document.getElementById("loadingOv"); // Memanfaatkan overlay loader global Anda
    const fileCdgInput = document.getElementById("fileCdg");
    const fileCddInput = document.getElementById("fileCdd");

    // Bungkus data parameter form & biner file kedalam FormData object
    const formData = new FormData();
    formData.append(
      "periode",
      document.getElementById("impPeriode").value.trim(),
    );
    formData.append("masa", document.getElementById("impMasa").value.trim());
    formData.append(
      "kode_cabang",
      document.getElementById("impCabang").value.trim(),
    );
    formData.append("file_cdg", fileCdgInput.files[0]);
    formData.append("file_cdd", fileCddInput.files[0]);

    try {
      // Aktifkan animasi loading spinner core
      if (loadingOv) {
        loadingOv.querySelector("span").innerHTML =
          `<span class="spinner"></span> Mengirim berkas & memproses ke PostgreSQL Cloud...`;
        loadingOv.classList.add("show");
      }
      btnSubmit.disabled = true;
      btnSubmit.style.opacity = "0.5";

      // Eksekusi HTTP Request POST ke Server
      const response = await fetch(this.API_URL, {
        method: "POST",
        body: formData, // Browser akan otomatis mengatur header Content-Type multipart/form-data beserta boundary-nya
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(
          "Sukses! Data FoxPro berhasil tersinkronisasi ke Cloud PostgreSQL.",
        );

        // Memanggil ulang fungsi routing navigasi core untuk mereset komponen form kembali bersih
        if (typeof navigate === "function") {
          navigate("importFoxpro");
        }
      } else {
        throw new Error(
          result.message ||
            result.error ||
            "Gagal melakukan proses sinkronisasi.",
        );
      }
    } catch (err) {
      console.error("Proses sinkronisasi terhenti:", err);
      alert("Gagal Sinkronisasi:\n" + err.message);
    } finally {
      // Kembalikan keadaan tombol dan hilangkan overlay spinner loading
      if (loadingOv) loadingOv.classList.remove("show");
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.style.opacity = "1";
      }
    }
  },
};

// ============================================================================
// REGISTRASI OTOMATIS KE ROUTER CORE (PANEL MAP & AFTER RENDER)
// ============================================================================
if (typeof PANEL_MAP !== "undefined") {
  PANEL_MAP["importFoxpro"] = async function () {
    return AppImporFoxpro.getHTML();
  };
}

if (typeof AFTER_RENDER !== "undefined") {
  AFTER_RENDER["importFoxpro"] = function () {
    AppImporFoxpro.initEvents();
  };
}
