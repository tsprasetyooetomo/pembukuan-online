const AppImporFoxpro = {
  API_URL: window.location.origin + "/api/impor-foxpro-online",
  files: { cdg: [], cdd: [], det: [] },

  getHTML() {
    let opsiCabang = `<option value="" disabled selected>-- Pilih Cabang --</option>`;
    if (typeof DBCache !== "undefined" && DBCache.cabang?.length > 0) {
      DBCache.cabang.forEach((c) => {
        let kode = c.kode_cabang || c.kode || c.rest || "";
        let nama = c.nama_cabang || c.nama || "";
        if (kode)
          opsiCabang += `<option value="${kode}">${kode} - ${nama}</option>`;
      });
    }

    let opsiTahun = `<option value="" disabled selected>-- Pilih Tahun --</option>`;
    for (let y = 2020; y <= 2030; y++) {
      opsiTahun += `<option value="${y}">${y}</option>`;
    }

    // ✅ AMBIL OPSI GROUP
    let opsiGroup = `<option value="" disabled selected>-- Pilih Group --</option>`;
    if (typeof getGroupOpts === "function") {
      opsiGroup = getGroupOpts("");
    }

    return `
      <div style="max-width: 700px; margin: 1rem auto; padding: 2rem; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); max-height: 90vh; overflow-y: auto;">
        <h2 style="margin-bottom: 1rem; font-family: 'Space Grotesk', sans-serif; font-size: 1.5rem; color: #fff; display: flex; align-items: center; gap: 0.75rem; position: sticky; top: 0; background: rgba(20,20,30,0.95); padding: 1rem 0; z-index: 10;">
          <i class="fa-solid fa-folder-open" style="color: #3b82f6;"></i> Impor DBF Per Bulan
        </h2>

        <p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 2rem;">
          Format: <b style="color:#60a5fa">CDG/CDD/DET + KODE + BULAN + TAHUN.dbf</b><br>
          Contoh: <b style="color:#10b981">CDG000126.dbf</b> = Cabang 00, Bulan 01, Tahun 2026
        </p>

        <form id="formImporFoxpro">
          <div style="margin-bottom: 2rem;">
            <label style="display: block; color: #94a3b8; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">Kode Cabang</label>
            <select id="impCabang" required style="width: 100%; padding: 0.75rem; background: #000; border: 1px solid #333; border-radius: 4px; color: #ffffff; font-family: 'JetBrains Mono', monospace;">
              ${opsiCabang}
            </select>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: #94a3b8; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">Group</label>
            <!-- ✅ TAMBAHKAN DROPDOWN GROUP DI SINI -->
            <select id="impGroup" required style="width: 100%; padding: 0.75rem; background: #000; border: 1px solid #333; border-radius: 4px; color: #ffffff; font-family: 'JetBrains Mono', monospace;">
              ${opsiGroup}
            </select>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: #94a3b8; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 500;">Tahun</label>
            <select id="impTahun" required style="width: 100%; padding: 0.75rem; background: #000; border: 1px solid #333; border-radius: 4px; color: #ffffff; font-family: 'JetBrains Mono', monospace;">
              ${opsiTahun}
            </select>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: #fff; font-size: 0.85rem; margin-bottom: 0.5rem;">Pilih Folder</label>
            <div style="position: relative; border: 2px dashed rgba(255,255,255,0.15); border-radius: 6px; padding: 2rem; text-align: center; background: rgba(0,0,0,0.1);">
              <input type="file" id="folderInput" webkitdirectory directory multiple required style="position: absolute; inset: 0; opacity: 0; cursor: pointer;">
              <div id="labelFolder" style="color: #94a3b8;">
                <i class="fa-solid fa-folder" style="font-size: 2.5rem; margin-bottom: 0.5rem; display: block; color: #fbbf24;"></i>
                Klik untuk pilih folder
              </div>
            </div>
          </div>

          <!-- PROGRESS BAR -->
          <div id="progressBox" style="display:none;margin-bottom:1.5rem">
            <div style="background:var(--bg2);border-radius:8px;height:28px;overflow:hidden;border:1px solid var(--brd);position:relative">
              <div id="progressBar" style="width:0%;height:100%;background:linear-gradient(90deg,#3b82f6,#10b981);transition:width 0.3s;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.8rem"></div>
            </div>
            <div id="progressText" style="font-size:.8rem;color:var(--muted);margin-top:.5rem;text-align:center">Menunggu...</div>
            <div id="progressLog" style="font-size:.7rem;color:var(--muted);margin-top:.3rem;max-height:80px;overflow-y:auto;background:rgba(0,0,0,0.2);padding:.5rem;border-radius:4px"></div>
          </div>

          <div id="statusBox" style="display: none; margin-bottom: 1.5rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 0.8rem; max-height: 200px; overflow-y: auto;">
            <div id="listFile"></div>
            <div id="infoMasa" style="margin-top: 0.75rem; color: #60a5fa;"></div>
          </div>

          <button type="submit" id="btnSubmit" disabled style="width: 100%; padding: 0.9rem; background: #3b82f6; border: none; border-radius: 4px; color: #fff; font-weight: 600; opacity: 0.5; cursor: not-allowed;">
            <i class="fa-solid fa-cloud-arrow-up"></i> Proses & Upload
          </button>
        </form>
      </div>
    `;
  },

  initEvents() {
    document
      .getElementById("folderInput")
      ?.addEventListener("change", (e) => this.scanFolder(e));
    document
      .getElementById("impCabang")
      ?.addEventListener("change", () => this.validate());
    document
      .getElementById("impGroup")
      ?.addEventListener("change", () => this.validate()); // ✅ TAMBAHKAN EVENT LISTENER GROUP
    document
      .getElementById("impTahun")
      ?.addEventListener("change", () => this.validate());
    document
      .getElementById("formImporFoxpro")
      ?.addEventListener("submit", (e) => this.submit(e));
  },

  parseName(fileName) {
    const n = fileName.toUpperCase().replace(".DBF", "");
    const m = n.match(/^(CDG|CDD|DET)(\d{2})(\d{2})(\d{2})$/);
    if (!m) return null;
    return { type: m[1], kode: m[2], bulan: m[3], tahun2digit: m[4] };
  },

  scanFolder(e) {
    const files = Array.from(e.target.files || []);
    this.files = { cdg: [], cdd: [], det: [] };

    const kode = document.getElementById("impCabang")?.value || "";
    const tahun2 = document.getElementById("impTahun")?.value?.slice(-2) || "";

    files.forEach((f) => {
      const p = this.parseName(f.name);
      if (!p) return;
      if (p.kode === kode && p.tahun2digit === tahun2) {
        if (p.type === "CDG") this.files.cdg.push({ file: f, info: p });
        if (p.type === "CDD") this.files.cdd.push({ file: f, info: p });
        if (p.type === "DET") this.files.det.push({ file: f, info: p });
      }
    });

    const statusBox = document.getElementById("statusBox");
    const labelFolder = document.getElementById("labelFolder");
    if (statusBox) statusBox.style.display = "block";
    if (labelFolder)
      labelFolder.innerHTML = `
      <i class="fa-solid fa-folder-check" style="font-size: 2.5rem; margin-bottom: 0.5rem; display: block; color: #10b981;"></i>
      ${files[0]?.webkitRelativePath.split("/")[0] || "Folder"}<br>
      <small>${files.length} file total</small>
    `;

    this.validate();
  },

  validate() {
    const kode = document.getElementById("impCabang")?.value || "";
    const group = document.getElementById("impGroup")?.value || ""; // ✅ AMBIL NILAI GROUP
    const tahun4 = document.getElementById("impTahun")?.value || "";
    const listFile = document.getElementById("listFile");
    const infoMasa = document.getElementById("infoMasa");
    const btn = document.getElementById("btnSubmit");

    this.files.cdg = this.files.cdg || [];
    this.files.cdd = this.files.cdd || [];
    this.files.det = this.files.det || [];

    this.files.cdg.sort(
      (a, b) => (a.info.bulan || "00") - (b.info.bulan || "00"),
    );
    this.files.cdd.sort(
      (a, b) => (a.info.bulan || "00") - (b.info.bulan || "00"),
    );
    this.files.det.sort(
      (a, b) => (a.info.bulan || "00") - (b.info.bulan || "00"),
    );

    let html = "";
    let bulanValid = [];

    for (let i = 1; i <= 12; i++) {
      const bln = String(i).padStart(2, "0");
      const cdg = this.files.cdg.find((f) => f.info.bulan === bln);
      const cdd = this.files.cdd.find((f) => f.info.bulan === bln);
      const det = this.files.det.find((f) => f.info.bulan === bln);

      if (cdg && cdd && det) {
        html += `<div style="color: #10b981; margin-bottom: 0.3rem;">
          <i class="fa-solid fa-check"></i> Bulan ${bln}: ${cdg.file.name} + ${cdd.file.name} + ${det.file.name}
        </div>`;
        bulanValid.push(bln);
      } else if (cdg || cdd || det) {
        html += `<div style="color: #fbbf24; margin-bottom: 0.3rem;">
          <i class="fa-solid fa-triangle-exclamation"></i> Bulan ${bln}: File tidak lengkap
        </div>`;
      } else {
        html += `<div style="color: #64748b; margin-bottom: 0.3rem;">
          <i class="fa-solid fa-minus"></i> Bulan ${bln}: File tidak ditemukan
        </div>`;
      }
    }

    if (listFile) listFile.innerHTML = html;
    if (infoMasa)
      infoMasa.innerHTML = `<i class="fa-solid fa-info-circle"></i> Siap upload: ${bulanValid.length} bulan | Cabang ${kode} | Group ${group} | Tahun ${tahun4}`;

    // ✅ WAJIB ISI GROUP UNTUK AKTIFKAN TOMBOL
    const ok = bulanValid.length > 0 && kode && group && tahun4;
    if (btn) {
      btn.disabled = !ok;
      btn.style.opacity = ok ? "1" : "0.5";
      btn.style.cursor = ok ? "pointer" : "not-allowed";
    }
  },

  async submit(e) {
    e.preventDefault();
    const btn = document.getElementById("btnSubmit");
    const loading = document.getElementById("loadingOv");
    const progressBox = document.getElementById("progressBox");
    const progressBar = document.getElementById("progressBar");
    const progressText = document.getElementById("progressText");
    const progressLog = document.getElementById("progressLog");

    const kode = document.getElementById("impCabang")?.value;
    const group = document.getElementById("impGroup")?.value; // ✅ AMBIL NILAI GROUP
    const tahun4 = document.getElementById("impTahun")?.value;

    try {
      loading?.classList.add("show");
      btn.disabled = true;
      progressBox.style.display = "block";
      progressLog.innerHTML = "";

      let totalBulan = 0;
      for (let i = 1; i <= 12; i++) {
        const bln = String(i).padStart(2, "0");
        const cdg = this.files.cdg.find((f) => f.info.bulan === bln);
        const cdd = this.files.cdd.find((f) => f.info.bulan === bln);
        const det = this.files.det.find((f) => f.info.bulan === bln);
        if (cdg && cdd && det) totalBulan++;
      }

      if (totalBulan === 0)
        throw new Error("Tidak ada bulan lengkap untuk diupload");

      let bulanKe = 0;

      for (let i = 1; i <= 12; i++) {
        const bln = String(i).padStart(2, "0");
        const cdg = this.files.cdg.find((f) => f.info.bulan === bln);
        const cdd = this.files.cdd.find((f) => f.info.bulan === bln);
        const det = this.files.det.find((f) => f.info.bulan === bln);

        if (cdg && cdd && det) {
          bulanKe++;
          progressText.textContent = `Upload bulan ${bln} - 0%`;
          progressBar.style.width = "0%";
          progressBar.textContent = "0%";

          const fd = new FormData();
          fd.append("kode_cabang", kode);
          fd.append("group", group); // ✅ KIRIM NILAI GROUP KE BACKEND
          fd.append("tahun", tahun4);
          fd.append("bulan", bln);
          fd.append("masa", bln + cdg.info.tahun2digit);
          fd.append("file_cdg", cdg.file);
          fd.append("file_cdd", cdd.file);
          fd.append("file_det", det.file);

          await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", this.API_URL);

            let lastLine = "";
            xhr.onreadystatechange = function () {
              if (xhr.readyState === 3) {
                const lines = xhr.responseText.split("\n\n");
                const newLine = lines[lines.length - 2];
                if (
                  newLine &&
                  newLine.startsWith("data: ") &&
                  newLine !== lastLine
                ) {
                  lastLine = newLine;
                  try {
                    const data = JSON.parse(newLine.replace("data: ", ""));
                    const baseProgress = ((bulanKe - 1) / totalBulan) * 100;
                    const currentProgress =
                      (data.percent / 100) * (100 / totalBulan);
                    const totalProgress = Math.round(
                      baseProgress + currentProgress,
                    );

                    progressBar.style.width = totalProgress + "%";
                    progressBar.textContent = totalProgress + "%";
                    progressText.textContent = `Bulan ${bln} ${bulanKe}/${totalBulan} - ${data.message}`;

                    if (data.message) {
                      progressLog.innerHTML += `<div style="margin-bottom:2px">${new Date().toLocaleTimeString()} ${data.message}</div>`;
                      progressLog.scrollTop = progressLog.scrollHeight;
                    }

                    if (data.percent === 100) {
                      if (!data.success) reject(new Error(data.message));
                      else resolve(data);
                    }
                  } catch (err) {}
                }
              }
            };

            xhr.onerror = () => reject(new Error("Network error"));
            xhr.send(fd);
          });
        }
      }

      toast(
        `Sukses! ${totalBulan} bulan data cabang ${kode} group ${group} tahun ${tahun4} terupload`,
        "ok",
      );
      progressBar.style.width = "100%";
      progressBar.textContent = "100%";
      progressText.textContent = "Selesai semua!";

      setTimeout(() => navigate?.("importFoxpro"), 1500);
    } catch (err) {
      toast("Error: " + err.message, "err");
      progressBar.style.background = "var(--danger)";
      progressText.textContent = "Gagal: " + err.message;
    } finally {
      loading?.classList.remove("show");
      btn.disabled = false;
    }
  },
};

if (typeof PANEL_MAP !== "undefined")
  PANEL_MAP["importFoxpro"] = () => AppImporFoxpro.getHTML();
if (typeof AFTER_RENDER !== "undefined")
  AFTER_RENDER["importFoxpro"] = () => AppImporFoxpro.initEvents();
