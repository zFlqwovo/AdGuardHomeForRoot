/**
 * AdGuardHome for Root - WebUI Application
 * 
 * KernelSU API: ksu.exec(cmd) returns stdout string synchronously
 * KernelSU API: ksu.toast(msg) shows a toast
 */

// ==================== Module API Layer ====================
var ModuleAPI = {
  _api: null,

  init: function() {
    if (typeof ksu !== 'undefined' && typeof ksu.exec === 'function') {
      this._api = ksu;
    } else if (typeof ap !== 'undefined' && typeof ap.exec === 'function') {
      this._api = ap;
    }
  },

  isAvailable: function() {
    return this._api !== null;
  },

  /**
   * Execute shell command SYNCHRONOUSLY.
   * ksu.exec(cmd) returns stdout string directly.
   * Returns { errno, stdout }
   */
  exec: function(command) {
    if (!this._api) {
      return { errno: -1, stdout: '' };
    }
    try {
      var result = this._api.exec(command);
      return {
        errno: 0,
        stdout: (result || '').replace(/\r/g, '')
      };
    } catch (e) {
      return { errno: -1, stdout: '' };
    }
  },

  toast: function(msg) {
    if (this._api && typeof this._api.toast === 'function') {
      try { this._api.toast(msg); } catch (e) {}
    }
  }
};

ModuleAPI.init();

// ==================== Utility Functions ====================
function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration || 3000;
  var container = document.getElementById('toastContainer');
  var toastEl = document.createElement('div');
  toastEl.className = 'toast ' + type;
  toastEl.textContent = message;
  container.appendChild(toastEl);
  setTimeout(function() {
    toastEl.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(function() { toastEl.remove(); }, 300);
  }, duration);
}

function showLoading(show) {
  document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

// ==================== State ====================
var currentSettings = {};
var settingsChanged = false;
var isRunning = false;
var webPort = '3000'; // stored internally for openAdGuardHome()

// ==================== Tab / Page Switching ====================
var currentPage = 0;
var pageCount = 2;

function switchTab(index) {
  if (index < 0 || index >= pageCount) return;
  currentPage = index;

  var container = document.getElementById('pagesContainer');
  container.classList.remove('no-transition');
  container.style.transform = 'translateX(' + (-index * 50) + '%)';

  // Update floating tab active state
  var tabs = document.querySelectorAll('.floating-tab-item');
  for (var i = 0; i < tabs.length; i++) {
    if (i === index) {
      tabs[i].classList.add('active');
    } else {
      tabs[i].classList.remove('active');
    }
  }
}

// ==================== Touch Swipe Support ====================
(function() {
  var startX = 0;
  var startY = 0;
  var deltaX = 0;
  var swiping = false;
  var container = null;

  function getContainer() {
    if (!container) {
      container = document.getElementById('pagesContainer');
    }
    return container;
  }

  function onTouchStart(e) {
    var tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return;

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    deltaX = 0;
    swiping = false;
  }

  function onTouchMove(e) {
    if (!startX && !startY) return;

    var dx = e.touches[0].clientX - startX;
    var dy = e.touches[0].clientY - startY;

    if (!swiping) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        swiping = true;
        getContainer().classList.add('no-transition');
      } else {
        return;
      }
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
    }

    deltaX = dx;

    var pageWidth = window.innerWidth;
    var baseOffset = -currentPage * pageWidth;
    var offset = baseOffset + deltaX;

    var minOffset = -(pageCount - 1) * pageWidth;
    if (offset > 0) offset = offset * 0.3;
    if (offset < minOffset) offset = minOffset + (offset - minOffset) * 0.3;

    getContainer().style.transform = 'translateX(' + offset + 'px)';
  }

  function onTouchEnd(e) {
    if (!swiping) return;
    swiping = false;

    var threshold = window.innerWidth * 0.2;

    if (deltaX < -threshold && currentPage < pageCount - 1) {
      switchTab(currentPage + 1);
    } else if (deltaX > threshold && currentPage > 0) {
      switchTab(currentPage - 1);
    } else {
      switchTab(currentPage);
    }

    deltaX = 0;
  }

  document.addEventListener('DOMContentLoaded', function() {
    var c = getContainer();
    if (c) {
      c.addEventListener('touchstart', onTouchStart, { passive: true });
      c.addEventListener('touchmove', onTouchMove, { passive: false });
      c.addEventListener('touchend', onTouchEnd, { passive: true });
    }
  });
})();

// ==================== Status Check ====================
function checkStatus() {
  var badge = document.getElementById('statusBadge');
  var statusText = document.getElementById('statusText');
  var pidBadge = document.getElementById('pidBadge');

  var running = false;
  var pid = '-';

  var pidResult = ModuleAPI.exec('cat /data/adb/agh/bin/agh.pid 2>/dev/null');
  pid = pidResult.stdout.trim();

  if (pid && /^\d+$/.test(pid)) {
    running = true;
  } else {
    pid = '-';
  }

  isRunning = running;
  badge.className = 'status-badge ' + (running ? 'running' : 'stopped');
  statusText.textContent = running ? 'Running' : 'Stopped';

  pidBadge.textContent = 'PID: ' + pid;

  document.getElementById('btnStart').disabled = running;
  document.getElementById('btnStop').disabled = !running;
  document.getElementById('btnRestart').disabled = !running;
}

// ==================== Load Settings ====================
function loadSettings() {
  var settings = {};

  function getConf(key) {
    var r = ModuleAPI.exec('grep "^' + key + '=" /data/adb/agh/settings.conf 2>/dev/null | cut -d= -f2');
    return (r.stdout || '').replace(/\r/g, '').trim();
  }
  function getConfQuoted(key) {
    var val = getConf(key);
    return val.replace(/^"|"$/g, '');
  }

  settings.enable_iptables = getConf('enable_iptables');
  settings.block_ipv6_dns = getConf('block_ipv6_dns');
  settings.redir_port = getConf('redir_port') || '5591';
  settings.adg_user = getConf('adg_user') || 'root';
  settings.adg_group = getConf('adg_group') || 'net_raw';
  settings.ignore_dest_list = getConfQuoted('ignore_dest_list');
  settings.ignore_src_list = getConfQuoted('ignore_src_list');

  currentSettings = settings;
  applySettingsToUI(settings);
}

function applySettingsToUI(settings) {
  document.getElementById('setEnableIptables').checked = (settings.enable_iptables === 'true');
  document.getElementById('setBlockIpv6').checked = (settings.block_ipv6_dns === 'true');
  document.getElementById('setRedirPort').value = settings.redir_port || '5591';
  document.getElementById('setAdgUser').value = settings.adg_user || 'root';
  document.getElementById('setAdgGroup').value = settings.adg_group || 'net_raw';
  document.getElementById('setIgnoreDest').value = settings.ignore_dest_list || '';
  document.getElementById('setIgnoreSrc').value = settings.ignore_src_list || '';

  settingsChanged = false;
  document.getElementById('btnSaveSettings').disabled = true;
}

function onSettingChange() {
  settingsChanged = true;
  document.getElementById('btnSaveSettings').disabled = false;
}

// ==================== Save Settings ====================
function saveSettings() {
  showLoading(true);

  var enableIptables = document.getElementById('setEnableIptables').checked;
  var blockIpv6 = document.getElementById('setBlockIpv6').checked;
  var redirPort = document.getElementById('setRedirPort').value || '5591';
  var adgUser = document.getElementById('setAdgUser').value || 'root';
  var adgGroup = document.getElementById('setAdgGroup').value || 'net_raw';
  var ignoreDest = document.getElementById('setIgnoreDest').value || '';
  var ignoreSrc = document.getElementById('setIgnoreSrc').value || '';

  var cmd =
    "sed -i 's#^enable_iptables=.*#enable_iptables=" + enableIptables + "#' /data/adb/agh/settings.conf" +
    " && sed -i 's#^block_ipv6_dns=.*#block_ipv6_dns=" + blockIpv6 + "#' /data/adb/agh/settings.conf" +
    " && sed -i 's#^redir_port=.*#redir_port=" + redirPort + "#' /data/adb/agh/settings.conf" +
    " && sed -i 's#^adg_user=.*#adg_user=" + adgUser + "#' /data/adb/agh/settings.conf" +
    " && sed -i 's#^adg_group=.*#adg_group=" + adgGroup + "#' /data/adb/agh/settings.conf" +
    " && sed -i 's#^ignore_dest_list=.*#ignore_dest_list=\"" + ignoreDest + "\"#' /data/adb/agh/settings.conf" +
    " && sed -i 's#^ignore_src_list=.*#ignore_src_list=\"" + ignoreSrc + "\"#' /data/adb/agh/settings.conf";

  var result = ModuleAPI.exec(cmd);

  if (result.errno === 0) {
    settingsChanged = false;
    document.getElementById('btnSaveSettings').disabled = true;
    showToast('Settings saved successfully', 'success');
  } else {
    showToast('Failed to save settings', 'error');
  }

  showLoading(false);
}

// ==================== Log Viewer ====================
function loadLog() {
  if (!ModuleAPI.isAvailable()) return;
  var result = ModuleAPI.exec("awk '{a[NR]=$0}END{for(i=(NR>5?NR-4:1);i<=NR;i++)printf \"%s::NL::\",a[i]}' /data/adb/agh/history.log 2>/dev/null");
  var logViewer = document.getElementById('logViewer');
  if (logViewer) {
    var raw = (result.stdout || '').trim();
    var lines = raw.split('::NL::').filter(function(l) { return l !== ''; });
    var content = lines.join('\n');
    logViewer.textContent = content || 'No log entries';
    logViewer.scrollTop = logViewer.scrollHeight;
  }
}

// ==================== Control ====================
function controlAdGuard(action) {
  showLoading(true);

  var cmd;
  switch (action) {
    case 'start':
      cmd = '/data/adb/agh/scripts/tool.sh start';
      break;
    case 'stop':
      cmd = '/data/adb/agh/scripts/tool.sh stop';
      break;
    case 'restart':
      cmd = '/data/adb/agh/scripts/tool.sh stop; sleep 1; /data/adb/agh/scripts/tool.sh start';
      break;
    default:
      showLoading(false);
      return;
  }

  var result = ModuleAPI.exec(cmd);

  if (result.errno === 0) {
    var label = action.charAt(0).toUpperCase() + action.slice(1);
    showToast(label + ' successful', 'success');
  } else {
    showToast(action + ' failed', 'error');
  }

  setTimeout(function() {
    checkStatus();
    loadLog();
    showLoading(false);
  }, 2000);
}

// ==================== Open AdGuardHome ====================
function openAdGuardHome() {
  var url = (webPort !== '-') ? ('http://127.0.0.1:' + webPort) : 'http://127.0.0.1:3000';
  window.open(url, '_blank');
}

// ==================== Debug Info ====================
function collectDebugInfo() {
  showLoading(true);
  ModuleAPI.exec('/data/adb/agh/scripts/debug.sh 2>/dev/null');
  showToast('Debug info collected to /data/adb/agh/debug.log', 'success');
  showLoading(false);
}

// ==================== Load Web Port ====================
function loadWebPort() {
  var result = ModuleAPI.exec("grep 'address:' /data/adb/agh/bin/AdGuardHome.yaml 2>/dev/null | head -1");
  var line = result.stdout.trim();
  var match = line.match(/address:\s*\S+:(\d+)/);
  if (match && match[1]) {
    webPort = match[1];
  } else {
    webPort = '3000';
  }
}

// ==================== Load Version ====================
function loadVersion() {
  var result = ModuleAPI.exec('grep "^version=" /data/adb/modules/AdGuardHome/module.prop 2>/dev/null | cut -d= -f2');
  var version = result.stdout.trim();
  if (version) {
    document.getElementById('versionText').textContent = 'v' + version;
  }
}

// ==================== Initialize ====================
function init() {
  if (!ModuleAPI.isAvailable()) {
    document.getElementById('noApiWarning').style.display = 'block';
    document.getElementById('statusBadge').className = 'status-badge stopped';
    document.getElementById('statusText').textContent = 'No API';
    return;
  }

  loadSettings();
  checkStatus();
  loadWebPort();
  loadVersion();
  loadLog();

  switchTab(0);
}

// Auto-refresh status and log every 15 seconds
setInterval(function() {
  if (ModuleAPI.isAvailable()) {
    checkStatus();
    loadLog();
  }
}, 15000);

// Start
document.addEventListener('DOMContentLoaded', init);
