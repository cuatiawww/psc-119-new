import { NextResponse } from 'next/server'

/**
 * POST /api/generate-dashboard-report-ai
 *
 * Server-side proxy yang memanggil Gemini AI untuk menghasilkan sintesis
 * intelijen surveilans epidemiologi & krisis kesehatan EOC Kemenkes RI yang
 * sangat mendalam, deskriptif, panjang, dan berbobot formal kenegaraan.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // ── Step 1: Forward ke Backend PHP jika tersedia ──
    const backendBase = (
      process.env.SIPKK_BACKEND_BASE_URL || 'http://sipkk-baru.test'
    ).replace(/\/+$/, '')

    const dashboardToken = process.env.SIPKK_DASHBOARD_TTOKEN?.trim() || ''
    const authHeader = req.headers.get('authorization') || ''
    const clientToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : ''
    const tokenToSend = clientToken || dashboardToken

    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
    if (tokenToSend) forwardHeaders['TTOKEN'] = tokenToSend

    try {
      console.log('[generate-dashboard-report-ai] Forwarding to backend PHP...')
      const backendRes = await fetch(`${backendBase}/api/generate-dashboard-report-ai`, {
        method: 'POST',
        headers: forwardHeaders,
        body: JSON.stringify(body),
        cache: 'no-store',
      })

      if (backendRes.ok) {
        const json = await backendRes.json()
        if (json.success && json.data) {
          console.log('[generate-dashboard-report-ai] Backend PHP response OK')
          return NextResponse.json(json)
        }
      } else {
        console.warn(`[generate-dashboard-report-ai] Backend returned HTTP ${backendRes.status}`)
      }
    } catch (backendErr) {
      console.warn('[generate-dashboard-report-ai] Backend PHP unreachable:', backendErr)
    }

    // ── Step 2: Direct Gemini AI Multi-Key & Multi-Model Rotation ──
    const rawKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GOOGLE_AI_API_KEY,
      process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    ].filter(Boolean) as string[]

    const uniqueKeys = Array.from(new Set(rawKeys))
    if (uniqueKeys.length === 0) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY tidak tersedia di server environment' },
        { status: 500 }
      )
    }

    const {
      totalReports = 0,
      totalMeninggal = 0,
      totalLuka = 0,
      totalHilang = 0,
      totalTerdampak = 0,
      totalPengungsi = 0,
      totalFaskes = 0,
      filterWilayahText = 'Seluruh Wilayah (Nasional)',
      filterBencanaText = 'Semua Jenis Bencana',
      timePresetText = 'Semua Periode',
      topRegions = [],
      topJenis = [],
    } = body

    const topRegionsStr = (topRegions as any[]).slice(0, 5).map((r: any, i: number) =>
      `${i + 1}. ${r.name}: ${r.total_laporan} Kejadian (MD: ${r.korban_meninggal || 0}, LK: ${r.korban_luka || 0}, HL: ${r.korban_hilang || 0}, Terdampak: ${(r.penduduk_terdampak || 0) + (r.pengungsi || 0)}, Dominan: ${r.bencana_dominan || '-'})`
    ).join('\n')

    const topJenisStr = (topJenis as any[]).slice(0, 5).map((j: any) =>
      `- ${j.name || j[0] || 'Lainnya'}: ${j.count || j[1] || 0} kejadian`
    ).join('\n')

    const prompt = `Anda adalah Kepala Tim Analisis Surveilans Epidemiologi & Intelijen Krisis Kesehatan Pusat Krisis Kesehatan (EOC) Kementerian Kesehatan Republik Indonesia.
Tugas Anda adalah menyusun dokumen resmi "Laporan Pengawasan Krisis Kesehatan dan Kebencanaan" tingkat eksekutif kenegaraan yang SANGAT LENGKAP, PANJANG, MENDALAM, DESKRIPTIF, DAN BERBOBOT TINGGI.

INSTRUKSI PENTING GAYA PENULISAN:
1. Hindari kalimat pendek, dangkal, atau ringkasan instan. Buat narasi setiap bagian mengalir dalam beberapa paragraf deskriptif analitis yang kaya konteks medis kebencanaan.
2. Gunakan terminologi resmi Kementerian Kesehatan RI, WHO Health Cluster Guidelines, SKDR/EWARS, Standar SPGDT 119, dan protokol Emergency Medical Team (EMT).
3. Cantumkan penekanan angka data dengan tag <b>...</b> pada metrik vital (jumlah korban, wilayah, faskes).
4. Kaitkan dampak bahaya fisik bencana dengan risiko kesehatan sekunder (trauma, penyakit infeksi pernapasan/pencernaan, gangguan sanitasi, gizi balita/ibu hamil, dan kesehatan jiwa).

DATA RESMI YANG DIEVALUASI:
- Cakupan Wilayah: ${filterWilayahText}
- Jenis Bencana Terfilter: ${filterBencanaText}
- Periode Evaluasi: ${timePresetText}
- Total Laporan Kejadian: ${totalReports} Kejadian
- Total Korban Meninggal Dunia: ${totalMeninggal} Jiwa
- Total Korban Luka-Luka (Berat/Ringan): ${totalLuka} Jiwa
- Total Korban Hilang dalam Pencarian: ${totalHilang} Jiwa
- Total Penduduk Terdampak Langsung: ${totalTerdampak} Jiwa
- Total Pengungsi di Posko Penampungan: ${totalPengungsi} Jiwa
- Fasilitas Pelayanan Kesehatan (Faskes) Terdampak: ${totalFaskes} Unit

Sebaran Wilayah Kejadian Terbanyak:
${topRegionsStr}

Distribusi Jenis Bencana Dominan:
${topJenisStr}

Susun respons HANYA dalam format JSON murni yang valid tanpa blok pembungkus markdown:
{
  "ringkasan_laporan": "Paragraf 1: Analisis komprehensif eskalasi kejadian bencana sebanyak <b>${totalReports} kejadian</b> di wilayah <b>${filterWilayahText}</b>, menelaah keterkaitan fenomena hidrometeorologi/geologi terhadap keselamatan jiwa dan infrastruktur vital...\\n\\nParagraf 2: Telaah epidemiologi mendalam terhadap morbiditas korban (<b>${totalMeninggal} jiwa meninggal</b>, <b>${totalLuka} korban luka-luka</b>, <b>${totalHilang} korban hilang</b>), serta risiko komplikasi kesehatan masyarakat pada <b>${totalPengungsi} jiwa pengungsi</b> dan <b>${totalTerdampak} jiwa warga terdampak</b>...\\n\\nParagraf 3: Mobilisasi komando operasional terpadu Klaster Kesehatan Kemenkes RI bersama Dinas Kesehatan Provinsi/Kabupaten, BNPB, Basarnas, dan TNI/Polri dalam menjamin stabilitas pelayanan medik darurat serta penyiagaan buffer stock logistik farmasi.",
  
  "poin_utama": [
    "**Agregasi Dampak & Morbiditas Jiwa:** Sintesis surveilans di <b>${filterWilayahText}</b> mencatat eskalasi <b>${totalReports} kejadian bencana</b> dengan total fatalitas <b>${totalMeninggal} jiwa meninggal</b>, <b>${totalLuka} korban luka-luka</b>, dan <b>${totalHilang} jiwa hilang</b>, menuntut aktivasi triase klinis lapangan dan percepatan rujukan ke jejaring Rumah Sakit Regional.",
    "**Koridor Hotspot & Kerentanan Spasial:** Konsentrasi risiko bencana terparah teridentifikasi di zona terdampak utama, di mana kerusakan aksesibilitas fisik dan terputusnya jaringan utilitas memerlukan intervensi pos kesehatan darurat mobile.",
    "**Karakteristik Bahaya & Dampak Sistemik:** Dominasi kejadian <b>${filterBencanaText}</b> memicu dampak domino berupa kontaminasi sumber air bersih komunal, kerusakan rantai sanitasi lingkungan, serta penurunan kapasitas pelayanan puskesmas setempat.",
    "**Surveilans Dini Penyakit Potensial KLB (SKDR):** Sebanyak <b>${totalPengungsi} jiwa pengungsi</b> yang tersebar di titik-titik penampungan sementara berada di bawah pengawasan ketat SKDR untuk mendeteksi lonjakan kasus ISPA, Diare Akut, Penyakit Kulit, Demam Berdarah, dan Leptospirosis.",
    "**Ketahanan & Fungsionalitas Fasyankes:** Terdata <b>${totalFaskes} unit faskes</b> mengalami dampak operasional, yang telah direspons melalui pendirian tenda RS Lapangan, perbantuan genset darurat, serta pengalihan alur rujukan gawat darurat (SPGDT).",
    "**Aktivasi Emergency Medical Team (EMT):** Pusat Krisis Kesehatan menginstruksikan kesiapsiagaan Tim Medis Darurat (EMT Tipe 1 Mobile & Fixed) dengan mandat 24 jam untuk penguatan penanganan trauma massal dan stabilisasi pasien rentan.",
    "**Rantai Pasok Logistik Medis & Nutrisi:** Distribusi paket buffer stock obat bencana, kit persalinan darurat, MP-ASI balita, hygiene kit, dan PAC penjernih air telah digulirkan untuk menjamin kecukupan logistik hingga 14 hari ke depan.",
    "**Dukungan Kesehatan Jiwa dan Psikososial (DKJPS):** Pelayanan pendampingan psikososial terpadu mulai diaktivasi di lokasi pengungsian untuk mencegah gangguan stres pascatrauma (PTSD) pada anak-anak, lansia, dan keluarga korban."
  ],

  "analisis_spasial_naratif": "Berdasarkan pemetaan geospasial intelijen kebencanaan EOC Kemenkes RI, sebaran kejadian bencana di wilayah ${filterWilayahText} memperlihatkan pola klaster spasial dengan konsentrasi risiko tertinggi di wilayah terdampak utama. Karakteristik geomorfologi dan kepadatan permukiman di zona ini meningkatkan kerentanan populasi terhadap bahaya langsung maupun isolasi geografis yang menghambat evakuasi medis.\\n\\nKeterisolasian beberapa titik permukiman menuntut penempatan pos kesehatan terdepan berbasis puskesmas keliling dan koordinasi lintas matra bersama Basarnas dan TNI untuk evakuasi jalur air maupun udara. Integrasi data spasial ini menjadi rujukan utama bagi komando EOC dalam mendistribusikan tenaga cadangan kesehatan (TCK) dan logistik obat tepat sasaran ke kantong-kantong pengungsian terpencil.",

  "analisis_tren_epidemiologi": "Evaluasi pergerakan indikator surveilans epidemiologi kebencanaan menunjukkan bahwa dominasi bencana ${filterBencanaText} berkorelasi langsung dengan lonjakan morbiditas penyakit berbasis lingkungan dan infeksi menular. Pada populasi pengungsi sebanyak ${totalPengungsi} jiwa, kepadatan tenda dan kelembaban lingkungan memicu peningkatan risiko Infeksi Saluran Pernapasan Akut (ISPA) serta penyakit diare akibat keterbatasan akses air bersih higienis.\\n\\nSistem Kewaspadaan Dini dan Respon (SKDR) Kemenkes RI mencatat sinyal kewaspadaan dini yang dipantau setiap 24 jam. Langkah klorinasi sumur warga, distribusi kaporit, inspeksi sanitasi makanan posko, serta promosi perilaku hidup bersih dan sehat (PHBS) dilaksanakan secara serentak untuk memastikan tidak terjadi eskalasi menjadi Kejadian Luar Biasa (KLB).",

  "aktivitas_indikator": [
    {
      "indikator": "Dinamika Kejadian Bencana & Ancaman Fisik",
      "tren": "Meningkat",
      "level": "Siaga Darurat",
      "keterangan": "Eskalasi curah hujan ekstrem, pergerakan tanah, dan dinamika cuaca memerlukan pemantauan real-time 24 jam bersama BMKG dan BNPB."
    },
    {
      "indikator": "Tingkat Fatalitas (CFR) & Morbiditas Trauma",
      "tren": "Terkendali",
      "level": "Moderat",
      "keterangan": "Triase medis cepat dan evakuasi gawat darurat berhasil menekan Case Fatality Rate serta mencegah kecacatan permanen pada korban luka."
    },
    {
      "indikator": "Surveilans Sinyal Penyakit Potensial KLB di Pengungsian",
      "tren": "Waspada",
      "level": "Siaga 24 Jam",
      "keterangan": "Pengawasan harian SKDR/EWARS aktif di seluruh pos kesehatan untuk mendeteksi dini klaster kasus ISPA, Diare, Kulit, dan Leptospirosis."
    },
    {
      "indikator": "Kapasitas & Kontinuitas Operasional Fasyankes",
      "tren": "Optimal",
      "level": "Siaga Penuh",
      "keterangan": "Jejaring Rumah Sakit Rujukan Regional dan Puskesmas siaga siap menampung lonjakan pasien melalui aktivasi Hospital Disaster Plan (HDP)."
    },
    {
      "indikator": "Ketahanan Buffer Stock Logistik Medis & Farmasi",
      "tren": "Mencukupi",
      "level": "Siaga Cadangan",
      "keterangan": "Ketersediaan obat paket bencana, cairan infus, antibiotik, klorinasi air, dan MP-ASI dipastikan mencukupi kebutuhan posko hingga 14 hari ke depan."
    }
  ],

  "analisis_fasyankes_naratif": "Penilaian cepat kesiapsiagaan fasilitas kesehatan (Rapid Health Assessment) terhadap ${totalFaskes} unit faskes terdampak memastikan bahwa kontinuitas pelayanan darurat tetap berjalan tanpa diskontinuitas. Pada fasilitas kesehatan yang mengalami kerusakan fisik ringan maupun sedang, Pusat Krisis Kesehatan mendirikan Tenda Medis Darurat berstandar EMT Tipe 1 untuk memisahkan alur triase gawat darurat dan rawat jalan umum.\\n\\nJalur Sistem Pelayanan Gawat Darurat Terpadu (SPGDT) 119 diintegrasikan dengan ambulans gawat darurat dan Rumah Sakit Rujukan penyangga regional guna memfasilitasi transfer pasien kritis yang membutuhkan tindakan operasi atau perawatan intensif ICU secara cepat dan aman.",

  "rekomendasi_emt": [
    {
      "fase": "Fase 1: Respons Cepat & Penanganan Akut (0 - 72 Jam)",
      "tindakan": "Pelaksanaan triase klinis lapangan cepat, stabilisasi resusitasi trauma massal, pendirian Pos Kesehatan 24 jam di pusat pengungsian, aktivasi SPGDT 119, dan mobilisasi tim medis darurat (EMT Tipe 1 Mobile) ke desa-desa terisolir."
    },
    {
      "fase": "Fase 2: Surveilans Epidemiologi, Sanitasi & Mitigasi KLB (Hari ke 4 - 14)",
      "tindakan": "Penguatan pelaporan SKDR/EWARS harian, inspeksi kualitas air minum dan sanitasi posko penampungan, pemberian makanan tambahan (MP-ASI) bergizi bagi balita dan ibu hamil, klorinasi massal sumber air, serta imunisasi darurat di pengungsian."
    },
    {
      "fase": "Fase 3: Pemulihan Fungsional, Dukungan Jiwa (DKJPS) & Transisi Layanan",
      "tindakan": "Pelayanan Dukungan Kesehatan Jiwa dan Psikososial (DKJPS) secara berkelanjutan bagi keluarga korban dan penyintas, perbaikan sarana prasarana puskesmas terdampak, pengisian ulang buffer stock farmasi daerah, dan transisi ke pelayanan kesehatan primer rutin."
    }
  ],

  "analisis_logistik_naratif": "Manajemen logistik kesehatan darurat Kemenkes RI menerapkan sistem rantai pasok respons cepat dengan standar pengiriman di bawah 24 jam sejak penetapan status darurat. Paket bantuan mencakup Obat Bencana Generik (antibiotik, analgesik, cairan kristaloid), Alat Pelindung Diri (APD), Kantong Jenazah, Tenda Posko Medis, Bahan Penjernih Air Cepat (PAC/Aquatabs), serta Paket Kebersihan Pribadi (Hygiene Kit) yang didistribusikan terkoordinasi melalui Dinas Kesehatan setempat.",

  "landasan_kebijakan_naratif": "Penyelenggaraan respon darurat krisis kesehatan ini berpedoman pada Keputusan Menteri Kesehatan Republik Indonesia Nomor HK.01.07/MENKES/1998/2022 tentang Pedoman Penanggulangan Krisis Kesehatan serta mematuhi International Health Regulations (IHR 2005). Dokumen intelijen surveilans ini diterbitkan sebagai dasar legal-formal bagi pimpinan kementerian dan instansi lintas sektor dalam menetapkan kebijakan komando, mobilisasi sumber daya nakes, dan pengalokasian anggaran darurat.",

  "himbauan_masyarakat": [
    "Menerapkan Perilaku Hidup Bersih dan Sehat (PHBS) secara konsisten di lingkungan keluarga dan tenda pengungsian, termasuk mencuci tangan memakai sabun.",
    "Hanya mengonsumsi air minum yang telah dimasak mendidih sempurna atau air minum bersih yang telah terverifikasi mutunya guna mencegah infeksi saluran cerna (Diare/Disentri).",
    "Segera memeriksakan diri ke Pos Kesehatan, Puskesmas, atau petugas EMT terdekat apabila mengalami demam tinggi, sesak napas, batuk persisten, diare berulang, atau luka infeksi.",
    "Bagi keluarga dengan bayi, balita, ibu hamil, dan lansia, pastikan berada di tempat penampungan yang kering, hangat, serta mendapatkan prioritas asupan nutrisi dan imunisasi.",
    "Menjaga kewaspadaan terhadap potensi bahaya susulan dan segera menghubungi Call Center Gawat Darurat Kemenkes RI 119 (bebas pulsa 24 jam) untuk evakuasi medis darurat."
  ]
}`

    let aiData: any = null
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']

    for (const activeKey of uniqueKeys) {
      if (aiData) break
      for (const modelName of models) {
        try {
          console.log(`[generate-dashboard-report-ai] Trying Gemini key ...${activeKey.slice(-6)} model: ${modelName}`)
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${activeKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.2,
                  maxOutputTokens: 8192,
                  topP: 0.95,
                },
              }),
            }
          )

          if (geminiRes.ok) {
            const geminiJson = await geminiRes.json()
            const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text
            if (rawText) {
              let cleanJson = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '')
              if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3)
              const parsed = JSON.parse(cleanJson.trim())
              if (parsed && (parsed.poin_utama || parsed.ringkasan_laporan)) {
                aiData = parsed
                console.log(`[generate-dashboard-report-ai] Gemini ${modelName} success!`)
                break
              }
            }
          } else {
            const errStatus = geminiRes.status
            console.warn(`[generate-dashboard-report-ai] Gemini ${modelName} HTTP ${errStatus}`)
            if (errStatus === 429 || errStatus === 403) {
              break // pindah ke key berikutnya
            }
          }
        } catch (modelErr) {
          console.warn(`[generate-dashboard-report-ai] Gemini ${modelName} error:`, modelErr)
        }
      }
    }

    if (!aiData) {
      return NextResponse.json(
        { success: false, error: 'Semua model Gemini AI gagal menghasilkan respons. Periksa API key.' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      data: aiData,
      source: 'gemini-direct',
    })
  } catch (err) {
    console.error('[generate-dashboard-report-ai] Fatal error:', err)
    return NextResponse.json(
      { success: false, error: 'Internal server error', detail: String(err) },
      { status: 500 }
    )
  }
}
