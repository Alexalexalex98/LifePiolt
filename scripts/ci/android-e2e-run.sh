#!/usr/bin/env bash
# Eseguito DENTRO l'emulatore Android gia' avviato (reactivecircus/android-emulator-runner) o su un telefono collegato via adb.
#   APK=app.apk INCLUDE_TAGS=smoke,native bash scripts/ci/android-e2e-run.sh
# Variabili: APK (obbligatoria), INCLUDE_TAGS (default smoke), MAESTRO_VERSION, OUT (default maestro-report), SET_LOCALE=1 (imposta italiano), SET_PIN=1234 (blocco schermo)
# Ogni flusso gira da solo: un report JUnit e un video per flusso. I flussi con tag "fragile" non fanno fallire lo script.
set -u
APK="${APK:?imposta APK=percorso.apk}"
INCLUDE_TAGS="${INCLUDE_TAGS:-smoke}"
MAESTRO_VERSION="${MAESTRO_VERSION:-1.40.3}"
OUT="${OUT:-maestro-report}"
APP_ID="com.lifepilot.app"
mkdir -p "$OUT/junit" "$OUT/video" "$OUT/screenshots" "$OUT/logs"

echo "::group::Dispositivo"
adb wait-for-device
adb shell getprop ro.build.version.release
adb shell getprop ro.product.cpu.abi
if [ "${SET_LOCALE:-1}" = "1" ]; then
  # Lingua italiana: l'app parte nella lingua del dispositivo e i flussi cercano i testi in italiano.
  adb root >/dev/null 2>&1 || true
  adb shell "setprop persist.sys.locale it-IT; setprop persist.sys.language it; setprop persist.sys.country IT" || true
  adb shell "setprop ctl.restart zygote" || true
  sleep 5; adb wait-for-device
  # attende la fine dell'avvio dopo il riavvio dello zygote
  for i in $(seq 1 60); do [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ] && break; sleep 2; done
  adb shell getprop persist.sys.locale
fi
if [ -n "${SET_PIN:-1234}" ]; then adb shell locksettings set-pin "${SET_PIN:-1234}" || echo "set-pin non riuscito (i flussi del blocco app potrebbero fallire)"; fi
# schermo acceso, sbloccato, senza animazioni
adb shell input keyevent KEYCODE_WAKEUP || true
adb shell wm dismiss-keyguard || true
for s in window_animation_scale transition_animation_scale animator_duration_scale; do adb shell settings put global "$s" 0 || true; done
echo "::endgroup::"

echo "::group::Installa APK"
adb uninstall "$APP_ID" >/dev/null 2>&1 || true
adb install -r -t "$APK"
adb shell pm list packages | grep -q "$APP_ID" || { echo "APK non installato"; exit 2; }
echo "::endgroup::"

if ! command -v maestro >/dev/null 2>&1; then
  echo "::group::Installa Maestro $MAESTRO_VERSION"
  export MAESTRO_VERSION
  curl -fsSL "https://get.maestro.mobile.dev" | bash
  export PATH="$PATH:$HOME/.maestro/bin"
  echo "::endgroup::"
fi
maestro --version

fail=0; fragile_fail=0; total=0
run_list() { # $1 = elenco flussi, $2 = "fragile" per non far fallire
  for flow in $1; do
    [ -z "$flow" ] && continue
    name="$(basename "$flow" .yaml)"; total=$((total+1))
    echo "::group::$name"
    adb shell "rm -f /sdcard/$name.mp4"
    # screenrecord si ferma a 180 s: i flussi lenti hanno comunque l'inizio e i screenshot
    (adb shell screenrecord --time-limit 180 "/sdcard/$name.mp4" >/dev/null 2>&1 &) ; sleep 1
    maestro test "$flow" --format junit --output "$OUT/junit/$name.xml" --test-output-dir "$OUT/screenshots/$name" --debug-output "$OUT/logs/$name" 2>&1 | tee "$OUT/logs/$name.log"
    rc=${PIPESTATUS[0]}
    adb shell pkill -2 screenrecord >/dev/null 2>&1 || true; sleep 2
    adb pull "/sdcard/$name.mp4" "$OUT/video/$name.mp4" >/dev/null 2>&1 || true
    if [ "$rc" -ne 0 ]; then
      echo "::warning::flusso $name fallito (rc=$rc)"
      if [ "${2:-}" = "fragile" ]; then fragile_fail=$((fragile_fail+1)); else fail=$((fail+1)); fi
      adb logcat -d -t 400 > "$OUT/logs/$name.logcat.txt" 2>/dev/null || true
    fi
    echo "::endgroup::"
  done
}
STABLE="$(node scripts/ci/maestro-select.mjs --include="$INCLUDE_TAGS" --exclude=fragile)"
FRAGILE="$(node scripts/ci/maestro-select.mjs --include="$INCLUDE_TAGS" --only=fragile)"
run_list "$STABLE" stable
run_list "$FRAGILE" fragile
echo "Flussi: $total | falliti: $fail | falliti fragili (non bloccanti): $fragile_fail"
{ echo "### Maestro"; echo "- eseguiti: $total"; echo "- falliti: $fail"; echo "- falliti fragili (non bloccanti): $fragile_fail"; } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
[ "$fail" -eq 0 ]
