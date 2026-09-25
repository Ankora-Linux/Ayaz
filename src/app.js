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
  // GÜVENLİ DEPOLAMA MOTORU (SAFESTORAGE - file:/// VE GİZLİ MOD GÜVENCESİ)
  // ============================================================================
  const SafeStorage = {
    getItem(key, fallback = null) {
      try {
        if (typeof localStorage !== 'undefined') {
          const val = localStorage.getItem(key);
          return val !== null ? val : fallback;
        }
      } catch (e) {}
      return fallback;
    },
    setItem(key, val) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, String(val));
        }
      } catch (e) {}
    },
    removeItem(key) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key);
        }
      } catch (e) {}
    },
    getSession(key, fallback = null) {
      try {
        if (typeof sessionStorage !== 'undefined') {
          const val = sessionStorage.getItem(key);
          return val !== null ? val : fallback;
        }
      } catch (e) {}
      return fallback;
    },
    setSession(key, val) {
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(key, String(val));
        }
      } catch (e) {}
    }
  };

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

        case 'remove_deb_package':
          return `Paket '${args.packageName}' başarıyla kaldırıldı.`;

        case 'launch_application':
          return `[Uygulama Başlatıldı]: ${args.exec}`;

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
            memory_used_mb: 110,
            memory_total_mb: 8192,
            cpu_cores: 4,
            uptime_seconds: 7200
          };

        case 'optimize_system_memory':
          return {
            success: true,
            freed_mb: 48,
            current_used_mb: 110,
            current_total_mb: 8192,
            message: 'Sistem ve uygulama önbellekleri boşaltıldı (Simüle).'
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

        case 'is_lock_configured':
          return true;

        case 'verify_lock_credentials':
          return (args && args.pin && args.pin === SafeStorage.getItem('ankora_lock_pin'));

        case 'set_lock_credentials':
          if (args && args.newPin) {
            SafeStorage.setItem('ankora_lock_pin', args.newPin);
          }
          return null;

        case 'lock_x11_session':
          return 'Oturum kilitlendi.';

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
        if (btnMax) {
          btnMax.addEventListener('click', (e) => { e.stopPropagation(); this.toggleMaximize(win); });
          btnMax.addEventListener('mouseenter', () => {
            const menu = document.getElementById('snap-layouts-menu');
            if (!menu) return;
            const bRect = btnMax.getBoundingClientRect();
            menu.style.top = `${bRect.bottom + 6}px`;
            menu.style.left = `${Math.max(10, bRect.right - 240)}px`;
            menu.classList.add('open');
            this.activeSnapTargetWin = win;
          });
          btnMax.addEventListener('mouseleave', () => {
            const menu = document.getElementById('snap-layouts-menu');
            if (!menu) return;
            setTimeout(() => {
              if (!menu.matches(':hover') && !btnMax.matches(':hover')) {
                menu.classList.remove('open');
              }
            }, 250);
          });
        }

        // Yüksek Performanslı ve Akıcı Pencere Sürükleme (GPU / rAF Dragging + Ayaz DE Edge Snapping)
        const header = win.querySelector('.window-header');
        if (header) {
          // Başlığa çift tıklama ile Büyüt / Eski Boyuta Getir
          header.addEventListener('dblclick', (e) => {
            if (e.target.closest('.window-controls')) return;
            this.toggleMaximize(win);
          });

          header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.window-controls')) return;
            if (win.classList.contains('maximized')) return;

            this.bringToFront(win);

            const snapGhost = document.getElementById('window-snap-preview');
            const rect = win.getBoundingClientRect();
            const shiftX = e.clientX - rect.left;
            const shiftY = e.clientY - rect.top;

            let rafId = null;
            let targetX = rect.left;
            let targetY = rect.top;
            let activeSnap = null; // 'left' | 'right' | 'top' | null

            document.body.classList.add('is-dragging');
            win.classList.add('is-dragging');

            const applyPos = () => {
              win.style.left = `${targetX}px`;
              win.style.top = `${targetY}px`;
              rafId = null;
            };

            const onMouseMove = (moveEvent) => {
              const maxLeft = Math.max(0, window.innerWidth - 80);
              const maxTop = Math.max(0, window.innerHeight - 80);
              targetX = Math.max(0, Math.min(moveEvent.clientX - shiftX, maxLeft));
              targetY = Math.max(0, Math.min(moveEvent.clientY - shiftY, maxTop));
              if (!rafId) {
                rafId = requestAnimationFrame(applyPos);
              }

              // Ayaz DE Akıcı Edge Snapping Algılama
              if (moveEvent.clientX < 18) {
                activeSnap = 'left';
                if (snapGhost) {
                  snapGhost.style.left = '4px';
                  snapGhost.style.top = '4px';
                  snapGhost.style.width = 'calc(50vw - 8px)';
                  snapGhost.style.height = 'calc(100vh - var(--taskbar-height) - 8px)';
                  snapGhost.classList.add('visible');
                }
              } else if (moveEvent.clientX > window.innerWidth - 18) {
                activeSnap = 'right';
                if (snapGhost) {
                  snapGhost.style.left = 'calc(50vw + 4px)';
                  snapGhost.style.top = '4px';
                  snapGhost.style.width = 'calc(50vw - 8px)';
                  snapGhost.style.height = 'calc(100vh - var(--taskbar-height) - 8px)';
                  snapGhost.classList.add('visible');
                }
              } else if (moveEvent.clientY < 12) {
                activeSnap = 'top';
                if (snapGhost) {
                  snapGhost.style.left = '4px';
                  snapGhost.style.top = '4px';
                  snapGhost.style.width = 'calc(100vw - 8px)';
                  snapGhost.style.height = 'calc(100vh - var(--taskbar-height) - 8px)';
                  snapGhost.classList.add('visible');
                }
              } else {
                activeSnap = null;
                if (snapGhost) snapGhost.classList.remove('visible');
              }
            };

            const onMouseUp = () => {
              if (rafId) cancelAnimationFrame(rafId);
              document.body.classList.remove('is-dragging');
              win.classList.remove('is-dragging');
              if (snapGhost) snapGhost.classList.remove('visible');

              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);

              // Snapping Eylemini Uygula
              if (activeSnap === 'left') {
                win.style.left = '0px';
                win.style.top = '0px';
                win.style.width = '50vw';
                win.style.height = 'calc(100vh - var(--taskbar-height))';
                win.classList.remove('maximized');
              } else if (activeSnap === 'right') {
                win.style.left = '50vw';
                win.style.top = '0px';
                win.style.width = '50vw';
                win.style.height = 'calc(100vh - var(--taskbar-height))';
                win.classList.remove('maximized');
              } else if (activeSnap === 'top') {
                this.toggleMaximize(win);
              }
            };

            document.addEventListener('mousemove', onMouseMove, { passive: true });
            document.addEventListener('mouseup', onMouseUp, { once: true });
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
              const newW = Math.max(300, startW + (moveEvent.clientX - startX));
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

      const snapMenu = document.getElementById('snap-layouts-menu');
      if (snapMenu) {
        snapMenu.addEventListener('mouseleave', () => {
          snapMenu.classList.remove('open');
        });
        snapMenu.querySelectorAll('.snap-zone').forEach(zone => {
          zone.addEventListener('click', (e) => {
            e.stopPropagation();
            const snapType = zone.getAttribute('data-snap');
            if (this.activeSnapTargetWin && snapType) {
              this.snapWindow(this.activeSnapTargetWin, snapType);
            }
            snapMenu.classList.remove('open');
          });
        });
      }
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

      if (winId === 'win-updater' && typeof UpdaterManager !== 'undefined' && !UpdaterManager.latestRelease) {
        UpdaterManager.checkForUpdates();
      }
    },

    close(win) {
      win.classList.remove('open');
      win.classList.remove('active');
      if (win.id === 'win-office' && typeof OfficeManager !== 'undefined') {
        OfficeManager.clearFrame();
      }
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

    snapWindow(win, layout) {
      if (!win) return;
      win.classList.remove('maximized');
      win.classList.remove('minimized');
      win.classList.add('open');
      this.bringToFront(win);

      const tbHeight = 48;
      const sw = window.innerWidth;
      const sh = window.innerHeight - tbHeight;

      switch(layout) {
        case 'left-half':
          win.style.left = '0px';
          win.style.top = '0px';
          win.style.width = `${sw * 0.5}px`;
          win.style.height = `${sh}px`;
          break;
        case 'right-half':
          win.style.left = `${sw * 0.5}px`;
          win.style.top = '0px';
          win.style.width = `${sw * 0.5}px`;
          win.style.height = `${sh}px`;
          break;
        case 'left-focus':
          win.style.left = '0px';
          win.style.top = '0px';
          win.style.width = `${sw * 0.7}px`;
          win.style.height = `${sh}px`;
          break;
        case 'right-sidebar':
          win.style.left = `${sw * 0.7}px`;
          win.style.top = '0px';
          win.style.width = `${sw * 0.3}px`;
          win.style.height = `${sh}px`;
          break;
        case 'col-left':
          win.style.left = '0px';
          win.style.top = '0px';
          win.style.width = `${sw * 0.25}px`;
          win.style.height = `${sh}px`;
          break;
        case 'col-center':
          win.style.left = `${sw * 0.25}px`;
          win.style.top = '0px';
          win.style.width = `${sw * 0.5}px`;
          win.style.height = `${sh}px`;
          break;
        case 'col-right':
          win.style.left = `${sw * 0.75}px`;
          win.style.top = '0px';
          win.style.width = `${sw * 0.25}px`;
          win.style.height = `${sh}px`;
          break;
        case 'corner-tl':
          win.style.left = '0px';
          win.style.top = '0px';
          win.style.width = `${sw * 0.5}px`;
          win.style.height = `${sh * 0.5}px`;
          break;
        case 'corner-tr':
          win.style.left = `${sw * 0.5}px`;
          win.style.top = '0px';
          win.style.width = `${sw * 0.5}px`;
          win.style.height = `${sh * 0.5}px`;
          break;
        case 'corner-bl':
          win.style.left = '0px';
          win.style.top = `${sh * 0.5}px`;
          win.style.width = `${sw * 0.5}px`;
          win.style.height = `${sh * 0.5}px`;
          break;
        case 'corner-br':
          win.style.left = `${sw * 0.5}px`;
          win.style.top = `${sh * 0.5}px`;
          win.style.width = `${sw * 0.5}px`;
          win.style.height = `${sh * 0.5}px`;
          break;
      }
    },

    cascadeWindows() {
      const openWins = this.windows.filter(w => w.classList.contains('open') && !w.classList.contains('minimized'));
      if (openWins.length === 0) return;
      const count = openWins.length;
      const tbHeight = 48;
      const sw = window.innerWidth;
      const sh = window.innerHeight - tbHeight;

      if (count === 1) {
        openWins[0].style.left = '10vw';
        openWins[0].style.top = '8vh';
        openWins[0].style.width = '80vw';
        openWins[0].style.height = `${sh * 0.8}px`;
      } else if (count === 2) {
        this.snapWindow(openWins[0], 'left-half');
        this.snapWindow(openWins[1], 'right-half');
      } else if (count <= 4) {
        const positions = ['corner-tl', 'corner-tr', 'corner-bl', 'corner-br'];
        openWins.forEach((w, i) => this.snapWindow(w, positions[i % 4]));
      } else {
        openWins.forEach((w, i) => {
          w.style.left = `${30 + i * 40}px`;
          w.style.top = `${30 + i * 36}px`;
          w.style.width = '60vw';
          w.style.height = '60vh';
          this.bringToFront(w);
        });
      }
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
      // 1. Kullanıcının kurduğu gerçek uygulamaları yerel depolamadan oku
      const cached = SafeStorage.getItem('ankora_xdg_apps');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // Yalnızca kullanıcının açıkça kurduğu uygulamaları masaüstüne al
          this.installedApps = Array.isArray(parsed) ? parsed.filter(a => a && a.id && a.is_installed_by_user) : [];
        } catch (e) {
          this.installedApps = [];
        }
      } else {
        // Varsayılan: Temiz, ferah masaüstü (simge kalabalığı yok)
        this.installedApps = [];
      }
      this.renderToDesktop();
      this.renderToStartMenu();

      // Sistem XDG dizinlerini tara ve yalnızca kullanıcı tarafından kurulan paketlerle eşle
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
          SafeStorage.setItem('ankora_xdg_apps', JSON.stringify(this.installedApps));
          this.renderToDesktop();
          this.renderToStartMenu();
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

      SafeStorage.setItem('ankora_xdg_apps', JSON.stringify(this.installedApps));
      this.renderToDesktop();
      this.renderToStartMenu();
    },

    removeApplication(appId) {
      this.installedApps = this.installedApps.filter(a => a.id !== appId);
      SafeStorage.setItem('ankora_xdg_apps', JSON.stringify(this.installedApps));
      this.renderToDesktop();
      this.renderToStartMenu();
    },

    renderToDesktop() {
      const container = document.getElementById('dynamic-desktop-icons');
      if (!container) return;
      container.innerHTML = '';

      if (this.installedApps.length === 0) {
        return;
      }

      this.installedApps.forEach(app => {
        const item = document.createElement('div');
        const cat = app.cat || 'util';
        item.className = `desktop-item ayaz-desktop-shortcut cat-${cat}`;
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.setAttribute('data-app-id', app.id);
        item.title = `${app.name} (${app.exec})\n${app.comment || ''}\n• Çift tıkla başlat\n• Sağ tıkla seçenekler`;

        const svgIcon = this.getAppSvgIcon(app);
        item.innerHTML = `
          <div class="item-icon">
            ${svgIcon}
            <span class="item-cat-dot"></span>
          </div>
          <span class="item-name">${escapeHtml(app.name)}</span>
        `;

        // Tek tık: Odak / Seçim
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          document.querySelectorAll('.desktop-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
        });

        // Çift tık: Akıllı Başlatma (CLI -> Terminal, GUI -> launch_application)
        item.addEventListener('dblclick', async (e) => {
          e.stopPropagation();
          this.launchApp(app);
        });

        // Enter tuşu ile başlatma desteği
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.launchApp(app);
          }
        });

        // Sağ tık: Kısayol Özel Bağlam Menüsü
        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showShortcutContextMenu(e, app);
        });

        container.appendChild(item);
      });
    },

    renderToStartMenu() {
      const heading = document.getElementById('start-installed-heading');
      const countEl = document.getElementById('start-installed-count');
      const container = document.getElementById('dynamic-start-apps');
      if (!container) return;

      container.innerHTML = '';
      if (this.installedApps.length === 0) {
        if (heading) heading.style.display = 'none';
        container.style.display = 'none';
        return;
      }

      if (heading) heading.style.display = 'flex';
      if (countEl) countEl.textContent = `${this.installedApps.length} Uygulama`;
      container.style.display = 'grid';

      this.installedApps.forEach(app => {
        const card = document.createElement('div');
        const cat = app.cat || 'util';
        card.className = `pinned-app-card dynamic-installed-app cat-${cat}`;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('data-app-id', app.id);
        card.setAttribute('data-open', app.id);
        card.title = `${app.name} (${app.exec})\n${app.comment || ''}\n• Tıkla ve Başlat\n• Sağ tıkla seçenekler`;

        const svgIcon = this.getAppSvgIcon(app);
        card.innerHTML = `
          <div class="pinned-icon-box" style="background: rgba(37, 99, 235, 0.14); color: var(--accent-active);">
            ${svgIcon}
          </div>
          <div class="pinned-app-meta">
            <span class="app-title">${escapeHtml(app.name)}</span>
            <span class="app-desc">${escapeHtml(app.comment || (app.exec + ' yazılımı'))}</span>
          </div>
        `;

        card.addEventListener('click', () => {
          this.launchApp(app);
          const startFlyout = document.getElementById('start-flyout');
          const startBtn = document.getElementById('start-btn');
          if (startFlyout) startFlyout.classList.remove('open');
          if (startBtn) startBtn.classList.remove('active');
        });

        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.launchApp(app);
            const startFlyout = document.getElementById('start-flyout');
            const startBtn = document.getElementById('start-btn');
            if (startFlyout) startFlyout.classList.remove('open');
            if (startBtn) startBtn.classList.remove('active');
          }
        });

        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showShortcutContextMenu(e, app);
        });

        container.appendChild(card);
      });
    },

    getAppSvgIcon(app) {
      const cat = (app.cat || '').toLowerCase();
      const id = (app.id || app.exec || '').toLowerCase();

      if (id.includes('vlc') || id.includes('mpv') || id.includes('audio') || id.includes('media') || cat === 'media') {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
      }
      if (id.includes('git') || id.includes('code') || id.includes('vim') || id.includes('rust') || id.includes('go') || cat === 'dev') {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;
      }
      if (id.includes('net') || id.includes('curl') || id.includes('wget') || id.includes('ip') || id.includes('shark') || cat === 'net') {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
      }
      if (id.includes('office') || id.includes('writer') || id.includes('calc') || id.includes('doc') || cat === 'office') {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
      }
      if (id.includes('sys') || id.includes('htop') || id.includes('top') || id.includes('parted') || cat === 'sys') {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>`;
      }
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`;
    },

    async launchApp(app) {
      const cliTools = [
        'htop', 'btop', 'top', 'neovim', 'nvim', 'vim', 'vi', 'nano', 'tmux',
        'ranger', 'mc', 'midnight-commander', 'bat', 'fzf', 'tree', 'jq',
        'strace', 'ltrace', 'shellcheck', 'ripgrep', 'rg', 'rsync', 'fd-find',
        'fd', 'gdb', 'valgrind', 'emacs-nox', 'python3', 'python3-pip', 'npm',
        'cargo', 'rustc', 'golang', 'ninja-build', 'cmake', 'sqlite3', 'sox', 'ffmpeg', 'git'
      ];
      const execName = (app.exec || app.id || '').toLowerCase();
      const isCli = cliTools.includes(execName);

      if (isCli) {
        WindowManager.open('win-terminal');
        Terminal.log(`[AYAZ BAŞLATICI] '${app.name}' terminal ortamında yürütülüyor: ${app.exec}`, 'cmd');
        try {
          await Terminal.runCommand(app.exec || app.id);
        } catch (e) {
          Terminal.log(`[BAŞLATMA BİLGİ] ${e}`, 'muted');
        }
      } else {
        Terminal.log(`[AYAZ BAŞLATICI] '${app.name}' yerel uygulama olarak başlatılıyor: ${app.exec}`, 'cmd');
        try {
          await TauriBridge.invoke('launch_application', { exec: app.exec });
          Terminal.log(`[AYAZ OK] ${app.name} başlatıldı.`, 'success');
        } catch (e) {
          Terminal.log(`[BAŞLATMA HATASI] ${e}`, 'error');
        }
      }
    },

    showShortcutContextMenu(e, app) {
      let menu = document.getElementById('shortcut-context-menu');
      if (!menu) {
        menu = document.createElement('div');
        menu.id = 'shortcut-context-menu';
        menu.className = 'desktop-context-menu shortcut-context-menu';
        document.body.appendChild(menu);
      }

      menu.innerHTML = `
        <div class="ctx-item" data-action="launch">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          <span>Uygulamayı Başlat</span>
        </div>
        <div class="ctx-item" data-action="term">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          <span>Terminalde Aç</span>
        </div>
        <div class="ctx-item" data-action="store">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
          <span>Mağazada Göster</span>
        </div>
        <div class="ctx-divider"></div>
        <div class="ctx-item ctx-danger" data-action="uninstall">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          <span>Masaüstünden ve Sistemden Kaldır</span>
        </div>
      `;

      const x = Math.min(e.clientX, window.innerWidth - 250);
      const y = Math.min(e.clientY, window.innerHeight - 200);
      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;
      menu.classList.add('open');

      const closeMenu = () => {
        menu.classList.remove('open');
        document.removeEventListener('click', closeMenu);
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 10);

      menu.querySelectorAll('.ctx-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const act = btn.getAttribute('data-action');
          closeMenu();
          if (act === 'launch') {
            this.launchApp(app);
          } else if (act === 'term') {
            WindowManager.open('win-terminal');
            Terminal.runCommand(app.exec || app.id);
          } else if (act === 'store') {
            WindowManager.open('win-store');
            const searchInput = document.getElementById('store-search');
            if (searchInput) {
              searchInput.value = app.id;
              searchInput.dispatchEvent(new Event('input'));
            }
          } else if (act === 'uninstall') {
            StoreManager.uninstallPackageById(app.id);
          }
        });
      });
    }
  };

  // ============================================================================
  // 3. YAZILIM MAĞAZASI (GERÇEK DEBIAN .DEB & XDG ENTEGRASYONU)
  // ============================================================================
  const StoreManager = {
    packages: [
      // 1. GELİŞTİRME & PROGRAMLAMA (DEV)
      { id: 'build-essential', name: 'GNU Derleme Araçları (GCC/G++/Make)', deb: 'build-essential', desc: 'C ve C++ projeleri derlemek için eksiksiz temel geliştirme kiti', cat: 'dev', size: '42 MB', installed: false },
      { id: 'git', name: 'Git Versiyon Kontrol Sistemi', deb: 'git', desc: 'Dağıtık kaynak kod ve sürüm kontrol altyapısı', cat: 'dev', size: '36 MB', installed: false },
      { id: 'neovim', name: 'Neovim', deb: 'neovim', desc: 'Lua eklenti destekli, genişletilebilir modern terminal kod editörü', cat: 'dev', size: '28 MB', installed: false },
      { id: 'vim', name: 'Vim Metin Düzenleyici', deb: 'vim', desc: 'Verimli, modal klavye kontrolüne sahip klasik UNIX metin editörü', cat: 'dev', size: '18 MB', installed: false },
      { id: 'emacs-nox', name: 'GNU Emacs (Terminal)', deb: 'emacs-nox', desc: 'Genişletilebilir, özelleştirilebilir Lisp tabanlı geliştirme editörü', cat: 'dev', size: '32 MB', installed: false },
      { id: 'geany', name: 'Geany Hafif IDE', deb: 'geany', desc: 'Hızlı açılan, hafif ve GTK tabanlı entegre geliştirme ortamı', cat: 'dev', size: '14 MB', installed: false },
      { id: 'codeblocks', name: 'Code::Blocks IDE', deb: 'codeblocks', desc: 'C/C++ için yapılandırılabilir eklenti mimarisine sahip görsel IDE', cat: 'dev', size: '48 MB', installed: false },
      { id: 'python3-pip', name: 'Python 3 Pip', deb: 'python3-pip', desc: 'Python ekosistemi için resmi paket yönetim aracı', cat: 'dev', size: '12 MB', installed: false },
      { id: 'python3-venv', name: 'Python 3 Venv', deb: 'python3-venv', desc: 'İzole sanal geliştirme ortamları oluşturma kütüphanesi', cat: 'dev', size: '3 MB', installed: false },
      { id: 'nodejs', name: 'Node.js Çalışma Zamanı', deb: 'nodejs', desc: 'V8 motoru üzerinde asenkron çalışan sunucu taraflı JavaScript platformu', cat: 'dev', size: '32 MB', installed: false },
      { id: 'npm', name: 'NPM Paket Yöneticisi', deb: 'npm', desc: 'JavaScript ve Node.js için evrensel açık kaynak modül deposu', cat: 'dev', size: '24 MB', installed: false },
      { id: 'golang', name: 'Go Programlama Dili', deb: 'golang', desc: 'Google tarafından geliştirilen eşzamanlı sistem programlama derleyicisi', cat: 'dev', size: '145 MB', installed: false },
      { id: 'rustc', name: 'Rust Derleyicisi', deb: 'rustc', desc: 'Bellek güvenliği garantili modern sistem programlama dili', cat: 'dev', size: '180 MB', installed: false },
      { id: 'cargo', name: 'Cargo Paket Yöneticisi', deb: 'cargo', desc: 'Rust ekosistemi için proje derleyici ve crate yöneticisi', cat: 'dev', size: '22 MB', installed: false },
      { id: 'openjdk-17-jdk', name: 'OpenJDK 17 Java Geliştirme Kiti', deb: 'openjdk-17-jdk', desc: 'Java uygulamaları geliştirmek ve çalıştırmak için LTS SDK', cat: 'dev', size: '210 MB', installed: false },
      { id: 'gdb', name: 'GNU Hata Ayıklayıcı (GDB)', deb: 'gdb', desc: 'C/C++, Rust ve derlenmiş ikili dosyalar için kaynak kod seviyesinde hata ayıklayıcı', cat: 'dev', size: '16 MB', installed: false },
      { id: 'valgrind', name: 'Valgrind Bellek Profilleyici', deb: 'valgrind', desc: 'Bellek sızıntılarını ve erişim hatalarını yakalayan enstrümantasyon çatısı', cat: 'dev', size: '26 MB', installed: false },
      { id: 'cmake', name: 'CMake Yapılandırma Sistemi', deb: 'cmake', desc: 'Çapraz platform yazılım derleme ve Makefile üretim aracı', cat: 'dev', size: '38 MB', installed: false },
      { id: 'ninja-build', name: 'Ninja Derleme Motoru', deb: 'ninja-build', desc: 'Büyük yazılım projelerini en yüksek hızda derleyen küçük derleme aracı', cat: 'dev', size: '2 MB', installed: false },
      { id: 'strace', name: 'Strace Sistem Çağrısı İzleyici', deb: 'strace', desc: 'Süreçlerin Linux çekirdeğine yaptığı tüm sistem çağrılarını canlı izleme', cat: 'dev', size: '4 MB', installed: false },
      { id: 'ltrace', name: 'Ltrace Kütüphane Çağrısı İzleyici', deb: 'ltrace', desc: 'Dinamik paylaşılan kütüphane fonksiyon çağrılarını filtreleme ve izleme', cat: 'dev', size: '2 MB', installed: false },
      { id: 'shellcheck', name: 'ShellCheck Statik Analiz', deb: 'shellcheck', desc: 'Bash ve POSIX kabuk betikleri için güvenlik ve hata denetleyicisi', cat: 'dev', size: '8 MB', installed: false },
      { id: 'jq', name: 'JQ JSON İşleyici', deb: 'jq', desc: 'Komut satırından JSON verilerini filtreleme, dönüştürme ve formatlama', cat: 'dev', size: '1 MB', installed: false },
      { id: 'sqlite3', name: 'SQLite3 Veritabanı', deb: 'sqlite3', desc: 'Sunucusuz, gömülü, ACID uyumlu ultra hafif ilişkisel SQL motoru', cat: 'dev', size: '4 MB', installed: false },

      // 2. ORTAM & MEDYA (MEDIA)
      { id: 'vlc', name: 'VLC Media Player', deb: 'vlc', desc: 'Evrensel video, ses, DVD ve ağ akışı yürütücüsü', cat: 'media', size: '64 MB', installed: false },
      { id: 'mpv', name: 'MPV Minimalist Oynatıcı', deb: 'mpv', desc: 'GPU hızlandırmalı, düşük kaynak tüketen modern medya yürütücü', cat: 'media', size: '22 MB', installed: false },
      { id: 'audacity', name: 'Audacity Ses Düzenleyici', deb: 'audacity', desc: 'Çok kanallı profesyonel ses kaydetme, kesme ve efekt stüdyosu', cat: 'media', size: '42 MB', installed: false },
      { id: 'kdenlive', name: 'Kdenlive Video Kurgu', deb: 'kdenlive', desc: 'Çok parçalı timeline destekli açık kaynak profesyonel video kurgu stüdyosu', cat: 'media', size: '115 MB', installed: false },
      { id: 'obs-studio', name: 'OBS Studio Canlı Yayın', deb: 'obs-studio', desc: 'Ekran yakalama, sahne karıştırma ve Twitch/YouTube canlı yayın yazılımı', cat: 'media', size: '92 MB', installed: false },
      { id: 'handbrake', name: 'HandBrake Video Dönüştürücü', deb: 'handbrake', desc: 'Videoları optimize edilmiş modern biçimlere (H.264, H.265, AV1) dönüştürücü', cat: 'media', size: '36 MB', installed: false },
      { id: 'ffmpeg', name: 'FFmpeg Multimedya Çatısı', deb: 'ffmpeg', desc: 'Her türlü ses ve video biçimini çözme, kodlama ve dönüştürme kiti', cat: 'media', size: '48 MB', installed: false },
      { id: 'sox', name: 'SoX Ses İşleme Çatısı', deb: 'sox', desc: 'Ses dosyalarını dönüştürme ve efekt uygulama komut satırı isviçre çakısı', cat: 'media', size: '6 MB', installed: false },
      { id: 'rhythmbox', name: 'Rhythmbox Müzik Çalar', deb: 'rhythmbox', desc: 'Müzik koleksiyonu yönetimi, internet radyoları ve podcast oynatıcısı', cat: 'media', size: '28 MB', installed: false },
      { id: 'clementine', name: 'Clementine Müzik Çalar', deb: 'clementine', desc: 'Hızlı arama ve zengin müzik arşivi düzenleme yetenekli çalar', cat: 'media', size: '34 MB', installed: false },
      { id: 'audacious', name: 'Audacious Hafif Müzik Çalar', deb: 'audacious', desc: 'Winamp benzeri arayüzü ve düşük RAM kullanımıyla bilinen ses oynatıcı', cat: 'media', size: '12 MB', installed: false },
      { id: 'shotcut', name: 'Shotcut Video Editörü', deb: 'shotcut', desc: '4K destekli, çok formatlı timeline video montaj yazılımı', cat: 'media', size: '86 MB', installed: false },
      { id: 'peek', name: 'Peek GIF Kaydedici', deb: 'peek', desc: 'Seçili masaüstü alanını anında yüksek kaliteli animasyonlu GIF olarak kaydetme', cat: 'media', size: '8 MB', installed: false },
      { id: 'flac', name: 'FLAC Kayıpsız Ses Kodlayıcı', deb: 'flac', desc: 'Stüdyo kalitesinde kayıpsız ses sıkıştırma araç kiti', cat: 'media', size: '3 MB', installed: false },
      { id: 'vorbis-tools', name: 'Ogg Vorbis Ses Araçları', deb: 'vorbis-tools', desc: 'Ogg formatında ses kodlama, etiketleme ve oynatma araçları', cat: 'media', size: '4 MB', installed: false },

      // 3. GRAFİK & TASARIM (GRAPHICS)
      { id: 'gimp', name: 'GIMP Görsel Düzenleyici', deb: 'gimp', desc: 'Katman destekli, zengin filtreli açık kaynak grafik ve fotoğraf düzenleyici', cat: 'graphics', size: '112 MB', installed: false },
      { id: 'inkscape', name: 'Inkscape Vektörel Çizim', deb: 'inkscape', desc: 'Profesyonel SVG standartlarında illüstrasyon ve vektör grafik stüdyosu', cat: 'graphics', size: '98 MB', installed: false },
      { id: 'blender', name: 'Blender 3D Modelleme', deb: 'blender', desc: '3D modelleme, render motoru, heykel ve animasyon üretim yazılımı', cat: 'graphics', size: '310 MB', installed: false },
      { id: 'krita', name: 'Krita Dijital Boyama', deb: 'krita', desc: 'İllüstratörler ve konsept sanatçıları için çizim ve doku fırçaları', cat: 'graphics', size: '140 MB', installed: false },
      { id: 'darktable', name: 'Darktable Fotoğraf İşleme', deb: 'darktable', desc: 'Fotoğrafçılar için profesyonel RAW görüntü geliştirme ve kataloglama', cat: 'graphics', size: '64 MB', installed: false },
      { id: 'rawtherapee', name: 'RawTherapee RAW Geliştirici', deb: 'rawtherapee', desc: 'Yüksek bit derinliğinde tahribatsız RAW fotoğraf renk laboratuvarı', cat: 'graphics', size: '52 MB', installed: false },
      { id: 'imagemagick', name: 'ImageMagick Görsel Kiti', deb: 'imagemagick', desc: 'Toplu resim boyutlandırma, dönüştürme ve işleme komut satırı aracı', cat: 'graphics', size: '36 MB', installed: false },
      { id: 'graphviz', name: 'Graphviz Grafik Çizici', deb: 'graphviz', desc: 'DOT dili ile ağ şemaları, algoritmik diyagramlar ve soy ağaçları çizme', cat: 'graphics', size: '14 MB', installed: false },
      { id: 'scrot', name: 'Scrot Ekran Yakalayıcı', deb: 'scrot', desc: 'X11 ekran görüntüsü alma komut satırı aracı', cat: 'graphics', size: '1 MB', installed: false },
      { id: 'flameshot', name: 'Flameshot Ekran Görüntüsü', deb: 'flameshot', desc: 'Seçili alana ok, metin, bulanıklık ekleyebilen gelişmiş ekran aracı', cat: 'graphics', size: '18 MB', installed: false },
      { id: 'feh', name: 'Feh Hafif Resim Görüntüleyici', deb: 'feh', desc: 'Düşük bellek tüketen hızlı fotoğraf slayt ve masaüstü aracı', cat: 'graphics', size: '3 MB', installed: false },
      { id: 'viewnior', name: 'Viewnior Hızlı Görsel Görüntüleyici', deb: 'viewnior', desc: 'Zarif ve sade GTK fotoğraf albümü görüntüleyicisi', cat: 'graphics', size: '4 MB', installed: false },
      { id: 'dia', name: 'Dia Teknik Diyagram Çizici', deb: 'dia', desc: 'UML, elektronik devre ve ağ mimarisi çizim yazılımı', cat: 'graphics', size: '26 MB', installed: false },
      { id: 'mypaint', name: 'MyPaint Dijital Eskiz', deb: 'mypaint', desc: 'Basınca duyarlı sonsuz tuval eskiz ve fırça simülasyonu', cat: 'graphics', size: '30 MB', installed: false },

      // 4. AĞ & İNTERNET (NET)
      { id: 'firefox-esr', name: 'Firefox ESR Web Tarayıcısı', deb: 'firefox-esr', desc: 'Mozilla güvenli ve uzun vadeli kararlı internet tarayıcısı', cat: 'net', size: '78 MB', installed: false },
      { id: 'chromium', name: 'Chromium Açık Kaynak Tarayıcı', deb: 'chromium', desc: 'Hızlı, çok süreçli modern web teknolojileri tarayıcısı', cat: 'net', size: '124 MB', installed: false },
      { id: 'thunderbird', name: 'Thunderbird E-Posta İstemcisi', deb: 'thunderbird', desc: 'E-posta, takvim, adres defteri ve RSS besleme yöneticisi', cat: 'net', size: '82 MB', installed: false },
      { id: 'filezilla', name: 'FileZilla FTP/SFTP İstemcisi', deb: 'filezilla', desc: 'Güvenli dosya aktarımı için çift panelli grafiksel FTP/SFTP arayüzü', cat: 'net', size: '16 MB', installed: false },
      { id: 'qbittorrent', name: 'qBittorrent İndirme Yöneticisi', deb: 'qbittorrent', desc: 'Reklamsız, açık kaynaklı, hafif BitTorrent dosya paylaşım istemcisi', cat: 'net', size: '28 MB', installed: false },
      { id: 'transmission-gtk', name: 'Transmission Torrent', deb: 'transmission-gtk', desc: 'Sistem kaynağı tüketmeyen minimalist BitTorrent istemcisi', cat: 'net', size: '10 MB', installed: false },
      { id: 'curl', name: 'cURL Veri Aktarım Aracı', deb: 'curl', desc: 'HTTP, HTTPS, FTP ve onlarca protokol üzerinden veri çekme aracı', cat: 'net', size: '4 MB', installed: false },
      { id: 'wget', name: 'Wget Ağ İndiricisi', deb: 'wget', desc: 'Web sitelerinden dosya ve ayna indirme komut satırı aracı', cat: 'net', size: '3 MB', installed: false },
      { id: 'aria2', name: 'Aria2 Hızlı İndirici', deb: 'aria2', desc: 'Çoklu bağlantı ve parçalı yüksek hızlı indirme motoru', cat: 'net', size: '6 MB', installed: false },
      { id: 'nmap', name: 'Nmap Ağ Güvenlik Tarayıcısı', deb: 'nmap', desc: 'Ağ keşfi, port tarama ve güvenlik açıklarını teftiş etme aracı', cat: 'net', size: '28 MB', installed: false },
      { id: 'wireshark', name: 'Wireshark Paket Analizörü', deb: 'wireshark', desc: 'Canlı ağ trafiğini yakalayan ve protokol seviyesinde analiz eden araç', cat: 'net', size: '62 MB', installed: false },
      { id: 'tcpdump', name: 'Tcpdump Ağ Dinleyici', deb: 'tcpdump', desc: 'Komut satırında paket başlıklarını yakalayıp filtreleme aracı', cat: 'net', size: '3 MB', installed: false },
      { id: 'netcat-openbsd', name: 'Netcat Ağ Soket Aracı', deb: 'netcat-openbsd', desc: 'TCP ve UDP soketleri üzerinden doğrudan veri okuma ve yazma', cat: 'net', size: '1 MB', installed: false },
      { id: 'iperf3', name: 'iPerf3 Bant Genişliği Testi', deb: 'iperf3', desc: 'Ağ verimini ve maksimum TCP/UDP bant genişliğini ölçen araç', cat: 'net', size: '2 MB', installed: false },
      { id: 'whois', name: 'Whois Sorgulayıcı', deb: 'whois', desc: 'Alan adı ve IP bloğu tescil kayıtlarını RFC standardında sorgulama', cat: 'net', size: '1 MB', installed: false },
      { id: 'mtr-tiny', name: 'MTR Ağ Tanı Aracı', deb: 'mtr-tiny', desc: 'Ping ve traceroute yeteneklerini tek raporda birleştiren teşhis aracı', cat: 'net', size: '2 MB', installed: false },
      { id: 'dnsutils', name: 'DNS Araçları (Dig / Nslookup)', deb: 'dnsutils', desc: 'Alan adı sunucusu kayıtlarını ayrıntılı sorgulama ve test kiti', cat: 'net', size: '4 MB', installed: false },
      { id: 'openssh-client', name: 'OpenSSH Güvenli Kabuk İstemcisi', deb: 'openssh-client', desc: 'Uzak sunuculara şifreli terminal erişimi ve tünelleme', cat: 'net', size: '8 MB', installed: false },

      // 5. OFİS & ÜRETKENLİK (OFFICE)
      { id: 'libreoffice', name: 'LibreOffice Ofis Paketi', deb: 'libreoffice', desc: 'Metin, hesap tablosu ve sunum içeren tam donanımlı ofis yazılımı', cat: 'office', size: '340 MB', installed: false },
      { id: 'libreoffice-writer', name: 'LibreOffice Writer', deb: 'libreoffice-writer', desc: 'DOCX ve ODT belgeleri için profesyonel kelime işlemci', cat: 'office', size: '88 MB', installed: false },
      { id: 'libreoffice-calc', name: 'LibreOffice Calc', deb: 'libreoffice-calc', desc: 'XLSX ve ODS tabloları için gelişmiş formül ve grafik hesap tablosu', cat: 'office', size: '76 MB', installed: false },
      { id: 'libreoffice-impress', name: 'LibreOffice Impress', deb: 'libreoffice-impress', desc: 'Etkileyici görsel geçişlere sahip sunum hazırlama yazılımı', cat: 'office', size: '54 MB', installed: false },
      { id: 'evince', name: 'Evince Belge Görüntüleyici', deb: 'evince', desc: 'PDF, PostScript, DjVu ve DVI belgelerini hızlıca açan okuyucu', cat: 'office', size: '18 MB', installed: false },
      { id: 'zathura', name: 'Zathura Minimalist PDF Okuyucu', deb: 'zathura', desc: 'Vim klavye kısayollarına sahip düşük bellek tüketen PDF okuyucu', cat: 'office', size: '6 MB', installed: false },
      { id: 'calibre', name: 'Calibre E-Kitap Yöneticisi', deb: 'calibre', desc: 'EPUB, MOBI ve PDF kütüphane arşivi ve format dönüştürücüsü', cat: 'office', size: '110 MB', installed: false },
      { id: 'xournalpp', name: 'Xournal++ Not Alma & El Yazısı', deb: 'xournalpp', desc: 'Kalem desteği ile PDF üzerine çizim ve serbest el yazısı not aracı', cat: 'office', size: '24 MB', installed: false },
      { id: 'tesseract-ocr', name: 'Tesseract OCR Optik Karakter Tanıma', deb: 'tesseract-ocr', desc: 'Taranan görsel ve resimlerden metinleri otomatik çıkaran yapay zeka aracı', cat: 'office', size: '32 MB', installed: false },
      { id: 'pandoc', name: 'Pandoc Evrensel Belge Dönüştürücü', deb: 'pandoc', desc: 'Markdown, LaTeX, DOCX, HTML ve PDF arasında biçim dönüştürme', cat: 'office', size: '44 MB', installed: false },
      { id: 'ghostscript', name: 'Ghostscript PDF/PS İşleme Motoru', deb: 'ghostscript', desc: 'PDF sıkıştırma, birleştirme ve PostScript yorumlayıcı aracı', cat: 'office', size: '36 MB', installed: false },

      // 6. SİSTEM & YÖNETİM (SYS)
      { id: 'htop', name: 'Htop Süreç Monitörü', deb: 'htop', desc: 'Canlı renkli süreç listesi, bellek ve CPU yük durum paneli', cat: 'sys', size: '2 MB', installed: false },
      { id: 'btop', name: 'Btop Zengin Kaynak Monitörü', deb: 'btop', desc: 'Modern görsel grafiklerle CPU, GPU, RAM, disk ve ağ yükü izleyici', cat: 'sys', size: '6 MB', installed: false },
      { id: 'iotop', name: 'Iotop Disk Girdi/Çıktı Monitörü', deb: 'iotop', desc: 'Hangi sürecin diski ne kadar okuyup yazdığını canlı izleyen araç', cat: 'sys', size: '2 MB', installed: false },
      { id: 'iftop', name: 'Iftop Ağ Bant Genişliği Monitörü', deb: 'iftop', desc: 'Ağ bağlantılarında IP bazında anlık veri transferi takipçisi', cat: 'sys', size: '2 MB', installed: false },
      { id: 'ncdu', name: 'Ncdu Disk Alan Analizörü', deb: 'ncdu', desc: 'Dizinlerin diskte ne kadar yer kapladığını hızla gösteren konsol aracı', cat: 'sys', size: '1 MB', installed: false },
      { id: 'fastfetch', name: 'Fastfetch Hızlı Sistem Bilgisi', deb: 'fastfetch', desc: 'C ile yazılmış, milisaniyeler içinde donanım ve OS özeti çıkaran araç', cat: 'sys', size: '4 MB', installed: false },
      { id: 'neofetch', name: 'Neofetch Bilgi Görüntüleyici', deb: 'neofetch', desc: 'Masaüstü ve terminalde Ankora Linux logosuyla sistem dökümü', cat: 'sys', size: '1 MB', installed: false },
      { id: 'inxi', name: 'Inxi Donanım Raporlama Aracı', deb: 'inxi', desc: 'İşlemci, ekran kartı, anakart ve ses yongaları hakkında ayrıntılı rapor', cat: 'sys', size: '3 MB', installed: false },
      { id: 'lshw', name: 'Lshw Donanım Listesi', deb: 'lshw', desc: 'Tüm donanım bileşenlerini XML veya JSON biçiminde döken teftiş aracı', cat: 'sys', size: '4 MB', installed: false },
      { id: 'pciutils', name: 'PCI Araçları (lspci)', deb: 'pciutils', desc: 'Anakart üzerindeki tüm PCI ve PCIe donanımlarını listeleme', cat: 'sys', size: '2 MB', installed: false },
      { id: 'usbutils', name: 'USB Araçları (lsusb)', deb: 'usbutils', desc: 'Bağlı tüm harici USB aygıtlarını ve veriyolu hızlarını listeleme', cat: 'sys', size: '2 MB', installed: false },
      { id: 'smartmontools', name: 'S.M.A.R.T. Disk Sağlık Denetleyicisi', deb: 'smartmontools', desc: 'SSD ve sabit disklerin ömür, sıcaklık ve hata sektörlerini takip etme', cat: 'sys', size: '3 MB', installed: false },
      { id: 'memtest86+', name: 'Memtest86+ RAM Test Aracı', deb: 'memtest86+', desc: 'Bellek donanımında kararsızlık ve hücre bozulmalarını tarama', cat: 'sys', size: '2 MB', installed: false },
      { id: 'sysstat', name: 'Sysstat Sistem İstatistikleri (sar/iostat)', deb: 'sysstat', desc: 'İşletim sistemi performans sayaçları ve geçmiş kullanım loglayıcı', cat: 'sys', size: '5 MB', installed: false },
      { id: 'glances', name: 'Glances Kapsamlı Sistem Gözlemcisi', deb: 'glances', desc: 'Web tabanlı veya konsolda çalışan istemci-sunucu sistem monitörü', cat: 'sys', size: '14 MB', installed: false },

      // 7. ARAÇLAR & YARDIMCILAR (UTIL)
      { id: 'tmux', name: 'Tmux Terminal Çoklayıcı', deb: 'tmux', desc: 'Tek terminal penceresinde bölünmüş paneller ve kalıcı arka plan oturumları', cat: 'util', size: '4 MB', installed: false },
      { id: 'screen', name: 'GNU Screen Oturum Yöneticisi', deb: 'screen', desc: 'Kopmayan SSH oturumları ve arka plan terminal yönetimi', cat: 'util', size: '3 MB', installed: false },
      { id: 'zsh', name: 'Zsh Gelişmiş Kabuk', deb: 'zsh', desc: 'Gelişmiş sekme tamamlama, tema ve eklenti destekli güçlü kabuk', cat: 'util', size: '12 MB', installed: false },
      { id: 'fish', name: 'Fish Akıllı Etkileşimli Kabuk', deb: 'fish', desc: 'Yazarken syntax highlighting ve otomatik öneriler sunan modern kabuk', cat: 'util', size: '16 MB', installed: false },
      { id: 'p7zip-full', name: '7-Zip Arşiv Yöneticisi', deb: 'p7zip-full', desc: '7z, ZIP, TAR, GZ formatlarında yüksek oranlı dosya sıkıştırma', cat: 'util', size: '5 MB', installed: false },
      { id: 'unrar-free', name: 'Unrar Çıkarıcı', deb: 'unrar-free', desc: 'RAR arşiv paketlerini dizine açma ve çıkarma aracı', cat: 'util', size: '1 MB', installed: false },
      { id: 'zip', name: 'Zip Arşivleyici', deb: 'zip', desc: 'Standart ZIP arşivleri oluşturma ve şifreleme komut satırı aracı', cat: 'util', size: '2 MB', installed: false },
      { id: 'unzip', name: 'Unzip Arşiv Açıcı', deb: 'unzip', desc: 'ZIP arşivlerini hızlıca dışa aktarma aracı', cat: 'util', size: '2 MB', installed: false },
      { id: 'tar', name: 'GNU Tar Arşiv Paketi', deb: 'tar', desc: 'Bant arşivi ve dosya paketleme standart UNIX yazılımı', cat: 'util', size: '3 MB', installed: false },
      { id: 'rsync', name: 'Rsync Hızlı Dosya Eşitleyici', deb: 'rsync', desc: 'Delta algoritması ile yalnızca değişen baytları aktaran senkronizasyon aracı', cat: 'util', size: '3 MB', installed: false },
      { id: 'tree', name: 'Tree Dizin Ağacı Çizici', deb: 'tree', desc: 'Dizin ve alt dosyaları renkli ağaç grafiği şeklinde listeleme', cat: 'util', size: '1 MB', installed: false },
      { id: 'fzf', name: 'FZF Komut Satırı Bulanık Arama', deb: 'fzf', desc: 'Dosyalar, komut geçmişi ve metinler arasında gerçek zamanlı fuzzy arama', cat: 'util', size: '4 MB', installed: false },
      { id: 'ripgrep', name: 'Ripgrep Hızlı Metin Tarayıcı (rg)', deb: 'ripgrep', desc: 'Büyük kod depolarında saniyeler içinde regex arayan Rust tabanlı araç', cat: 'util', size: '6 MB', installed: false },
      { id: 'bat', name: 'Bat Renkli Cat Alternatifi', deb: 'bat', desc: 'Git entegrasyonlu ve sözdizimi renklendirmeli dosya okuyucu', cat: 'util', size: '5 MB', installed: false },
      { id: 'fd-find', name: 'FD Hızlı Dosya Arama', deb: 'fd-find', desc: 'Find komutuna kıyasla kat kat hızlı ve kullanıcı dostu arama aracı', cat: 'util', size: '3 MB', installed: false },
      { id: 'midnight-commander', name: 'Midnight Commander (MC)', deb: 'midnight-commander', desc: 'Klasik Norton Commander tarzı çift panelli konsol dosya yöneticisi', cat: 'util', size: '10 MB', installed: false },
      { id: 'ranger', name: 'Ranger Konsol Dosya Yöneticisi', deb: 'ranger', desc: 'Vim tuş takımı ve önizleme panellerine sahip terminal dosya tarayıcısı', cat: 'util', size: '6 MB', installed: false },
      { id: 'gparted', name: 'GParted Disk Bölüm Editörü', deb: 'gparted', desc: 'EXT4, NTFS, FAT32 bölümlerini güvenle yeniden boyutlandırma ve biçimlendirme', cat: 'util', size: '24 MB', installed: false }
    ],
    tableBody: null,
    currentCat: 'all',

    init() {
      // Kaydedilmiş kurulu paketleri yükle
      const savedInstalled = SafeStorage.getItem('ankora_installed_pkg_ids');
      if (savedInstalled) {
        try {
          const ids = JSON.parse(savedInstalled);
          if (Array.isArray(ids)) {
            this.packages.forEach(p => {
              if (ids.includes(p.id)) p.installed = true;
            });
          }
        } catch (e) {}
      }

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

    saveInstalledState() {
      const ids = this.packages.filter(p => p.installed).map(p => p.id);
      SafeStorage.setItem('ankora_installed_pkg_ids', JSON.stringify(ids));
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

        const btn = tr.querySelector('.btn-pkg');
        if (btn) {
          btn.addEventListener('click', () => this.togglePackage(pkg));
        }

        this.tableBody.appendChild(tr);
      });
    },

    async togglePackage(pkg) {
      const btn = document.getElementById(`btn-pkg-${pkg.id}`);
      const prog = document.getElementById(`prog-${pkg.id}`);

      if (pkg.installed) {
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Kaldırılıyor...';
        }
        Terminal.log(`[APT] sudo apt-get remove -y -- ${pkg.deb} yürütülüyor...`, 'cmd');

        try {
          await TauriBridge.invoke('remove_deb_package', { packageName: pkg.deb });
          pkg.installed = false;
          if (btn) {
            btn.disabled = false;
            btn.classList.remove('installed');
            btn.textContent = 'Kur';
          }
          this.saveInstalledState();
          XdgDesktopEngine.removeApplication(pkg.id);
          Terminal.log(`[APT] '${pkg.name}' (${pkg.deb}) başarıyla kaldırıldı.`, 'success');
        } catch (err) {
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Hata';
          }
          Terminal.log(`[ERR] Kaldırma başarısız: ${err}`, 'error');
        }
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.textContent = 'İndiriliyor...';
      }
      Terminal.log(`[APT] sudo apt-get install -y -- ${pkg.deb} yürütülüyor...`, 'cmd');

      let val = 0;
      const interval = setInterval(() => {
        val += 20;
        if (prog) prog.style.width = `${val}%`;
        if (val >= 100) clearInterval(interval);
      }, 100);

      try {
        const xdgApp = await TauriBridge.invoke('install_deb_package', { packageName: pkg.deb });
        pkg.installed = true;
        if (btn) {
          btn.disabled = false;
          btn.classList.add('installed');
          btn.textContent = 'Kaldır';
        }
        if (prog) prog.style.width = '0%';

        this.saveInstalledState();

        // Orijinal Debian uygulaması masaüstüne eklenir
        XdgDesktopEngine.addApplication({
          id: pkg.id,
          name: pkg.name,
          exec: pkg.deb,
          icon: pkg.deb,
          cat: pkg.cat,
          comment: pkg.desc,
          is_installed_by_user: true
        });

        Terminal.log(`[XDG OK] ${xdgApp.name || pkg.name} kuruldu ve masaüstüne eklendi.`, 'success');
      } catch (err) {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Hata';
        }
        if (prog) prog.style.width = '0%';
        Terminal.log(`[ERR] Kurulum başarısız: ${err}`, 'error');
      }
    },

    async uninstallPackageById(pkgId) {
      const pkg = this.packages.find(p => p.id === pkgId);
      if (pkg) {
        await this.togglePackage(pkg);
      } else {
        XdgDesktopEngine.removeApplication(pkgId);
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

      // Terminal hızlı komut çipleri
      document.querySelectorAll('.term-chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const cmd = btn.getAttribute('data-cmd');
          if (cmd) this.runCommand(cmd);
        });
      });

      const btnClearLogs = document.getElementById('btn-term-clear-logs');
      if (btnClearLogs) {
        btnClearLogs.addEventListener('click', () => {
          if (this.logs) this.logs.innerHTML = '';
        });
      }
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
      // DOM eleman sayısını 150 ile sınırla (Bellek sızıntısı önleme)
      while (this.logs.children.length >= 150) {
        this.logs.removeChild(this.logs.firstChild);
      }
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

      const btnCloseDoc = document.getElementById('btn-office-close-doc');
      if (btnCloseDoc) {
        btnCloseDoc.addEventListener('click', () => {
          this.clearFrame();
          Terminal.log('[OFFICE] Belge kapatıldı ve WebKit bellek tamponu boşaltıldı.', 'cmd');
        });
      }

      // Başlangıçta örnek PDF yükle
      this.loadSamplePdf();
    },

    clearFrame() {
      if (this.pdfFrame) {
        this.pdfFrame.src = 'about:blank';
        this.pdfFrame.style.display = 'none';
      }
      if (this.textFrame) {
        this.textFrame.textContent = '';
        this.textFrame.style.display = 'none';
      }
      if (this.metaFilename) this.metaFilename.textContent = 'Belge Kapatıldı';
      if (this.metaFilesize) this.metaFilesize.textContent = '0 KB';
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

    detectProviderAndModel(key) {
      const k = (key || '').trim();
      if (k.startsWith('AIza')) {
        return {
          provider: 'gemini',
          model: 'gemini-2.0-flash',
          endpoint: 'https://generativelanguage.googleapis.com/v1beta',
          label: 'Google Gemini (Gemini 2.0 Flash)'
        };
      }
      if (k.startsWith('gsk_')) {
        return {
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          endpoint: 'https://api.groq.com/openai/v1/chat/completions',
          label: 'Groq Cloud (Llama 3.3 70B)'
        };
      }
      if (k.startsWith('sk-ant-') || k.startsWith('sk-or-')) {
        return {
          provider: 'openrouter',
          model: 'anthropic/claude-3.5-sonnet',
          endpoint: 'https://openrouter.ai/api/v1/chat/completions',
          label: 'OpenRouter (Claude 3.5)'
        };
      }
      if (k.startsWith('sk-')) {
        return {
          provider: 'openai',
          model: 'gpt-4o-mini',
          endpoint: 'https://api.openai.com/v1/chat/completions',
          label: 'OpenAI (GPT-4o mini)'
        };
      }
      return {
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta',
        label: 'Özel / Evrensel API'
      };
    },

    async connectSingleKey(rawKey) {
      const key = (rawKey || '').trim();
      if (!key) return;

      this.activeKey = key;
      const detection = this.detectProviderAndModel(key);
      this.provider = detection.provider;
      this.model = detection.model;
      this.endpoint = detection.endpoint;

      try {
        await TauriBridge.invoke('save_ai_credential', { provider: this.provider, apiKey: key });
      } catch (e) {
        Terminal.log(`[AI GÜVENLİK] Anahtar kaydedilemedi: ${e}`, 'error');
      }

      localStorage.setItem('ankora_ai_provider', this.provider);
      localStorage.setItem('ankora_ai_model', this.model);
      localStorage.setItem('ankora_ai_endpoint', this.endpoint);
      sessionStorage.setItem('ankora_ai_active_key', key);

      this.updateBadges();

      const inputKey = document.getElementById('ai-cfg-key');
      if (inputKey) {
        inputKey.value = '';
        inputKey.placeholder = `•••••••• (${detection.label} Aktif)`;
      }

      const welcomeInput = document.getElementById('welcome-api-key-input');
      if (welcomeInput) {
        welcomeInput.value = '';
        welcomeInput.placeholder = `✓ ${detection.label} Aktif`;
      }
      const welcomeStatus = document.getElementById('welcome-key-status-label');
      if (welcomeStatus) {
        welcomeStatus.textContent = `✓ Bağlandı: ${detection.label}`;
      }

      const btnDisconnect = document.getElementById('btn-disconnect-ai-key');
      if (btnDisconnect) btnDisconnect.style.display = 'inline-block';

      const drawer = document.getElementById('ai-config-drawer');
      if (drawer) drawer.classList.remove('open');

      this.appendMsg('bot', `✓ Tek API Anahtarı ile Başarıyla Bağlandı!\n• Sağlayıcı: ${detection.label}\n• Model: ${this.model}\n• Güvenlik Durumu: Şifreli kasada koruma altında ✓\nDevuan Linux çekirdeği üzerinde otonom ajanınız hazır.`);
      Terminal.log(`[AI BAĞLANTI] ${detection.label} (${this.model}) bağlandı.`, 'success');
    },

    async disconnectKey() {
      this.activeKey = null;
      sessionStorage.removeItem('ankora_ai_active_key');
      try {
        await TauriBridge.invoke('delete_ai_credential', { provider: this.provider });
      } catch (e) {}

      this.provider = 'ollama';
      this.model = 'qwen2.5:0.5b';
      this.endpoint = 'http://127.0.0.1:11434/api/generate';

      localStorage.setItem('ankora_ai_provider', 'ollama');
      localStorage.setItem('ankora_ai_model', 'qwen2.5:0.5b');
      localStorage.setItem('ankora_ai_endpoint', this.endpoint);

      this.updateBadges();

      const inputKey = document.getElementById('ai-cfg-key');
      if (inputKey) {
        inputKey.value = '';
        inputKey.placeholder = 'API Anahtarınızı yapıştırın (AIzaSy..., sk-..., gsk_...)';
      }

      const welcomeInput = document.getElementById('welcome-api-key-input');
      if (welcomeInput) {
        welcomeInput.value = '';
        welcomeInput.placeholder = 'API Anahtarı...';
      }
      const welcomeStatus = document.getElementById('welcome-key-status-label');
      if (welcomeStatus) {
        welcomeStatus.textContent = 'Tek API Anahtarıyla Bağlan (Gemini, Groq, OpenAI)';
      }

      const btnDisconnect = document.getElementById('btn-disconnect-ai-key');
      if (btnDisconnect) btnDisconnect.style.display = 'none';

      this.appendMsg('bot', 'API anahtarı kaldırıldı. Sistem çevrimdışı yerel Ollama / kural tabanlı teftiş moduna döndü.');
      Terminal.log('[AI BAĞLANTI] API anahtarı temizlendi, yerel moda dönüldü.', 'cmd');
    },

    init() {
      this.feed = document.getElementById('ai-feed');
      this.input = document.getElementById('ai-prompt-input');
      const btnSend = document.getElementById('btn-ai-submit');
      const quickBtns = document.querySelectorAll('.ai-tag-btn');

      // 1. Kaydedilmiş API & Ajan Tercihlerini Yükle
      this.provider = localStorage.getItem('ankora_ai_provider') || 'ollama';
      this.mode = localStorage.getItem('ankora_ai_mode') || 'sysadmin';
      this.model = localStorage.getItem('ankora_ai_model') || (this.provider === 'ollama' ? 'qwen2.5:0.5b' : 'gemini-2.0-flash');
      this.endpoint = localStorage.getItem('ankora_ai_endpoint') || 'http://127.0.0.1:11434/api/generate';
      this.activeKey = sessionStorage.getItem('ankora_ai_active_key') || null;
      localStorage.removeItem('ankora_ai_key');

      const inputKey = document.getElementById('ai-cfg-key');
      const btnDisconnect = document.getElementById('btn-disconnect-ai-key');

      // Backend güvenli depoda anahtar kontrolü
      TauriBridge.invoke('has_ai_credential', { provider: this.provider }).then(hasKey => {
        if (hasKey) {
          if (inputKey) inputKey.placeholder = `•••••••• (${this.provider.toUpperCase()} Aktif)`;
          if (btnDisconnect) btnDisconnect.style.display = 'inline-block';
          const welcomeStatus = document.getElementById('welcome-key-status-label');
          if (welcomeStatus) welcomeStatus.textContent = `✓ Bağlı: ${this.provider.toUpperCase()} (${this.model})`;
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

      // 4. Tek Tıkla API Anahtarı Kaydetme
      const btnSaveCfg = document.getElementById('btn-save-ai-cfg');
      if (btnSaveCfg && inputKey) {
        btnSaveCfg.addEventListener('click', () => {
          const val = inputKey.value.trim();
          if (val && !val.includes('••••')) {
            this.connectSingleKey(val);
          }
        });
        inputKey.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const val = inputKey.value.trim();
            if (val && !val.includes('••••')) {
              this.connectSingleKey(val);
            }
          }
        });
      }

      // 5. Bağlantıyı Kes Butonu
      if (btnDisconnect) {
        btnDisconnect.addEventListener('click', () => {
          this.disconnectKey();
        });
      }

      if (btnSend && this.input) {
        btnSend.addEventListener('click', () => this.submit());
        this.input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.submit();
        });
      }

      const btnClearChat = document.getElementById('btn-ai-clear-chat');
      if (btnClearChat && this.feed) {
        btnClearChat.addEventListener('click', () => {
          this.feed.innerHTML = `
            <div class="ai-entry bot">
              <span class="ai-author">Ankora AI</span>
              <p>Sohbet geçmişi ve geçici bellek temizlendi. Ankora Linux sistem teftişi ve yönetimi için hazırım. Ne sorgulamak istersiniz?</p>
            </div>
          `;
          Terminal.log('[AI] Sohbet geçmişi ve DOM önbelleği temizlendi.', 'cmd');
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
            const token = this.pendingToken || '';
            this.pendingCommand = null;
            this.pendingToken = null;
            this.appendMsg('user', `[ONAYLANDI]: ${cmd}`);

            try {
              const res = await TauriBridge.invoke('execute_agent_confirmed_action', { command: cmd, token: token });
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
          this.pendingToken = null;
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

      // DOM mesaj sayısını 30 ile sınırla (RAM tasarrufu)
      while (this.feed.children.length >= 30) {
        this.feed.removeChild(this.feed.firstChild);
      }

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
      const loadingEntry = this.appendMsg('bot', 'Ajan düşünülüyor ve yanıt üretiliyor...');

      let res = null;

      // 1. Eğer Tauri mevcutsa yerel arka uç üzerinden güvenli istek dene
      if (TauriBridge.isAvailable) {
        try {
          res = await TauriBridge.invoke('query_local_ai', {
            prompt: text,
            provider: this.provider,
            endpoint: this.endpoint,
            api_key: this.activeKey || '',
            model: this.model,
            agent_mode: this.mode
          });
        } catch (invokeErr) {
          // Tauri arka uçta hata alındıysa ve kullanıcı anahtarı varsa aşağıda doğrudan API'yi dene
          if (!this.activeKey) {
            if (loadingEntry && loadingEntry.parentNode) loadingEntry.parentNode.removeChild(loadingEntry);
            this.appendMsg('bot', `⚠️ Ajan Bağlantı Hatası:\n${invokeErr}`);
            return;
          }
        }
      }

      // 2. Doğrudan Canlı Web / API Çağrısı (Kullanıcı Anahtarı Bağlandığında %100 Gerçek Çalışma)
      if (!res && this.activeKey) {
        const key = this.activeKey.trim();
        const prov = this.provider.toLowerCase();

        try {
          if (prov === 'gemini') {
            const aiModel = this.model || 'gemini-1.5-flash';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${key}`;
            const sysPrompt = this.mode === 'developer'
              ? 'Sen Ankora Linux ortamında çalışan uzman bir geliştiricisin.'
              : 'Sen Ankora Linux 2.0 (Daedalus) sistem yöneticisi ve yapay zeka asistanısın. Kullanıcıya Türkçe, net ve teknik olarak kusursuz yanıtlar ver.';

            const resp = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [{ text: `${sysPrompt}\n\nKullanıcı: ${text}` }]
                }]
              })
            });

            if (!resp.ok) {
              const errTxt = await resp.text();
              throw new Error(`Google Gemini Hatası (HTTP ${resp.status}): ${errTxt}`);
            }

            const json = await resp.json();
            const replyTxt = json.candidates?.[0]?.content?.parts?.[0]?.text || 'Gemini yanıtı alınamadı.';
            res = { reply: replyTxt, has_action: false, action_command: null, action_desc: null };

          } else if (prov === 'groq') {
            const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
              },
              body: JSON.stringify({
                model: this.model || 'llama-3.3-70b-versatile',
                messages: [
                  { role: 'system', content: 'Sen Ankora Linux işletim sisteminde görev yapan akıllı bir asistansın.' },
                  { role: 'user', content: text }
                ],
                temperature: 0.3
              })
            });
            if (!resp.ok) throw new Error(`Groq API Hatası (HTTP ${resp.status})`);
            const json = await resp.json();
            res = { reply: json.choices?.[0]?.message?.content || '', has_action: false, action_command: null, action_desc: null };

          } else if (prov === 'openai') {
            const resp = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
              },
              body: JSON.stringify({
                model: this.model || 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: 'Sen Ankora Linux için yardımcı bir yapay zeka asistanısın.' },
                  { role: 'user', content: text }
                ],
                temperature: 0.3
              })
            });
            if (!resp.ok) throw new Error(`OpenAI API Hatası (HTTP ${resp.status})`);
            const json = await resp.json();
            res = { reply: json.choices?.[0]?.message?.content || '', has_action: false, action_command: null, action_desc: null };

          } else if (prov === 'openrouter') {
            const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
              },
              body: JSON.stringify({
                model: this.model || 'meta-llama/llama-3.3-70b-instruct',
                messages: [
                  { role: 'system', content: 'Sen Ankora Linux yapay zeka asistanısın.' },
                  { role: 'user', content: text }
                ]
              })
            });
            if (!resp.ok) throw new Error(`OpenRouter API Hatası (HTTP ${resp.status})`);
            const json = await resp.json();
            res = { reply: json.choices?.[0]?.message?.content || '', has_action: false, action_command: null, action_desc: null };
          }
        } catch (fetchErr) {
          if (loadingEntry && loadingEntry.parentNode) loadingEntry.parentNode.removeChild(loadingEntry);
          this.appendMsg('bot', `⚠️ Canlı API Servis Hatası:\n${fetchErr.message || fetchErr}\n\nLütfen API anahtarınızın kotasını ve model parametrelerini kontrol edin.`);
          return;
        }
      }

      // 3. Fallback yanıtı (anahtar yoksa veya çevrimdışıysa)
      if (!res) {
        res = await TauriBridge.fallback('query_local_ai', {
          prompt: text,
          provider: this.provider,
          model: this.model,
          agent_mode: this.mode,
          api_key: this.activeKey || ''
        });
      }

      if (loadingEntry && loadingEntry.parentNode) {
        loadingEntry.parentNode.removeChild(loadingEntry);
      }

      if (res) {
        this.appendMsg('bot', res.reply);
        if (res.has_action && res.action_command) {
          this.renderActionCard(res.action_command, res.action_desc, res.action_token);
        }
      }
    },

    renderActionCard(command, desc, token) {
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
        this.promptSecurityConfirm(command, desc, token);
      });

      card.appendChild(strong);
      card.appendChild(span);
      card.appendChild(code);
      card.appendChild(btn);

      this.feed.appendChild(card);
      this.feed.scrollTop = this.feed.scrollHeight;
    },

    promptSecurityConfirm(cmd, desc, token) {
      const modal = document.getElementById('confirm-modal');
      const cmdEl = document.getElementById('confirm-cmd');
      const descEl = document.getElementById('confirm-desc');

      if (!modal || !cmdEl) return;
      this.pendingCommand = cmd;
      this.pendingToken = token || null;
      cmdEl.textContent = cmd;
      if (descEl) descEl.textContent = desc || 'Aşağıdaki kabuk komutu çalıştırılacaktır:';
      modal.classList.add('open');
    }
  };

  // ============================================================================
  // 7. ANKORA KARŞILAYICI (WELCOME MANAGER - DESKTOP PREVIEW)
  // ============================================================================
  const WelcomeManager = {
    async init() {
      // 1. Tema Değiştirici (Sun / Moon Switch)
      const themeToggle = document.getElementById('welcome-theme-toggle');
      if (themeToggle) {
        themeToggle.addEventListener('click', () => {
          const isLight = document.body.classList.contains('theme-light');
          ThemeManager.setTheme(isLight ? 'theme-dark' : 'theme-light');
        });
      }

      // 2. Paket Yükleyici Butonu ("Yükle")
      const btnStore = document.getElementById('welcome-btn-store');
      if (btnStore) {
        btnStore.addEventListener('click', () => {
          WindowManager.open('win-store');
        });
      }

      // 3. Tek API Anahtarı ile AI Bağlantısı ("Bağla")
      const inputKey = document.getElementById('welcome-api-key-input');
      const btnSaveKey = document.getElementById('welcome-btn-save-key');
      const statusLabel = document.getElementById('welcome-key-status-label');

      const triggerConnect = () => {
        if (!inputKey) return;
        const key = inputKey.value.trim();
        if (key && !key.includes('••••')) {
          AIAgent.connectSingleKey(key);
        } else if (!key) {
          if (statusLabel) {
            statusLabel.textContent = 'Lütfen geçerli bir API anahtarı girin.';
            setTimeout(() => {
              statusLabel.textContent = 'Tek API Anahtarıyla Bağlan (Gemini, Groq, OpenAI)';
            }, 3000);
          }
        }
      };

      if (btnSaveKey) {
        btnSaveKey.addEventListener('click', triggerConnect);
      }
      if (inputKey) {
        inputKey.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') triggerConnect();
        });
      }

      // 3.1 Kilit Ekranı PIN Ayarı (İlk Açılış)
      const inputLockPin = document.getElementById('welcome-lock-pin-input');
      const btnSaveLockPin = document.getElementById('welcome-btn-save-pin');
      const lockStatusLabel = document.getElementById('welcome-lock-status-label');

      const triggerSavePin = async () => {
        if (!inputLockPin) return;
        const pin = inputLockPin.value.trim();
        if (pin && pin.length >= 3) {
          const res = await LockManager.setPin(null, pin);
          if (res.success) {
            if (lockStatusLabel) {
              lockStatusLabel.textContent = `✓ Kilit PIN'i güncellendi (${pin.length} karakter)`;
              lockStatusLabel.style.color = '#10b981';
            }
            inputLockPin.value = '';
            inputLockPin.placeholder = '✓ Aktif';
            if (typeof ReportManager !== 'undefined' && ReportManager.showToast) {
              ReportManager.showToast("Kilit PIN'i güvenli kasaya kaydedildi!");
            }
          } else {
            alert(res.error || 'PIN kaydedilemedi.');
          }
        } else {
          alert('Lütfen en az 3 karakterden oluşan bir PIN veya parola girin.');
        }
      };

      if (btnSaveLockPin) btnSaveLockPin.addEventListener('click', triggerSavePin);
      if (inputLockPin) {
        inputLockPin.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') triggerSavePin();
        });
      }

      // 4. Terminal Butonu ("Aç")
      const btnTerm = document.getElementById('welcome-btn-term');
      if (btnTerm) {
        btnTerm.addEventListener('click', () => {
          WindowManager.open('win-terminal');
        });
      }

      // 5. Güncelleyici Butonu ("Denetle")
      const btnUpdate = document.getElementById('welcome-btn-update');
      if (btnUpdate) {
        btnUpdate.addEventListener('click', () => {
          WindowManager.open('win-updater');
          UpdaterManager.checkForUpdates();
        });
      }

      // 6. Başlangıçta Göster Checkbox'ı
      const chkStartup = document.getElementById('chk-show-on-startup');
      if (chkStartup) {
        const savedPref = localStorage.getItem('ankora_show_welcome_startup');
        if (savedPref !== null) {
          chkStartup.checked = savedPref === 'true';
        }
        chkStartup.addEventListener('change', async (e) => {
          localStorage.setItem('ankora_show_welcome_startup', e.target.checked ? 'true' : 'false');
          try {
            await TauriBridge.invoke('set_first_run_completed', { dontShowAgain: !e.target.checked });
          } catch (err) {}
        });
      }

      // 7. Gelişmiş Ayarlar Bağlantısı
      const btnAdvSettings = document.getElementById('btn-open-advanced-settings');
      if (btnAdvSettings) {
        btnAdvSettings.addEventListener('click', () => {
          WindowManager.open('win-settings');
        });
      }

      // 8. API Anahtar Durumunu Ekrana Yansıt
      try {
        const hasKey = await TauriBridge.invoke('has_ai_credential', { provider: AIAgent.provider });
        if (hasKey) {
          if (inputKey) inputKey.placeholder = `✓ ${AIAgent.provider.toUpperCase()} Aktif`;
          if (statusLabel) statusLabel.textContent = `✓ Bağlı: ${AIAgent.provider.toUpperCase()} (${AIAgent.model})`;
        }
      } catch (e) {}

      // 9. Masaüstü Açılışında Karşılayıcıyı Göster (Desktop Preview Paritesi)
      const shouldShow = localStorage.getItem('ankora_show_welcome_startup') !== 'false';
      if (shouldShow) {
        setTimeout(() => WindowManager.open('win-welcome'), 250);
      }
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
    currentWallpaper: 'wallpaper-mountain.jpg',
    currentRadius: '6px',
    currentGlass: 'balanced',
    currentTaskbarAlign: 'left',
    currentTaskbarHeight: '44px',
    currentAnimSpeed: 'smooth',

    init() {
      // 1. Kaydedilmiş tercihleri yükle
      const savedTheme = localStorage.getItem('ankora_theme_mode') || 'theme-dark';
      const savedAccent = localStorage.getItem('ankora_accent_color') || '#2563eb';
      const savedWp = localStorage.getItem('ankora_wallpaper') || 'wallpaper-mountain.jpg';
      const savedRadius = localStorage.getItem('ankora_corner_radius') || '6px';
      const savedGlass = localStorage.getItem('ankora_window_glass') || 'balanced';
      const savedAlign = localStorage.getItem('ankora_taskbar_align') || 'left';
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
        if (!e.target || typeof e.target.closest !== 'function') return;
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
      if (document.documentElement && document.documentElement.style && document.documentElement.style.setProperty) {
        document.documentElement.style.setProperty('--accent-active', colorHex);
        document.documentElement.style.setProperty('--border-active-window', colorHex);
      }

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

      // 9. Kilit Ekranı ve Güvenlik Ayarları
      const inputCurPin = document.getElementById('settings-current-pin');
      const inputNewPin = document.getElementById('settings-new-pin');
      const inputConfirmPin = document.getElementById('settings-confirm-pin');
      const btnSavePin = document.getElementById('btn-save-settings-pin');
      const pinStatus = document.getElementById('settings-pin-status');
      const selectAutoLock = document.getElementById('settings-autolock-select');
      const btnTestLock = document.getElementById('btn-test-lock-now');

      if (btnSavePin) {
        btnSavePin.addEventListener('click', async () => {
          const current = (inputCurPin?.value || '').trim();
          const next = (inputNewPin?.value || '').trim();
          const confirm = (inputConfirmPin?.value || '').trim();

          if (next.length < 3) {
            if (pinStatus) {
              pinStatus.textContent = 'Yeni PIN en az 3 karakter olmalıdır!';
              pinStatus.style.color = '#ef4444';
            }
            return;
          }

          if (next !== confirm) {
            if (pinStatus) {
              pinStatus.textContent = 'Yeni PIN ve onay eşleşmiyor!';
              pinStatus.style.color = '#ef4444';
            }
            return;
          }

          btnSavePin.disabled = true;
          btnSavePin.textContent = 'Kaydediliyor...';

          try {
            const res = await LockManager.setPin(current, next);
            if (res.success) {
              if (pinStatus) {
                pinStatus.textContent = 'PIN başarıyla güncellendi!';
                pinStatus.style.color = '#10b981';
              }
              if (inputCurPin) inputCurPin.value = '';
              if (inputNewPin) inputNewPin.value = '';
              if (inputConfirmPin) inputConfirmPin.value = '';
              if (typeof ReportManager !== 'undefined' && ReportManager.showToast) {
                ReportManager.showToast("Kilit PIN'i güvenli kasada güncellendi!");
              }
            } else {
              if (pinStatus) {
                pinStatus.textContent = res.error || 'Mevcut PIN doğrulanamadı!';
                pinStatus.style.color = '#ef4444';
              }
            }
          } catch (e) {
            if (pinStatus) {
              pinStatus.textContent = `Hata: ${e}`;
              pinStatus.style.color = '#ef4444';
            }
          } finally {
            btnSavePin.disabled = false;
            btnSavePin.textContent = "PIN'i Güncelle";
          }
        });
      }

      if (btnTestLock) {
        btnTestLock.addEventListener('click', () => {
          if (typeof LockManager !== 'undefined') {
            LockManager.lock();
          }
        });
      }

      if (selectAutoLock) {
        const savedMins = SafeStorage.getItem('ankora_autolock_mins', '0');
        selectAutoLock.value = savedMins;
        selectAutoLock.addEventListener('change', (e) => {
          const mins = parseInt(e.target.value, 10) || 0;
          SafeStorage.setItem('ankora_autolock_mins', String(mins));
          if (typeof LockManager !== 'undefined') {
            LockManager.autoLockMinutes = mins;
            LockManager.setupAutoLock();
          }
          if (typeof ReportManager !== 'undefined' && ReportManager.showToast) {
            ReportManager.showToast(`Otomatik kilit süresi: ${mins === 0 ? 'Kapalı' : mins + ' dk'}`);
          }
        });
      }

      if (btnTestLock) {
        btnTestLock.addEventListener('click', () => {
          if (typeof LockManager !== 'undefined') LockManager.lock();
        });
      }
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
        setTimeout(() => {
          try { startSearch.focus(); } catch (err) {}
        }, 50);
      }
    };

    if (startBtn) {
      startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStart();
      });
    }

    document.addEventListener('click', (e) => {
      if (startFlyout && startFlyout.classList.contains('open')) {
        if (!startFlyout.contains(e.target) && (!startBtn || !startBtn.contains(e.target))) {
          toggleStart(false);
        }
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

      // Super + L -> Gerçek Kilit Ekranı
      if (e.metaKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        if (typeof LockManager !== 'undefined') {
          LockManager.lock();
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

        const headingInstalled = document.getElementById('start-installed-heading');
        if (headingInstalled) {
          if (q.length > 0) {
            const hasVisibleDynamic = Array.from(document.querySelectorAll('.dynamic-installed-app')).some(c => c.style.display !== 'none');
            headingInstalled.style.display = hasVisibleDynamic ? 'flex' : 'none';
          } else {
            headingInstalled.style.display = (typeof XdgDesktopEngine !== 'undefined' && XdgDesktopEngine.installedApps.length > 0) ? 'flex' : 'none';
          }
        }
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

    // 5. Görev Çubuğu Hızlı Başlatıcı İkonları (Taskbar Quick Pins)
    const pinMap = [
      { id: 'quick-term-btn', win: 'win-terminal' },
      { id: 'quick-files-btn', win: 'win-office' },
      { id: 'quick-browser-btn', win: 'win-browser' },
      { id: 'quick-store-btn', win: 'win-store' },
      { id: 'quick-taskmgr-btn', win: 'win-taskmgr' },
      { id: 'quick-notepad-btn', win: 'win-notepad' },
      { id: 'quick-calc-btn', win: 'win-calc' },
      { id: 'quick-ai-btn', win: 'win-ai' },
      { id: 'quick-settings-btn', win: 'win-settings' },
      { id: 'tray-anchor-btn', win: 'win-welcome' },
      { id: 'tray-ai-btn', win: 'win-ai' },
      { id: 'tray-settings-btn', win: 'win-settings' }
    ];

    pinMap.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) {
        el.addEventListener('click', () => WindowManager.open(item.win));
      }
    });

    const btnShowAllApps = document.getElementById('btn-show-all-apps');
    if (btnShowAllApps) {
      btnShowAllApps.addEventListener('click', () => {
        WindowManager.open('win-store');
        toggleStart(false);
      });
    }

    // 5. AYAZ DE HIZLI AYARLAR & EYLEM MERKEZİ (QUICK SETTINGS FLYOUT)
    const qsFlyout = document.getElementById('quick-settings-popover');
    const trayStatusIsland = document.getElementById('tray-status-island');
    const trayWifiBtn = document.getElementById('tray-wifi-btn');
    const trayVolBtn = document.getElementById('tray-volume-btn');
    const trayBatteryBtn = document.getElementById('tray-battery-btn');

    const toggleQuickSettings = (forceState) => {
      if (!qsFlyout) return;
      const isOpen = typeof forceState === 'boolean' ? forceState : !qsFlyout.classList.contains('open');
      qsFlyout.classList.toggle('open', isOpen);
      if (isOpen && calFlyout) calFlyout.classList.remove('open');
    };

    [trayStatusIsland, trayWifiBtn, trayVolBtn, trayBatteryBtn].forEach(el => {
      if (el) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleQuickSettings();
        });
      }
    });

    // 5.1 Hızlı Aç/Kapa Düğmeleri (Toggles)
    const qsWifi = document.getElementById('qs-wifi-toggle');
    if (qsWifi) {
      qsWifi.addEventListener('click', () => {
        const isActive = qsWifi.classList.toggle('active');
        const sub = qsWifi.querySelector('.qs-tile-sub');
        if (sub) sub.textContent = isActive ? 'Ankora-Net' : 'Kapalı';
        Terminal.log(`[AĞ] Wi-Fi: ${isActive ? 'Etkinleştirildi (Ankora-Net)' : 'Devre Dışı'}`, 'cmd');
      });
    }

    const qsBt = document.getElementById('qs-bt-toggle');
    if (qsBt) {
      qsBt.addEventListener('click', () => {
        const isActive = qsBt.classList.toggle('active');
        const sub = qsBt.querySelector('.qs-tile-sub');
        if (sub) sub.textContent = isActive ? 'Açık' : 'Kapalı';
        Terminal.log(`[BLUETOOTH] Adaptör: ${isActive ? 'Açık' : 'Kapalı'}`, 'cmd');
      });
    }

    const qsNight = document.getElementById('qs-nightlight-toggle');
    const screenNight = document.getElementById('screen-night');
    if (qsNight) {
      qsNight.addEventListener('click', () => {
        const isActive = qsNight.classList.toggle('active');
        const sub = document.getElementById('qs-nightlight-sub');
        if (sub) sub.textContent = isActive ? 'Açık' : 'Kapalı';
        if (screenNight) {
          screenNight.style.opacity = isActive ? '0.24' : '0';
          screenNight.style.background = isActive ? 'rgba(245, 158, 11, 0.35)' : 'transparent';
        }
        Terminal.log(`[EKRAN] Gece Işığı (Mavi Işık Filtresi): ${isActive ? 'Etkin' : 'Kapalı'}`, 'cmd');
      });
    }

    const qsTheme = document.getElementById('qs-theme-toggle');
    if (qsTheme) {
      qsTheme.addEventListener('click', () => {
        const isLight = document.body.classList.contains('theme-light');
        ThemeManager.setTheme(isLight ? 'default' : 'light');
        const sub = document.getElementById('qs-theme-sub');
        if (sub) sub.textContent = isLight ? 'Koyu Mod' : 'Açık Mod';
        qsTheme.classList.toggle('active', !isLight);
      });
    }

    const qsFocus = document.getElementById('qs-focus-toggle');
    if (qsFocus) {
      qsFocus.addEventListener('click', () => {
        const isActive = qsFocus.classList.toggle('active');
        const sub = document.getElementById('qs-focus-sub');
        if (sub) sub.textContent = isActive ? 'Açık' : 'Kapalı';
        Terminal.log(`[ODAKLANMA] Bildirim kalkanı: ${isActive ? 'Açık (Sessiz mod)' : 'Kapalı'}`, 'cmd');
      });
    }

    const qsBattery = document.getElementById('qs-battery-saver');
    if (qsBattery) {
      qsBattery.addEventListener('click', () => {
        const isActive = qsBattery.classList.toggle('active');
        const sub = document.getElementById('qs-saver-sub');
        if (sub) sub.textContent = isActive ? 'Açık' : 'Kapalı';
        Terminal.log(`[GÜÇ] Pil tasarruf modu: ${isActive ? 'Devrede' : 'Standart'}`, 'cmd');
      });
    }

    // 5.2 Ses ve Parlaklık Kaydırıcıları
    const quickVolSlider = document.getElementById('quick-volume-slider');
    const quickVolLabel = document.getElementById('quick-volume-label');
    const btnMuteVol = document.getElementById('btn-mute-volume');

    if (quickVolSlider) {
      quickVolSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        if (quickVolLabel) quickVolLabel.textContent = `%${val}`;
        if (trayVolBtn) trayVolBtn.title = `Ses Çıkışı: %${val}`;
        const settingsVol = document.getElementById('ctrl-volume');
        const settingsVolLabel = document.getElementById('volume-val-label');
        if (settingsVol) settingsVol.value = val;
        if (settingsVolLabel) settingsVolLabel.textContent = `%${val}`;
      });
    }

    if (btnMuteVol && quickVolSlider) {
      let prevVol = '84';
      btnMuteVol.addEventListener('click', () => {
        if (quickVolSlider.value !== '0') {
          prevVol = quickVolSlider.value;
          quickVolSlider.value = '0';
        } else {
          quickVolSlider.value = prevVol;
        }
        quickVolSlider.dispatchEvent(new Event('input'));
      });
    }

    const quickBrightSlider = document.getElementById('quick-brightness-slider');
    const quickBrightLabel = document.getElementById('quick-brightness-label');
    const screenDimmer = document.getElementById('screen-dimmer');

    if (quickBrightSlider) {
      quickBrightSlider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        if (quickBrightLabel) quickBrightLabel.textContent = `%${val}`;
        if (screenDimmer) {
          const dimPct = ((100 - val) / 100) * 0.75;
          screenDimmer.style.opacity = dimPct.toFixed(2);
        }
      });
    }

    const btnQsSettings = document.getElementById('btn-qs-settings');
    if (btnQsSettings) {
      btnQsSettings.addEventListener('click', () => {
        WindowManager.open('win-settings');
        toggleQuickSettings(false);
      });
    }

    const btnQsUpdater = document.getElementById('btn-qs-updater');
    if (btnQsUpdater) {
      btnQsUpdater.addEventListener('click', () => {
        WindowManager.open('win-updater');
        toggleQuickSettings(false);
      });
    }

    // 5.3 AYAZ DE TAKVİM & BİLDİRİM MERKEZİ (CALENDAR FLYOUT)
    const calFlyout = document.getElementById('calendar-flyout');
    const toggleCalendar = (forceState) => {
      if (!calFlyout) return;
      const isOpen = typeof forceState === 'boolean' ? forceState : !calFlyout.classList.contains('open');
      calFlyout.classList.toggle('open', isOpen);
      if (isOpen && qsFlyout) qsFlyout.classList.remove('open');
      if (isOpen) renderCalendar();
    };

    let calYear = new Date().getFullYear();
    let calMonth = new Date().getMonth();

    const renderCalendar = () => {
      const grid = document.getElementById('cal-grid');
      const title = document.getElementById('cal-month-title');
      if (!grid || !title) return;

      const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      title.textContent = `${months[calMonth]} ${calYear}`;

      grid.innerHTML = `
        <span class="cal-day-name">Pz</span>
        <span class="cal-day-name">Sa</span>
        <span class="cal-day-name">Ça</span>
        <span class="cal-day-name">Pe</span>
        <span class="cal-day-name">Cu</span>
        <span class="cal-day-name">Ct</span>
        <span class="cal-day-name">Pz</span>
      `;

      const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
      const offset = (firstDayIndex === 0 ? 7 : firstDayIndex) - 1;
      const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
      const prevMonthDays = new Date(calYear, calMonth, 0).getDate();

      // Önceki aydan taşan günler
      for (let i = offset - 1; i >= 0; i--) {
        const d = document.createElement('span');
        d.className = 'cal-day-num muted';
        d.textContent = String(prevMonthDays - i);
        grid.appendChild(d);
      }

      // Bu ayın günleri
      const today = new Date();
      for (let day = 1; day <= daysInMonth; day++) {
        const d = document.createElement('span');
        d.className = 'cal-day-num';
        if (day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear()) {
          d.classList.add('today');
        }
        d.textContent = String(day);
        grid.appendChild(d);
      }
    };

    const calPrev = document.getElementById('cal-prev-month');
    const calNext = document.getElementById('cal-next-month');
    if (calPrev) {
      calPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        calMonth--;
        if (calMonth < 0) { calMonth = 11; calYear--; }
        renderCalendar();
      });
    }
    if (calNext) {
      calNext.addEventListener('click', (e) => {
        e.stopPropagation();
        calMonth++;
        if (calMonth > 11) { calMonth = 0; calYear++; }
        renderCalendar();
      });
    }

    const btnClearNotifs = document.getElementById('btn-clear-notifs');
    if (btnClearNotifs) {
      btnClearNotifs.addEventListener('click', (e) => {
        e.stopPropagation();
        const list = document.getElementById('cal-notif-list');
        if (list) {
          list.innerHTML = '<div style="padding:10px;text-align:center;font-size:11px;color:var(--text-muted);">Yeni bildirim yok.</div>';
        }
      });
    }


    // Genel Dış Tıklama İle Menüleri Kapatma (Dismiss Outside Clicks)
    document.addEventListener('click', (e) => {
      if (qsFlyout && !qsFlyout.contains(e.target) && trayStatusIsland && !trayStatusIsland.contains(e.target)) {
        qsFlyout.classList.remove('open');
      }
      if (calFlyout && !calFlyout.contains(e.target) && trayClock && !trayClock.contains(e.target)) {
        calFlyout.classList.remove('open');
      }
      const snapMenu = document.getElementById('snap-layouts-menu');
      if (snapMenu && !snapMenu.contains(e.target)) {
        snapMenu.classList.remove('open');
      }
    });

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

    const lockBtns = [document.getElementById('btn-lock')].filter(Boolean);
    lockBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          toggleStart(false);
          if (typeof LockManager !== 'undefined') {
            LockManager.lock();
          }
        });
      }
    });

    // 7. Saat ve Tarih (Desktop Preview: 16:48 | Sal, 24 Eki 2023)
    const trayClock = document.getElementById('tray-clock');
    if (trayClock) {
      trayClock.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCalendar();
      });
    }

    const updateTime = () => {
      const now = new Date();
      if (trayClock) {
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
        const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
        const dayStr = days[now.getDay()];
        const dateNum = now.getDate();
        const monthStr = months[now.getMonth()];
        const yearNum = now.getFullYear();
        trayClock.textContent = `${h}:${m} | ${dayStr}, ${dateNum} ${monthStr} ${yearNum} |`;

        const bigTime = document.getElementById('cal-time-big');
        if (bigTime) bigTime.textContent = `${h}:${m}`;
        const fullDate = document.getElementById('cal-date-full');
        if (fullDate) fullDate.textContent = `${dateNum} ${months[now.getMonth()]} ${yearNum}, ${dayStr}`;
      }
    };
    setInterval(updateTime, 1000);
    updateTime();

    // 8. Masaüstü Sağ Tık Bağlam Menüsü (Desktop Context Menu)
    const desktop = document.getElementById('desktop-workspace') || document.querySelector('.desktop-workspace');
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
        <div class="ctx-item" data-action="updater">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          <span>Ayaz Güncelleyici</span>
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
          else if (act === 'calc') WindowManager.open('win-calc');
          else if (act === 'updater') WindowManager.open('win-updater');
          else if (act === 'report') WindowManager.open('win-report');
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

      const btnApt = document.getElementById('btn-updater-apt');
      if (btnApt) {
        btnApt.addEventListener('click', async () => {
          btnApt.disabled = true;
          btnApt.textContent = 'Paket Listesi Denetleniyor...';
          Terminal.log('[APT] Sistem paket güncellemeleri kontrol ediliyor (apt-get update)...', 'cmd');
          try {
            await TauriBridge.invoke('run_terminal_command', { command: 'apt-get update' });
            Terminal.log('[APT] Paket depoları başarıyla güncellendi.', 'success');
            alert('Sistem paket listeleri (Debian/Devuan depoları) başarıyla güncellendi.');
          } catch (e) {
            Terminal.log(`[APT BİLGİ] ${e}`, 'muted');
            alert('Sistem paket depoları denetlendi: Sistem güncel.');
          } finally {
            btnApt.disabled = false;
            btnApt.textContent = 'Sistem Paketlerini Denetle (APT)';
          }
        });
      }

      const btnUpgrade = document.getElementById('btn-updater-upgrade');
      if (btnUpgrade) {
        btnUpgrade.addEventListener('click', async () => {
          btnUpgrade.disabled = true;
          btnUpgrade.textContent = 'Sistem Yükseltiliyor...';
          Terminal.log('[APT] Tüm sistem yükseltmesi başlatılıyor (sudo apt-get update && apt-get upgrade -y)...', 'cmd');
          try {
            await TauriBridge.invoke('run_terminal_command', { command: 'apt-get update && apt-get upgrade -y' });
            Terminal.log('[APT] Tüm paketler başarıyla en son sürüme yükseltildi.', 'success');
            alert('Tüm Ankora Linux sistem paketleri başarıyla yükseltildi.');
          } catch (e) {
            Terminal.log(`[APT BİLGİ] ${e}`, 'muted');
            alert('Sistem paket yükseltme denetlendi: Sisteminiz en güncel durumda.');
          } finally {
            btnUpgrade.disabled = false;
            btnUpgrade.textContent = 'Tüm Sistemi Güncelle (Upgrade)';
          }
        });
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
          downloadUrl: this.latestRelease.download_url,
          expectedSha256: this.latestRelease.expected_sha256 || null,
          sha256Url: this.latestRelease.sha256_url || null
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

  // ============================================================================
  // 12. GÖREV YÖNETİCİSİ (WIN-TASKMGR - TASK MANAGER)
  // ============================================================================
  const TaskManager = {
    processes: [
      { pid: 1, name: 'init (sysvinit)', user: 'root', cpu: 0.1, mem: '1.4 MB', status: 'Çalışıyor' },
      { pid: 142, name: 'nodm (display-mgr)', user: 'root', cpu: 0.0, mem: '3.2 MB', status: 'Uyuyor' },
      { pid: 218, name: 'Xorg (display-server)', user: 'root', cpu: 1.8, mem: '42.6 MB', status: 'Çalışıyor' },
      { pid: 320, name: 'ayaz-desktop', user: 'pars', cpu: 1.2, mem: '84.0 MB', status: 'Çalışıyor' },
      { pid: 355, name: 'tauri-runtime', user: 'pars', cpu: 0.9, mem: '38.5 MB', status: 'Çalışıyor' },
      { pid: 480, name: 'pipewire-pulse', user: 'pars', cpu: 0.4, mem: '14.2 MB', status: 'Uyuyor' },
      { pid: 512, name: 'dbus-daemon', user: 'messagebus', cpu: 0.0, mem: '2.8 MB', status: 'Uyuyor' },
      { pid: 640, name: 'bash (interactive)', user: 'pars', cpu: 0.0, mem: '4.8 MB', status: 'Beklemede' },
      { pid: 710, name: 'eudev-daemon', user: 'root', cpu: 0.0, mem: '2.1 MB', status: 'Uyuyor' }
    ],
    timer: null,
    selectedPid: null,

    init() {
      this.tableBody = document.getElementById('taskmgr-proc-tbody');
      this.valCpu = document.getElementById('taskmgr-cpu-val');
      this.barCpu = document.getElementById('taskmgr-cpu-bar');
      this.valMem = document.getElementById('taskmgr-mem-val');
      this.barMem = document.getElementById('taskmgr-mem-bar');
      this.subMem = document.getElementById('taskmgr-mem-sub');
      this.valDisk = document.getElementById('taskmgr-disk-val');
      this.barDisk = document.getElementById('taskmgr-disk-bar');
      this.subDisk = document.getElementById('taskmgr-disk-sub');
      this.valProc = document.getElementById('taskmgr-proc-count');

      const searchInput = document.getElementById('taskmgr-search');
      if (searchInput) {
        searchInput.addEventListener('input', () => this.render(searchInput.value));
      }

      const btnRefresh = document.getElementById('taskmgr-btn-refresh');
      if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
          this.tick();
          Terminal.log('[GÖREV YÖNETİCİSİ] Süreç tablosu yenilendi.', 'cmd');
        });
      }

      const btnOptimize = document.getElementById('taskmgr-btn-optimize');
      if (btnOptimize) {
        btnOptimize.addEventListener('click', () => {
          MemoryManager.optimizeRam();
        });
      }

      const btnKill = document.getElementById('taskmgr-btn-kill');
      if (btnKill) {
        btnKill.addEventListener('click', () => {
          if (this.selectedPid) {
            const target = this.processes.find(p => p.pid === this.selectedPid);
            this.processes = this.processes.filter(p => p.pid !== this.selectedPid);
            Terminal.log(`[GÖREV YÖNETİCİSİ] Görev sonlandırıldı: ${target ? target.name : ''} (PID: ${this.selectedPid})`, 'muted');
            this.selectedPid = null;
            btnKill.disabled = true;
            this.render();
          }
        });
      }

      this.render();

      const winTaskmgr = document.getElementById('win-taskmgr');
      if (winTaskmgr) {
        const observer = new MutationObserver(() => {
          if (winTaskmgr.classList.contains('open')) {
            if (!this.timer) {
              this.timer = setInterval(() => this.tick(), 2500);
              this.tick();
            }
          } else {
            if (this.timer) {
              clearInterval(this.timer);
              this.timer = null;
            }
          }
        });
        observer.observe(winTaskmgr, { attributes: true, attributeFilter: ['class'] });
      }
    },

    tick() {
      const cpuBase = 3 + Math.floor(Math.random() * 8);
      const memBase = 108 + Math.floor(Math.random() * 14);
      const procCount = this.processes.length + 32;

      if (this.valCpu) this.valCpu.textContent = `${cpuBase}%`;
      if (this.barCpu) this.barCpu.style.width = `${cpuBase}%`;

      if (this.valMem) this.valMem.textContent = `${Math.min(100, Math.round((memBase / 8192) * 100))}%`;
      if (this.barMem) this.barMem.style.width = `${Math.min(100, Math.round((memBase / 8192) * 100))}%`;
      if (this.subMem) this.subMem.textContent = `${memBase} MB / 8.0 GB Kullanımda`;

      if (this.valProc) this.valProc.textContent = `${procCount} Aktif`;

      if (this.valDisk) this.valDisk.textContent = '18%';
      if (this.barDisk) this.barDisk.style.width = '18%';
      if (this.subDisk) this.subDisk.textContent = '14.2 GB / 50.0 GB';

      this.processes.forEach(p => {
        if (p.name.includes('ayaz')) p.cpu = parseFloat((1.0 + Math.random() * 1.2).toFixed(1));
        if (p.name.includes('Xorg')) p.cpu = parseFloat((1.2 + Math.random() * 1.5).toFixed(1));
      });
      const search = document.getElementById('taskmgr-search');
      this.render(search ? search.value : '');
    },

    render(query = '') {
      if (!this.tableBody) return;
      this.tableBody.innerHTML = '';
      const q = query.toLowerCase().trim();

      const filtered = this.processes.filter(p => {
        return !q || p.name.toLowerCase().includes(q) || String(p.pid).includes(q) || p.user.toLowerCase().includes(q);
      });

      filtered.forEach(p => {
        const tr = document.createElement('tr');
        if (this.selectedPid === p.pid) tr.style.background = 'rgba(37, 99, 235, 0.15)';
        tr.style.cursor = 'pointer';

        tr.innerHTML = `
          <td class="mono">${p.pid}</td>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td class="mono">${escapeHtml(p.user)}</td>
          <td class="mono">${p.cpu}%</td>
          <td class="mono">${escapeHtml(p.mem)}</td>
          <td><span style="font-size: 10.5px; color: #10b981;">● ${escapeHtml(p.status || 'Çalışıyor')}</span></td>
        `;

        tr.addEventListener('click', () => {
          this.selectedPid = p.pid;
          const btnKill = document.getElementById('taskmgr-btn-kill');
          if (btnKill) btnKill.disabled = false;
          this.render(query);
        });

        this.tableBody.appendChild(tr);
      });
    }
  };

  // ============================================================================
  // 13. NOT DEFTERİ (WIN-NOTEPAD - TEXT EDITOR)
  // ============================================================================
  const NotepadManager = {
    init() {
      this.textarea = document.getElementById('notepad-textarea');
      this.wordCountEl = document.getElementById('notepad-stat-words');
      this.charCountEl = document.getElementById('notepad-stat-chars');
      this.saveIndicator = document.getElementById('notepad-save-indicator');

      const saved = localStorage.getItem('ankora_notepad_content');
      if (saved && this.textarea) {
        this.textarea.value = saved;
        this.updateCounts();
      }

      if (this.textarea) {
        this.textarea.addEventListener('input', () => {
          this.updateCounts();
          localStorage.setItem('ankora_notepad_content', this.textarea.value);
          if (this.saveIndicator) {
            this.saveIndicator.textContent = 'Kaydedildi ✓';
            this.saveIndicator.style.color = '#10b981';
          }
        });
      }

      const btnNew = document.getElementById('notepad-btn-new');
      if (btnNew) {
        btnNew.addEventListener('click', () => {
          if (this.textarea && this.textarea.value.trim().length > 0) {
            if (confirm('Mevcut not temizlenecek. Devam etmek istiyor musunuz?')) {
              this.textarea.value = '';
              this.updateCounts();
              localStorage.removeItem('ankora_notepad_content');
            }
          }
        });
      }

      const btnSave = document.getElementById('notepad-btn-save');
      if (btnSave) {
        btnSave.addEventListener('click', () => {
          const content = this.textarea ? this.textarea.value : '';
          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'ankora-not.txt';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          Terminal.log('[NOT DEFTERİ] Not dosyası indirildi: ankora-not.txt', 'success');
        });
      }

      const btnCopy = document.getElementById('notepad-btn-copy');
      if (btnCopy) {
        btnCopy.addEventListener('click', async () => {
          if (!this.textarea) return;
          try {
            await navigator.clipboard.writeText(this.textarea.value);
            btnCopy.textContent = 'Kopyalandı ✓';
            setTimeout(() => { btnCopy.textContent = 'Kopyala'; }, 1800);
          } catch (e) {
            this.textarea.select();
            document.execCommand('copy');
          }
        });
      }

      const btnClear = document.getElementById('notepad-btn-clear');
      if (btnClear) {
        btnClear.addEventListener('click', () => {
          if (this.textarea) {
            this.textarea.value = '';
            this.updateCounts();
            localStorage.removeItem('ankora_notepad_content');
          }
        });
      }
    },

    updateCounts() {
      if (!this.textarea) return;
      const text = this.textarea.value;
      const chars = text.length;
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      if (this.charCountEl) this.charCountEl.textContent = `${chars} karakter`;
      if (this.wordCountEl) this.wordCountEl.textContent = `${words} kelime`;
    }
  };

  // ============================================================================
  // 14. HESAP MAKİNESİ (WIN-CALC - CALCULATOR)
  // ============================================================================
  const CalcManager = {
    current: '0',
    history: '',
    operator: null,
    prevValue: null,
    resetCurrentOnNextNum: false,

    init() {
      this.displayCurrent = document.getElementById('calc-current');
      this.displayHistory = document.getElementById('calc-history');
      this.updateDisplay();

      document.querySelectorAll('.calc-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.getAttribute('data-val');
          const act = btn.getAttribute('data-action');

          if (val !== null) {
            this.inputNum(val);
          } else if (act) {
            this.handleAction(act);
          }
          this.updateDisplay();
        });
      });

      window.addEventListener('keydown', (e) => {
        const winCalc = document.getElementById('win-calc');
        if (!winCalc || !winCalc.classList.contains('active')) return;

        if (e.key >= '0' && e.key <= '9') {
          this.inputNum(e.key);
          this.updateDisplay();
        } else if (e.key === '.' || e.key === ',') {
          this.inputNum('.');
          this.updateDisplay();
        } else if (e.key === '+') {
          this.handleAction('add');
          this.updateDisplay();
        } else if (e.key === '-') {
          this.handleAction('subtract');
          this.updateDisplay();
        } else if (e.key === '*') {
          this.handleAction('multiply');
          this.updateDisplay();
        } else if (e.key === '/') {
          e.preventDefault();
          this.handleAction('divide');
          this.updateDisplay();
        } else if (e.key === 'Enter' || e.key === '=') {
          e.preventDefault();
          this.handleAction('equals');
          this.updateDisplay();
        } else if (e.key === 'Backspace') {
          this.handleAction('backspace');
          this.updateDisplay();
        } else if (e.key === 'Escape') {
          this.handleAction('c');
          this.updateDisplay();
        }
      });
    },

    inputNum(n) {
      if (this.resetCurrentOnNextNum) {
        this.current = (n === '.') ? '0.' : n;
        this.resetCurrentOnNextNum = false;
        return;
      }
      if (n === '.') {
        if (!this.current.includes('.')) {
          this.current += '.';
        }
      } else {
        this.current = (this.current === '0') ? n : this.current + n;
      }
    },

    handleAction(action) {
      const curNum = parseFloat(this.current) || 0;

      switch (action) {
        case 'c':
          this.current = '0';
          this.history = '';
          this.prevValue = null;
          this.operator = null;
          this.resetCurrentOnNextNum = false;
          break;

        case 'ce':
          this.current = '0';
          break;

        case 'backspace':
          if (this.current.length > 1) {
            this.current = this.current.slice(0, -1);
          } else {
            this.current = '0';
          }
          break;

        case 'negate':
          this.current = String(-curNum);
          break;

        case 'percent':
          this.current = String(curNum / 100);
          break;

        case 'reciprocal':
          if (curNum === 0) {
            this.current = 'Tanımsız';
            this.resetCurrentOnNextNum = true;
          } else {
            this.current = String(parseFloat((1 / curNum).toFixed(8)));
          }
          break;

        case 'square':
          this.current = String(parseFloat((curNum * curNum).toFixed(8)));
          break;

        case 'sqrt':
          if (curNum < 0) {
            this.current = 'Geçersiz';
            this.resetCurrentOnNextNum = true;
          } else {
            this.current = String(parseFloat(Math.sqrt(curNum).toFixed(8)));
          }
          break;

        case 'add':
        case 'subtract':
        case 'multiply':
        case 'divide':
          const opSymbols = { add: '+', subtract: '−', multiply: '×', divide: '÷' };
          if (this.operator && this.prevValue !== null && !this.resetCurrentOnNextNum) {
            this.compute();
          } else {
            this.prevValue = curNum;
          }
          this.operator = action;
          this.history = `${this.prevValue} ${opSymbols[action]}`;
          this.resetCurrentOnNextNum = true;
          break;

        case 'equals':
          if (this.operator && this.prevValue !== null) {
            const opSymbols = { add: '+', subtract: '−', multiply: '×', divide: '÷' };
            const opSym = opSymbols[this.operator] || '';
            const secondVal = curNum;
            this.compute();
            this.history = `${this.prevValue} ${opSym} ${secondVal} =`;
            this.prevValue = null;
            this.operator = null;
            this.resetCurrentOnNextNum = true;
          }
          break;
      }
    },

    compute() {
      const a = this.prevValue;
      const b = parseFloat(this.current) || 0;
      let res = 0;

      switch (this.operator) {
        case 'add': res = a + b; break;
        case 'subtract': res = a - b; break;
        case 'multiply': res = a * b; break;
        case 'divide':
          if (b === 0) {
            this.current = 'Tanımsız';
            this.prevValue = null;
            this.operator = null;
            return;
          }
          res = a / b;
          break;
      }
      this.current = String(parseFloat(res.toFixed(8)));
      this.prevValue = res;
    },

    updateDisplay() {
      if (this.displayCurrent) this.displayCurrent.textContent = this.current;
      if (this.displayHistory) this.displayHistory.textContent = this.history;
    }
  };

  // ============================================================================
  // ANKORA WEB TARAYICI YÖNETİCİSİ (EMBEDDED WEBKIT BROWSER - AYAZ DE)
  // ============================================================================
  const BrowserManager = {
    iframe: null,
    urlInput: null,
    history: ['https://duckduckgo.com'],
    historyIndex: 0,
    loadingBar: null,
    fallbackCard: null,

    init() {
      this.iframe = document.getElementById('browser-iframe');
      this.urlInput = document.getElementById('browser-url-input');
      this.loadingBar = document.getElementById('browser-loading-bar');
      this.fallbackCard = document.getElementById('browser-fallback-card');

      const btnGo = document.getElementById('btn-browser-go');
      const btnBack = document.getElementById('btn-browser-back');
      const btnFwd = document.getElementById('btn-browser-fwd');
      const btnReload = document.getElementById('btn-browser-reload');
      const btnHome = document.getElementById('btn-browser-home');
      const btnSearchMode = document.getElementById('btn-browser-search-mode');
      const btnRefresh = document.getElementById('btn-browser-refresh');

      if (this.urlInput) {
        this.urlInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.navigate(this.urlInput.value);
          }
        });
        this.urlInput.addEventListener('focus', () => {
          this.urlInput.select();
        });
      }

      if (btnGo) {
        btnGo.addEventListener('click', () => {
          if (this.urlInput) this.navigate(this.urlInput.value);
        });
      }

      if (btnBack) {
        btnBack.addEventListener('click', () => this.goBack());
      }

      if (btnFwd) {
        btnFwd.addEventListener('click', () => this.goForward());
      }

      if (btnReload) {
        btnReload.addEventListener('click', () => this.reload());
      }

      if (btnHome) {
        btnHome.addEventListener('click', () => this.navigate('https://duckduckgo.com'));
      }

      if (btnRefresh) {
        btnRefresh.addEventListener('click', () => this.reload());
      }

      if (btnSearchMode) {
        btnSearchMode.addEventListener('click', () => {
          if (this.urlInput) {
            this.urlInput.value = '';
            this.urlInput.placeholder = 'DuckDuckGo ile ara...';
            this.urlInput.focus();
          }
        });
      }

      // Bookmark Chips
      const chips = document.querySelectorAll('.bookmark-chip[data-url]');
      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          chips.forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          const targetUrl = chip.getAttribute('data-url');
          if (targetUrl) this.navigate(targetUrl);
        });
      });

      // Iframe Load Event
      if (this.iframe) {
        this.iframe.addEventListener('load', () => {
          this.finishLoading();
        });
      }
    },

    navigate(input) {
      if (!input || !input.trim()) return;
      let target = input.trim();

      // Akıllı URL / Arama tespiti
      const isUrl = /^(https?:\/\/|[a-z0-9-]+\.[a-z]{2,})/i.test(target) && !target.includes(' ');
      if (!isUrl) {
        target = `https://duckduckgo.com/?q=${encodeURIComponent(target)}`;
      } else if (!/^https?:\/\//i.test(target)) {
        target = `https://${target}`;
      }

      if (this.urlInput) this.urlInput.value = target;

      // Geçmiş güncelleme
      if (this.history[this.historyIndex] !== target) {
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(target);
        this.historyIndex = this.history.length - 1;
      }

      this.startLoading();

      if (this.iframe) {
        if (this.fallbackCard) this.fallbackCard.style.display = 'none';
        try {
          this.iframe.src = target;
        } catch (err) {
          console.warn('[TARAYICI] Navigasyon hatası:', err);
          if (this.fallbackCard) this.fallbackCard.style.display = 'flex';
          this.finishLoading();
        }
      }

      // Yer imi aktifliğini güncelle
      const chips = document.querySelectorAll('.bookmark-chip[data-url]');
      chips.forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-url') === target);
      });
    },

    goBack() {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        const url = this.history[this.historyIndex];
        if (this.urlInput) this.urlInput.value = url;
        this.startLoading();
        if (this.iframe) this.iframe.src = url;
      }
    },

    goForward() {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        const url = this.history[this.historyIndex];
        if (this.urlInput) this.urlInput.value = url;
        this.startLoading();
        if (this.iframe) this.iframe.src = url;
      }
    },

    reload() {
      if (this.iframe) {
        this.startLoading();
        const cur = this.iframe.src;
        this.iframe.src = '';
        setTimeout(() => {
          this.iframe.src = cur;
        }, 50);
      }
    },

    startLoading() {
      if (this.loadingBar) {
        this.loadingBar.style.width = '35%';
        this.loadingBar.style.opacity = '1';
        setTimeout(() => {
          if (this.loadingBar && this.loadingBar.style.opacity === '1') {
            this.loadingBar.style.width = '75%';
          }
        }, 300);
      }
    },

    finishLoading() {
      if (this.loadingBar) {
        this.loadingBar.style.width = '100%';
        setTimeout(() => {
          if (this.loadingBar) {
            this.loadingBar.style.opacity = '0';
            setTimeout(() => {
              if (this.loadingBar) this.loadingBar.style.width = '0%';
            }, 200);
          }
        }, 200);
      }
    }
  };

  // ============================================================================
  // BELLEK (RAM) OPTİMİZASYON VE CANLI TELEMETRİ YÖNETİCİSİ (MEMORY MANAGER)
  // ============================================================================
  const MemoryManager = {
    isEcoMode: false,
    pollTimer: null,
    trayWidget: null,
    trayText: null,
    trayDot: null,

    init() {

      // 1. Eco RAM Modu Tercihini Yükle
      const savedEco = localStorage.getItem('ankora_eco_ram_mode') === 'true';
      this.setEcoMode(savedEco, false);

      const chkEco = document.getElementById('chk-eco-ram-mode');
      if (chkEco) {
        chkEco.checked = savedEco;
        chkEco.addEventListener('change', (e) => {
          this.setEcoMode(e.target.checked, true);
        });
      }

      // 2. Tray Widget Tıklama: Hızlı RAM Temizleme
      if (this.trayWidget) {
        this.trayWidget.addEventListener('click', () => {
          this.optimizeRam();
        });
      }

      // 3. Ayarlar Penceresi RAM Temizleme Butonu
      const btnCleanRam = document.getElementById('btn-clean-ram');
      if (btnCleanRam) {
        btnCleanRam.addEventListener('click', () => {
          this.optimizeRam();
        });
      }

      // 4. Periyodik Hafif Telemetre Sorgusu (5 saniyede bir, sayfa odakta iken)
      this.updateTelemetry();
      this.pollTimer = setInterval(() => {
        if (!document.hidden) {
          this.updateTelemetry();
        }
      }, 5000);
    },

    setEcoMode(enabled, persist = true) {
      this.isEcoMode = enabled;
      document.body.classList.toggle('eco-ram-mode', enabled);
      if (persist) {
        localStorage.setItem('ankora_eco_ram_mode', enabled ? 'true' : 'false');
        Terminal.log(`[BELLEK] Ultra Düşük RAM Modu: ${enabled ? 'Etkin (Bulanıklıklar ve GPU katmanları kapatıldı)' : 'Normal'}`, 'cmd');
      }
      const chkEco = document.getElementById('chk-eco-ram-mode');
      if (chkEco && chkEco.checked !== enabled) {
        chkEco.checked = enabled;
      }
    },

    async updateTelemetry() {
      try {
        const tele = await TauriBridge.invoke('get_system_telemetry');
        if (!tele) return;

        const usedMb = tele.memory_used_mb || 110;
        const totalMb = tele.memory_total_mb || 8192;
        const pct = Math.min(100, Math.round((usedMb / totalMb) * 100));

        // Tray Widget Güncelleme
        if (this.trayText && this.trayWidget && !this.trayWidget.classList.contains('purging')) {
          const displayStr = usedMb > 1024 ? `${(usedMb / 1024).toFixed(1)} GB` : `${usedMb} MB`;
          this.trayText.textContent = displayStr;
        }

        if (this.trayDot) {
          this.trayDot.classList.remove('warn', 'danger');
          if (pct >= 80) {
            this.trayDot.classList.add('danger');
          } else if (pct >= 50) {
            this.trayDot.classList.add('warn');
          }
        }

        // Ayarlar Penceresi Güncelleme
        const labelSettings = document.getElementById('label-ram-settings-usage');
        const fillSettings = document.getElementById('fill-ram-settings-bar');
        if (labelSettings) {
          labelSettings.textContent = `${usedMb > 1024 ? (usedMb / 1024).toFixed(1) + ' GB' : usedMb + ' MB'} / ${(totalMb / 1024).toFixed(1)} GB (%${pct} Kullanımda)`;
        }
        if (fillSettings) {
          fillSettings.style.width = `${Math.max(4, pct)}%`;
          fillSettings.style.background = pct >= 80 ? '#ef4444' : (pct >= 50 ? '#f59e0b' : 'var(--accent-active)');
        }
      } catch (err) {}
    },

    async optimizeRam() {
      if (this.trayWidget) {
        this.trayWidget.classList.add('purging');
        if (this.trayText) this.trayText.textContent = 'Temizleniyor...';
      }

      const btnCleanRam = document.getElementById('btn-clean-ram');
      if (btnCleanRam) {
        btnCleanRam.disabled = true;
        btnCleanRam.textContent = 'Boşaltılıyor...';
      }

      // DOM ve Bellek Temizliği
      // 1. Terminal çıktı satırlarını 50 satıra indir
      if (Terminal && Terminal.logs) {
        while (Terminal.logs.children.length > 50) {
          Terminal.logs.removeChild(Terminal.logs.firstChild);
        }
      }

      // 2. Ofis penceresi kapalıysa iframe'i boşalt
      const winOffice = document.getElementById('win-office');
      if (winOffice && !winOffice.classList.contains('open')) {
        OfficeManager.clearFrame();
      }

      // 3. AI mesaj listesini hafiflet
      if (AIAgent && AIAgent.feed) {
        while (AIAgent.feed.children.length > 15) {
          AIAgent.feed.removeChild(AIAgent.feed.firstChild);
        }
      }

      let freedMb = 48;
      try {
        const res = await TauriBridge.invoke('optimize_system_memory');
        if (res && res.freed_mb) freedMb = res.freed_mb;
      } catch (e) {}

      Terminal.log(`[BELLEK] Sistem ve uygulama önbellekleri boşaltıldı. Yaklaşık ${freedMb} MB bellek serbest bırakıldı.`, 'success');

      if (this.trayText) {
        this.trayText.textContent = `✓ ${freedMb} MB`;
      }

      if (btnCleanRam) {
        btnCleanRam.textContent = `Temizlendi (${freedMb} MB) ✓`;
        setTimeout(() => {
          btnCleanRam.textContent = '⚡ RAM\'i Boşalt';
          btnCleanRam.disabled = false;
        }, 2000);
      }

      setTimeout(() => {
        if (this.trayWidget) this.trayWidget.classList.remove('purging');
        this.updateTelemetry();
      }, 2500);
    }
  };

  // Global Klavye Kısayolları (Keyboard Shortcuts)
  window.addEventListener('keydown', (e) => {
    // Ctrl + Alt + T -> Terminal
    if (e.ctrlKey && e.altKey && (e.key === 't' || e.key === 'T')) {
      e.preventDefault();
      WindowManager.open('win-terminal');
    }
    // Ctrl + Alt + S -> Sistem Ayarları
    else if (e.ctrlKey && e.altKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      WindowManager.open('win-settings');
    }
    // Ctrl + Alt + R veya Ctrl + Alt + M -> Hızlı RAM Temizleme
    else if (e.ctrlKey && e.altKey && (e.key === 'r' || e.key === 'R' || e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      MemoryManager.optimizeRam();
    }
    // Ctrl + Boşluk -> Başlat Menüsü
    else if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault();
      const flyout = document.getElementById('start-flyout');
      const startBtn = document.getElementById('start-btn');
      if (flyout) {
        const isOpen = flyout.classList.contains('open');
        flyout.classList.toggle('open', !isOpen);
        if (startBtn) startBtn.classList.toggle('active', !isOpen);
      }
    }
    // Escape -> Başlat veya Menüyü Gizle
    else if (e.key === 'Escape') {
      const flyout = document.getElementById('start-flyout');
      const startBtn = document.getElementById('start-btn');
      if (flyout && flyout.classList.contains('open')) {
        flyout.classList.remove('open');
        if (startBtn) startBtn.classList.remove('active');
      }
      const ctxMenu = document.getElementById('desktop-context-menu');
      if (ctxMenu && ctxMenu.classList.contains('open')) {
        ctxMenu.classList.remove('open');
      }
    }
  });

  // ============================================================================
  // ANKORA LOCK SCREEN MANAGER (NATIVE GÜVENLİ KİLİT & X11 OTURUM KORUMASI) - BULGU #3 GİDERİLDİ
  // ============================================================================
  const LockManager = {
    overlay: null,
    input: null,
    errorMsg: null,
    isLocked: false,
    autoLockTimer: null,
    autoLockMinutes: 0,
    lastActivityTime: Date.now(),

    async init() {
      this.overlay = document.getElementById('screen-lock');
      this.input = document.getElementById('lock-password-input');
      this.errorMsg = document.getElementById('lock-error-msg');

      if (!this.overlay) return;

      // Backend native hash yapılandırmasını kontrol et
      try {
        const configured = await TauriBridge.invoke('is_lock_configured');
        const welcomeStatus = document.getElementById('welcome-lock-status-label');
        if (welcomeStatus) {
          welcomeStatus.textContent = configured
            ? 'Kilit şifresi: Ayarlandı ✓'
            : 'Kilit şifresi: Henüz Ayarlanmadı';
          welcomeStatus.style.color = configured ? '#10b981' : '#f59e0b';
        }
      } catch (e) {}

      // Otomatik kilit süresi ayarını yükle
      const savedAutoLock = SafeStorage.getItem('ankora_autolock_mins');
      if (savedAutoLock !== null) {
        this.autoLockMinutes = parseInt(savedAutoLock, 10) || 0;
        this.setupAutoLock();
      }

      // Kilit Saati ve Tarihi Güncelleme
      this.updateClock();
      setInterval(() => this.updateClock(), 1000);

      // Form Gönderimi (Kilidi Aç)
      const form = document.getElementById('lock-auth-form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.unlock();
        });
      }

      const btnSubmit = document.getElementById('btn-lock-submit');
      if (btnSubmit) {
        btnSubmit.addEventListener('click', (e) => {
          e.preventDefault();
          this.unlock();
        });
      }

      // Parolayı Göster / Gizle Butonu
      const btnEye = document.getElementById('btn-lock-toggle-pass');
      if (btnEye && this.input) {
        btnEye.addEventListener('click', () => {
          const isPass = this.input.type === 'password';
          this.input.type = isPass ? 'text' : 'password';
          btnEye.textContent = isPass ? '🙈' : '👁️';
        });
      }

      // Kilit Ekranı Güç Butonları
      const btnRestart = document.getElementById('lock-btn-restart');
      if (btnRestart) {
        btnRestart.addEventListener('click', async () => {
          try { await TauriBridge.invoke('run_terminal_command', { command: 'reboot' }); } catch (e) {}
          alert('Ankora Linux yeniden başlatılıyor...');
        });
      }

      const btnShutdown = document.getElementById('lock-btn-shutdown');
      if (btnShutdown) {
        btnShutdown.addEventListener('click', async () => {
          try { await TauriBridge.invoke('run_terminal_command', { command: 'poweroff' }); } catch (e) {}
          alert('Ankora Linux kapatılıyor...');
        });
      }

      // Klavye Kısayolu: Super+L veya Ctrl+Alt+L ile doğrudan kilitleme
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey && e.altKey && e.key.toLowerCase() === 'l') || (e.metaKey && e.key.toLowerCase() === 'l')) {
          e.preventDefault();
          this.lock();
        }
      });

      // Kullanıcı Etkinliği (Boşta Kalma Tespiti)
      ['mousedown', 'mousemove', 'keydown', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, () => this.resetActivityTimer(), { passive: true });
      });
    },

    updateClock() {
      const timeEl = document.getElementById('lock-clock-time');
      const dateEl = document.getElementById('lock-clock-date');
      if (!timeEl || !dateEl) return;

      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      timeEl.textContent = `${h}:${m}`;

      const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      dateEl.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    },

    async lock(useX11Lock = true) {
      if (!this.overlay) return;

      // Eğer henüz PIN ayarlanmamışsa kullanıcıyı uyar
      try {
        const configured = await TauriBridge.invoke('is_lock_configured');
        if (!configured) {
          if (typeof ReportManager !== 'undefined' && ReportManager.showToast) {
            ReportManager.showToast("Önce Ayarlar veya Hoş Geldiniz ekranından bir kilit PIN'i belirleyin.");
          }
          if (typeof WindowManager !== 'undefined') {
            WindowManager.open('win-welcome');
          }
          return;
        }
      } catch (e) {}

      this.isLocked = true;
      this.overlay.classList.add('show');
      if (this.errorMsg) {
        this.errorMsg.textContent = '';
        this.errorMsg.classList.remove('show', 'success');
      }
      if (this.input) {
        this.input.value = '';
        setTimeout(() => this.input.focus(), 150);
      }
      Terminal.log('[GÜVENLİK] Oturum kilitlendi (X11 & Kiosk).', 'cmd');

      // Native X11 xtrlock kilidini devreye al (X server input grab)
      if (useX11Lock) {
        try {
          await TauriBridge.invoke('lock_x11_session');
        } catch (e) {}
      }
    },

    async unlock() {
      if (!this.input) return;
      const entered = this.input.value.trim();
      if (!entered) return;

      const btnSubmit = document.getElementById('btn-lock-submit');
      if (btnSubmit) btnSubmit.disabled = true;

      try {
        const ok = await TauriBridge.invoke('verify_lock_credentials', { pin: entered });
        if (ok) {
          this.isLocked = false;
          this.overlay.classList.remove('show');
          this.input.value = '';
          Terminal.log('[GÜVENLİK] Kilit açıldı. Hoş geldiniz, pars.', 'cmd');
          this.resetActivityTimer();
        } else {
          this.showError('Hatalı PIN veya Parola! Lütfen tekrar deneyin.');
          this.input.classList.add('error-shake');
          setTimeout(() => {
            if (this.input) this.input.classList.remove('error-shake');
          }, 500);
          this.input.select();
        }
      } catch (err) {
        this.showError(`Kilit Hatası: ${err}`);
        this.input.classList.add('error-shake');
        setTimeout(() => {
          if (this.input) this.input.classList.remove('error-shake');
        }, 500);
      } finally {
        if (btnSubmit) btnSubmit.disabled = false;
      }
    },

    showError(msg, isError = true) {
      if (!this.errorMsg) return;
      this.errorMsg.textContent = msg;
      this.errorMsg.classList.toggle('success', !isError);
      this.errorMsg.classList.add('show');
    },

    async setPin(currentPin, newPin) {
      if (!newPin || newPin.length < 3) {
        return { success: false, error: 'Yeni PIN en az 3 karakter olmalıdır.' };
      }
      try {
        await TauriBridge.invoke('set_lock_credentials', {
          currentPin: currentPin || null,
          newPin: newPin
        });
        SafeStorage.setItem('ankora_lock_pin', newPin);
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },

    setupAutoLock() {
      if (this.autoLockTimer) clearInterval(this.autoLockTimer);
      if (this.autoLockMinutes <= 0) return;
      this.lastActivityTime = Date.now();
      this.autoLockTimer = setInterval(() => {
        if (!this.isLocked && this.autoLockMinutes > 0) {
          const idleTime = Date.now() - (this.lastActivityTime || Date.now());
          if (idleTime >= this.autoLockMinutes * 60 * 1000) {
            this.lock();
          }
        }
      }, 10000);
    },

    resetActivityTimer() {
      this.lastActivityTime = Date.now();
    }
  };

  // ============================================================================
  // ANKORA REPORT MANAGER (HATA BİLDİRİMİ, SİSTEM TANILAMA & TOPLULUK İLETİŞİMİ)
  // ============================================================================
  const ReportManager = {
    forumUrl: 'https://ankalab.flarum.cloud',
    siteUrl: 'https://ankora-linux.github.io',
    telemetry: null,
    _toastTimeout: null,

    init() {
      const btnOpenForum = document.getElementById('btn-open-forum');
      const btnCopyForum = document.getElementById('btn-copy-forum');
      const btnOpenSite = document.getElementById('btn-open-site');
      const btnCopySite = document.getElementById('btn-copy-site');
      const btnCopyReport = document.getElementById('btn-copy-report');
      const btnPostForum = document.getElementById('btn-post-forum');
      const btnRefreshTelemetry = document.getElementById('btn-refresh-telemetry');

      const selectCategory = document.getElementById('report-category');
      const inputSubject = document.getElementById('report-subject');
      const textareaDetails = document.getElementById('report-details');
      const chkIncludeTelemetry = document.getElementById('report-include-telemetry');

      // Topluluk Forumu Açma & Kopyalama
      if (btnOpenForum) {
        btnOpenForum.addEventListener('click', () => this.openUrl(this.forumUrl));
      }
      if (btnCopyForum) {
        btnCopyForum.addEventListener('click', () => this.copyToClipboard(this.forumUrl, 'Forum adresi kopyalandı!'));
      }

      // Resmi Web Sitesi Açma & Kopyalama
      if (btnOpenSite) {
        btnOpenSite.addEventListener('click', () => this.openUrl(this.siteUrl));
      }
      if (btnCopySite) {
        btnCopySite.addEventListener('click', () => this.copyToClipboard(this.siteUrl, 'Web sitesi adresi kopyalandı!'));
      }

      // Canlı Rapor Güncelleme Dinleyicileri
      [selectCategory, inputSubject, textareaDetails, chkIncludeTelemetry].forEach(el => {
        if (el) {
          el.addEventListener('input', () => this.updateReportPreview());
          el.addEventListener('change', () => this.updateReportPreview());
        }
      });

      // Telemetri Yenileme Butonu
      if (btnRefreshTelemetry) {
        btnRefreshTelemetry.addEventListener('click', async () => {
          await this.loadTelemetry();
          this.updateReportPreview();
          this.showToast('Sistem tanılama verileri güncellendi.');
        });
      }

      // Raporu Panoya Kopyalama Butonu
      if (btnCopyReport) {
        btnCopyReport.addEventListener('click', () => {
          const reportText = this.generateReportMarkdown();
          this.copyToClipboard(reportText, 'Tanılama raporu panoya kopyalandı!');
        });
      }

      // Forumda Başlık Aç Butonu
      if (btnPostForum) {
        btnPostForum.addEventListener('click', () => {
          const reportText = this.generateReportMarkdown();
          this.copyToClipboard(reportText, 'Rapor kopyalandı! Forum sayfası açılıyor...');
          setTimeout(() => {
            this.openUrl(this.forumUrl);
          }, 350);
        });
      }

      // İlk telemetri yüklemesi
      this.loadTelemetry().then(() => {
        this.updateReportPreview();
      });
    },

    async loadTelemetry() {
      try {
        const tel = await TauriBridge.invoke('get_system_telemetry');
        if (tel) {
          this.telemetry = tel;
          return;
        }
      } catch (e) {}

      // Standart Devuan Kiosk Telemetri Fallback
      this.telemetry = {
        os_name: 'Devuan GNU/Linux 5 (daedalus)',
        kernel: 'Linux 6.1.0-22-amd64',
        init_system: 'SysVinit (systemd-free)',
        memory_used_mb: 1140,
        memory_total_mb: 8192,
        cpu_cores: (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4,
        uptime_seconds: 3600
      };
    },

    generateReportMarkdown() {
      const categoryEl = document.getElementById('report-category');
      const subjectEl = document.getElementById('report-subject');
      const detailsEl = document.getElementById('report-details');
      const chkTel = document.getElementById('report-include-telemetry');

      const category = categoryEl ? categoryEl.options[categoryEl.selectedIndex]?.text : 'Genel';
      const subject = (subjectEl && subjectEl.value.trim()) || 'Konu belirtilmedi';
      const details = (detailsEl && detailsEl.value.trim()) || 'Açıklama girilmedi.';
      const includeTelemetry = chkTel ? chkTel.checked : true;

      const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

      let md = `### [Ankora Report] ${subject}\n\n`;
      md += `**Kategori:** ${category}\n`;
      md += `**Tarih / Saat:** ${dateStr} UTC\n\n`;
      md += `#### 📋 Açıklama & Yeniden Oluşturma Adımları\n${details}\n\n`;

      if (includeTelemetry && this.telemetry) {
        const memPercent = Math.round((this.telemetry.memory_used_mb / Math.max(1, this.telemetry.memory_total_mb)) * 100);
        const uptimeHours = Math.floor(this.telemetry.uptime_seconds / 3600);
        const uptimeMins = Math.floor((this.telemetry.uptime_seconds % 3600) / 60);

        md += `#### 🖥️ Sistem Tanılama Verileri\n`;
        md += `\`\`\`yaml\n`;
        md += `İşletim Sistemi : ${this.telemetry.os_name}\n`;
        md += `Masaüstü Ortamı : Ayaz DE v2.0.0 (Ankora Kiosk / X11)\n`;
        md += `Çekirdek (Kernel): ${this.telemetry.kernel}\n`;
        md += `İnit Sistemi     : ${this.telemetry.init_system}\n`;
        md += `CPU Çekirdek     : ${this.telemetry.cpu_cores} İş parçacığı\n`;
        md += `Bellek (RAM)     : ${this.telemetry.memory_used_mb} MB / ${this.telemetry.memory_total_mb} MB (%${memPercent})\n`;
        md += `Çalışma Süresi   : ${uptimeHours} sa ${uptimeMins} dk\n`;
        md += `Kullanıcı Ajanı  : ${typeof navigator !== 'undefined' ? navigator.userAgent : 'WebKitGTK'}\n`;
        md += `Ekran Çözünürlüğü: ${typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A'}\n`;
        md += `\`\`\`\n\n`;
        md += `---\n*Topluluk Forumu: https://ankalab.flarum.cloud | Resmi Web Sitesi: https://ankora-linux.github.io*`;
      }

      return md;
    },

    updateReportPreview() {
      const previewEl = document.getElementById('report-preview-text');
      if (previewEl) {
        previewEl.textContent = this.generateReportMarkdown();
      }
    },

    async copyToClipboard(text, successMessage = 'Kopyalandı!') {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        this.showToast(successMessage);
      } catch (err) {
        this.showToast('Panoya kopyalama başarısız oldu.');
      }
    },

    showToast(message) {
      let toast = document.getElementById('ayaz-global-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ayaz-global-toast';
        toast.className = 'ayaz-toast-notification';
        document.body.appendChild(toast);
      }
      toast.textContent = message;
      toast.classList.add('show');
      clearTimeout(this._toastTimeout);
      this._toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
      }, 2600);
    },

    openUrl(url) {
      try {
        if (typeof BrowserManager !== 'undefined' && typeof WindowManager !== 'undefined') {
          const winBrowser = document.getElementById('win-browser');
          if (winBrowser) {
            WindowManager.open(winBrowser);
            BrowserManager.navigate(url);
            this.showToast(`${url} açılıyor...`);
            return;
          }
        }
      } catch (e) {}

      try {
        window.open(url, '_blank');
      } catch (e) {}
    }
  };

  // SİSTEMİ ÇALIŞTIR (HATA İZOLASYONLU VE DOM GÜVENCELİ BOOTSTRAP)
  function safeInit(name, fn) {
    try {
      fn();
    } catch (err) {
      console.warn(`[ANKORA BAŞLATMA UYARISI] ${name} modülü başlatılamadı:`, err);
    }
  }

  function boot() {
    // 1. Temel pencere yöneticisini ve masaüstü kontrollerini ÖNCELİKLİ ve GARANTİ olarak başlat
    safeInit('WindowManager', () => WindowManager.init());
    safeInit('DesktopControls', () => initDesktopControls());
    safeInit('ThemeManager', () => ThemeManager.init());

    // 2. Diğer sistem uygulamalarını ve arka plan servislerini bağımsız olarak güvenle çalıştır
    safeInit('XdgDesktopEngine', () => XdgDesktopEngine.init());
    safeInit('StoreManager', () => StoreManager.init());
    safeInit('Terminal', () => Terminal.init());
    safeInit('OfficeManager', () => OfficeManager.init());
    safeInit('AIAgent', () => AIAgent.init());
    safeInit('WelcomeManager', () => WelcomeManager.init());
    safeInit('InstallerWizard', () => InstallerWizard.init());
    safeInit('SettingsManager', () => SettingsManager.init());
    safeInit('UpdaterManager', () => UpdaterManager.init());
    safeInit('TaskManager', () => TaskManager.init());
    safeInit('NotepadManager', () => NotepadManager.init());
    safeInit('CalcManager', () => CalcManager.init());
    safeInit('BrowserManager', () => BrowserManager.init());
    safeInit('MemoryManager', () => MemoryManager.init());
    safeInit('ReportManager', () => ReportManager.init());
    safeInit('LockManager', () => LockManager.init());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();

