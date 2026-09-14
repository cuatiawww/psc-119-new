import crypto from 'node:crypto'
// @ts-ignore
import { Pool } from 'pg'

export const NTT_DATASETS = [
  'analisa_ringkasan_harian',
  'situasi_kesehatan',
  'pasien_rs',
  'pasien_puskesmas',
  'surveilans_penyakit',
] as const

export type NttDatasetName = (typeof NTT_DATASETS)[number]

export type NttDatabaseRow = {
  dataset: string
  tanggal: string
  row_data: Record<string, unknown>
  imported_at: string | null
}

export type NttDatabaseSnapshot = {
  rows: NttDatabaseRow[]
  dates: string[]
  updated_at: string
}

let pool: Pool | undefined

export function getNttPool() {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || 'db-postgres',
      port: Number(process.env.POSTGRES_PORT || 5432),
      database: process.env.POSTGRES_DB || 'collector_bencana_ntt',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || undefined,
      connectionTimeoutMillis: Number(process.env.POSTGRES_CONNECT_TIMEOUT_SECONDS || 10) * 1000,
      max: 5,
    })
  }
  return pool
}

export async function ensureNttSchema(): Promise<void> {
  const p = getNttPool()
  const schema = `
    CREATE TABLE IF NOT EXISTS ntt_csv_imports (
        source_file TEXT PRIMARY KEY,
        dataset TEXT NOT NULL,
        tanggal DATE NOT NULL,
        file_sha256 TEXT NOT NULL,
        imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ntt_records (
        id BIGSERIAL PRIMARY KEY,
        dataset TEXT NOT NULL,
        tanggal DATE NOT NULL,
        row_number INTEGER NOT NULL,
        row_data JSONB NOT NULL,
        source_file TEXT NOT NULL,
        row_hash TEXT NOT NULL,
        imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT ntt_records_source_row_unique UNIQUE (source_file, row_number)
    );

    CREATE INDEX IF NOT EXISTS ntt_records_dataset_date_idx
        ON ntt_records (dataset, tanggal);
    CREATE INDEX IF NOT EXISTS ntt_records_date_idx
        ON ntt_records (tanggal);

    CREATE TABLE IF NOT EXISTS ntt_collection_runs (
        id BIGSERIAL PRIMARY KEY,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        status TEXT NOT NULL,
        latest_date DATE,
        message TEXT
    );
  `
  await p.query(schema)
}

export async function readNttDatabase(): Promise<NttDatabaseSnapshot | null> {
  try {
    const result = await getNttPool().query<NttDatabaseRow>(
      `
        SELECT
          dataset,
          TO_CHAR(tanggal, 'YYYY-MM-DD') AS tanggal,
          row_data,
          imported_at
        FROM ntt_records
        WHERE dataset = ANY($1::text[])
        ORDER BY tanggal ASC, dataset ASC, row_number ASC
      `,
      [NTT_DATASETS],
    )

    if (result.rows.length === 0) return null

    const dateSet = new Set<string>()
    result.rows.forEach((row: NttDatabaseRow) => {
      if (row.tanggal) dateSet.add(String(row.tanggal))
    })
    const dates = Array.from(dateSet).sort()
    const latestImport = result.rows
      .map((row: NttDatabaseRow) => row.imported_at)
      .filter((value: string | null): value is string => Boolean(value))
      .sort()
      .at(-1)

    return {
      rows: result.rows,
      dates,
      updated_at: latestImport || new Date().toISOString(),
    }
  } catch (error) {
    console.warn('[API ntt-data] PostgreSQL read failed; using CSV fallback:', error)
    return null
  }
}

/**
 * Menyimpan / Mengimpor record CSV ke PostgreSQL mengikuti schema & rule collector.
 */
export async function saveNttRecordsToDatabase({
  dataset,
  tanggal,
  sourceFile,
  fileContent,
  rows,
}: {
  dataset: NttDatasetName
  tanggal: string
  sourceFile: string
  fileContent: string | Buffer
  rows: Array<Record<string, unknown>>
}): Promise<{ rowCount: number; fileHash: string }> {
  const p = getNttPool()
  await ensureNttSchema()

  const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex')

  const client = await p.connect()
  try {
    await client.query('BEGIN')

    // 1. Bersihkan record lama untuk source file ini
    await client.query('DELETE FROM ntt_records WHERE source_file = $1', [sourceFile])

    // 2. Insert baris baru
    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 1
      const rowData = rows[i]
      const rowJson = JSON.stringify(rowData)
      const rowHash = crypto
        .createHash('sha256')
        .update(`${sourceFile}:${rowNumber}:${rowJson}`)
        .digest('hex')

      await client.query(
        `
        INSERT INTO ntt_records
          (dataset, tanggal, row_number, row_data, source_file, row_hash)
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [dataset, tanggal, rowNumber, rowData, sourceFile, rowHash],
      )
    }

    // 3. Upsert ntt_csv_imports
    await client.query(
      `
      INSERT INTO ntt_csv_imports
        (source_file, dataset, tanggal, file_sha256)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (source_file) DO UPDATE SET
        dataset = EXCLUDED.dataset,
        tanggal = EXCLUDED.tanggal,
        file_sha256 = EXCLUDED.file_sha256,
        imported_at = NOW()
      `,
      [sourceFile, dataset, tanggal, fileHash],
    )

    await client.query('COMMIT')
    return { rowCount: rows.length, fileHash }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
