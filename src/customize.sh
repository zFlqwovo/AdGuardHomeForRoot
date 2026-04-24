SKIPUNZIP=1

# most of the users are Chinese, so set default language to Chinese
language="zh"

# try to get the system language
locale=$(getprop persist.sys.locale || getprop ro.product.locale || getprop persist.sys.language)

# if the system language is English, set language to English
if echo "$locale" | grep -qi "en"; then
  language="en"
fi

function info() {
  [ "$language" = "en" ] && ui_print "$1" || ui_print "$2"
}

function error() {
  [ "$language" = "en" ] && abort "$1" || abort "$2"
}

info "- 🚀 Installing AdGuardHome for $ARCH" "- 🚀 开始安装 AdGuardHome for $ARCH"

AGH_DIR="/data/adb/agh"
BIN_DIR="$AGH_DIR/bin"
SCRIPT_DIR="$AGH_DIR/scripts"
PID_FILE="$AGH_DIR/bin/agh.pid"

info "- 📦 Extracting module basic files..." "- 📦 解压模块基本文件..."
unzip -o "$ZIPFILE" "action.sh" -d "$MODPATH" >/dev/null 2>&1 
unzip -o "$ZIPFILE" "module.prop" -d "$MODPATH" >/dev/null 2>&1
unzip -o "$ZIPFILE" "service.sh" -d "$MODPATH" >/dev/null 2>&1
unzip -o "$ZIPFILE" "uninstall.sh" -d "$MODPATH" >/dev/null 2>&1
unzip -o "$ZIPFILE" "webroot/*" -d "$MODPATH" >/dev/null 2>&1

extract_keep_config() {
  info "- 🌈 Keeping old configuration files..." "- 🌈 保留原来的配置文件..."
  info "- 📜 Extracting script files..." "- 📜 正在解压脚本文件..."
  unzip -o "$ZIPFILE" "scripts/*" -d $AGH_DIR >/dev/null 2>&1 || {
    error "- ❌ Failed to extract scripts!" "- ❌ 解压脚本文件失败！"
  }
  info "- 🛠️ Extracting binary files except configuration..." "- 🛠️ 正在解压二进制文件（不包括配置文件）..."
  unzip -o "$ZIPFILE" "bin/*" -x "bin/AdGuardHome.yaml" -d $AGH_DIR >/dev/null 2>&1 || {
    error "- ❌ Failed to extract binary files!" "- ❌ 解压二进制文件失败！"
  }
  info "- 🚫 Skipping configuration file extraction..." "- 🚫 跳过解压配置文件..."
}

extract_all() {
  info "- 🌟 Extracting script files..." "- 🌟 正在解压脚本文件..."
  unzip -o "$ZIPFILE" "scripts/*" -d $AGH_DIR >/dev/null 2>&1 || {
    error "- ❌ Failed to extract scripts" "- ❌ 解压脚本文件失败"
  }
  info "- 🛠️ Extracting binary files..." "- 🛠️ 正在解压二进制文件..."
  unzip -o "$ZIPFILE" "bin/*" -d $AGH_DIR >/dev/null 2>&1 || {
    error "- ❌ Failed to extract binary files" "- ❌ 解压二进制文件失败"
  }
  info "- 📜 Extracting configuration files..." "- 📜 正在解压配置文件..."
  unzip -o "$ZIPFILE" "settings.conf" -d $AGH_DIR >/dev/null 2>&1 || {
    error "- ❌ Failed to extract configuration files" "- ❌ 解压配置文件失败"
  }
}

if [ -d "$AGH_DIR" ]; then
  info "- ⏹️ Found old version, stopping all AdGuardHome processes..." "- ⏹️ 发现旧版模块，正在停止所有 AdGuardHome 进程..."
  pkill -f "AdGuardHome" || pkill -9 -f "AdGuardHome" 

  for i in 1 2 3 4 5; do
  pgrep -f "AdGuardHome" >/dev/null 2>&1 || break
  sleep 1
  done
  
  info "- 🔄 Defaulting to keep old configuration." "- 🔄 默认保留原配置。"
  extract_keep_config
else
  info "- 📦 First time installation, extracting files..." "- 📦 第一次安装，正在解压文件..."
  mkdir -p "$AGH_DIR" "$BIN_DIR" "$SCRIPT_DIR"
  extract_all
fi

info "- 🔐 Setting permissions..." "- 🔐 设置权限..."

chmod +x "$BIN_DIR/AdGuardHome"
chown root:net_raw "$BIN_DIR/AdGuardHome"

chmod +x "$SCRIPT_DIR"/*.sh "$MODPATH"/*.sh

info "- 🎉 Installation completed, please reboot." "- 🎉 安装完成，请重启设备。"
