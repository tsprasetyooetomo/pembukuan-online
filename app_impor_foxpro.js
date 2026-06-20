const AppImporFoxpro = {
  API_URL: window.location.origin + "/api/impor-foxpro-online",

  getHTML() {
    let opsiCabang = `<option value="" disabled selected>-- Pilih Cabang --</option>`;
    if (
      typeof DBCache !== "undefined" &&
      DBCache.cabang &&
      DBCache.cabang.length > 0
    ) {
      DBCache.cabang.forEach((c) => {
        let kode = c.kode_cabang || c.kode || c.rest || "";
        let nama = c.nama_cabang || c.nama || "";
        if (kode) {
          opsiCabang += `<option value="${kode}">${kode} - ${nama}</option>`;
        }
      });
    } else {
      opsiCabang += `<option value="" disabled>Data cabang kosong / belum dimuat</option>`;
    }

    return `
      <div class="card" style="max-width: 700px; margin: 1rem auto; padding: 2rem; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); max-height: 90vh; overflow-y: auto;">
        <h2 style="margin-bottom: 1.5rem; font-family: 'Space Grotesk', sans-serif; font-size: 1.5rem; color: #fff; display: flex; align-items: center; gap: 0.75rem; position: sticky; top: 0; background: rgba(20,20,30,0.95); padding: 1rem 0; z-index: 10;">
          <i class="fa-solid fa-cloud-arrow-up" style="color: #3b82f6;"></i> Impor DBF FoxPro 1 Tahun ke Supabase
        </h2>

        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem; line-height: 1.5;">
          Upload file DBF 1 periode tahun. Sistem otomatis proses masa 01 sampai 12. Nggak perlu pilih bulan/kode masa manual.
        </p>

        <form id="formImporFoxpro">
          <!-- Input Tahun -->
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: #fff; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">Tahun Periode (4 Digit)</label>
            <input type="number" id="impPeriode" placeholder="Contoh: 2026" required min="2000" max="2099"
              style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-family: 'JetBrains Mono', monospace;">
            <small style="color: #64748b; font-size: 0.75rem; margin-top: 0.25rem; display: block;">Data akan diproses untuk masa 01-12 tahun ini</small>
          </div>

          <!-- Dropdown Cabang -->
          <div style="margin-bottom: 2rem;">
            <label style="display: block; color: #fff; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">Kode Cabang (Rest)</label>
            <select id="impCabang" required style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-family: 'JetBrains Mono', monospace; cursor: pointer;">
              ${opsiCabang}
            </select>
          </div>

          <!-- Upload CDG -->
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: #fff; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">
              File Golongan <span style="color: #60a5fa; font-family: monospace;">cdg*.dbf</span>
            </label>
            <div style="position: relative; border: 2px dashed rgba(255,255,255,0.15); border-radius: 6px; padding: 1.5rem; text-align: center; background: rgba(0,0,0,0.1);">
              <input type="file" id="fileCdg" accept=".dbf" required style="position: absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer;">
              <div id="labelCdg" style="color: #94a3b8; font-size: 0.85rem;">
                <i class="fa-solid fa-file-excel" style="font-size: 1.5rem; margin-bottom: 0.5rem; display:block; color: #ef4444;"></i>
                Klik atau jatuhkan file cdg*.dbf
              </div>
            </div>
          </div>

          <!-- Upload CDD -->
          <div style="margin-bottom: 2.5rem;">
            <label style="display: block; color: #fff; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">
              File Perkiraan <span style="color: #60a5fa; font-family: monospace;">cdd*.dbf</span>
            </label>
            <div style="position: relative; border: 2px dashed rgba(255,255,255,0.15); border-radius: 6px; padding: 1.5rem; text-align: center; background: rgba(0,0,0,0.1);">
              <input type="file" id="fileCdd" accept=".dbf" required style="position: absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer;">
              <div id="labelCdd" style="color: #94a3b8; font-size: 0.85rem;">
                <i class="fa-solid fa-file-excel" style="font-size: 1.5rem; margin-bottom: 0.5rem; display:block; color: #10b981;"></i>
                Klik atau jatuhkan file cdd*.dbf
              </div>
            </div>
          </div>

          <!-- Info Progress -->
          <div id="progressInfo" style="display: none; margin-bottom: 1.5rem; padding: 1rem; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); border-radius: 4px; color: #60a5fa; font-size: 0.85rem;">
            <i class="fa-solid fa-circle-info"></i> Sistem akan memproses 12 masa: 01-12 untuk tahun yang dipilih
          </div>

          <button type="submit" id="btnSubmitImpor" style="width: 100%; padding: 0.9rem; background: #3b82f6; border: none; border-radius: 4px; color: #fff; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 1rem; transition: opacity 0.2s;">
            <i class="fa-solid fa-cloud-arrow-up"></i> Kirim & Proses 12 Masa Otomatis
          </button>
        </form>
      </div>
    `;
  },

  initEvents() {
    const form = document.getElementById("formImporFoxpro");
    const fileCdg = document.getElementById("fileCdg");
    const fileCdd = document.getElementById("fileCdd");
    const impPeriode = document.getElementById("impPeriode");
    const progressInfo = document.getElementById("progressInfo");

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
    if (impPeriode) {
      impPeriode.addEventListener("input", () => {
        progressInfo.style.display =
          impPeriode.value.length === 4 ? "block" : "none";
      });
    }
    if (form) {
      form.addEventListener("submit", (e) => this.handleFormSubmit(e));
    }
  },

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

  async handleFormSubmit(event) {
    event.preventDefault();

    const btnSubmit = document.getElementById("btnSubmitImpor");
    const loadingOv = document.getElementById("loadingOv");
    const fileCdgInput = document.getElementById("fileCdg");
    const fileCddInput = document.getElementById("fileCdd");
    const periode = document.getElementById("impPeriode").value.trim();
    const kodeCabang = document.getElementById("impCabang").value;

    if (periode.length !== 4) {
      alert("Tahun harus 4 digit");
      return;
    }

    const formData = new FormData();
    formData.append("periode", periode);
    formData.append("kode_cabang", kodeCabang);
    formData.append("file_cdg", fileCdgInput.files[0]);
    formData.append("file_cdd", fileCddInput.files[0]);
    formData.append("auto_masa", "true"); // flag buat backend: proses 01-12

    try {
      if (loadingOv) {
        loadingOv.querySelector("span").innerHTML =
          `<span class="spinner"></span> Memproses masa 01-12...`;
        loadingOv.classList.add("show");
      }

      btnSubmit.disabled = true;
      btnSubmit.style.opacity = "0.5";

      const response = await fetch(this.API_URL, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(
          `Sukses! ${result.total_masa || 12} masa berhasil disinkronisasi ke Supabase.`,
        );
        if (typeof navigate === "function") {
          navigate("importFoxpro");
        }
      } else {
        throw new Error(
          result.message || result.error || "Gagal sinkronisasi.",
        );
      }
    } catch (err) {
      console.error("Proses terhenti:", err);
      alert("Gagal:\n" + err.message);
    } finally {
      if (loadingOv) loadingOv.classList.remove("show");
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.style.opacity = "1";
      }
    }
  },
};

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
