until [ $(getprop init.svc.bootanim) = "stopped" ]; do
  sleep 12
done

/data/adb/agh/scripts/tool.sh start

inotifyd /data/adb/agh/scripts/inotify.sh /data/adb/modules/AdGuardHome:dn &
