#!/bin/bash
# Prepara e installa l'app di sviluppo sull'iPhone collegato col cavo (serve Xcode 16.4 e la piattaforma iOS).
# Uso, dalla cartella del progetto:  bash scripts/ios-dev.sh
set -e
cd "$(dirname "$0")/.."
say() { printf "\n\033[1m== %s ==\033[0m\n" "$1"; }
fail() { printf "\n\033[31mERRORE: %s\033[0m\n" "$1"; exit 1; }

say "1/6 Controllo Xcode"
[ -d /Applications/Xcode.app ] || fail "Xcode non è nella cartella Applicazioni."
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept || true
sudo xcodebuild -runFirstLaunch || true
xcodebuild -showsdks 2>/dev/null | grep -q iphoneos || fail "Manca la piattaforma iOS: apri Xcode > Settings > Components e installa iOS 18.5."
xcodebuild -version

say "2/6 Controllo lo spazio sul Mac"
FREE=$(df -g / | awk 'NR==2{print $4}')
echo "Spazio libero: ${FREE} GB"
[ "$FREE" -ge 10 ] || fail "Servono almeno 10 GB liberi sul Mac."

say "3/6 Pacchetti del progetto"
npm install --legacy-peer-deps

say "4/6 Creo la parte iPhone (prebuild)"
npx expo prebuild --platform ios --clean

say "5/6 Controllo l'iPhone"
echo "Sblocca l'iPhone, tienilo collegato col cavo e, se compare, tocca «Autorizza»."

say "6/6 Compilo e installo sull'iPhone (la prima volta ci vogliono 10-20 minuti)"
npx expo run:ios --device
