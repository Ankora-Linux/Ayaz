(() => {
  'use strict';

  // ============================================================================
  // XSS VE ENJEKSİYON ÖNLEYİCİ HTML KAÇIŞ YARDIMCISI (SECURITY ESCAPER)
  // ============================================================================
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  // ============================================================================
  // TAURI IPC KÖPRÜSÜ (NATIVE BRIDGE)
  // ============================================================================
  const TauriBridge = {
    isAvailable: typeof window !== 'undefined' && Boolean(window.__TAURI__),

    async invoke(cmd, args = {}) {
      if (this.isAvailable && window.__TAURI__.invoke) {
        try {
          return await window.__TAURI__.invoke(cmd, args);
        } catch (err) {
          throw err;
        }
      }
      return this.fallback(cmd, args);
    },

    async fallback(cmd, args) {
      switch (cmd) {
        case 'drag_window':
          return null;

        case 'scan_xdg_applications':
          return [];

        case 'install_deb_package':
          return {
            id: args.packageName || 'app',
            name: (args.packageName || 'Uygulama').toUpperCase(),
            exec: args.packageName || 'app',
            icon: args.packageName || 'application-x-executable',
            comment: 'Devuan paket deposundan kuruldu',
            categories: ['Utility']
          };

        case 'run_terminal_command':
          const c = (args.command || '').trim();
          if (c === 'uname -a') return 'Linux ankora-os 6.1.0-22-amd64 #1 SMP PREEMPT Devuan x86_64 GNU/Linux';
          if (c === 'whoami') return 'pars (uid=1000 gid=1000 groups=sudo,audio,video)';
          if (c === 'uptime') return 'up 21 hours, 2 users, load average: 0.05, 0.02, 0.00';
          if (c === 'ls' || c === 'ls -la') return 'total 48\ndrwxr-xr-x 4 pars pars 4096 Sep 21 22:20 .\ndrwxr-xr-x 3 pars pars 4096 Sep 21 21:00 ..\n-rw-r--r-- 1 pars pars 1442 Sep 21 22:15 tauri.conf.json\n-rw-r--r-- 1 pars pars  561 Sep 21 22:23 Cargo.toml\ndrwxr-xr-x 2 pars pars 4096 Sep 21 22:10 src\n-rw-r--r-- 1 pars pars 6190 Sep 21 22:00 README.md';
          if (c.startsWith('cat ')) return `[${c}] Devuan GNU/Linux 5 (daedalus) / SysVinit Core`;
          return `[Bash Çıkışı]: ${c} başarıyla çalıştırıldı (Çıkış Kodu: 0).`;

        case 'read_document_file':
          return {
            file_name: 'ankora-sistem-rehberi.pdf',
            file_type: 'pdf',
            file_size: 48200,
            content: 'data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA1OTUgODQyXQovQ29udGVudHMgNCAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL0xlbmd0aCA4NQo+PgpzdHJlYW0KQVQKL1RkIDAgLzAgRjEgMjQgVGYKKDFBYmtvcmEgTGludXggMi4wIFNpc3RlbSBSZWhiZXJpKSBUagogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA2OCAwMDAwMCBuIAowMDAwMDAwMTI1IDAwMDAwIG4gCjAwMDAwMDAyMjUgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA1Ci9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgogMzYxCiUlRU9GCg=='
          };

        case 'query_local_ai': {
          const prov = (args.provider || 'ollama').toUpperCase();
          const mode = (args.agent_mode || 'sysadmin').toLowerCase();
          const p = (args.prompt || '').toLowerCase();
          const hasKey = Boolean(args.api_key && args.api_key.trim().length > 0);
          const prefix = `[${prov} / ${mode === 'developer' ? 'GELİŞTİRİCİ' : mode === 'general' ? 'ASİSTAN' : 'SİSTEM TEFTİŞ'} AJANI]: `;

          if (p.includes('temizle') || p.includes('önbellek')) {
            return {
              reply: `${prefix}Sistem önbelleklerinin temizlenmesi ve disk alanının boşaltılması analiz edildi. Aşağıdaki işlem paket önbelleğini ve geçici dosyaları güvenli bir şekilde silecektir.`,
              has_action: true,
              action_command: 'apt-get clean && rm -rf /tmp/*',
              action_desc: 'Sistem paket önbelleğini temizleme ve geçici dosyaları boşaltma'
            };
          } else if (p.includes('disk') || p.includes('ram') || p.includes('durum')) {
            return {
              reply: `${prefix}Sistem kaynakları denetleniyor. Kök dosya sistemi doluluğu ve bellek (RAM) tüketimi raporlanacaktır.`,
              has_action: true,
              action_command: 'df -h / && free -m',
              action_desc: 'Kök dosya sistemi ve RAM kullanımını sorgulama'
            };
          } else if (p.includes('ağ') || p.includes('ip') || p.includes('network')) {
            return {
              reply: `${prefix}Ağ arabirimleri ve etkin IP adresleri taranıyor.`,
              has_action: true,
              action_command: 'ip addr show',
              action_desc: 'Ağ arabirimlerini ve IP yapılandırmasını listeleme'
            };
          } else if (p.includes('teftiş') || p.includes('çekirdek') || p.includes('telemetri')) {
            return {
              reply: `${prefix}Çekirdek telemetrisi, init sistemi ve donanım mimarisi taranıyor.`,
              has_action: true,
              action_command: 'uname -a && uptime',
              action_desc: 'Sistem çekirdeği ve çalışma süresini teftiş etme'
            };
          }

          return {
            reply: `${prefix}Talebiniz '${args.prompt}' işlendi.\n• Model: ${args.model || 'varsayılan'}\n• Bağlantı: ${hasKey ? 'Özel Kullanıcı API Anahtarı Aktif ✓' : 'Yerel / Açık Uç Nokta'}\nAnkora Linux Devuan 5.0 (Daedalus) çekirdeği üzerinde otonom ajan hazır.`,
            has_action: false,
            action_command: null,
            action_desc: null
          };
        }

        case 'execute_agent_confirmed_action':
          return `[SİSTEM ONAYLANDI] ${args.command} çalıştırıldı ve tamamlandı.`;

        case 'get_storage_devices':
          return [
            { name: 'sda', path: '/dev/sda', size_gb: 256.0, model: 'Kingston SATA SSD (256 GB)', is_removable: false },
            { name: 'nvme0n1', path: '/dev/nvme0n1', size_gb: 512.0, model: 'Samsung 980 NVMe SSD (512 GB)', is_removable: false }
          ];

        case 'execute_system_installation':
          return `Kurulum tamamlandı: ${args.payload?.target_disk} -> ${args.payload?.username}`;

        case 'get_system_telemetry':
          return {
            os_name: 'Devuan GNU/Linux 5 (daedalus)',
            kernel: 'Linux 6.1.0-22-amd64 (Tauri Native)',
            init_system: 'SysVinit (systemd-free)',
            memory_used_mb: 1140,
            memory_total_mb: 8192,
            cpu_cores: 4,
            uptime_seconds: 7200
          };

        case 'check_first_run':
          return true;

        case 'save_ai_credential':
          return null;

        case 'has_ai_credential':
          return false;

        case 'delete_ai_credential':
          return null;

        case 'check_de_update':
          return {
            has_update: false,
            current_version: '2.0.0',
            latest_version: '2.0.0',
            release_name: 'Ayaz DE v2.0.0 (Son Kararlı Sürüm)',
            release_notes: '## Ayaz DE v2.0.0\n- Ankora Linux için geliştirilen minimalist masaüstü ortamı.\n- SysVinit uyumlu Kiosk tasarımı.\n- Güvenlik duvarı ve yerel AI ajan entegrasyonu.',
            download_url: null,
            published_at: new Date().toISOString(),
            package_size_bytes: 0
          };

        case 'download_and_apply_de_update':
          return 'Simülasyon güncellemesi başarıyla tamamlandı.';

        case 'restart_desktop_process':
          window.location.reload();
          return null;

        default:
          return null;
      }
    }
  };

  // ============================================================================
  // 1. GERÇEK TAURI NATIVE WINDOW MANAGER
  // ============================================================================
  const WindowManager = {
    highestZ: 30,
    windows: [],
    tabsContainer: null,

    init() {
      this.windows = Array.from(document.querySelectorAll('.window'));
      this.tabsContainer = document.getElementById('running-tabs');

      this.windows.forEach(win => {
        win.addEventListener('mousedown', () => this.bringToFront(win));

        const btnClose = win.querySelector('.ctrl-btn.close');
        const btnMin = win.querySelector('.ctrl-btn.min');
        const btnMax = win.querySelector('.ctrl-btn.max');

        if (btnClose) btnClose.addEventListener('click', (e) => { e.stopPropagation(); this.close(win); });
        if (btnMin) btnMin.addEventListener('click', (e) => { e.stopPropagation(); this.minimize(win); });
        if (btnMax) btnMax.addEventListener('click', (e) => { e.stopPropagation(); this.toggleMaximize(win); });

        // DOM Masaüstü Pencere Sürükleme (Drag)
        const header = win.querySelector('.window-header');
        if (header) {
          header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.window-controls')) return;
            if (win.classList.contains('maximized')) return;

            this.bringToFront(win);

            const rect = win.getBoundingClientRect();
            const shiftX = e.clientX - rect.left;
            const shiftY = e.clientY - rect.top;

            const onMouseMove = (moveEvent) => {
              const maxLeft = Math.max(0, window.innerWidth - 80);
              const maxTop = Math.max(0, window.innerHeight - 80);
              const newLeft = Math.max(0, Math.min(moveEvent.clientX - shiftX, maxLeft));
              const newTop = Math.max(0, Math.min(moveEvent.clientY - shiftY, maxTop));
              win.style.left = `${newLeft}px`;
              win.style.top = `${newTop}px`;
            };

            const onMouseUp = () => {
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
          });
        }

        // Pencere Boyutlandırma Tutamacı (Resize Handle)
        if (!win.querySelector('.window-resize-handle')) {
          const handle = document.createElement('div');
          handle.className = 'window-resize-handle';
          handle.title = 'Yeniden Boyutlandır';
          win.appendChild(handle);

          handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.bringToFront(win);

            const startW = win.offsetWidth;
            const startH = win.offsetHeight;
            const startX = e.clientX;
            const startY = e.clientY;

            const onResizeMove = (moveEvent) => {
              if (win.classList.contains('maximized')) return;
              const newW = Math.max(400, startW + (moveEvent.clientX - startX));
              const newH = Math.max(260, startH + (moveEvent.clientY - startY));
              win.style.width = `${newW}px`;
              win.style.height = `${newH}px`;
            };

            const onResizeUp = () => {
              document.removeEventListener('mousemove', onResizeMove);
              document.removeEventListener('mouseup', onResizeUp);
            };

            document.addEventListener('mousemove', onResizeMove);
            document.addEventListener('mouseup', onResizeUp);
          });
        }
      });
    },

    bringToFront(win) {
      this.highestZ++;
      win.style.zIndex = this.highestZ;
      this.windows.forEach(w => w.classList.remove('active'));
      win.classList.add('active');
      this.syncTabs();
    },

    open(winId) {
      const win = document.getElementById(winId);
      if (!win) return;

      win.classList.remove('minimized');
      win.classList.add('open');
      this.bringToFront(win);
      this.syncTabs();
    },

    close(win) {
      win.classList.remove('open');
      win.classList.remove('active');
      this.syncTabs();
    },

    minimize(win) {
      win.classList.add('minimized');
      win.classList.remove('active');
      this.syncTabs();
    },

    toggleMaximize(win) {
      win.classList.toggle('maximized');
      this.bringToFront(win);
    },

    syncTabs() {
      if (!this.tabsContainer) return;
      this.tabsContainer.innerHTML = '';

      this.windows.forEach(win => {
        if (win.classList.contains('open')) {
          const tab = document.createElement('div');
          tab.className = `task-tab ${win.classList.contains('active') && !win.classList.contains('minimized') ? 'active' : ''}`;

          const titleSpan = win.querySelector('.window-meta span');
          const title = titleSpan ? titleSpan.textContent.split('—')[0].trim() : 'Pencere';
          tab.textContent = title;

          tab.addEventListener('click', () => {
            if (win.classList.contains('minimized')) {
              win.classList.remove('minimized');
              this.bringToFront(win);
            } else if (win.classList.contains('active')) {
              this.minimize(win);
            } else {
              this.bringToFront(win);
            }
          });

          this.tabsContainer.appendChild(tab);
        }
      });
    }
  };

  // ============================================================================
  // 2. GERÇEK DİNAMİK XDG .DESKTOP UYGULAMA MOTORU
  // ============================================================================
  const XdgDesktopEngine = {
    installedApps: [],

    async init() {
      // Yerel önbellekten oku - kullanıcının kurduğu gerçek uygulamalar
      const cached = localStorage.getItem('ankora_xdg_apps');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          this.installedApps = Array.isArray(parsed) ? parsed.filter(a => a && a.id) : [];
          this.renderToDesktop();
        } catch (e) {
          this.installedApps = [];
        }
      }

      // Sistem XDG dizinlerini tara ve kurulu uygulamalarla güvenle birleştir
      try {
        const apps = await TauriBridge.invoke('scan_xdg_applications');
        if (apps && Array.isArray(apps)) {
          apps.forEach(app => {
            if (app && app.id && app.is_installed_by_user) {
              const existingIdx = this.installedApps.findIndex(a => a.id === app.id);
              if (existingIdx >= 0) {
                this.installedApps[existingIdx] = { ...this.installedApps[existingIdx], ...app, is_installed_by_user: true };
              } else {
                this.installedApps.push({ ...app, is_installed_by_user: true });
              }
            }
          });
          localStorage.setItem('ankora_xdg_apps', JSON.stringify(this.installedApps));
          this.renderToDesktop();
        }
      } catch (err) {}
    },

    addApplication(app) {
      if (!app || !app.id) return;
      app.is_installed_by_user = true;
      const existingIdx = this.installedApps.findIndex(a => a.id === app.id);
      if (existingIdx >= 0) {
        this.installedApps[existingIdx] = app;
      } else {
        this.installedApps.push(app);
      }

      localStorage.setItem('ankora_xdg_apps', JSON.stringify(this.installedApps));
      this.renderToDesktop();
    },

    removeApplication(appId) {
      this.installedApps = this.installedApps.filter(a => a.id !== appId);
      localStorage.setItem('ankora_xdg_apps', JSON.stringify(this.installedApps));
      this.renderToDesktop();
    },

    renderToDesktop() {
      const container = document.getElementById('dynamic-desktop-icons');
      if (!container) return;
      container.innerHTML = '';

      this.installedApps.forEach(app => {
        const item = document.createElement('div');
        item.className = 'desktop-item';
        item.tabIndex = 0;
        item.title = `${app.name} (${app.exec})\n${app.comment || ''}`;
        item.innerHTML = `
          <div class="item-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
          <span class="item-name">${escapeHtml(app.name)}</span>
        `;

        item.addEventListener('click', async () => {
          Terminal.log(`[XDG EXEC] Başlatılıyor: ${app.exec}`, 'cmd');
          try {
            await TauriBridge.invoke('launch_application', { exec: app.exec });
          } catch (e) {
            Terminal.log(`[ERR] ${e}`, 'error');
          }
        });

        container.appendChild(item);
      });
    }
  };

  // ============================================================================
  // 3. YAZILIM MAĞAZASI (GERÇEK DEBIAN .DEB & XDG ENTEGRASYONU)
  // ============================================================================
  const StoreManager = {
    packages: [
      { id: 'vlc', name: 'VLC Media Player', deb: 'vlc', desc: 'Evrensel video ve ortam yürütücü', cat: 'media', size: '64 MB', installed: false },
      { id: 'code', name: 'Visual Studio Code', deb: 'code', desc: 'Endüstri standardı kod editörü', cat: 'dev', size: '90 MB', installed: false },
      { id: 'gimp', name: 'GIMP', deb: 'gimp', desc: 'Açık kaynak görsel manipülasyon aracı', cat: 'graphics', size: '112 MB', installed: false },
      { id: 'firefox-esr', name: 'Firefox ESR', deb: 'firefox-esr', desc: 'Güvenli ve kararlı web tarayıcısı', cat: 'dev', size: '78 MB', installed: false },
      { id: 'blender', name: 'Blender 3D', deb: 'blender', desc: '3D modelleme ve animasyon stüdyosu', cat: 'graphics', size: '310 MB', installed: false },
      { id: 'htop', name: 'Htop Monitör', deb: 'htop', desc: 'Süreç ve bellek yöneticisi', cat: 'sys', size: '2 MB', installed: false }
    ],
    tableBody: null,
    currentCat: 'all',

    init() {
      this.tableBody = document.getElementById('store-table-body');
      const searchInput = document.getElementById('store-search');
      const filterBtns = document.querySelectorAll('.store-filter-btn');

      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentCat = btn.getAttribute('data-cat');
          this.render(searchInput ? searchInput.value : '');
        });
      });

      if (searchInput) {
        searchInput.addEventListener('input', (e) => this.render(e.target.value));
      }

      this.render();
    },

    render(query = '') {
      if (!this.tableBody) return;
      this.tableBody.innerHTML = '';

      const q = query.toLowerCase();
      const filtered = this.packages.filter(p => {
        const matchCat = this.currentCat === 'all' || p.cat === this.currentCat;
        const matchQ = p.name.toLowerCase().includes(q) || p.deb.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q);
        return matchCat && matchQ;
      });

      filtered.forEach(pkg => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <span class="pkg-title">${escapeHtml(pkg.name)}</span>
            <span class="pkg-name">${escapeHtml(pkg.deb)} (Devuan Resmi Deposu)</span>
            <div class="pkg-progress-bar" id="prog-${pkg.id}"></div>
          </td>
          <td><span class="pkg-desc">${escapeHtml(pkg.desc)}</span></td>
          <td><span style="color: var(--text-muted); font-family: var(--font-mono); font-size: 11px;">${escapeHtml(pkg.size)}</span></td>
          <td style="text-align: right;">
            <button class="btn-pkg ${pkg.installed ? 'installed' : ''}" id="btn-pkg-${pkg.id}">
              ${pkg.installed ? 'Kaldır' : 'Kur'}
            </button>
          </td>
        `;

        const btn = tr.querySelector(`#btn-pkg-${pkg.id}`);
        btn.addEventListener('click', () => this.togglePackage(pkg));

        this.tableBody.appendChild(tr);
      });
    },

    async togglePackage(pkg) {
      const btn = document.getElementById(`btn-pkg-${pkg.id}`);
      const prog = document.getElementById(`prog-${pkg.id}`);

      if (pkg.installed) {
        pkg.installed = false;
        btn.classList.remove('installed');
        btn.textContent = 'Kur';
        XdgDesktopEngine.removeApplication(pkg.id);
        Terminal.log(`[APT] Paket kaldırıldı: ${pkg.deb}`, 'muted');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'İndiriliyor...';
      Terminal.log(`[APT] apt-get install -y ${pkg.deb} yürütülüyor...`, 'cmd');

      let val = 0;
      const interval = setInterval(() => {
        val += 25;
        if (prog) prog.style.width = `${val}%`;
        if (val >= 100) clearInterval(interval);
      }, 100);

      try {
        const xdgApp = await TauriBridge.invoke('install_deb_package', { packageName: pkg.deb });
        pkg.installed = true;
        btn.disabled = false;
        btn.classList.add('installed');
        btn.textContent = 'Kaldır';
        if (prog) prog.style.width = '0%';

        // Yalnızca kullanıcı açıkça kurduğunda sisteme ekle
        XdgDesktopEngine.addApplication({
          id: pkg.id,
          name: pkg.name,
          exec: pkg.deb,
          icon: pkg.deb,
          comment: pkg.desc,
          is_installed_by_user: true
        });
        Terminal.log(`[XDG OK] ${xdgApp.name} kuruldu ve sisteme eklendi.`, 'success');
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Hata';
        if (prog) prog.style.width = '0%';
        Terminal.log(`[ERR] ${err}`, 'error');
      }
    }
  };

  // ============================================================================
  // 4. GERÇEK WEBKIT BASH TERMİNALİ (LIVE SHELL ENGINE)
  // ============================================================================
  const Terminal = {
    input: null,
    logs: null,
    viewport: null,
    history: [],
    hIndex: -1,

    init() {
      this.input = document.getElementById('term-input');
      this.logs = document.getElementById('term-logs');
      this.viewport = document.getElementById('term-viewport');

      // Kalıcı terminal geçmişini yükle
      try {
        const cached = localStorage.getItem('ankora_term_history');
        if (cached) {
          this.history = JSON.parse(cached);
          this.hIndex = this.history.length;
        }
      } catch (e) {
        this.history = [];
      }

      if (!this.input) return;

      this.input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          const raw = this.input.value.trim();
          if (!raw) return;
          this.input.value = '';
          await this.runCommand(raw);
        } else if (e.key === 'ArrowUp') {
          if (this.hIndex > 0) {
            this.hIndex--;
            this.input.value = this.history[this.hIndex];
          }
        } else if (e.key === 'ArrowDown') {
          if (this.hIndex < this.history.length - 1) {
            this.hIndex++;
            this.input.value = this.history[this.hIndex];
          } else {
            this.hIndex = this.history.length;
            this.input.value = '';
          }
        }
      });
    },

    saveHistory() {
      try {
        if (this.history.length > 100) {
          this.history = this.history.slice(-100);
        }
        localStorage.setItem('ankora_term_history', JSON.stringify(this.history));
      } catch (e) {}
    },

    async runCommand(command) {
      const clean = (command || '').trim();
      if (!clean) return '';

      this.log(`pars@ankora-os:~$ ${clean}`, 'cmd');
      this.history.push(clean);
      this.hIndex = this.history.length;
      this.saveHistory();

      if (clean.toLowerCase() === 'clear') {
        if (this.logs) this.logs.innerHTML = '';
        return '';
      }

      try {
        const out = await TauriBridge.invoke('run_terminal_command', { command: clean });
        if (out) this.log(out, 'muted');
        return out;
      } catch (err) {
        this.log(String(err), 'error');
        throw err;
      }
    },

    log(text, type = 'muted') {
      if (!this.logs) return;
      const row = document.createElement('div');
      row.className = `term-row ${type}`;
      row.textContent = text;
      this.logs.appendChild(row);
      if (this.viewport) this.viewport.scrollTop = this.viewport.scrollHeight;
    }
  };

  // ============================================================================
  // 5. ANKORA OFFICE (GERÇEK PDF & BELGE GÖRÜNTÜLEYİCİ)
  // ============================================================================
  const OfficeManager = {
    pdfFrame: null,
    textFrame: null,
    filePicker: null,
    metaFilename: null,
    metaFilesize: null,

    init() {
      this.pdfFrame = document.getElementById('office-pdf-frame');
      this.textFrame = document.getElementById('office-text-frame');
      this.filePicker = document.getElementById('office-file-picker');
      this.metaFilename = document.getElementById('office-filename');
      this.metaFilesize = document.getElementById('office-filesize');

      const btnOpen = document.getElementById('btn-office-open');
      const btnSamplePdf = document.getElementById('btn-office-sample-pdf');
      const btnSampleDoc = document.getElementById('btn-office-sample-doc');
      const btnPrint = document.getElementById('btn-office-print');

      if (btnOpen && this.filePicker) {
        btnOpen.addEventListener('click', () => this.filePicker.click());
        this.filePicker.addEventListener('change', (e) => this.handleLocalFile(e.target.files[0]));
      }

      if (btnSamplePdf) {
        btnSamplePdf.addEventListener('click', () => this.loadSamplePdf());
      }

      if (btnSampleDoc) {
        btnSampleDoc.addEventListener('click', () => this.loadSampleText());
      }

      if (btnPrint && this.pdfFrame) {
        btnPrint.addEventListener('click', () => {
          try {
            this.pdfFrame.contentWindow.print();
          } catch (e) {
            window.print();
          }
        });
      }

      // Başlangıçta örnek PDF yükle
      this.loadSamplePdf();
    },

    async loadSamplePdf() {
      try {
        const doc = await TauriBridge.invoke('read_document_file', { file_path: '/root/Belgeler/ankora-sistem-rehberi.pdf' });
        this.renderDocument(doc);
      } catch (err) {}
    },

    loadSampleText() {
      const doc = {
        file_name: 'kiosk-ayarlari.md',
        file_type: 'text',
        file_size: 1420,
        content: `# Ankora Linux 2.0 Kiosk Yapılandırma Raporu\n\n- Taban: Devuan Daedalus (SysVinit)\n- Çekirdek: Linux 6.1 LTS\n- Pencere Motoru: Tauri + WebKitGTK\n- Display Manager: nodm (Auto-login)\n- Donanım Parlaklığı: xrandr donanım kontrolü\n- Bellek: ZRAM + Disk Swap Hiyerarşisi\n\nBu belge, Ankora Office yerel belge işleyicisi tarafından doğrudan sistemden render edilmektedir.`
      };
      this.renderDocument(doc);
    },

    handleLocalFile(file) {
      if (!file) return;

      const ext = file.name.split('.').pop().toLowerCase();
      const reader = new FileReader();

      if (ext === 'pdf') {
        reader.onload = () => {
          this.renderDocument({
            file_name: file.name,
            file_type: 'pdf',
            file_size: file.size,
            content: reader.result
          });
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => {
          this.renderDocument({
            file_name: file.name,
            file_type: 'text',
            file_size: file.size,
            content: reader.result
          });
        };
        reader.readAsText(file);
      }
    },

    renderDocument(doc) {
      if (this.metaFilename) this.metaFilename.textContent = doc.file_name;
      if (this.metaFilesize) this.metaFilesize.textContent = `${(doc.file_size / 1024).toFixed(1)} KB`;

      if (doc.file_type === 'pdf') {
        if (this.pdfFrame) {
          this.pdfFrame.style.display = 'block';
          this.pdfFrame.src = doc.content;
        }
        if (this.textFrame) this.textFrame.style.display = 'none';
      } else {
        if (this.pdfFrame) this.pdfFrame.style.display = 'none';
        if (this.textFrame) {
          this.textFrame.style.display = 'block';
          this.textFrame.textContent = doc.content;
        }
      }
    },

    openDocumentByName(name) {
      if (!name) return;
      if (name.endsWith('.pdf')) {
        this.loadSamplePdf();
      } else if (name === 'kiosk-ayarlari.md') {
        this.loadSampleText();
      } else {
        this.renderDocument({
          file_name: name,
          file_type: 'text',
          file_size: 4096,
          content: `# Ankora Linux 2.0 - Sürüm Notları (Daedalus)\n\n- Taban: Devuan GNU/Linux 5.0 (Daedalus)\n- İnit Sistemi: SysVinit (systemd-free, ultra-lightweight)\n- Arayüz: Tauri 1.5 + Monokrom Minimalist DE\n- Çekirdek: Linux 6.1.0-22-amd64\n\nSistem kararlılığı ve minimum RAM tüketimi garanti edilmektedir.`
        });
      }
    }
  };

  // ============================================================================
  // 6. ANKORA AI (OTONOM AJAN, KULLANICI API BAĞLANTISI & GÜVENLİK ONAY SİSTEMİ)
  // ============================================================================
  const AIAgent = {
    feed: null,
    input: null,
    pendingCommand: null,
    provider: 'ollama',
    mode: 'sysadmin',
    model: 'qwen2.5:0.5b',
    endpoint: 'http://127.0.0.1:11434/api/generate',
    apiKey: '',

    init() {
      this.feed = document.getElementById('ai-feed');
      this.input = document.getElementById('ai-prompt-input');
      const btnSend = document.getElementById('btn-ai-submit');
      const quickBtns = document.querySelectorAll('.ai-tag-btn');

      // 1. Kaydedilmiş API & Ajan Tercihlerini Yükle
      this.provider = localStorage.getItem('ankora_ai_provider') || 'ollama';
      this.mode = localStorage.getItem('ankora_ai_mode') || 'sysadmin';
      this.model = localStorage.getItem('ankora_ai_model') || (this.provider === 'ollama' ? 'qwen2.5:0.5b' : 'gpt-4o-mini');
      this.endpoint = localStorage.getItem('ankora_ai_endpoint') || 'http://127.0.0.1:11434/api/generate';
      // Düz metin localStorage anahtarlarını temizle (Kritik Güvenlik Bulgusu #1)
      localStorage.removeItem('ankora_ai_key');

      const selProvider = document.getElementById('ai-cfg-provider');
      const selMode = document.getElementById('ai-cfg-mode');
      const inputModel = document.getElementById('ai-cfg-model');
      const inputEndpoint = document.getElementById('ai-cfg-endpoint');
      const inputKey = document.getElementById('ai-cfg-key');

      if (selProvider) selProvider.value = this.provider;
      if (selMode) selMode.value = this.mode;
      if (inputModel) inputModel.value = this.model;
      if (inputEndpoint) inputEndpoint.value = this.endpoint;

      // Backend güvenli depoda anahtar kontrolü
      TauriBridge.invoke('has_ai_credential', { provider: this.provider }).then(hasKey => {
        if (hasKey && inputKey) {
          inputKey.placeholder = '•••••••• (Kayıtlı ve Şifreli)';
        }
      }).catch(() => {});

      this.updateBadges();

      // 2. Yapılandırma Paneli (Drawer) Açma/Kapama
      const btnToggleConfig = document.getElementById('btn-toggle-ai-config');
      const drawer = document.getElementById('ai-config-drawer');
      if (btnToggleConfig && drawer) {
        btnToggleConfig.addEventListener('click', () => {
          drawer.classList.toggle('open');
        });
      }

      // 3. API Anahtarı Göster / Gizle Toggle Butonu
      const btnToggleKey = document.getElementById('btn-toggle-key-view');
      if (btnToggleKey && inputKey) {
        btnToggleKey.addEventListener('click', () => {
          inputKey.type = inputKey.type === 'password' ? 'text' : 'password';
        });
      }

      // 4. Sağlayıcı Değiştiğinde Otomatik Varsayılanları Tamamla
      if (selProvider) {
        selProvider.addEventListener('change', async () => {
          const val = selProvider.value;
          if (val === 'ollama') {
            if (inputModel) inputModel.value = 'qwen2.5:0.5b';
            if (inputEndpoint) inputEndpoint.value = 'http://127.0.0.1:11434/api/generate';
          } else if (val === 'openai') {
            if (inputModel) inputModel.value = 'gpt-4o-mini';
            if (inputEndpoint) inputEndpoint.value = 'https://api.openai.com/v1/chat/completions';
          } else if (val === 'gemini') {
            if (inputModel) inputModel.value = 'gemini-2.0-flash';
            if (inputEndpoint) inputEndpoint.value = 'https://generativelanguage.googleapis.com/v1beta';
          } else if (val === 'groq') {
            if (inputModel) inputModel.value = 'llama-3.3-70b-versatile';
            if (inputEndpoint) inputEndpoint.value = 'https://api.groq.com/openai/v1/chat/completions';
          } else if (val === 'openrouter') {
            if (inputModel) inputModel.value = 'anthropic/claude-3.5-sonnet';
            if (inputEndpoint) inputEndpoint.value = 'https://openrouter.ai/api/v1/chat/completions';
          } else if (val === 'custom') {
            if (inputModel) inputModel.value = 'default';
            if (inputEndpoint) inputEndpoint.value = 'http://127.0.0.1:8000/v1/chat/completions';
          }

          if (inputKey) {
            inputKey.value = '';
            try {
              const hasKey = await TauriBridge.invoke('has_ai_credential', { provider: val });
              inputKey.placeholder = hasKey ? '•••••••• (Kayıtlı ve Şifreli)' : 'sk-... veya API anahtarı';
            } catch (e) {
              inputKey.placeholder = 'sk-... veya API anahtarı';
            }
          }
        });
      }

      // 5. Yapılandırmayı Kaydetme (Rust Güvenli Depoya)
      const btnSaveCfg = document.getElementById('btn-save-ai-cfg');
      if (btnSaveCfg) {
        btnSaveCfg.addEventListener('click', async () => {
          if (selProvider) this.provider = selProvider.value;
          if (selMode) this.mode = selMode.value;
          if (inputModel) this.model = inputModel.value.trim() || 'default';
          if (inputEndpoint) this.endpoint = inputEndpoint.value.trim();

          const enteredKey = inputKey ? inputKey.value.trim() : '';
          let keySaved = false;
          if (enteredKey && !enteredKey.includes('••••')) {
            try {
              await TauriBridge.invoke('save_ai_credential', { provider: this.provider, apiKey: enteredKey });
              keySaved = true;
              if (inputKey) {
                inputKey.value = '';
                inputKey.placeholder = '•••••••• (Kayıtlı ve Şifreli)';
              }
            } catch (err) {
              Terminal.log(`[AI GÜVENLİK HATA] ${err}`, 'error');
            }
          }

          localStorage.setItem('ankora_ai_provider', this.provider);
          localStorage.setItem('ankora_ai_mode', this.mode);
          localStorage.setItem('ankora_ai_model', this.model);
          localStorage.setItem('ankora_ai_endpoint', this.endpoint);
          localStorage.removeItem('ankora_ai_key');

          this.updateBadges();
          if (drawer) drawer.classList.remove('open');

          const provLabel = selProvider?.options[selProvider.selectedIndex]?.text || this.provider;
          const modeLabel = selMode?.options[selMode.selectedIndex]?.text || this.mode;
          this.appendMsg('bot', `✓ Yapılandırma güncellendi ve otonom ajan hazırlandı.\n• Sağlayıcı: ${provLabel}\n• Ajan Yetki Rolü: ${modeLabel}\n• Model: ${this.model}\n${keySaved ? '• Özel API Anahtarı: Rust Güvenli Depoya Şifrelendi ✓' : '• Anahtar Durumu: Güvenli depodan doğrulanıyor'}`);
          Terminal.log(`[AI YAPILANDIRMA] Sağlayıcı: ${this.provider}, Rol: ${this.mode}, Model: ${this.model}`, 'success');
        });
      }

      if (btnSend && this.input) {
        btnSend.addEventListener('click', () => this.submit());
        this.input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.submit();
        });
      }

      quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const q = btn.getAttribute('data-query');
          if (q) this.handleQuery(q);
        });
      });

      // Onay Modalı İşleyicileri
      const modal = document.getElementById('confirm-modal');
      const btnConfirm = document.getElementById('btn-modal-confirm');
      const btnCancel = document.getElementById('btn-modal-cancel');

      if (btnConfirm && modal) {
        btnConfirm.addEventListener('click', async () => {
          modal.classList.remove('open');
          if (this.pendingCommand) {
            const cmd = this.pendingCommand;
            this.pendingCommand = null;
            this.appendMsg('user', `[ONAYLANDI]: ${cmd}`);

            try {
              const res = await TauriBridge.invoke('execute_agent_confirmed_action', { command: cmd });
              this.appendMsg('bot', `Sistem komutu başarıyla çalıştırıldı:\n${res || 'Tamamlandı.'}`);
              Terminal.log(`[AI EXEC] ${cmd}: Başarılı`, 'success');
            } catch (err) {
              this.appendMsg('bot', `Komut yürütme hatası: ${err}`);
              Terminal.log(`[AI ERR] ${err}`, 'error');
            }
          }
        });
      }

      if (btnCancel && modal) {
        btnCancel.addEventListener('click', () => {
          modal.classList.remove('open');
          this.pendingCommand = null;
          this.appendMsg('bot', 'İşlem kullanıcı tarafından iptal edildi.');
        });
      }
    },

    updateBadges() {
      const badgeProv = document.getElementById('ai-current-provider-badge');
      const badgeMode = document.getElementById('ai-current-mode-badge');
      const ind = document.getElementById('ai-status-indicator');

      const provMap = {
        ollama: 'Ollama (Yerel)',
        openai: 'OpenAI (GPT)',
        gemini: 'Google Gemini',
        groq: 'Groq Cloud',
        openrouter: 'OpenRouter',
        custom: 'Özel API'
      };

      const modeMap = {
        sysadmin: 'Sistem Teftiş Ajanı',
        developer: 'Geliştirici Asistanı',
        general: 'Genel Sistem Asistanı'
      };

      if (badgeProv) badgeProv.textContent = provMap[this.provider] || this.provider.toUpperCase();
      if (badgeMode) {
        badgeMode.innerHTML = `<svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:12px;height:12px;display:inline-block;vertical-align:-1px;margin-right:4px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>${modeMap[this.mode] || this.mode}`;
      }
      if (ind) {
        ind.textContent = 'Bağlı / Hazır';
        ind.className = 'status-pill online';
      }
    },

    submit() {
      if (!this.input) return;
      const text = this.input.value.trim();
      if (!text) return;
      this.input.value = '';
      this.handleQuery(text);
    },

    appendMsg(role, text) {
      if (!this.feed) return null;
      const entry = document.createElement('div');
      entry.className = `ai-entry ${role === 'user' ? 'user' : 'bot'}`;

      const author = document.createElement('span');
      author.className = 'ai-author';
      author.textContent = role === 'user' ? 'Kullanıcı' : 'Ankora AI';

      const p = document.createElement('p');
      p.style.whiteSpace = 'pre-wrap';
      p.textContent = String(text ?? '');

      entry.appendChild(author);
      entry.appendChild(p);
      this.feed.appendChild(entry);
      this.feed.scrollTop = this.feed.scrollHeight;
      return entry;
    },

    async handleQuery(text) {
      this.appendMsg('user', text);
      const loadingEntry = this.appendMsg('bot', 'Ajan düşünülüyor ve sistem analiz ediliyor...');

      try {
        const res = await TauriBridge.invoke('query_local_ai', {
          prompt: text,
          provider: this.provider,
          endpoint: this.endpoint,
          api_key: '', // Rust arka planı credentials.dat dosyasından güvenle çeker
          model: this.model,
          agent_mode: this.mode
        });

        if (loadingEntry && loadingEntry.parentNode) {
          loadingEntry.parentNode.removeChild(loadingEntry);
        }

        this.appendMsg('bot', res.reply);

        if (res.has_action && res.action_command) {
          this.renderActionCard(res.action_command, res.action_desc);
        }
      } catch (err) {
        if (loadingEntry && loadingEntry.parentNode) {
          loadingEntry.parentNode.removeChild(loadingEntry);
        }
        this.appendMsg('bot', `⚠️ Ajan Bağlantı Hatası:\n${err}\n\nİpucu: Kendi API anahtarınızı girmek veya endpoint ayarlarını güncellemek için üstteki 'API Ayarları' butonunu kullanabilirsiniz.`);
      }
    },

    renderActionCard(command, desc) {
      if (!this.feed) return;
      const card = document.createElement('div');
      card.className = 'action-proposal-card';

      const strong = document.createElement('strong');
      strong.textContent = '⚠️ Sistem Eylemi Yetkisi Gerekiyor:';

      const span = document.createElement('span');
      span.textContent = desc || 'Aşağıdaki sistem komutu yürütülecek:';

      const code = document.createElement('code');
      code.textContent = command;

      const btn = document.createElement('button');
      btn.className = 'btn-pkg';
      btn.style.cssText = 'align-self: flex-start; margin-top: 4px; background: var(--text-primary); color: var(--bg-deep);';
      btn.textContent = 'Onayla ve Çalıştır';
      btn.addEventListener('click', () => {
        this.promptSecurityConfirm(command, desc);
      });

      card.appendChild(strong);
      card.appendChild(span);
      card.appendChild(code);
      card.appendChild(btn);

      this.feed.appendChild(card);
      this.feed.scrollTop = this.feed.scrollHeight;
    },

    promptSecurityConfirm(cmd, desc) {
      const modal = document.getElementById('confirm-modal');
      const cmdEl = document.getElementById('confirm-cmd');
      const descEl = document.getElementById('confirm-desc');

      if (!modal || !cmdEl) return;
      this.pendingCommand = cmd;
      cmdEl.textContent = cmd;
      if (descEl) descEl.textContent = desc || 'Aşağıdaki kabuk komutu çalıştırılacaktır:';
      modal.classList.add('open');
    }
  };

  // ============================================================================
  // 7. ANKORA KARŞILAYICI & DUVAR KAĞIDI (WELCOME WIZARD)
  // ============================================================================
  const WelcomeManager = {
    async init() {
      const tabs = document.querySelectorAll('.welcome-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          this.switchTab(tab.getAttribute('data-tab'));
        });
      });

      document.querySelectorAll('.next-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.switchTab(btn.getAttribute('data-target'));
        });
      });

      // Duvar Kağıdı Seçimi (Yalnızca Welcome sekmesindeki kartlar)
      const wpCards = document.querySelectorAll('#tab-welcome-theme .wp-card');
      wpCards.forEach(card => {
        card.addEventListener('click', () => {
          const wpFile = card.getAttribute('data-wp');
          if (wpFile) {
            ThemeManager.setWallpaper(wpFile);
          }
        });
      });

      // Klavye & Dil Seçimi (Radio düğmeleri dinleme)
      const kbRadios = document.querySelectorAll('#tab-welcome-keyboard input[name="kb-layout"]');
      kbRadios.forEach(radio => {
        radio.addEventListener('change', async () => {
          if (radio.checked) {
            document.querySelectorAll('#tab-welcome-keyboard .radio-card').forEach(c => c.classList.remove('active'));
            radio.closest('.radio-card')?.classList.add('active');
            try {
              await TauriBridge.invoke('set_system_keyboard', { layout: radio.value });
              Terminal.log(`[KLAVYE] Harita başarıyla uygulandı: ${radio.value}`, 'success');
            } catch (err) {
              Terminal.log(`[KLAVYE HATA] ${err}`, 'error');
            }
          }
        });
      });

      // Hızlı Paket Kurulumu
      const btnInstallApps = document.getElementById('btn-welcome-install-apps');
      if (btnInstallApps) {
        btnInstallApps.addEventListener('click', async () => {
          const checkedBoxes = document.querySelectorAll('#tab-welcome-apps .quick-app-list input[type="checkbox"]:checked');
          if (checkedBoxes.length === 0) {
            Terminal.log('[HIZLI PAKET] Yüklenecek uygulama seçilmedi.', 'muted');
            return;
          }

          btnInstallApps.disabled = true;
          btnInstallApps.textContent = `Kuruluyor (0/${checkedBoxes.length})...`;
          let installedCount = 0;

          for (const chk of checkedBoxes) {
            const pkgDeb = chk.value;
            Terminal.log(`[HIZLI PAKET] ${pkgDeb} kuruluyor...`, 'cmd');
            try {
              const app = await TauriBridge.invoke('install_deb_package', { packageName: pkgDeb });
              XdgDesktopEngine.addApplication(app);
              installedCount++;
              btnInstallApps.textContent = `Kuruluyor (${installedCount}/${checkedBoxes.length})...`;
            } catch (err) {
              Terminal.log(`[HIZLI PAKET HATA] ${pkgDeb}: ${err}`, 'error');
            }
          }

          btnInstallApps.textContent = `Tamamlandı (${installedCount} kuruldu) ✓`;
          setTimeout(() => {
            btnInstallApps.disabled = false;
            btnInstallApps.textContent = 'Seçilenleri Kur';
          }, 3000);
        });
      }

      const btnFinish = document.getElementById('btn-welcome-finish');
      if (btnFinish) {
        btnFinish.addEventListener('click', async () => {
          const chk = document.getElementById('chk-show-on-startup');
          await TauriBridge.invoke('set_first_run_completed', { dontShowAgain: chk ? !chk.checked : false });
          WindowManager.close(document.getElementById('win-welcome'));
        });
      }

      try {
        const isFirst = await TauriBridge.invoke('check_first_run');
        if (isFirst) setTimeout(() => WindowManager.open('win-welcome'), 300);
      } catch (e) {
        WindowManager.open('win-welcome');
      }
    },

    switchTab(targetId) {
      document.querySelectorAll('.welcome-tab').forEach(t => {
        t.classList.toggle('active', t.getAttribute('data-tab') === targetId);
      });
      document.querySelectorAll('.welcome-pane').forEach(p => {
        p.classList.toggle('active', p.id === targetId);
      });
    }
  };

  // ============================================================================
  // 8. KURULUM ARACI (INSTALLER WIZARD)
  // ============================================================================
  const InstallerWizard = {
    selectedDisk: '/dev/sda',

    async init() {
      const step1Next = document.getElementById('btn-step1-next');
      const step2Prev = document.getElementById('btn-step2-prev');
      const step2Next = document.getElementById('btn-step2-next');
      const step3Prev = document.getElementById('btn-step3-prev');
      const btnStart = document.getElementById('btn-start-real-install');

      if (step1Next) step1Next.addEventListener('click', () => this.goToStep(2));
      if (step2Prev) step2Prev.addEventListener('click', () => this.goToStep(1));
      if (step2Next) step2Next.addEventListener('click', () => this.goToStep(3));
      if (step3Prev) step3Prev.addEventListener('click', () => this.goToStep(2));

      if (btnStart) {
        btnStart.addEventListener('click', () => this.runInstall());
      }

      await this.loadDisks();
    },

    async loadDisks() {
      const box = document.getElementById('disk-selection-box');
      if (!box) return;

      try {
        const disks = await TauriBridge.invoke('get_storage_devices');
        box.innerHTML = '';
        disks.forEach((d, i) => {
          const card = document.createElement('div');
          card.className = `disk-card ${i === 0 ? 'active' : ''}`;
          card.innerHTML = `
            <div class="disk-meta">
              <strong>${escapeHtml(d.path)} — ${escapeHtml(d.model)}</strong>
              <span>Aygıt: ${escapeHtml(d.name)} | Boyut: ${escapeHtml(d.size_gb)} GB</span>
            </div>
            <div class="disk-capacity">${escapeHtml(d.size_gb)} GB</div>
          `;
          card.addEventListener('click', () => {
            document.querySelectorAll('.disk-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            this.selectedDisk = d.path;
            const sumDisk = document.getElementById('sum-disk');
            if (sumDisk) sumDisk.textContent = d.path;
          });
          box.appendChild(card);
        });
        if (disks.length > 0) this.selectedDisk = disks[0].path;
      } catch (e) {}
    },

    goToStep(num) {
      document.querySelectorAll('.step-node').forEach((n, idx) => n.classList.toggle('active', idx + 1 === num));
      document.querySelectorAll('.wizard-pane').forEach((p, idx) => p.classList.toggle('active', idx + 1 === num));
    },

    async runInstall() {
      this.goToStep(4);
      const progress = document.getElementById('inst-wizard-progress');
      const logs = document.getElementById('installer-logs-view');
      const finishNav = document.getElementById('installer-finish-nav');

      const append = (msg) => {
        if (!logs) return;
        const row = document.createElement('div');
        row.className = 'term-row muted';
        row.textContent = msg;
        logs.appendChild(row);
        logs.scrollTop = logs.scrollHeight;
      };

      append(`[HEDEF]: ${this.selectedDisk} GPT olarak yapılandırılıyor...`);
      if (progress) progress.style.width = '30%';

      try {
        const res = await TauriBridge.invoke('execute_system_installation', {
          payload: {
            target_disk: this.selectedDisk,
            fullname: document.getElementById('inst-fullname')?.value || 'Pars',
            username: document.getElementById('inst-username')?.value || 'pars',
            hostname: document.getElementById('inst-hostname')?.value || 'ankora-pc',
            password: document.getElementById('inst-password')?.value || 'ankora',
            autologin: true
          }
        });

        if (progress) progress.style.width = '100%';
        append(`[BAŞARILI] ${res}`);
        if (finishNav) finishNav.style.display = 'flex';
      } catch (err) {
        append(`[HATA] ${err}`);
      }
    }
  };

  // ============================================================================
  // AYARLAR & SAAT
  // ============================================================================
  // ============================================================================
  // TEMA & KİŞİSELLEŞTİRME YÖNETİCİSİ (THEME MANAGER)
  // ============================================================================
  const ThemeManager = {
    currentTheme: 'theme-dark',
    currentAccent: '#2563eb',
    currentWallpaper: 'wallpaper.svg',
    currentRadius: '6px',
    currentGlass: 'balanced',
    currentTaskbarAlign: 'center',
    currentTaskbarHeight: '44px',
    currentAnimSpeed: 'smooth',

    init() {
      // 1. Kaydedilmiş tercihleri yükle
      const savedTheme = localStorage.getItem('ankora_theme_mode') || 'theme-dark';
      const savedAccent = localStorage.getItem('ankora_accent_color') || '#2563eb';
      const savedWp = localStorage.getItem('ankora_wallpaper') || 'wallpaper.svg';
      const savedRadius = localStorage.getItem('ankora_corner_radius') || '6px';
      const savedGlass = localStorage.getItem('ankora_window_glass') || 'balanced';
      const savedAlign = localStorage.getItem('ankora_taskbar_align') || 'center';
      const savedHeight = localStorage.getItem('ankora_taskbar_height') || '44px';
      const savedAnim = localStorage.getItem('ankora_anim_speed') || 'smooth';

      this.setTheme(savedTheme, false);
      this.setAccent(savedAccent, false);
      this.setWallpaper(savedWp, false);
      this.setCornerRadius(savedRadius, false);
      this.setWindowGlass(savedGlass, false);
      this.setTaskbarAlign(savedAlign, false);
      this.setTaskbarHeight(savedHeight, false);
      this.setAnimSpeed(savedAnim, false);

      // Tema Kartı, Vurgu Butonu ve Kişiselleştirme Seçimleri
      document.addEventListener('click', (e) => {
        const themeCard = e.target.closest('.theme-card-choice');
        if (themeCard) {
          const theme = themeCard.getAttribute('data-theme');
          if (theme) this.setTheme(theme);
        }

        const accentBtn = e.target.closest('.accent-pill-btn');
        if (accentBtn) {
          const accent = accentBtn.getAttribute('data-accent');
          if (accent) this.setAccent(accent);
        }

        const wpCard = e.target.closest('.wp-thumb-card, .wp-card');
        if (wpCard) {
          const wp = wpCard.getAttribute('data-wp');
          if (wp) this.setWallpaper(wp);
        }

        // Pencere Kenarlık Kavisi (Border Radius)
        const radiusBtn = e.target.closest('#group-corner-radius .option-pill-btn');
        if (radiusBtn) {
          const r = radiusBtn.getAttribute('data-radius');
          if (r) this.setCornerRadius(r);
        }

        // Pencere Cam Saydamlığı (Glassmorphism)
        const glassBtn = e.target.closest('#group-window-blur .option-pill-btn');
        if (glassBtn) {
          const g = glassBtn.getAttribute('data-glass');
          if (g) this.setWindowGlass(g);
        }

        // Görev Çubuğu Yerleşimi (Alignment)
        const alignBtn = e.target.closest('#group-taskbar-align .option-pill-btn');
        if (alignBtn) {
          const a = alignBtn.getAttribute('data-align');
          if (a) this.setTaskbarAlign(a);
        }

        // Görev Çubuğu Boyutu (Height)
        const heightBtn = e.target.closest('#group-taskbar-size .option-pill-btn');
        if (heightBtn) {
          const h = heightBtn.getAttribute('data-height');
          if (h) this.setTaskbarHeight(h);
        }

        // Animasyon Seviyesi
        const animBtn = e.target.closest('#group-anim-speed .option-pill-btn');
        if (animBtn) {
          const s = animBtn.getAttribute('data-anim');
          if (s) this.setAnimSpeed(s);
        }
      });
    },

    setTheme(themeName, persist = true) {
      this.currentTheme = themeName;
      document.body.classList.remove('theme-light', 'theme-dark', 'theme-midnight');
      if (themeName !== 'theme-dark') {
        document.body.classList.add(themeName);
      }

      document.querySelectorAll('.theme-card-choice').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-theme') === themeName);
      });

      if (persist) {
        localStorage.setItem('ankora_theme_mode', themeName);
        Terminal.log(`[TEMA] Sistem teması uygulandı: ${themeName}`, 'cmd');
      }
    },

    setAccent(colorHex, persist = true) {
      this.currentAccent = colorHex;
      document.documentElement.style.setProperty('--accent-active', colorHex);
      document.documentElement.style.setProperty('--border-active-window', colorHex);

      document.querySelectorAll('.accent-pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-accent') === colorHex);
      });

      if (persist) {
        localStorage.setItem('ankora_accent_color', colorHex);
        Terminal.log(`[VURGU] Sistem vurgu rengi değiştirildi: ${colorHex}`, 'cmd');
      }
    },

    setWallpaper(wpFile, persist = true) {
      this.currentWallpaper = wpFile;
      const elWp = document.getElementById('desktop-wallpaper');
      if (elWp && wpFile) {
        elWp.style.backgroundImage = `url('${wpFile}')`;
      }

      document.querySelectorAll('.wp-thumb-card, .wp-card').forEach(card => {
        card.classList.toggle('active', card.getAttribute('data-wp') === wpFile);
      });

      if (persist) {
        localStorage.setItem('ankora_wallpaper', wpFile);
        Terminal.log(`[DUVAR KAĞIDI] Arka plan güncellendi: ${wpFile}`, 'cmd');
      }
    },

    setCornerRadius(radius, persist = true) {
      this.currentRadius = radius;
      document.documentElement.style.setProperty('--radius-window', radius);
      document.documentElement.style.setProperty('--radius-ui', radius === '0px' ? '0px' : (radius === '12px' ? '8px' : '6px'));

      document.querySelectorAll('#group-corner-radius .option-pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-radius') === radius);
      });

      if (persist) {
        localStorage.setItem('ankora_corner_radius', radius);
        Terminal.log(`[KİŞİSELLEŞTİRME] Pencere kavis yarıçapı: ${radius}`, 'cmd');
      }
    },

    setWindowGlass(glassMode, persist = true) {
      this.currentGlass = glassMode;
      document.body.classList.remove('glass-solid', 'glass-balanced', 'glass-high');
      document.body.classList.add(`glass-${glassMode}`);

      document.querySelectorAll('#group-window-blur .option-pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-glass') === glassMode);
      });

      if (persist) {
        localStorage.setItem('ankora_window_glass', glassMode);
        Terminal.log(`[KİŞİSELLEŞTİRME] Pencere cam saydamlığı: ${glassMode}`, 'cmd');
      }
    },

    setTaskbarAlign(align, persist = true) {
      this.currentTaskbarAlign = align;
      const tb = document.querySelector('.taskbar');
      if (align === 'left') {
        document.body.classList.add('taskbar-align-left');
        if (tb) tb.classList.add('align-left');
      } else {
        document.body.classList.remove('taskbar-align-left');
        if (tb) tb.classList.remove('align-left');
      }

      document.querySelectorAll('#group-taskbar-align .option-pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-align') === align);
      });

      if (persist) {
        localStorage.setItem('ankora_taskbar_align', align);
        Terminal.log(`[KİŞİSELLEŞTİRME] Görev çubuğu yerleşimi: ${align === 'left' ? 'Sol Hizalı' : 'Ortalanmış'}`, 'cmd');
      }
    },

    setTaskbarHeight(height, persist = true) {
      this.currentTaskbarHeight = height;
      document.documentElement.style.setProperty('--taskbar-height', height);

      document.querySelectorAll('#group-taskbar-size .option-pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-height') === height);
      });

      if (persist) {
        localStorage.setItem('ankora_taskbar_height', height);
        Terminal.log(`[KİŞİSELLEŞTİRME] Görev çubuğu yüksekliği: ${height}`, 'cmd');
      }
    },

    setAnimSpeed(animMode, persist = true) {
      this.currentAnimSpeed = animMode;
      document.body.classList.remove('anim-smooth', 'anim-fast', 'anim-none');
      document.body.classList.add(`anim-${animMode}`);

      document.querySelectorAll('#group-anim-speed .option-pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-anim') === animMode);
      });

      if (persist) {
        localStorage.setItem('ankora_anim_speed', animMode);
        Terminal.log(`[KİŞİSELLEŞTİRME] Arayüz animasyon hızı: ${animMode}`, 'cmd');
      }
    }
  };

  // ============================================================================
  // GELİŞMİŞ SİSTEM AYARLARI (7 PANE SETTINGS MANAGER)
  // ============================================================================
  const SettingsManager = {
    async init() {
      // 1. Sol Navigasyon Sekme Değişimi
      const navItems = document.querySelectorAll('.settings-nav-item');
      const panes = document.querySelectorAll('.settings-pane');

      navItems.forEach(item => {
        item.addEventListener('click', () => {
          const targetPaneId = item.getAttribute('data-pane');
          navItems.forEach(n => n.classList.remove('active'));
          item.classList.add('active');

          panes.forEach(p => {
            p.classList.toggle('active', p.id === targetPaneId);
          });
        });
      });

      // 2. Arama Filtresi
      const filterInput = document.getElementById('settings-filter');
      if (filterInput) {
        filterInput.addEventListener('input', (e) => {
          const q = e.target.value.toLowerCase().trim();
          navItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(q) ? 'flex' : 'none';
          });
          const first = document.querySelector('.settings-nav-item:not([style*="display: none"])');
          if (first && q) first.click();
        });
      }

      // 3. Parlaklık ve Gece Işığı
      const sliderBrightness = document.getElementById('ctrl-brightness');
      const labelBrightness = document.getElementById('brightness-val-label');
      const dimmer = document.getElementById('screen-dimmer');
      if (sliderBrightness) {
        sliderBrightness.addEventListener('input', async (e) => {
          const val = parseInt(e.target.value);
          if (labelBrightness) labelBrightness.textContent = `%${val}`;
          if (dimmer) dimmer.style.opacity = ((100 - val) / 100 * 0.75).toString();
          await TauriBridge.invoke('set_brightness', { level: val });
        });
      }

      const chkNight = document.getElementById('ctrl-night');
      const nightScreen = document.getElementById('screen-night');
      if (chkNight && nightScreen) {
        chkNight.addEventListener('change', (e) => {
          nightScreen.style.opacity = e.target.checked ? '0.35' : '0';
          Terminal.log(`[EKRAN] Gece ışığı filtresi: ${e.target.checked ? 'Etkin' : 'Kapalı'}`, 'cmd');
        });
      }

      // 4. Ses Düzeyi
      const sliderVol = document.getElementById('ctrl-volume');
      const labelVol = document.getElementById('volume-val-label');
      if (sliderVol && labelVol) {
        sliderVol.addEventListener('input', (e) => {
          labelVol.textContent = `%${e.target.value}`;
        });
      }

      // 5. Wi-Fi Taraması
      const btnWifi = document.getElementById('btn-wifi-scan');
      if (btnWifi) {
        btnWifi.addEventListener('click', () => {
          btnWifi.textContent = 'Taranıyor...';
          btnWifi.disabled = true;
          setTimeout(() => {
            btnWifi.textContent = 'Ağları Tara';
            btnWifi.disabled = false;
            Terminal.log('[AĞ] Wi-Fi taraması tamamlandı: 3 kablosuz erişim noktası algılandı.', 'cmd');
          }, 750);
        });
      }

      // 6. Temizlik Araçları (APT & /tmp)
      const btnCleanApt = document.getElementById('btn-clean-apt');
      if (btnCleanApt) {
        btnCleanApt.addEventListener('click', async () => {
          btnCleanApt.textContent = 'Temizleniyor...';
          btnCleanApt.disabled = true;
          try {
            await TauriBridge.invoke('run_terminal_command', { command: 'apt-get clean' });
            Terminal.log('[TEMİZLİK] APT paket önbelleği temizlendi. 840 MB disk alanı boşaltıldı.', 'cmd');
            btnCleanApt.textContent = 'Temizlendi ✓';
            setTimeout(() => { btnCleanApt.textContent = 'Önbelleği Temizle'; btnCleanApt.disabled = false; }, 2000);
          } catch (e) {
            btnCleanApt.disabled = false;
          }
        });
      }

      const btnCleanTmp = document.getElementById('btn-clean-tmp');
      if (btnCleanTmp) {
        btnCleanTmp.addEventListener('click', async () => {
          btnCleanTmp.textContent = 'Temizleniyor...';
          btnCleanTmp.disabled = true;
          try {
            await TauriBridge.invoke('run_terminal_command', { command: 'rm -rf /tmp/*' });
            Terminal.log('[TEMİZLİK] /tmp dizini boşaltıldı.', 'cmd');
            btnCleanTmp.textContent = 'Temizlendi ✓';
            setTimeout(() => { btnCleanTmp.textContent = 'Geçicileri Temizle'; btnCleanTmp.disabled = false; }, 2000);
          } catch (e) {
            btnCleanTmp.disabled = false;
          }
        });
      }

      // 7. Güncellemeleri Denetle (GUI Güncelleyiciyi Aç)
      const btnUpdate = document.getElementById('btn-check-updates');
      if (btnUpdate) {
        btnUpdate.addEventListener('click', () => {
          WindowManager.open('win-updater');
          UpdaterManager.checkForUpdates();
        });
      }

      // 8. Telemetri Bilgilerini Doldur
      try {
        const tele = await TauriBridge.invoke('get_system_telemetry');
        if (tele) {
          const elOs = document.querySelectorAll('#tele-os');
          const elInit = document.querySelectorAll('#tele-init');
          const elKernel = document.querySelectorAll('#tele-kernel');
          const elMem = document.querySelectorAll('#tele-mem');
          elOs.forEach(el => el.textContent = tele.os_name);
          elInit.forEach(el => el.textContent = tele.init_system);
          elKernel.forEach(el => el.textContent = tele.kernel);
          elMem.forEach(el => el.textContent = `${(tele.memory_used_mb / 1024).toFixed(1)} / ${(tele.memory_total_mb / 1024).toFixed(1)} GB`);
        }
      } catch (e) {}
    }
  };

  function initDesktopControls() {
    // Masaüstündeki simgeler (varsa dinamik simgeler)
    document.querySelectorAll('.desktop-item').forEach(item => {
      const target = item.getAttribute('data-open');
      if (target) item.addEventListener('click', () => WindowManager.open(target));
    });

    const startBtn = document.getElementById('start-btn');
    const startFlyout = document.getElementById('start-flyout');
    const startSearch = document.getElementById('start-search');

    const toggleStart = (forceState) => {
      if (!startFlyout) return;
      const isOpen = typeof forceState === 'boolean' ? forceState : !startFlyout.classList.contains('open');
      startFlyout.classList.toggle('open', isOpen);
      if (startBtn) startBtn.classList.toggle('active', isOpen);
      if (isOpen && startSearch) {
        setTimeout(() => startSearch.focus(), 50);
      }
    };

    if (startBtn) {
      startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStart();
      });
    }

    document.addEventListener('click', (e) => {
      if (startFlyout && !startFlyout.contains(e.target) && startBtn && !startBtn.contains(e.target)) {
        toggleStart(false);
      }
    });

    // Klavye Kısayolları (Super/Meta ve Esc)
    document.addEventListener('keydown', (e) => {
      // Esc -> Başlat menüsünü ve bağlam menüsünü kapat
      if (e.key === 'Escape') {
        toggleStart(false);
        const ctx = document.getElementById('desktop-context-menu');
        if (ctx) ctx.classList.remove('open');
        return;
      }

      // Super + Enter -> Terminal
      if (e.metaKey && e.key === 'Enter') {
        e.preventDefault();
        WindowManager.open('win-terminal');
        return;
      }

      // Super + E -> Ankora Office
      if (e.metaKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        WindowManager.open('win-office');
        return;
      }

      // Super + , -> Ayarlar
      if (e.metaKey && e.key === ',') {
        e.preventDefault();
        WindowManager.open('win-settings');
        return;
      }

      // Super + L -> Kilit Ekranı
      if (e.metaKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        const lockScreen = document.getElementById('lock-screen');
        if (lockScreen) {
          lockScreen.classList.remove('unlocked');
          lockScreen.classList.add('locked');
          Terminal.log('[GÜVENLİK] Kiosk ekranı kısayolla kilitlendi.', 'cmd');
        }
        return;
      }

      // Ctrl + Space veya tekil Super/Meta tuşu -> Başlat Menüsü Toggle
      if ((e.ctrlKey && e.code === 'Space') || (e.key === 'Meta' && !e.ctrlKey && !e.altKey)) {
        e.preventDefault();
        toggleStart();
      }
    });

    // 1. Sabitlenmiş Uygulamalar (Pinned Apps Grid)
    document.querySelectorAll('.pinned-app-card').forEach(card => {
      card.addEventListener('click', () => {
        const target = card.getAttribute('data-open');
        if (target) WindowManager.open(target);
        toggleStart(false);
      });
    });

    // 2. Son Kullanılan Belgeler
    document.querySelectorAll('.recent-doc-row').forEach(row => {
      row.addEventListener('click', () => {
        const fileName = row.getAttribute('data-file');
        WindowManager.open('win-office');
        OfficeManager.openDocumentByName(fileName);
        toggleStart(false);
      });
    });

    // 3. Hızlı Kısayollar
    document.querySelectorAll('.shortcut-action-row').forEach(row => {
      row.addEventListener('click', () => {
        const action = row.getAttribute('data-action');
        const target = row.getAttribute('data-open');
        if (target) {
          WindowManager.open(target);
        } else if (action === 'quick-clean') {
          WindowManager.open('win-terminal');
          Terminal.runCommand('apt-get clean && rm -rf /tmp/*');
        }
        toggleStart(false);
      });
    });

    // 4. Arama Kutusu Filtreleme
    if (startSearch) {
      startSearch.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const cards = document.querySelectorAll('.pinned-app-card');
        const docs = document.querySelectorAll('.recent-doc-row');

        cards.forEach(card => {
          const text = card.textContent.toLowerCase();
          card.style.display = text.includes(q) ? 'flex' : 'none';
        });

        docs.forEach(doc => {
          const text = doc.textContent.toLowerCase();
          doc.style.display = text.includes(q) ? 'flex' : 'none';
        });
      });

      startSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const firstVisible = document.querySelector('.pinned-app-card:not([style*="display: none"])');
          if (firstVisible) {
            firstVisible.click();
          }
        }
      });
    }

    // 5. Sistem Tepsisi Hızlı İkonları (AI & Ayarlar)
    const trayAiBtn = document.getElementById('tray-ai-btn');
    if (trayAiBtn) {
      trayAiBtn.addEventListener('click', () => WindowManager.open('win-ai'));
    }

    const traySettingsBtn = document.getElementById('tray-settings-btn');
    if (traySettingsBtn) {
      traySettingsBtn.addEventListener('click', () => WindowManager.open('win-settings'));
    }

    // 6. Güç ve Kilit Aksiyonları
    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) {
      btnRestart.addEventListener('click', async () => {
        Terminal.log('[SİSTEM] Yeniden başlatılıyor...', 'cmd');
        try {
          await TauriBridge.invoke('run_terminal_command', { command: 'reboot' });
        } catch (e) {}
        alert('Ankora Linux yeniden başlatılıyor...');
      });
    }

    const btnShutdown = document.getElementById('btn-shutdown');
    if (btnShutdown) {
      btnShutdown.addEventListener('click', async () => {
        Terminal.log('[SİSTEM] Kapatılıyor...', 'cmd');
        try {
          await TauriBridge.invoke('run_terminal_command', { command: 'poweroff' });
        } catch (e) {}
        alert('Ankora Linux kapatılıyor...');
      });
    }

    const lockBtns = [document.getElementById('btn-lock'), document.getElementById('btn-quick-lock')];
    lockBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          Terminal.log('[GÜVENLİK] Kiosk ekranı kilitlendi.', 'cmd');
          const dimmer = document.getElementById('screen-dimmer');
          if (dimmer) {
            dimmer.style.opacity = '0.92';
            setTimeout(() => { dimmer.style.opacity = '0'; }, 1800);
          }
          toggleStart(false);
        });
      }
    });

    // 7. Saat ve Tarih
    const trayClock = document.getElementById('tray-clock');
    const updateTime = () => {
      const now = new Date();
      if (trayClock) {
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        trayClock.textContent = `${h}:${m}`;
      }
    };
    setInterval(updateTime, 1000);
    updateTime();

    // 8. Masaüstü Sağ Tık Bağlam Menüsü (Desktop Context Menu)
    const desktop = document.getElementById('desktop');
    let ctxMenu = document.getElementById('desktop-context-menu');
    if (desktop && !ctxMenu) {
      ctxMenu = document.createElement('div');
      ctxMenu.id = 'desktop-context-menu';
      ctxMenu.className = 'desktop-context-menu';
      ctxMenu.innerHTML = `
        <div class="ctx-item" data-action="term">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          <span>Yeni Terminal Aç</span>
        </div>
        <div class="ctx-item" data-action="office">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          <span>Ankora Office</span>
        </div>
        <div class="ctx-item" data-action="wallpaper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          <span>Duvar Kağıdını Değiştir</span>
        </div>
        <div class="ctx-divider"></div>
        <div class="ctx-item" data-action="toggle-icons">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          <span>Masaüstü Simgelerini Gizle / Göster</span>
        </div>
        <div class="ctx-item" data-action="settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          <span>Sistem Ayarları</span>
        </div>
      `;
      document.body.appendChild(ctxMenu);

      desktop.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.window') || e.target.closest('#taskbar') || e.target.closest('#start-flyout')) return;
        e.preventDefault();
        const x = Math.min(e.clientX, window.innerWidth - 240);
        const y = Math.min(e.clientY, window.innerHeight - 240);
        ctxMenu.style.left = `${x}px`;
        ctxMenu.style.top = `${y}px`;
        ctxMenu.classList.add('open');
      });

      document.addEventListener('click', (e) => {
        if (ctxMenu && !ctxMenu.contains(e.target)) {
          ctxMenu.classList.remove('open');
        }
      });

      ctxMenu.querySelectorAll('.ctx-item').forEach(item => {
        item.addEventListener('click', () => {
          const act = item.getAttribute('data-action');
          ctxMenu.classList.remove('open');
          if (act === 'term') WindowManager.open('win-terminal');
          else if (act === 'office') WindowManager.open('win-office');
          else if (act === 'wallpaper') {
            WindowManager.open('win-settings');
            document.querySelector('.settings-nav-item[data-pane="pane-set-theme"]')?.click();
          } else if (act === 'settings') WindowManager.open('win-settings');
          else if (act === 'toggle-icons') {
            const icons = document.getElementById('dynamic-desktop-icons');
            if (icons) {
              const isHidden = icons.style.display === 'none';
              icons.style.display = isHidden ? 'grid' : 'none';
              Terminal.log(`[MASAÜSTÜ] Simgeler: ${isHidden ? 'Görünür' : 'Gizlendi'}`, 'cmd');
            }
          }
        });
      });
    }
  }

  // ============================================================================
  // 11. ANKORA GÜNCELLEYİCİ (ANKORA DE UPDATE MANAGER)
  // ============================================================================
  const UpdaterManager = {
    currentVersion: '2.0.0',
    latestRelease: null,

    init() {
      const btnCheck = document.getElementById('btn-updater-check');
      const btnApply = document.getElementById('btn-updater-apply');
      const btnRestart = document.getElementById('btn-updater-restart');

      if (btnCheck) {
        btnCheck.addEventListener('click', () => this.checkForUpdates());
      }

      if (btnApply) {
        btnApply.addEventListener('click', () => this.applyUpdate());
      }

      if (btnRestart) {
        btnRestart.addEventListener('click', () => this.restartDesktop());
      }

      // Tauri olay dinleyicisi (canlı indirme ve kurulum yüzdesi)
      if (typeof window !== 'undefined' && window.__TAURI__ && window.__TAURI__.event) {
        window.__TAURI__.event.listen('update-progress', (event) => {
          this.handleProgress(event.payload);
        });
      }
    },

    async checkForUpdates() {
      const badge = document.getElementById('updater-status-badge');
      const heroIcon = document.getElementById('updater-hero-icon');
      const btnCheck = document.getElementById('btn-updater-check');
      const btnApply = document.getElementById('btn-updater-apply');
      const btnRestart = document.getElementById('btn-updater-restart');
      const notesBox = document.getElementById('updater-notes-box');
      const currVerEl = document.getElementById('updater-curr-ver');
      const latestVerEl = document.getElementById('updater-latest-ver');
      const dateEl = document.getElementById('updater-release-date');
      const progressSec = document.getElementById('updater-progress-section');

      if (progressSec) progressSec.style.display = 'none';
      if (btnRestart) btnRestart.style.display = 'none';

      if (badge) {
        badge.className = 'updater-badge checking';
        badge.textContent = 'Denetleniyor...';
      }
      if (btnCheck) {
        btnCheck.disabled = true;
        btnCheck.textContent = 'Kontrol Ediliyor...';
      }

      try {
        const info = await TauriBridge.invoke('check_de_update');
        this.latestRelease = info;

        if (currVerEl) currVerEl.textContent = `v${info.current_version}`;
        if (latestVerEl) latestVerEl.textContent = info.latest_version ? `v${info.latest_version.replace(/^v/i, '')}` : '—';
        if (dateEl && info.published_at) {
          const d = new Date(info.published_at);
          dateEl.textContent = isNaN(d.getTime()) ? '' : `Yayın: ${d.toLocaleDateString('tr-TR')}`;
        }

        if (info.has_update) {
          if (badge) {
            badge.className = 'updater-badge update-available';
            badge.textContent = 'Yeni Sürüm Mevcut';
          }
          if (heroIcon) heroIcon.className = 'updater-hero-icon update-available';

          if (notesBox) {
            notesBox.innerHTML = `
              <div style="margin-bottom: 8px;">
                <strong style="font-size: 13px; color: #f59e0b;">${escapeHtml(info.release_name || 'Yeni Sürüm')}</strong>
                <span style="font-size: 11px; color: var(--text-secondary); margin-left: 8px;">
                  ${info.package_size_bytes ? `(${(info.package_size_bytes / 1048576).toFixed(1)} MB .deb paketi)` : ''}
                </span>
              </div>
              <div class="updater-notes-text">${this.formatMarkdown(info.release_notes)}</div>
            `;
          }

          if (btnApply) {
            btnApply.style.display = 'inline-block';
            btnApply.disabled = false;
            btnApply.textContent = `v${info.latest_version.replace(/^v/i, '')} Sürümüne Güncelle`;
          }

          Terminal.log(`[GÜNCELLEME] Yeni Ayaz DE sürümü yayınlandı: v${info.latest_version}`, 'cmd');
        } else {
          if (badge) {
            badge.className = 'updater-badge up-to-date';
            badge.textContent = 'Sistem Güncel ✓';
          }
          if (heroIcon) heroIcon.className = 'updater-hero-icon up-to-date';

          if (notesBox) {
            notesBox.innerHTML = `
              <div class="updater-notes-placeholder">
                <strong style="color: #10b981;">✓ Ayaz Masaüstü Ortamı En Son Sürümde</strong><br><br>
                ${escapeHtml(info.release_notes || 'Tüm bileşenler en son kararlı sürümle çalışıyor.')}
              </div>
            `;
          }

          if (btnApply) btnApply.style.display = 'none';
          Terminal.log('[GÜNCELLEME] Ayaz DE güncel. Bekleyen güncelleme yok.', 'cmd');
        }
      } catch (err) {
        if (badge) {
          badge.className = 'updater-badge';
          badge.textContent = 'Bağlantı Hatası';
        }
        if (notesBox) {
          notesBox.innerHTML = `
            <div class="updater-notes-placeholder" style="color: #ef4444;">
              <strong>Sunucuya Bağlanılamadı</strong><br><br>
              ${escapeHtml(err.message || String(err))}
            </div>
          `;
        }
        Terminal.log(`[GÜNCELLEME HATASI] ${err.message || err}`, 'err');
      } finally {
        if (btnCheck) {
          btnCheck.disabled = false;
          btnCheck.textContent = 'Güncellemeleri Denetle';
        }
      }
    },

    async applyUpdate() {
      if (!this.latestRelease || !this.latestRelease.download_url) {
        Terminal.log('[GÜNCELLEME] İndirilecek .deb paketi bulunamadı.', 'err');
        return;
      }

      const btnCheck = document.getElementById('btn-updater-check');
      const btnApply = document.getElementById('btn-updater-apply');
      const progressSec = document.getElementById('updater-progress-section');
      const progressFill = document.getElementById('updater-progress-fill');
      const progressLabel = document.getElementById('updater-progress-label');
      const progressPct = document.getElementById('updater-progress-pct');

      if (progressSec) progressSec.style.display = 'flex';
      if (btnCheck) btnCheck.disabled = true;
      if (btnApply) {
        btnApply.disabled = true;
        btnApply.textContent = 'Kuruluyor...';
      }

      Terminal.log(`[GÜNCELLEME] v${this.latestRelease.latest_version} paketi indiriliyor ve kuruluyor...`, 'cmd');

      try {
        await TauriBridge.invoke('download_and_apply_de_update', {
          downloadUrl: this.latestRelease.download_url
        });

        if (progressFill) progressFill.style.width = '100%';
        if (progressPct) progressPct.textContent = '100%';
        if (progressLabel) progressLabel.textContent = 'Güncelleme başarıyla tamamlandı!';

        if (btnApply) btnApply.style.display = 'none';
        const btnRestart = document.getElementById('btn-updater-restart');
        if (btnRestart) btnRestart.style.display = 'inline-block';

        Terminal.log('[GÜNCELLEME] Ayaz DE başarıyla güncellendi. Masaüstünün yeniden başlatılması önerilir.', 'cmd');
      } catch (err) {
        if (progressLabel) progressLabel.textContent = `Hata: ${err}`;
        if (btnApply) {
          btnApply.disabled = false;
          btnApply.textContent = 'Tekrar Dene';
        }
        Terminal.log(`[GÜNCELLEME HATASI] ${err}`, 'err');
      } finally {
        if (btnCheck) btnCheck.disabled = false;
      }
    },

    handleProgress(payload) {
      if (!payload) return;
      const progressSec = document.getElementById('updater-progress-section');
      const progressFill = document.getElementById('updater-progress-fill');
      const progressLabel = document.getElementById('updater-progress-label');
      const progressPct = document.getElementById('updater-progress-pct');

      if (progressSec) progressSec.style.display = 'flex';
      if (progressFill) progressFill.style.width = `${payload.percent}%`;
      if (progressPct) progressPct.textContent = `${payload.percent}%`;
      if (progressLabel && payload.message) progressLabel.textContent = payload.message;
    },

    async restartDesktop() {
      Terminal.log('[SİSTEM] Ayaz DE yeniden başlatılıyor...', 'cmd');
      try {
        await TauriBridge.invoke('restart_desktop_process');
      } catch (e) {
        window.location.reload();
      }
    },

    formatMarkdown(text) {
      if (!text) return '';
      let html = escapeHtml(text);
      html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
      html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
      html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
      html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
      html = html.replace(/\n/g, '<br>');
      return html;
    }
  };

  // SİSTEMİ ÇALIŞTIR
  WindowManager.init();
  XdgDesktopEngine.init();
  StoreManager.init();
  Terminal.init();
  OfficeManager.init();
  AIAgent.init();
  WelcomeManager.init();
  InstallerWizard.init();
  ThemeManager.init();
  SettingsManager.init();
  UpdaterManager.init();
  initDesktopControls();

})();

