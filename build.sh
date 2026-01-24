#!/bin/bash

rm -rf output cache
mkdir -p output src/bin/data

echo "Updating FAK-DNS rules..."
curl -L "https://raw.githubusercontent.com/zFlqwovo/FAK-DNS/refs/heads/master/converted/FAK-DNS.txt" -o src/bin/data/FAK-DNS.txt

package() {
    arch=$1
    work_dir="cache/$arch"
    
    echo "Packaging for $arch..."
    mkdir -p "$work_dir/bin"
    cp -r src/. "$work_dir/"
    
    curl -L -o agh.tar.gz "https://github.com/AdguardTeam/AdGuardHome/releases/latest/download/AdGuardHome_linux_${arch}.tar.gz"
    tar -xzf agh.tar.gz AdGuardHome/AdGuardHome
    
    mv AdGuardHome/AdGuardHome "$work_dir/bin/AdGuardHome"
    chmod +x "$work_dir/bin/AdGuardHome"
    
    rm -rf AdGuardHome agh.tar.gz
    
    cd "$work_dir"
    zip -q -r -9 "../../output/AdGuardHomeForRoot_${arch}.zip" .
    cd - > /dev/null
}

package "arm64"
package "armv7"

cd output
sha256sum *.zip | tee checksums.txt