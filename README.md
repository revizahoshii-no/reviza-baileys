<h1 align="center">Reviza Baileys</h1>

<div align="center">

Pustaka WhatsApp berbasis WebSockets untuk kebutuhan bot dan aplikasi **Reviza**.

Berasal dari **Baileys** (`@whiskeysockets/baileys`) dan disesuaikan dengan kebutuhan Reviza.

</div>

---

> [!IMPORTANT]
> **Baca dulu sebelum mulai.** Semua contoh di halaman ini sudah saya cocokkan dengan isi
> source paket ini (`lib/`), bukan disalin mentah dari README Baileys. Karena itu ada
> beberapa bagian yang **berbeda dari Baileys asli** — terutama soal nama fungsi versi.
> Lihat [Perbedaan dengan Baileys asli](#perbedaan-dengan-baileys-asli).

## Daftar Isi

- [Nama Paket](#nama-paket)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Cara Menghubungkan Akun](#cara-menghubungkan-akun)
  - [Lewat QR Code](#lewat-qr-code)
  - [Lewat Pairing Code](#lewat-pairing-code)
- [Menyimpan & Memulihkan Sesi](#menyimpan--memulihkan-sesi)
- [Contoh Bot Lengkap](#contoh-bot-lengkap)
- [Mengirim Pesan](#mengirim-pesan)
- [Menerima & Mengunduh Media](#menerima--mengunduh-media)
- [Mengelola Grup](#mengelola-grup)
- [Event yang Tersedia](#event-yang-tersedia)
- [Fungsi Utilitas](#fungsi-utilitas)
- [Format ID WhatsApp (JID)](#format-id-whatsapp-jid)
- [Perbedaan dengan Baileys asli](#perbedaan-dengan-baileys-asli)
- [Identitas Proyek](#identitas-proyek)
- [Lisensi](#lisensi)

## Nama Paket

`@reviza/baileys`

## Prasyarat

| Kebutuhan | Keterangan |
|---|---|
| **Node.js 20 atau lebih baru** | **Wajib.** Saat `npm install`, ada script `preinstall` (`engine-requirements.js`) yang akan **menghentikan instalasi** jika versi Node Anda di bawah 20. |
| **ESM** | Paket ini `"type": "module"`. Kalau project Anda CommonJS, pakai `import()` dinamis (lihat di bawah). |
| **`pino`** | Untuk logger. Sudah ikut terpasang sebagai dependency. |

## Instalasi

Dari registry (jika sudah dirilis):

```bash
npm install @reviza/baileys
```

Langsung dari repository GitHub ini:

```bash
npm install github:revizahoshii-no/reviza-baileys
```

Lalu impor di kode Anda:

```js
import makeWASocket from "@reviza/baileys";
```

Di project CommonJS (`require`):

```js
async function main() {
  const { default: makeWASocket } = await import("@reviza/baileys");
  // ... lanjutkan di sini
}
main();
```

## Cara Menghubungkan Akun

WhatsApp menyediakan API multi-device yang membuat paket ini bisa autentikasi sebagai
perangkat WhatsApp kedua — pindai **QR code** atau pakai **pairing code** dari HP.

### Lewat QR Code

> [!IMPORTANT]
> **Ini beda dari Baileys biasa.** Opsi `printQRInTerminal` di fork ini **sudah deprecated** —
> kalau Anda set `true`, yang muncul cuma peringatan di log dan **QR code tidak dicetak**.
> Kode QR dikirim lewat event `connection.update` sebagai properti `qr`, jadi Anda yang menanganinya.

```js
import makeWASocket, { Browsers } from "@reviza/baileys";

const sock = makeWASocket({
    browser: Browsers.ubuntu("Reviza App")
});

sock.ev.on("connection.update", ({ qr }) => {
    if (qr) console.log("Scan kode QR ini dengan WhatsApp Anda:\n", qr);
});
```

Pindai lewat **WhatsApp → Perangkat Tertaut → Tautkan Perangkat**, dan Anda langsung masuk.

Mau QR yang bisa dibaca mata (bukan string teks) di terminal? Tambahkan dependency kecil:

```bash
npm install qrcode-terminal
```
```js
import qrcode from "qrcode-terminal";

sock.ev.on("connection.update", ({ qr }) => {
    if (qr) qrcode.generate(qr, { small: true });
});
```

### Lewat Pairing Code

Pairing code dipakai kalau tidak bisa memindai QR (misalnya di server/VPS).
Nomor **tanpa** `+`, `()`, atau `-` — awali dengan kode negara. Untuk Indonesia pakai `62`.

```js
import makeWASocket from "@reviza/baileys";

const sock = makeWASocket({});

if (!sock.authState.creds.registered) {
    const nomor = "6281234567890";
    const kode = await sock.requestPairingCode(nomor);
    console.log("Masukkan kode ini di WhatsApp:", kode);
}
```

Anda juga bisa menentukan kode sendiri, dengan syarat **panjangnya harus pas 8 karakter**:

```js
const kode = await sock.requestPairingCode("6281234567890", "REVIZA01");
```

Kalau panjangnya bukan 8, akan error: `Custom pairing code must be exactly 8 chars`.

## Menyimpan & Memulihkan Sesi

Supaya tidak perlu memindai QR berulang kali, simpan kredensial ke folder:

```js
import makeWASocket, { useMultiFileAuthState } from "@reviza/baileys";

const { state, saveCreds } = await useMultiFileAuthState("auth_info_reviza");

const sock = makeWASocket({
    auth: state         // perhatikan: namanya `auth`, bukan `authState`
});

// dipanggil setiap kali kredensial diperbarui
sock.ev.on("creds.update", saveCreds);
```

> [!WARNING]
> Folder `auth_info_reviza` berisi **kunci sesi** akun WhatsApp Anda. Siapa pun yang memegang
> folder itu bisa mengambil alih sesi. **Jangan pernah** commit ke Git — tambahkan ke `.gitignore`:
>
> ```gitignore
> auth_info_reviza/
> ```

Agar sesi makin awet dan tidak sering diminta pairing ulang, bungkus key store dengan cache:

```js
import makeWASocket, { useMultiFileAuthState, makeCacheableSignalKeyStore } from "@reviza/baileys";
import pino from "pino";

const logger = pino({ level: "silent" });
const { state, saveCreds } = await useMultiFileAuthState("auth_info_reviza");

const sock = makeWASocket({
    logger,
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
    }
});

sock.ev.on("creds.update", saveCreds);
```

## Contoh Bot Lengkap

Ini pola dasar yang paling umum dipakai: tangkap pesan masuk, balas, tangani koneksi putus.

```js
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@reviza/baileys";
import { Boom } from "@hapi/boom";

async function jalankanBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_reviza");

    const sock = makeWASocket({
        auth: state
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) console.log("Scan kode QR ini:", qr);

        if (connection === "close") {
            const logout = lastDisconnect?.error
                ? new Boom(lastDisconnect.error)?.output?.statusCode === DisconnectReason.loggedOut
                : false;

            console.log("Koneksi tertutup:", lastDisconnect?.error);
            // sambungkan lagi, kecuali Anda memang logout secara sadar
            if (!logout) jalankanBot();
        } else if (connection === "open") {
            console.log("Bot aktif!");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        // selalu pakai loop: messages adalah array
        for (const m of messages) {
            if (m.key.fromMe) continue;                 // lewati pesan dari bot sendiri
            if (m.message?.protocolMessage) continue;   // lewati edit/hapus pesan

            const teks = m.message?.conversation
                || m.message?.extendedTextMessage?.text
                || "";

            console.log(`Pesan dari ${m.key.remoteJid}:`, teks);
            await sock.sendMessage(m.key.remoteJid, { text: "Halo dari Reviza Baileys!" });
        }
    });

    sock.ev.on("creds.update", saveCreds);
}

jalankanBot();
```

## Mengirim Pesan

Semua jenis pesan dikirim lewat satu fungsi: `sock.sendMessage(jid, konten, opsi)`.

**Teks**

```js
await sock.sendMessage(nomor, { text: "halo apa kabar" });
```

**Balas dengan quote**

```js
await sock.sendMessage(nomor, { text: "oke siap" }, { quoted: pesanMasuk });
```

**Sebut (mention) pengguna**

```js
await sock.sendMessage(nomor, {
    text: "halo @6281234567890 👋",
    mentions: ["6281234567890@s.whatsapp.net"]
});
```

**Gambar**

```js
// dari file
await sock.sendMessage(nomor, { image: { url: "./foto.jpg" }, caption: "caption di sini" });

// dari Buffer hasil unduhan
await sock.sendMessage(nomor, { image: buffer, caption: "langsung dari memori" });
```

**Video, audio, dokumen, sticker, GIF**

```js
await sock.sendMessage(nomor, { video: { url: "./klip.mp4" }, caption: "video", gifPlayback: false });
await sock.sendMessage(nomor, { audio: { url: "./suara.mp3" }, ptt: true });   // ptt: true = voice note
await sock.sendMessage(nomor, { document: { url: "./kata-kata.pdf" }, fileName: "kata-kata.pdf" });
await sock.sendMessage(nomor, { sticker: "./stiker.webp" });
await sock.sendMessage(nomor, { video: { url: "./loop.mp4" }, gifPlayback: true });
```

**View Once**

```js
await sock.sendMessage(nomor, { image: { url: "./rahasia.jpg" }, viewOnce: true });
```

**Lokasi & Kontak**

```js
await sock.sendMessage(nomor, {
    location: { degreesLatitude: -3.5952, degreesLongitude: 97.6571 }  // Medan
});

const vcard =
    "BEGIN:VCARD\n" +
    "VERSION:3.0\n" +
    "FN:Reviza\n" +
    "TEL;type=CELL;type=VOICE;waid=6281234567890:+62 812-3456-7890\n" +
    "END:VCARD";

await sock.sendMessage(nomor, {
    contacts: { displayName: "Reviza", contacts: [{ vcard }] }
});
```

**Reaksi, Poll, dan Maju (forward)**

```js
await sock.sendMessage(nomor, { react: { text: "🔥", key: pesanMasuk.key } });
await sock.sendMessage(nomor, { react: { text: "", key: pesanMasuk.key } });  // string kosong = hapus reaksi

await sock.sendMessage(nomor, {
    poll: { name: "Makan siang?", values: ["Nasi padang", "Soto", "Gado-gado"], selectableCount: 1 }
});

await sock.sendMessage(nomor, { forward: pesanMasuk });
```

> [!TIP]
> Supaya tautan ikut menampilkan *preview*, pasang dependency opsionalnya:
>
> ```bash
> npm install link-preview-js
> ```
>
> Opsi `generateHighQualityLinkPreview` di fork ini **sudah `true` secara default**, jadi
> tidak perlu diaktifkan manual — cukup kirim teks yang berisi URL:
>
> ```js
> await sock.sendMessage(nomor, { text: "lihat: https://example.com" });
> ```

## Menerima & Mengunduh Media

```js
import { downloadMediaMessage } from "@reviza/baileys";
import fs from "node:fs";

sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const m of messages) {
        const media = m.message?.imageMessage
            || m.message?.videoMessage
            || m.message?.audioMessage
            || m.message?.documentMessage;

        if (!media) continue;

        const buffer = await downloadMediaMessage(m, "buffer", {}, {
            logger: sock.logger,
            reuploadRequest: sock.updateMediaMessage
        });

        fs.writeFileSync(`unduhan_${m.message.imageMessage ? "foto.jpg" : "media"}`, buffer);
    }
});
```

Butuh alurnya terpisah (unduh manual per konten)? Tersedia juga `downloadContentFromMessage`.

## Mengelola Grup

```js
// buat grup (array nomor)
const { id: jidGrup } = await sock.groupCreate("Ruang Reviza", [
    "6281234567890@s.whatsapp.net",
    "6281234567891@s.whatsapp.net"
]);

// info grup: nama, deskripsi, peserta
const meta = await sock.groupMetadata(jidGrup);
console.log(meta.subject, "| peserta:", meta.participants.length);

// tambah / keluarkan / naikkan-turunkan admin
await sock.groupParticipantsUpdate(jidGrup, ["6281234567892@s.whatsapp.net"], "add");
await sock.groupParticipantsUpdate(jidGrup, ["6281234567892@s.whatsapp.net"], "remove");
await sock.groupParticipantsUpdate(jidGrup, ["6281234567892@s.whatsapp.net"], "promote");
await sock.groupParticipantsUpdate(jidGrup, ["6281234567892@s.whatsapp.net"], "demote");

// ubah nama & deskripsi
await sock.groupUpdateSubject(jidGrup, "Nama Baru");
await sock.groupUpdateDescription(jidGrup, "Deskripsi grup");

// kunci grup (hanya admin yang bisa kirim)
await sock.groupSettingUpdate(jidGrup, "announcement");
await sock.groupSettingUpdate(jidGrup, "not_announcement");  // buka lagi

// pesan sementara (auto-delete)
await sock.groupToggleEphemeral(jidGrup, 7 * 24 * 3600);  // detik
```

## Event yang Tersedia

Paket ini memakai gaya `EventEmitter`, jadi tinggal `sock.ev.on(...)`:

| Event | Kapan terjadi |
|---|---|
| `connection.update` | Status koneksi berubah (`open`, `close`, QR menunggu) |
| `messages.upsert` | Ada pesan baru |
| `messages.update` | Pesan berubah (dibaca, diedit, dihapus, vote poll) |
| `messaging-history.set` | Riwayat chat terkirim saat pertama kali sinkron |
| `chats.upsert` / `chats.update` / `chats.delete` | Data chat berubah |
| `contacts.upsert` / `contacts.update` | Data kontak berubah |
| `groups.upsert` / `groups.update` | Informasi grup berubah |
| `group-participants.update` | Ada yang masuk/keluar/di-promosi |
| `creds.update` | Kredensial sesi perlu disimpan ulang |
| `presence.update` | Ada yang sedang mengetik / online |

Contoh menangani peserta grup baru:

```js
sock.ev.on("group-participants.update", async (event) => {
    if (event.action === "add") {
        await sock.sendMessage(event.id, { text: `Selamat datang @${event.participants[0].split("@")[0]}!`, mentions: event.participants });
    }
});
```

## Fungsi Utilitas

Semua ini bisa diimpor langsung dari `"@reviza/baileys"`:

| Fungsi | Kegunaan |
|---|---|
| `getContentType(pesan)` | Tahu jenis isi pesan (`imageMessage`, `conversation`, dst.) |
| `getDevice(pesan)` | Tahu perangkat pengirim (`android`, `desktop`, `smba`) |
| `jidDecode("62..@s.whatsapp.net")` | Pecah JID jadi `{ user, server, agent, device }` |
| `jidNormalizedUser(jid)` | Normalisasi JID (buang agent/device) |
| `isJidGroup` / `isJidBroadcast` / `isJidStatusBroadcast` | Cek jenis JID |
| `downloadMediaMessage` / `downloadContentFromMessage` | Unduh media |
| `prepareWAMessageMedia` | Siapkan media sebelum dikirim (untuk kontrol penuh) |
| `generateWAMessageFromContent` | Susun objek pesan mentah |
| `updateMediaMessage` | Kirim ulang media yang habis masa berlakunya |
| `getAggregateVotesInPollMessage` | Baca hasil vote poll |
| `useMultiFileAuthState` / `useSingleFileAuthState` / `useSqliteAuthState` | Simpan sesi (folder / satu file / SQLite) |
| `makeCacheableSignalKeyStore` | Cache kunci sesi (lebih cepat & lebih awet) |
| `initAuthCreds` | Bikin kredensial kosong dari nol |
| `makeInMemoryStore` | Penyimpanan chat/kontak sementara di memori |
| `useSqliteAuthState({ dbPath })` | Simpan sesi di SQLite (butuh `better-sqlite3`) |
| `Browsers` | Pengaturan identitas perangkat (`macOS`, `windows`, `ubuntu`, `android`, `baileys`, `appropriate`) |
| `delay(ms)` | Jeda (Promise) |
| `proto` | Akses objek protokol WhatsApp (`proto.Message`, `proto.WebMessageInfo`) |

Penyimpanan di memori (praktis untuk bot kecil, **boros RAM** untuk pemakaian serius):

```js
import makeWASocket, { makeInMemoryStore } from "@reviza/baileys";

const store = makeInMemoryStore({});
store.readFromFile("./reviza_store.json");
setInterval(() => store.writeToFile("./reviza_store.json"), 10_000);

const sock = makeWASocket({});
store.bind(sock.ev);

sock.ev.on("chats.upsert", () => console.log(store.chats.all()));
```

## Format ID WhatsApp (JID)

ID tujuan (disebut **JID**) wajib format `[kode negara][nomor]@s.whatsapp.net`:

| Untuk | Format | Contoh |
|---|---|---|
| Pengguna | `nomor@s.whatsapp.net` | `6281234567890@s.whatsapp.net` |
| Grup | `id-internal@g.us` | `120363012345678901@g.us` |
| Broadcast list | `[waktu-dibuat]@broadcast` | — |
| Status/story | `status@broadcast` | — |

Nomor **selalu** pakai kode negara tanpa `+` (Indonesia → `62`).

## Perbedaan dengan Baileys asli

Kalau Anda sebelumnya pakai `@whiskeysockets/baileys`, ada yang berubah di sini:

- **`fetchLatestBaileysVersion` tidak tersedia dengan nama itu.** Di fork ini namanya diganti
  menjadi `fetchLatestReviza BaileysVersion` (di `lib/Utils/generics.js`). Perlu dicatat dengan
  jujur: nama itu mengandung **spasi**, sehingga **tidak valid sebagai identifier JavaScript** dan
  file tersebut gagal di-parse (`SyntaxError: Missing initializer in const declaration`). Jadi
  jangan menulis `import { fetchLatestBaileysVersion }` — tidak akan resolve.
  **Solusi yang aman:** set versi secara manual di config, atau pakai `fetchLatestWaWebVersion`
  (namanya normal dan berfungsi):
  ```js
  import makeWASocket, { fetchLatestWaWebVersion } from "@reviza/baileys";

  // opsi 1 — tulis versi sendiri
  const sock = makeWASocket({ version: [2, 3000, x] });

  // opsi 2 — ambil versi dari WhatsApp Web
  const { version } = await fetchLatestWaWebVersion({});
  const sock2 = makeWASocket({ version });
  ```
- **`printQRInTerminal` sudah deprecated.** Kalau diset `true`, hanya muncul peringatan dan
  QR **tidak** dicetak. Ambil QR dari `connection.update` → `({ qr })`, lalu cetak sendiri.
- **Tidak ada lagi Mobile API.** Menggunakan opsi `mobile` akan melempar
  `Mobile API is not supported anymore` dengan status `loggedOut`.
- **Opsi `auth`**, bukan `authState`, saat membuat socket. `sock.authState` memang tersedia,
  tapi properti masuknya bernama `auth`.
- **Bawaan lain yang perlu diketahui:** `syncFullHistory: true`, `markOnlineOnConnect: true`,
  `generateHighQualityLinkPreview: true`, `fireInitQueries: true`,
  `browser: Browsers.macOS("Chrome")`, `connectTimeoutMs: 20000`, `keepAliveIntervalMs: 15000`.
- **Struktur `useMultiFileAuthState`** mengembalikan `{ state, saveCreds }` dengan
  `state = { creds, keys }` — sama polanya dengan Baileys, tapi implementasinya di fork ini
  ditulis ulang (bisa dilihat dari komentar `Reviza@Note` di source).
- **`Browsers.baileys()`** melapor sebagai `"Reviza Baileys"`, bukan `"Baileys"`.
- **Store in-memory** di fork ini dikonversi ke ESM secara manual dan masih berstatus
  *work in progress* (`[WIP]` di komentar source). Untuk produksi, sebaiknya buat penyimpanan
  sendiri (SQLite/Postgres).
- **Bukan paket murni `type: module` saja** — tidak ada build script di paket ini yang terpasang,
  jadi yang ter-publish adalah hasil build `lib/`. Mengubah TypeScript di repo hulu tidak akan
  berpengaruh ke sini.

> [!NOTE]
> Daftar di atas menggambarkan **isi source apa adanya**. Fungsi `makeWASocket` sendiri utuh dan
> tidak diubah; satu-satunya cacat yang ditemukan saat dokumentasi ini ditulis ada di
> `lib/Utils/generics.js` baris 181 (nama export berspasi). Selama file itu belum diperbaiki,
> `import makeWASocket from "@reviza/baileys"` akan ikut gagal di-parse, karena rantai
> importnya menyentuh file tersebut (`lib/index.js` → `lib/Socket/index.js` → `lib/Defaults/index.js`
> → `lib/Utils/generics.js`).

## Identitas Proyek

Paket ini dikemas dan digunakan untuk proyek pribadi Reviza.

## Lisensi

Ketentuan lisensi dan pemberitahuan hak cipta yang diwajibkan oleh komponen sumber tetap tersedia
di file `LICENSE`. File tersebut tidak dihapus atau diubah.

## Catatan

Jangan menghapus file `LICENSE` ketika menyalin atau menggunakan paket ini apabila ketentuan
lisensinya mewajibkan pemberitahuan tersebut tetap disertakan.

## Repository

Sumber resmi proyek: https://github.com/revizahoshii-no/reviza-baileys

Contoh penggunaan di halaman ini diadaptasi dari dokumentasi
[Baileys (`WhiskeySockets/Baileys`)](https://github.com/WhiskeySockets/Baileys) dan diterjemahkan
serta disesuaikan ke `@reviza/baileys`.
