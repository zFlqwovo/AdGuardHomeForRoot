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

// ==================== Paths ====================
var AGH_DIR = '/data/adb/agh';
var CONF_FILE = AGH_DIR + '/settings.conf';
var PID_FILE = AGH_DIR + '/bin/agh.pid';
var LOG_FILE = AGH_DIR + '/history.log';
var SCRIPT_DIR = AGH_DIR + '/scripts';
var BIN_DIR = AGH_DIR + '/bin';
var MODULE_PROP = '/data/adb/modules/AdGuardHome/module.prop';

// ==================== State ====================
var currentSettings = {};
var settingsChanged = false;
var isRunning = false;
var webPort = '3000';
var webUser = 'root';
var webPassword = 'root';
var statsFailCount = 0;
var statsAuthVisible = false;

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

  // Always show floating tab when switching pages
  var floatingTab = document.getElementById('floatingTab');
  if (floatingTab) {
    floatingTab.classList.remove('tab-hidden');
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

  var pidResult = ModuleAPI.exec('cat ' + PID_FILE + ' 2>/dev/null');
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
function getConf(key) {
  var r = ModuleAPI.exec('grep "^' + key + '=" ' + CONF_FILE + ' 2>/dev/null | cut -d= -f2');
  return (r.stdout || '').replace(/\r/g, '').trim();
}

function getConfQuoted(key) {
  return getConf(key).replace(/^"|"$/g, '');
}

function loadSettings() {
  var settings = {};
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
    "sed -i 's#^enable_iptables=.*#enable_iptables=" + enableIptables + "#' " + CONF_FILE +
    " && sed -i 's#^block_ipv6_dns=.*#block_ipv6_dns=" + blockIpv6 + "#' " + CONF_FILE +
    " && sed -i 's#^redir_port=.*#redir_port=" + redirPort + "#' " + CONF_FILE +
    " && sed -i 's#^adg_user=.*#adg_user=" + adgUser + "#' " + CONF_FILE +
    " && sed -i 's#^adg_group=.*#adg_group=" + adgGroup + "#' " + CONF_FILE +
    " && sed -i 's#^ignore_dest_list=.*#ignore_dest_list=\"" + ignoreDest + "\"#' " + CONF_FILE +
    " && sed -i 's#^ignore_src_list=.*#ignore_src_list=\"" + ignoreSrc + "\"#' " + CONF_FILE;

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
  var result = ModuleAPI.exec("awk '{a[NR]=$0}END{for(i=(NR>5?NR-4:1);i<=NR;i++)printf \"%s::NL::\",a[i]}' " + LOG_FILE + " 2>/dev/null");
  var logViewer = document.getElementById('logViewer');
  if (logViewer) {
    var raw = (result.stdout || '').trim();
    var lines = raw.split('::NL::').filter(function(l) { return l !== ''; });
    var content = lines.join('\n');
    logViewer.textContent = content || 'No log entries';
    logViewer.scrollTop = logViewer.scrollHeight;
  }
}

// ==================== Stats Help Modal ====================
function toggleStatsHelp() {
  var overlay = document.getElementById('statsHelpOverlay');
  if (overlay) {
    overlay.classList.add('visible');
  }
}

function closeStatsHelp() {
  var overlay = document.getElementById('statsHelpOverlay');
  if (overlay) {
    overlay.classList.remove('visible');
  }
}

// ==================== Stats View Switching ====================
function showStatsDataView() {
  statsAuthVisible = false;
  var dataView = document.getElementById('statsDataView');
  var authView = document.getElementById('statsAuthView');
  if (dataView) dataView.style.display = '';
  if (authView) authView.style.display = 'none';
}

function showStatsAuthView() {
  statsAuthVisible = true;
  var dataView = document.getElementById('statsDataView');
  var authView = document.getElementById('statsAuthView');
  if (dataView) dataView.style.display = 'none';
  if (authView) authView.style.display = '';
}

function submitCredentials() {
  var userEl = document.getElementById('authUser');
  var passEl = document.getElementById('authPassword');
  if (userEl) webUser = userEl.value || 'root';
  if (passEl) webPassword = passEl.value || 'root';
  statsFailCount = 0;
  showStatsDataView();
  loadStats();
}

// ==================== Query Log Statistics ====================
function loadStats() {
  if (!ModuleAPI.isAvailable()) return;
  if (!isRunning) return;
  if (webPort === '-') return;
  if (statsAuthVisible) return;

  var url = 'http://127.0.0.1:' + webPort + '/control/stats';
  var auth = webUser + ':' + webPassword;
  var cmd = 'wget -qO- --user=' + webUser + ' --password=' + webPassword + ' ' + url + ' 2>/dev/null || curl -s -u ' + auth + ' ' + url + ' 2>/dev/null';

  var result = ModuleAPI.exec(cmd);
  var raw = (result.stdout || '').trim();

  var queriesEl = document.getElementById('statQueries');
  var blockedEl = document.getElementById('statBlocked');
  var timeEl = document.getElementById('statTime');

  if (!raw || raw.charAt(0) !== '{') {
    statsFailCount++;
    if (queriesEl) queriesEl.textContent = '-';
    if (blockedEl) blockedEl.textContent = '-';
    if (timeEl) timeEl.textContent = '-';
    if (statsFailCount >= 2) {
      showStatsAuthView();
    }
    return;
  }

  try {
    var stats = JSON.parse(raw);

    if (queriesEl) queriesEl.textContent = (typeof stats.num_dns_queries === 'number') ? stats.num_dns_queries : '-';
    if (blockedEl) blockedEl.textContent = (typeof stats.num_blocked_filtering === 'number') ? stats.num_blocked_filtering : '-';
    if (timeEl) timeEl.textContent = (typeof stats.avg_processing_time === 'number') ? stats.avg_processing_time.toFixed(2) + 's' : '-';
    statsFailCount = 0;
  } catch (e) {
    statsFailCount++;
    if (queriesEl) queriesEl.textContent = '-';
    if (blockedEl) blockedEl.textContent = '-';
    if (timeEl) timeEl.textContent = '-';
    if (statsFailCount >= 2) {
      showStatsAuthView();
    }
  }
}

// ==================== Control ====================
function controlAdGuard(action) {
  showLoading(true);

  var cmd;
  switch (action) {
    case 'start':
      cmd = SCRIPT_DIR + '/tool.sh start';
      break;
    case 'stop':
      cmd = SCRIPT_DIR + '/tool.sh stop';
      break;
    case 'restart':
      cmd = SCRIPT_DIR + '/tool.sh stop; sleep 1; ' + SCRIPT_DIR + '/tool.sh start';
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
  ModuleAPI.exec(SCRIPT_DIR + '/debug.sh 2>/dev/null');
  showToast('Debug info collected to ' + AGH_DIR + '/debug.log', 'success');
  showLoading(false);
}

// ==================== Load Web Port ====================
function loadWebPort() {
  var result = ModuleAPI.exec("grep 'address:' " + BIN_DIR + "/AdGuardHome.yaml 2>/dev/null | head -1");
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
  var result = ModuleAPI.exec('grep "^version=" ' + MODULE_PROP + ' 2>/dev/null | cut -d= -f2');
  var version = result.stdout.trim();
  if (version) {
    document.getElementById('versionText').textContent = 'v' + version;
  }
}

// ==================== Scroll Hide Floating Tab ====================
function setupScrollHideTab() {
  var pages = document.querySelectorAll('.page');
  var floatingTab = document.getElementById('floatingTab');
  if (!floatingTab) return;

  for (var i = 0; i < pages.length; i++) {
    (function(page) {
      page.addEventListener('scroll', function() {
        var atTop = page.scrollTop <= 2;
        var atBottom = page.scrollTop + page.clientHeight >= page.scrollHeight - 2;

        if (atTop || atBottom) {
          floatingTab.classList.remove('tab-hidden');
        } else {
          floatingTab.classList.add('tab-hidden');
        }
      });
    })(pages[i]);
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
  loadStats();
  setupScrollHideTab();

  switchTab(0);
}

// Auto-refresh every 5 seconds
setInterval(function() {
  if (ModuleAPI.isAvailable()) {
    checkStatus();
    loadLog();
    loadStats();
  }
}, 5000);

// Start
document.addEventListener('DOMContentLoaded', init);
