import ExcelJS from 'exceljs'
import { getSupabase } from '@/lib/supabase'
import { categoryForType, type SignalCategory } from '@/lib/signals'

export const maxDuration = 60

const PAGE_SIZE = 1000
const MAX_ROWS = 20000

const CATEGORY_LABEL = { world: 'World Signal', action: 'Action' } as const

type Row = Record<string, unknown>

// Supabase caps a single response at ~1000 rows, so page through the table.
async function fetchAll(table: 'mirror_signals' | 'mirror_thoughts', hashtag?: string | null): Promise<Row[]> {
  const supabase = getSupabase()
  const rows: Row[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    let query = supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (hashtag) query = query.contains('hashtags', [hashtag.toLowerCase()])
    const { data, error } = await query
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

function titleCase(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function addSheet(workbook: ExcelJS.Workbook, name: string, columns: Partial<ExcelJS.Column>[], rows: unknown[][]) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = columns
  sheet.addRows(rows)
  const header = sheet.getRow(1)
  header.font = { bold: true }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3EE' } }
  sheet.eachRow((row, n) => {
    if (n > 1) row.alignment = { vertical: 'top', wrapText: true }
  })
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const type = url.searchParams.get('type')
  const today = new Date().toISOString().slice(0, 10)

  try {
    const workbook = new ExcelJS.Workbook()
    let filename: string

    if (type === 'thoughts') {
      const hashtag = url.searchParams.get('hashtag')
      const thoughts = await fetchAll('mirror_thoughts', hashtag)
      addSheet(
        workbook,
        'Thoughts',
        [
          { header: 'Date', key: 'date', width: 20, style: { numFmt: 'yyyy-mm-dd hh:mm' } },
          { header: 'Thought', key: 'content', width: 80 },
          { header: 'Hashtags', key: 'hashtags', width: 30 },
        ],
        thoughts.map((t) => [
          new Date(t.created_at as string),
          t.content,
          ((t.hashtags as string[] | null) ?? []).map((h) => `#${h}`).join(' '),
        ]),
      )
      filename = `mirror-thoughts-${today}.xlsx`
    } else if (type === 'signals') {
      const filter = url.searchParams.get('category')
      const all = await fetchAll('mirror_signals')
      const signals = all
        .map((s) => ({
          created_at: s.created_at as string,
          type: s.type as string,
          content: s.content as string,
          category: (s.category as SignalCategory | null) ?? categoryForType(s.type as string),
        }))
        .filter((s) => (filter === 'world' || filter === 'action' ? s.category === filter : true))
      addSheet(
        workbook,
        'Signals',
        [
          { header: 'Date', key: 'date', width: 20, style: { numFmt: 'yyyy-mm-dd hh:mm' } },
          { header: 'Category', key: 'category', width: 16 },
          { header: 'Type', key: 'type', width: 22 },
          { header: 'Content', key: 'content', width: 80 },
        ],
        signals.map((s) => [
          new Date(s.created_at),
          CATEGORY_LABEL[s.category],
          titleCase(s.type),
          s.content,
        ]),
      )
      filename = `mirror-signals-${today}.xlsx`
    } else {
      return Response.json({ error: "type must be 'thoughts' or 'signals'" }, { status: 400 })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
