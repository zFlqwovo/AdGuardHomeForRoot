#!/bin/bash
set -e  # 关键：遇到任何错误（如网络中断）立即停止脚本，不再继续执行

rm -rf output cache
mkdir -p output src/bin/data

echo "Updating FAK-DNS rules..."
curl -L --retry 3 --fail "https://raw.githubusercontent.com/zFlqwovo/FAK-DNS/refs/heads/master/converted/FAK-DNS.txt" -o src/bin/data/FAK-DNS.txt

package() {
    arch=$1
    work_dir="cache/$arch"
    echo "----------------------------------------"
    echo "Packaging for $arch..."

    mkdir -p "$work_dir/bin"
    cp -r src/. "$work_dir/"

    download_url="https://github.com/AdguardTeam/AdGuardHome/releases/latest/download/AdGuardHome_linux_${arch}.tar.gz"
    echo "Downloading from: $download_url"
    
    curl -L --retry 3 --fail -o agh.tar.gz "$download_url"

    if ! tar -tzf agh.tar.gz >/dev/null 2>&1; then
        echo "Error: Downloaded file is not a valid tar archive."
        exit 1
    fi

    tar -xzf agh.tar.gz AdGuardHome/AdGuardHome

    if [ -f "AdGuardHome/AdGuardHome" ]; then
        mv AdGuardHome/AdGuardHome "$work_dir/bin/AdGuardHome"
        chmod +x "$work_dir/bin/AdGuardHome"
    else
        echo "Error: Binary file not found after extraction."
        exit 1
    fi

    rm -rf AdGuardHome agh.tar.gz

    cd "$work_dir"
    zip -q -r -9 "../../output/AdGuardHomeForRoot_${arch}.zip" .
    cd - > /dev/null
    
    echo "Success: Packaging for $arch done."
}

package "arm64"
package "armv7"

cd output
sha256sum *.zip | tee checksums.txt
echo "----------------------------------------"
echo "All builds completed successfully."