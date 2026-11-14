// Shared types and canvas helpers for the Whiteboard section.
// Shapes are stored in world coordinates (infinite canvas); the view
// transform (pan + zoom) is applied at draw time only.

export type PenShape = {
  id: string
  t: 'pen'
  /** Flat [x0, y0, x1, y1, …] */
  pts: number[]
  color: string
  w: number
  /** Highlighter: translucent and thicker */
  hl?: boolean
}
export type LineShape = {
  id: string
  t: 'line' | 'arrow' | 'rect' | 'ellipse'
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  w: number
}
export type TextShape = {
  id: string
  t: 'text'
  x: number
  y: number
  text: string
  color: string
  size: number
}
export type Shape = PenShape | LineShape | TextShape

export type View = { x: number; y: number; k: number }

export const COLORS = ['#1A1A1A', '#D4622A', '#2563EB', '#16A34A', '#DC2626', '#9333EA', '#EAB308']
export const WIDTHS = [2, 4, 8]
export const HIGHLIGHT_ALPHA = 0.35
export const HIGHLIGHT_SCALE = 4
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

/** Coerce stored JSON into a shapes array, dropping anything malformed. */
export function parseShapes(data: unknown): Shape[] {
  const raw = (data as { shapes?: unknown } | null)?.shapes
  if (!Array.isArray(raw)) return []
  return raw.filter((s): s is Shape => !!s && typeof s === 'object' && typeof (s as Shape).id === 'string' && typeof (s as Shape).t === 'string')
}

let measureCtx: CanvasRenderingContext2D | null = null
function measure(): CanvasRenderingContext2D | null {
  if (!measureCtx && typeof document !== 'undefined') {
    measureCtx = document.createElement('canvas').getContext('2d')
  }
  return measureCtx
}

export function textBounds(s: TextShape) {
  const ctx = measure()
  const lines = s.text.split('\n')
  let width = 0
  if (ctx) {
    ctx.font = `${s.size}px ${FONT}`
    for (const l of lines) width = Math.max(width, ctx.measureText(l).width)
  } else {
    width = Math.max(...lines.map((l) => l.length)) * s.size * 0.55
  }
  return { x: s.x, y: s.y, w: width, h: lines.length * s.size * 1.25 }
}

export function drawShape(ctx: CanvasRenderingContext2D, s: Shape) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (s.t === 'pen') {
    ctx.strokeStyle = s.color
    ctx.lineWidth = s.hl ? s.w * HIGHLIGHT_SCALE : s.w
    if (s.hl) ctx.globalAlpha = HIGHLIGHT_ALPHA
    const p = s.pts
    ctx.beginPath()
    ctx.moveTo(p[0], p[1])
    if (p.length <= 2) {
      ctx.lineTo(p[0] + 0.01, p[1])
    } else {
      // Smooth through midpoints
      for (let i = 2; i < p.length - 2; i += 2) {
        ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2)
      }
      ctx.lineTo(p[p.length - 2], p[p.length - 1])
    }
    ctx.stroke()
  } else if (s.t === 'text') {
    ctx.fillStyle = s.color
    ctx.font = `${s.size}px ${FONT}`
    ctx.textBaseline = 'top'
    s.text.split('\n').forEach((line, i) => ctx.fillText(line, s.x, s.y + i * s.size * 1.25))
  } else {
    ctx.strokeStyle = s.color
    ctx.fillStyle = s.color
    ctx.lineWidth = s.w
    const { x1, y1, x2, y2 } = s
    ctx.beginPath()
    if (s.t === 'rect') {
      ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
    } else if (s.t === 'ellipse') {
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2)
    } else {
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
    }
    ctx.stroke()
    if (s.t === 'arrow') {
      const head = 8 + s.w * 2
      const a = Math.atan2(y2 - y1, x2 - x1)
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - head * Math.cos(a - Math.PI / 6), y2 - head * Math.sin(a - Math.PI / 6))
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - head * Math.cos(a + Math.PI / 6), y2 - head * Math.sin(a + Math.PI / 6))
      ctx.stroke()
    }
  }
  ctx.restore()
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/** Does the point (world coords) touch the shape, within `tol` world units? */
export function hitTest(s: Shape, px: number, py: number, tol: number): boolean {
  if (s.t === 'pen') {
    const reach = tol + (s.hl ? s.w * HIGHLIGHT_SCALE : s.w) / 2
    const p = s.pts
    if (p.length <= 2) return Math.hypot(px - p[0], py - p[1]) <= reach
    for (let i = 0; i < p.length - 2; i += 2) {
      if (distToSegment(px, py, p[i], p[i + 1], p[i + 2], p[i + 3]) <= reach) return true
    }
    return false
  }
  if (s.t === 'text') {
    const b = textBounds(s)
    return px >= b.x - tol && px <= b.x + b.w + tol && py >= b.y - tol && py <= b.y + b.h + tol
  }
  const reach = tol + s.w / 2
  const { x1, y1, x2, y2 } = s
  if (s.t === 'line' || s.t === 'arrow') return distToSegment(px, py, x1, y1, x2, y2) <= reach
  if (s.t === 'rect') {
    const l = Math.min(x1, x2), r = Math.max(x1, x2), t = Math.min(y1, y2), b = Math.max(y1, y2)
    return (
      distToSegment(px, py, l, t, r, t) <= reach ||
      distToSegment(px, py, r, t, r, b) <= reach ||
      distToSegment(px, py, r, b, l, b) <= reach ||
      distToSegment(px, py, l, b, l, t) <= reach
    )
  }
  // ellipse outline
  const rx = Math.abs(x2 - x1) / 2
  const ry = Math.abs(y2 - y1) / 2
  const dx = px - (x1 + x2) / 2
  const dy = py - (y1 + y2) / 2
  if (rx < 0.5 || ry < 0.5) return Math.hypot(dx, dy) <= reach + Math.max(rx, ry)
  const radial = Math.hypot(dx / rx, dy / ry)
  return Math.abs(radial - 1) * Math.min(rx, ry) <= reach
}

export function shapesBounds(shapes: Shape[]) {
  if (shapes.length === 0) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const add = (x: number, y: number, pad = 0) => {
    minX = Math.min(minX, x - pad); maxX = Math.max(maxX, x + pad)
    minY = Math.min(minY, y - pad); maxY = Math.max(maxY, y + pad)
  }
  for (const s of shapes) {
    if (s.t === 'pen') {
      const pad = (s.hl ? s.w * HIGHLIGHT_SCALE : s.w) / 2
      for (let i = 0; i < s.pts.length; i += 2) add(s.pts[i], s.pts[i + 1], pad)
    } else if (s.t === 'text') {
      const b = textBounds(s)
      add(b.x, b.y); add(b.x + b.w, b.y + b.h)
    } else {
      const pad = s.w / 2 + (s.t === 'arrow' ? 10 : 0)
      add(s.x1, s.y1, pad); add(s.x2, s.y2, pad)
    }
  }
  return { minX, minY, maxX, maxY }
}

/** Render all shapes fitted into a width×height canvas on white. */
export function renderToCanvas(shapes: Shape[], width: number, height: number, margin: number, scaleCap = 2): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)
  const b = shapesBounds(shapes)
  if (b) {
    const bw = Math.max(b.maxX - b.minX, 1)
    const bh = Math.max(b.maxY - b.minY, 1)
    const k = Math.min((width - margin * 2) / bw, (height - margin * 2) / bh, scaleCap)
    ctx.translate((width - bw * k) / 2 - b.minX * k, (height - bh * k) / 2 - b.minY * k)
    ctx.scale(k, k)
    for (const s of shapes) drawShape(ctx, s)
  }
  return canvas
}

export function makeThumbnail(shapes: Shape[]): string | null {
  if (shapes.length === 0) return null
  try {
    return renderToCanvas(shapes, 320, 200, 16, 1).toDataURL('image/jpeg', 0.7)
  } catch {
    return null
  }
}

/** Full-size PNG of the whole board, sized to its contents. */
export function exportPng(shapes: Shape[]): string | null {
  const b = shapesBounds(shapes)
  if (!b) return null
  const margin = 40
  const w = Math.min(Math.ceil(b.maxX - b.minX) + margin * 2, 4000)
  const h = Math.min(Math.ceil(b.maxY - b.minY) + margin * 2, 4000)
  return renderToCanvas(shapes, Math.max(w, 200), Math.max(h, 200), margin, 1).toDataURL('image/png')
}
