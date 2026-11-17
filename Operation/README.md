# Operation — VoiceGuard

Dokumen komersial & operasional **VoiceGuard — Real vs AI Voice Radar** diterbitkan oleh
**PT. Sainskerta Solusi Nusantara** (software house & AI partner, sejak 2013 — Gedung Graha Mampang
Lt. 3, Jakarta Selatan · hello@sainskerta.id · +62 813-5988-3131 · sainskerta.net).

VoiceGuard adalah ekstensi Google Chrome Manifest V3 bersumber terbuka (MIT, © 2026 aisac-id) yang
menandai suara TTS robotik, replay berulang, dan suara sintetis pada meeting, audio tab, atau
mikrofon pengguna. Seluruh analisis berjalan on-device melalui lima sinyal DSP tanpa cloud, tanpa
unggah audio, dan tanpa backend — fakta arsitektur yang menjadi dasar seluruh dokumen di folder ini.

**Klasifikasi:** Confidential — penggunaan internal dan untuk prospek yang telah menandatangani NDA.
**Tanggal suite:** 17 November 2026 · Versi 1.0 · Prefix kode dokumen: `SSN-VGD-*`

> Harga, target, dan proyeksi di seluruh dokumen ini adalah **usulan — perlu validasi manajemen**.
> Semua klaim fitur bersumber dari repo versi 1.0.0 (`README.md`, `manifest.json`, `app.html`, `js/*`).
> Produk secara eksplisit merupakan alat triase heuristik, bukan pengklasifikasi forensik kloning suara.

## 01-Business-Strategy

| Dokumen | Kode | Isi singkat |
|---|---|---|
| [01-Business-Model-Canvas.docx](01-Business-Strategy/01-Business-Model-Canvas.docx) | SSN-VGD-BMC-01 | Sembilan blok model bisnis open-core: inti gratis, bayarkan distribusi & kalibrasi |
| [02-ICP-dan-Segmentasi-Pasar.docx](01-Business-Strategy/02-ICP-dan-Segmentasi-Pasar.docx) | SSN-VGD-ICP-02 | Papan skor segmen, ICP B2B BFSI dan ICP B2C kreator/jurnalis |
| [03-Analisis-Kompetitor.docx](01-Business-Strategy/03-Analisis-Kompetitor.docx) | SSN-VGD-KOMP-03 | Pindrop, Resemble, Reality Defender, Hiya, Hive, aivoicedetector, TruthScan, Modulate, SynthID |
| [04-Analisis-SWOT.docx](01-Business-Strategy/04-Analisis-SWOT.docx) | SSN-VGD-SWOT-04 | SWOT berbasis bukti kode + matriks TOWS dan lima gerakan prioritas |

## 02-Sales

| Dokumen | Kode | Isi singkat |
|---|---|---|
| [05-Proposal-Penjualan-B2B-BFSI.docx](02-Sales/05-Proposal-Penjualan-B2B-BFSI.docx) | SSN-VGD-PROP-B2B-05 | Proposal untuk tim fraud & compliance bank/fintech |
| [05-Proposal-Penjualan-B2C-Kreator-Jurnalis.docx](02-Sales/05-Proposal-Penjualan-B2C-Kreator-Jurnalis.docx) | SSN-VGD-PROP-B2C-05 | Proposal perorangan untuk jurnalis, fact-checker, podcaster |
| [06-Statement-of-Work.docx](02-Sales/06-Statement-of-Work.docx) | SSN-VGD-SOW-06 | Lingkup W1–W7, prasyarat, jadwal 12 pekan, kriteria penerimaan |
| [07-Pricing-dan-Packaging.docx](02-Sales/07-Pricing-dan-Packaging.docx) | SSN-VGD-PRICE-07 | Empat tingkat paket + daftar harga Rupiah (usulan) dan simulasi |
| [08-Sales-Playbook-dan-Battlecard.docx](02-Sales/08-Sales-Playbook-dan-Battlecard.docx) | SSN-VGD-PLAY-08 | Jalur penjualan, kualifikasi, keberatan, dan battlecard kompetitor |
| [09-Product-Datasheet.docx](02-Sales/09-Product-Datasheet.docx) | SSN-VGD-DS-09 | Lembar spesifikasi produk & persyaratan sistem |

## 03-Pre-Sales

| Dokumen | Kode | Isi singkat |
|---|---|---|
| [10-Discovery-Questionnaire.docx](03-Pre-Sales/10-Discovery-Questionnaire.docx) | SSN-VGD-DISC-10 | Kuesioner discovery: kasus, endpoint, kebijakan, kriteria sukses |
| [11-Demo-Script-dan-PoC-Plan.docx](03-Pre-Sales/11-Demo-Script-dan-PoC-Plan.docx) | SSN-VGD-DEMO-11 | Naskah demo 35 menit + rencana PoC 4 pekan & ambang lulus |
| [12-Technical-Proposal.docx](03-Pre-Sales/12-Technical-Proposal.docx) | SSN-VGD-TECH-12 | Opsi distribusi, prasyarat, rencana 12 pekan, kriteria penerimaan |
| [13-ROI-dan-Business-Case.docx](03-Pre-Sales/13-ROI-dan-Business-Case.docx) | SSN-VGD-ROI-13 | Model nilai, perhitungan ilustratif, sensitivitas, risiko bisnis case |

## 04-IT-Communication

| Dokumen | Kode | Isi singkat |
|---|---|---|
| [14-Arsitektur-Solusi.docx](04-IT-Communication/14-Arsitektur-Solusi.docx) | SSN-VGD-ARS-14 | Komponen, alur data, lima sinyal, replay watchdog, batasan desain |
| [15-Arsitektur-Keamanan-dan-Threat-Model.docx](04-IT-Communication/15-Arsitektur-Keamanan-dan-Threat-Model.docx) | SSN-VGD-SEC-15 | Aset, batas kepercayaan, threat model STRIDE, gap keamanan |
| [16-Privasi-Data-dan-Kepatuhan.docx](04-IT-Communication/16-Privasi-Data-dan-Kepatuhan.docx) | SSN-VGD-PRIV-16 | Analisis UU PDP 27/2022, kebijakan toko, posisi GDPR, batasan klaim |

## 05-Resilience-Operations

| Dokumen | Kode | Isi singkat |
|---|---|---|
| [17-Business-Continuity-Plan.docx](05-Resilience-Operations/17-Business-Continuity-Plan.docx) | SSN-VGD-BCP-17 | BIA & skenario kontinuitas distribusi (bukan server): kunci penerbit, CWS, repo |
| [18-Disaster-Recovery-Plan.docx](05-Resilience-Operations/18-Disaster-Recovery-Plan.docx) | SSN-VGD-DRP-18 | Prosedur pemulihan aset rekayasa & kanal rilis, uji fungsional wajib |
| [19-SOP-Insiden-dan-Breach-Response.docx](05-Resilience-Operations/19-SOP-Insiden-dan-Breach-Response.docx) | SSN-VGD-SOP-19 | Deteksi → triase → containment → eradikasi → recovery → notifikasi |
| [20-SLA-dan-Model-Dukungan.docx](05-Resilience-Operations/20-SLA-dan-Model-Dukungan.docx) | SSN-VGD-SLA-20 | Model dukungan per paket, severity, target tanggap, eksklusi, kredit |

## Cara Membaca Suite Ini

1. Mulai dari `01`–`04` untuk posisi produk dan pasar.
2. Gunakan `05`–`09` saat menyusun penawaran; jangan mengutip harga tanpa persetujuan manajemen.
3. `10`–`13` dipakai sebelum kontrak: discovery, demo, PoC, proposal teknis, bisnis case.
4. `14`–`16` adalah rujukan teknis untuk arsitek IT & fungsi keamanan/kepatuhan klien.
5. `17`–`20` menjelaskan bagaimana kami tetap beroperasi dan bertanggung jawab bila terjadi gangguan.

## Catatan Penting

- VoiceGuard **tidak memiliki backend**; dokumen IT, BCP, DRP, SOP, dan SLA sengaja berfokus pada
  kontinuitas distribusi (kanal pemasangan, kunci penerbit, repositori, build) dan bukan pada server.
- Repo versi 1.0.0 hanya mendokumentasikan pemasangan *load unpacked*, sehingga penerbitan di
  Chrome Web Store tercatat sebagai **rencana**, bukan fakta.
- Verdict bersifat penyaringan awal. Dilarang memakainya sebagai dasar keputusan otomatis terhadap
  individu atau sebagai bukti forensik.
- Kompetitor dan sumber eksternal dikutip dengan URL aslinya; harga pihak ketiga wajib diverifikasi
  ulang sebelum dipakai dalam dokumen penawaran.

© 2026 PT. Sainskerta Solusi Nusantara · hello@sainskerta.id · sainskerta.net
