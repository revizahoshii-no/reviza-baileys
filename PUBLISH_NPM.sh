#!/usr/bin/env bash
# Publish @reviza/baileys ke npm. Kamu cuma perlu satu hal: token npm.
#   ./PUBLISH_NPM.sh npm_xxxxxxxxxxxxxxxxxxxx
#
# Cara dapat token (2 menit, dari HP boleh):
#   1) https://www.npmjs.com/login
#   2) Account settings -> Access Tokens -> Generate New Token -> "Publishing"
#   3) Copy token yang mulai dengan "npm_"
#
# Script ini TIDAK menyimpan token ke repo / git. Setelah selesai token dibuang.
set -euo pipefail
cd "$(dirname "$0")"

TOKEN="${1:?usage: ./PUBLISH_NPM.sh <npm_token>}"

echo "==> 1/5 cek 2FA (npm menolak publish tanpa 2FA aktif di akun)"
echo "    kalau gagal di langkah 5, aktifkan: Account settings -> Two-Factor Authentication"

echo "==> 2/5 set token (hanya di memori + .npmrc sementara, bukan di repo)"
umask 077
printf '//registry.npmjs.org/:_authToken=%s\n' "$TOKEN" > .npmrc.publish
trap 'rm -f .npmrc.publish' EXIT

echo "==> 3/5 pastikan versi sah + akses publik (0.3.18-final adalah PRERELEASE: tidak akan jadi 'latest')"
node -e '
const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json","utf8"));
let changed=false;
if(/-(final|test|beta)$/.test(p.version)){p.version="0.3.18";changed=true;console.log("   versi dinormalkan -> 0.3.18");}
if(!p.publishConfig||p.publishConfig.access!=="public"){p.publishConfig={...(p.publishConfig||{}),access:"public"};changed=true;console.log("   publishConfig.access=public ditambahkan");}
if(p.packageManager){delete p.packageManager;changed=true;console.log("   packageManager (yarn) dihapus agar tidak bentrok dengan npm");}
if(changed){fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n");console.log("   package.json diperbarui");}else{console.log("   package.json sudah oke");}
'

echo "==> 4/5 dry-run: lihat apa yang benar-benar ikut ke-upload"
npm pack --dry-run 2>&1 | tail -6

echo "==> 5/5 publish"
if npm publish --access public 2>&1 | tee /tmp/publish.log | tail -5; then :; fi
if grep -q "npm error" /tmp/publish.log; then
  echo "   GAGAL. Penyebab paling umum:"
  grep -oE "(E401|E403|E404|402 Payment Required|Invalid version|two-factor|Cannot publish|forbidden)" /tmp/publish.log | sort -u | sed 's/^/     - /'
  echo "   Kalau tertulis 'two-factor': aktifkan 2FA dulu, lalu ulangi."
  echo "   Kalau 'E401/E403': token tidak punya hak Publishing (bukan Read-only)."
  echo "   Kalau 'Cannot publish over previously published': versi sudah ada, naikkan (npm version patch)."
else
  echo "   SUKSES. Cek: https://www.npmjs.com/package/@reviza/baileys"
  git add package.json 2>/dev/null || true
  git commit -m "Publish 0.3.18 ke npm" 2>/dev/null || true
  GIT_TERMINAL_PROMPT=0 git push origin main 2>&1 | tail -2 || echo "   (push gagal, tidak berpengaruh ke npm)"
fi

rm -f .npmrc.publish
echo "==> token dibuang dari disk"
