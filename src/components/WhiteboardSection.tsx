'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  COLORS, WIDTHS, FONT,
  drawShape, hitTest, newId, parseShapes, makeThumbnail, exportPng, translateShape, shapesBounds,
  type Shape, type View,
} from '@/lib/whiteboard'

type BoardMeta = { id: string; title: string; thumbnail: string | null; updated_at: string }
type Board = BoardMeta & { data: unknown }
type Tool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'pan'
type SaveState = 'saved' | 'saving' | 'error'

const MIN_K = 0.1
const MAX_K = 8

const ic = (children: React.ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: 'select', label: 'Select & move (drag empty space to pan)', icon: ic(<path d="m4 4 7.07 17 2.51-7.39L21 11.07z"/>) },
  { id: 'pan', label: 'Hand / move canvas (H, or hold Space)', icon: ic(<><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.9-2.4L3.4 16a2 2 0 0 1 3.2-2.4L8 15"/></>) },
  { id: 'pen', label: 'Pen / write (W)', icon: ic(<><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></>) },
  { id: 'highlighter', label: 'Highlighter', icon: ic(<><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></>) },
  { id: 'eraser', label: 'Eraser (E) — removes whole strokes', icon: ic(<><path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l9.6-9.6a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></>) },
  { id: 'line', label: 'Line', icon: ic(<line x1="5" y1="19" x2="19" y2="5"/>) },
  { id: 'arrow', label: 'Arrow', icon: ic(<><line x1="5" y1="19" x2="19" y2="5"/><polyline points="9 5 19 5 19 15"/></>) },
  { id: 'rect', label: 'Rectangle', icon: ic(<rect x="3" y="5" width="18" height="14" rx="1"/>) },
  { id: 'ellipse', label: 'Ellipse', icon: ic(<ellipse cx="12" cy="12" rx="9" ry="7"/>) },
  { id: 'text', label: 'Text', icon: ic(<><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></>) },
]

// Single-key tool shortcuts (no modifiers, ignored while typing).
const TOOL_SHORTCUTS: Record<string, Tool> = { h: 'pan', w: 'pen', e: 'eraser' }

const CURSORS: Record<Tool, string> = {
  select: 'default', pan: 'grab', pen: 'crosshair', highlighter: 'crosshair', eraser: 'cell',
  line: 'crosshair', arrow: 'crosshair', rect: 'crosshair', ellipse: 'crosshair', text: 'text',
}

function IconBtn({ onClick, label, disabled = false, children }: { onClick: () => void; label: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-md text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#F5F3EE] disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  )
}

function BoardEditor({ board, onBack, onDeleted }: { board: Board; onBack: () => void; onDeleted: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })

  const shapesRef = useRef<Shape[]>(parseShapes(board.data))
  const pastRef = useRef<Shape[][]>([])
  const futureRef = useRef<Shape[][]>([])
  const draftRef = useRef<Shape | null>(null)
  const erasedRef = useRef<Set<string>>(new Set())
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 })
  const dragRef = useRef<null | { mode: 'draw' | 'erase' | 'pan' | 'text' | 'move'; sx: number; sy: number; vx: number; vy: number }>(null)
  const spaceRef = useRef(false)
  const selectedRef = useRef<string | null>(null)
  const moveRef = useRef<null | { id: string; ox: number; oy: number; dx: number; dy: number }>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [width, setWidth] = useState(WIDTHS[1])
  const [title, setTitle] = useState(board.title)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [zoom, setZoom] = useState(1)
  const [isFull, setIsFull] = useState(false)
  const [hist, setHist] = useState({ undo: false, redo: false, empty: parseShapes(board.data).length === 0 })
  const syncHist = useCallback(() => setHist({
    undo: pastRef.current.length > 0,
    redo: futureRef.current.length > 0,
    empty: shapesRef.current.length === 0,
  }), [])
  const [textEdit, setTextEdit] = useState<null | { wx: number; wy: number; sx: number; sy: number; value: string }>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const textDoneRef = useRef(false)
  const textEditRef = useRef<typeof textEdit>(null)
  const updateText = useCallback((next: typeof textEdit) => {
    textEditRef.current = next
    setTextEdit(next)
  }, [])

  // Mirror state into refs so the (stable) event handlers always see current values.
  const toolRef = useRef(tool)
  const colorRef = useRef(color)
  const widthRef = useRef(width)
  const titleRef = useRef(title)
  useEffect(() => {
    toolRef.current = tool
    colorRef.current = color
    widthRef.current = width
    titleRef.current = title
  }, [tool, color, width, title])

  // ---------- drawing ----------
  const draw = useCallback(() => {
    rafRef.current = 0
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h, dpr } = sizeRef.current
    const v = viewRef.current

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)

    // dot grid that follows pan/zoom
    const step = 32 * v.k
    if (step >= 10) {
      ctx.fillStyle = '#D9D5CA'
      const ox = ((v.x % step) + step) % step
      const oy = ((v.y % step) + step) % step
      for (let x = ox; x < w; x += step) for (let y = oy; y < h; y += step) ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5)
    }

    ctx.setTransform(dpr * v.k, 0, 0, dpr * v.k, dpr * v.x, dpr * v.y)
    const erased = erasedRef.current
    const mv = moveRef.current
    let selected: Shape | null = null
    for (const s of shapesRef.current) {
      if (erased.has(s.id)) continue
      const shown = mv && mv.id === s.id ? translateShape(s, mv.dx, mv.dy) : s
      drawShape(ctx, shown)
      if (s.id === selectedRef.current) selected = shown
    }
    if (draftRef.current) drawShape(ctx, draftRef.current)
    if (selected) {
      const b = shapesBounds([selected])
      if (b) {
        const pad = 6 / v.k
        ctx.save()
        ctx.strokeStyle = '#D4622A'
        ctx.lineWidth = 1.5 / v.k
        ctx.setLineDash([5 / v.k, 4 / v.k])
        ctx.strokeRect(b.minX - pad, b.minY - pad, b.maxX - b.minX + pad * 2, b.maxY - b.minY + pad * 2)
        ctx.restore()
      }
    }
  }, [])

  const requestDraw = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(draw)
  }, [draw])

  // ---------- persistence ----------
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(false)
  const titleDirtyRef = useRef(false)
  const savingRef = useRef<Promise<void> | null>(null)

  const flush = useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    if (savingRef.current) await savingRef.current
    if (!dirtyRef.current && !titleDirtyRef.current) return
    const body: Record<string, unknown> = {}
    if (dirtyRef.current) {
      body.data = { shapes: shapesRef.current }
      body.thumbnail = makeThumbnail(shapesRef.current)
    }
    if (titleDirtyRef.current) body.title = titleRef.current
    dirtyRef.current = false
    titleDirtyRef.current = false
    setSaveState('saving')
    const p = fetch(`/api/whiteboards/${board.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((res) => {
      if (!res.ok) throw new Error('save failed')
      setSaveState(dirtyRef.current || titleDirtyRef.current ? 'saving' : 'saved')
    }).catch(() => {
      // Keep the changes marked dirty so the next edit (or Back) retries.
      if (body.data !== undefined) dirtyRef.current = true
      if (body.title !== undefined) titleDirtyRef.current = true
      setSaveState('error')
    }).finally(() => { savingRef.current = null })
    savingRef.current = p
    await p
  }, [board.id])

  const scheduleSave = useCallback(() => {
    setSaveState('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void flush() }, 1000)
  }, [flush])

  // Save any pending edits when leaving the board.
  useEffect(() => () => { void flush() }, [flush])

  // ---------- history ----------
  const commit = useCallback((next: Shape[]) => {
    pastRef.current.push(shapesRef.current)
    if (pastRef.current.length > 200) pastRef.current.shift()
    futureRef.current = []
    shapesRef.current = next
    dirtyRef.current = true
    scheduleSave()
    syncHist()
    requestDraw()
  }, [scheduleSave, requestDraw, syncHist])

  const undo = useCallback(() => {
    const prev = pastRef.current.pop()
    if (!prev) return
    futureRef.current.push(shapesRef.current)
    shapesRef.current = prev
    dirtyRef.current = true
    scheduleSave(); syncHist(); requestDraw()
  }, [scheduleSave, requestDraw, syncHist])

  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (!next) return
    pastRef.current.push(shapesRef.current)
    shapesRef.current = next
    dirtyRef.current = true
    scheduleSave(); syncHist(); requestDraw()
  }, [scheduleSave, requestDraw, syncHist])

  // ---------- view ----------
  const setView = useCallback((v: View) => {
    viewRef.current = v
    setZoom(v.k)
    requestDraw()
  }, [requestDraw])

  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    const v = viewRef.current
    const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor))
    const wx = (cx - v.x) / v.k
    const wy = (cy - v.y) / v.k
    setView({ k, x: cx - wx * k, y: cy - wy * k })
  }, [setView])

  const zoomCenter = (factor: number) => zoomAt(sizeRef.current.w / 2, sizeRef.current.h / 2, factor)

  // ---------- canvas sizing ----------
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      sizeRef.current = { w, h, dpr }
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      requestDraw()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => {
      ro.disconnect()
      // Reset too, or requestDraw() would think a frame is still pending (breaks under StrictMode remounts).
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    }
  }, [requestDraw])

  // Wheel: ctrl/⌘ (and trackpad pinch) zooms, otherwise pans. Must be non-passive.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.01))
      } else {
        const v = viewRef.current
        setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })
      }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [zoomAt, setView])

  // Keyboard: undo/redo and hold-Space to pan (ignored while typing in a field).
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    }
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo(); else undo()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault(); redo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef.current) {
        e.preventDefault()
        const id = selectedRef.current
        selectedRef.current = null
        commit(shapesRef.current.filter((s) => s.id !== id))
      } else if (e.key === 'Escape' && selectedRef.current) {
        selectedRef.current = null
        requestDraw()
      } else if (e.code === 'Space' && !e.repeat) {
        e.preventDefault(); spaceRef.current = true
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceRef.current = false
        if (canvasRef.current) canvasRef.current.style.cursor = CURSORS[toolRef.current]
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [undo, redo, commit, requestDraw])

  // ---------- text ----------
  const finishText = useCallback((commitIt: boolean) => {
    if (textDoneRef.current) return
    textDoneRef.current = true
    const te = textEditRef.current
    updateText(null)
    if (te && commitIt && te.value.trim()) {
      const size = 12 + widthRef.current * 3
      commit([...shapesRef.current, { id: newId(), t: 'text', x: te.wx, y: te.wy, text: te.value, color: colorRef.current, size }])
    }
  }, [commit, updateText])

  useEffect(() => {
    if (textEdit && textRef.current) textRef.current.focus()
    // only on open/close (typing shouldn't refocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textEdit === null])

  // ---------- pointer handling ----------
  const toWorld = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const v = viewRef.current
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    return { sx, sy, x: (sx - v.x) / v.k, y: (sy - v.y) / v.k }
  }

  const eraseAt = (x: number, y: number) => {
    const tol = 6 / viewRef.current.k
    for (let i = shapesRef.current.length - 1; i >= 0; i--) {
      const s = shapesRef.current[i]
      if (!erasedRef.current.has(s.id) && hitTest(s, x, y, tol)) erasedRef.current.add(s.id)
    }
    requestDraw()
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 2) return
    if (dragRef.current) return // ignore second finger
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toWorld(e)
    const t = toolRef.current
    const v = viewRef.current

    if (e.button === 1 || t === 'pan' || spaceRef.current) {
      dragRef.current = { mode: 'pan', sx: p.sx, sy: p.sy, vx: v.x, vy: v.y }
      e.currentTarget.style.cursor = 'grabbing'
      return
    }
    if (t === 'select') {
      const tol = 8 / v.k
      let hit: Shape | null = null
      for (let i = shapesRef.current.length - 1; i >= 0; i--) {
        if (hitTest(shapesRef.current[i], p.x, p.y, tol)) { hit = shapesRef.current[i]; break }
      }
      selectedRef.current = hit ? hit.id : null
      if (hit) {
        moveRef.current = { id: hit.id, ox: p.x, oy: p.y, dx: 0, dy: 0 }
        dragRef.current = { mode: 'move', sx: p.sx, sy: p.sy, vx: 0, vy: 0 }
        e.currentTarget.style.cursor = 'move'
      } else {
        // empty space: drag to pan the board
        dragRef.current = { mode: 'pan', sx: p.sx, sy: p.sy, vx: v.x, vy: v.y }
        e.currentTarget.style.cursor = 'grabbing'
      }
      requestDraw()
      return
    }
    if (t === 'text') {
      // The editor opens on pointer-up: focusing it now would be undone by the
      // browser's own mousedown focus handling. Any open editor blurs (commits) first.
      dragRef.current = { mode: 'text', sx: p.sx, sy: p.sy, vx: 0, vy: 0 }
      return
    }
    if (t === 'eraser') {
      dragRef.current = { mode: 'erase', sx: p.sx, sy: p.sy, vx: 0, vy: 0 }
      erasedRef.current = new Set()
      eraseAt(p.x, p.y)
      return
    }
    dragRef.current = { mode: 'draw', sx: p.sx, sy: p.sy, vx: 0, vy: 0 }
    const w = widthRef.current
    if (t === 'pen' || t === 'highlighter') {
      draftRef.current = { id: newId(), t: 'pen', pts: [p.x, p.y], color: colorRef.current, w, hl: t === 'highlighter' }
    } else {
      draftRef.current = { id: newId(), t, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color: colorRef.current, w }
    }
    requestDraw()
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current
    if (!d) return
    const p = toWorld(e)
    if (d.mode === 'move') {
      const m = moveRef.current
      if (m) { m.dx = p.x - m.ox; m.dy = p.y - m.oy; requestDraw() }
    } else if (d.mode === 'pan') {
      setView({ ...viewRef.current, x: d.vx + (p.sx - d.sx), y: d.vy + (p.sy - d.sy) })
    } else if (d.mode === 'erase') {
      eraseAt(p.x, p.y)
    } else if (draftRef.current) {
      const s = draftRef.current
      if (s.t === 'pen') {
        const n = s.pts.length
        // skip sub-pixel jitter
        if (Math.hypot(p.x - s.pts[n - 2], p.y - s.pts[n - 1]) * viewRef.current.k > 1.5) s.pts.push(p.x, p.y)
      } else if (s.t !== 'text') {
        s.x2 = p.x
        s.y2 = p.y
      }
      requestDraw()
    }
  }

  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    if (d.mode === 'text') {
      const v = viewRef.current
      textDoneRef.current = false
      updateText({ wx: (d.sx - v.x) / v.k, wy: (d.sy - v.y) / v.k, sx: d.sx, sy: d.sy, value: '' })
    } else if (d.mode === 'move') {
      const m = moveRef.current
      moveRef.current = null
      e.currentTarget.style.cursor = CURSORS[toolRef.current]
      if (m && Math.hypot(m.dx, m.dy) * viewRef.current.k >= 2) {
        commit(shapesRef.current.map((s) => (s.id === m.id ? translateShape(s, m.dx, m.dy) : s)))
      } else requestDraw()
    } else if (d.mode === 'pan') {
      e.currentTarget.style.cursor = spaceRef.current ? 'grab' : CURSORS[toolRef.current]
    } else if (d.mode === 'erase') {
      const ids = erasedRef.current
      erasedRef.current = new Set()
      if (ids.size > 0) commit(shapesRef.current.filter((s) => !ids.has(s.id)))
      else requestDraw()
    } else if (draftRef.current) {
      const s = draftRef.current
      draftRef.current = null
      let keep = true
      if (s.t !== 'pen' && s.t !== 'text') {
        // drop accidental clicks that produced no shape
        keep = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) * viewRef.current.k >= 3
      }
      if (keep) commit([...shapesRef.current, s]); else requestDraw()
    }
  }

  // ---------- actions ----------
  const chooseTool = useCallback((t: Tool) => {
    setTool(t)
    if (t !== 'select' && selectedRef.current) { selectedRef.current = null; requestDraw() }
  }, [requestDraw])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const t = TOOL_SHORTCUTS[e.key.toLowerCase()]
      if (!t) return
      e.preventDefault()
      chooseTool(t)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chooseTool])

  // ---------- full screen ----------
  const enterFull = () => {
    setIsFull(true)
    // Real fullscreen where supported; otherwise the fixed overlay below still covers the app.
    rootRef.current?.requestFullscreen?.().catch(() => {})
  }
  const exitFull = useCallback(() => {
    setIsFull(false)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }, [])

  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement) setIsFull(false) }
    document.addEventListener('fullscreenchange', onChange)
    const root = rootRef.current
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement && document.fullscreenElement === root) void document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!isFull) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (e.key === 'Escape' && !(el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT'))) exitFull()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFull, exitFull])
  const clearBoard = () => {
    if (shapesRef.current.length === 0) return
    if (!window.confirm('Clear everything on this board? You can undo this.')) return
    commit([])
  }

  const downloadPng = () => {
    const url = exportPng(shapesRef.current)
    if (!url) { window.alert('Nothing to export yet — draw something first.'); return }
    const a = document.createElement('a')
    a.href = url
    a.download = `${(titleRef.current || 'whiteboard').replace(/[^\w\- ]+/g, '').trim() || 'whiteboard'}.png`
    a.click()
  }

  const goBack = async () => { await flush(); onBack() }

  const deleteBoard = async () => {
    if (!window.confirm(`Delete "${title || 'Untitled board'}"? This can't be undone.`)) return
    // Cancel any pending save so it can't recreate/touch the deleted row.
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    dirtyRef.current = false
    titleDirtyRef.current = false
    await fetch(`/api/whiteboards/${board.id}`, { method: 'DELETE' })
    onDeleted()
  }

  const sep = <div className="w-px h-5 bg-[#E3E0D8] mx-1 flex-shrink-0" />

  return (
    <div ref={rootRef} className={isFull ? 'fixed inset-0 z-[100] flex flex-col bg-white' : 'flex flex-col h-full min-w-0'}>
      {/* Header */}
      <div className={`${isFull ? 'hidden' : 'flex'} items-center gap-2 px-3 md:px-4 py-2 border-b border-[#E3E0D8] bg-white`}>
        <button
          onClick={goBack}
          className="flex items-center gap-1 text-sm text-[#6B6B6B] hover:text-[#1A1A1A] pr-1 flex-shrink-0"
          aria-label="Back to boards"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          <span className="hidden sm:inline">Boards</span>
        </button>
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); titleDirtyRef.current = true; scheduleSave() }}
          placeholder="Untitled board"
          className="flex-1 min-w-0 bg-transparent text-lg font-semibold text-[#1A1A1A] placeholder-[#C4BFB5] focus:outline-none"
        />
        <span className={`text-xs flex-shrink-0 ${saveState === 'error' ? 'text-red-600' : 'text-[#9CA3AF]'}`} role="status">
          {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Save failed — retrying on next edit'}
        </span>
        <button onClick={downloadPng} className="text-xs text-[#6B6B6B] bg-[#F5F3EE] border border-[#E3E0D8] hover:text-[#1A1A1A] px-2 py-1 rounded flex-shrink-0">
          Export PNG
        </button>
        <button onClick={deleteBoard} className="text-xs text-[#9CA3AF] hover:text-red-500 transition-colors px-2 py-1 flex-shrink-0">
          Delete
        </button>
      </div>

      {/* Toolbar */}
      <div
        className={
          isFull
            ? 'absolute top-3 left-1/2 -translate-x-1/2 z-10 max-w-[calc(100%-1.5rem)] flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#E3E0D8] bg-white shadow-lg overflow-x-auto opacity-30 hover:opacity-100 focus-within:opacity-100 transition-opacity'
            : 'flex items-center gap-1 px-3 md:px-4 py-1.5 border-b border-[#E3E0D8] bg-white overflow-x-auto'
        }
      >
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => chooseTool(t.id)}
            title={t.label}
            aria-label={t.label}
            aria-pressed={tool === t.id}
            className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-md transition-colors ${
              tool === t.id ? 'bg-[#D4622A] text-white' : 'text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#F5F3EE]'
            }`}
          >
            {t.icon}
          </button>
        ))}
        {sep}
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            title={c}
            aria-label={`Color ${c}`}
            aria-pressed={color === c}
            className={`w-5 h-5 flex-shrink-0 rounded-full border-2 transition-transform ${color === c ? 'border-[#1A1A1A] scale-110' : 'border-white ring-1 ring-[#E3E0D8]'}`}
            style={{ backgroundColor: c }}
          />
        ))}
        {sep}
        {WIDTHS.map((w) => (
          <button
            key={w}
            onClick={() => setWidth(w)}
            title={`Size ${w}`}
            aria-label={`Size ${w}`}
            aria-pressed={width === w}
            className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-md transition-colors ${width === w ? 'bg-[#F0EDE5]' : 'hover:bg-[#F5F3EE]'}`}
          >
            <span className="rounded-full bg-[#1A1A1A]" style={{ width: 3 + w * 1.5, height: 3 + w * 1.5 }} />
          </button>
        ))}
        {sep}
        <IconBtn onClick={undo} label="Undo (⌘Z)" disabled={!hist.undo}>{ic(<><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></>)}</IconBtn>
        <IconBtn onClick={redo} label="Redo (⇧⌘Z)" disabled={!hist.redo}>{ic(<><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></>)}</IconBtn>
        <IconBtn onClick={clearBoard} label="Clear board" disabled={hist.empty}>{ic(<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>)}</IconBtn>
        <div className="flex-1" />
        <IconBtn onClick={() => zoomCenter(1 / 1.25)} label="Zoom out">{ic(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></>)}</IconBtn>
        <button
          onClick={() => setView({ x: 0, y: 0, k: 1 })}
          title="Reset view"
          className="text-xs tabular-nums text-[#6B6B6B] hover:text-[#1A1A1A] w-11 text-center flex-shrink-0"
        >
          {Math.round(zoom * 100)}%
        </button>
        <IconBtn onClick={() => zoomCenter(1.25)} label="Zoom in">{ic(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></>)}</IconBtn>
        {sep}
        <IconBtn onClick={isFull ? exitFull : enterFull} label={isFull ? 'Exit full screen (Esc)' : 'Full screen'}>
          {isFull
            ? ic(<><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></>)
            : ic(<><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>)}
        </IconBtn>
      </div>

      {/* Canvas */}
      <div ref={wrapRef} className="relative flex-1 min-h-0 overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none', cursor: CURSORS[tool] }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onContextMenu={(e) => e.preventDefault()}
        />
        {textEdit && (
          <textarea
            ref={textRef}
            value={textEdit.value}
            onChange={(e) => updateText({ ...textEdit, value: e.target.value })}
            onBlur={() => finishText(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); finishText(false) }
              else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); finishText(true) }
            }}
            placeholder="Type… (⌘↵ to finish)"
            rows={1}
            className="absolute bg-transparent outline-none border border-dashed border-[#D4622A] rounded-sm resize-none overflow-hidden px-0.5 placeholder-[#C4BFB5]"
            style={{
              left: textEdit.sx,
              top: textEdit.sy,
              minWidth: 160,
              fontFamily: FONT,
              fontSize: (12 + width * 3) * zoom,
              lineHeight: 1.25,
              color,
              fieldSizing: 'content',
            } as React.CSSProperties}
          />
        )}
        <div className={`absolute left-3 bottom-3 text-[11px] text-[#9CA3AF] bg-white/80 rounded px-2 py-1 pointer-events-none ${isFull ? 'hidden' : 'hidden md:block'}`}>
          Scroll to pan · ⌘/Ctrl + scroll to zoom · hold Space to drag · H hand · W write · E erase
        </div>
      </div>
    </div>
  )
}

export default function WhiteboardSection() {
  const [boards, setBoards] = useState<BoardMeta[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<Board | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/whiteboards')
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to load boards')
      setBoards(data)
      setError(null)
    } catch (e) {
      setBoards([])
      setError(e instanceof Error ? e.message : 'Failed to load boards')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/whiteboards')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Failed to load boards')
        if (!cancelled) { setBoards(data); setError(null) }
      })
      .catch((e) => {
        if (cancelled) return
        setBoards([])
        setError(e instanceof Error ? e.message : 'Failed to load boards')
      })
    return () => { cancelled = true }
  }, [])

  const open = async (id: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/whiteboards/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to open board')
      setActive(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open board')
    } finally {
      setBusy(false)
    }
  }

  const create = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/whiteboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create board')
      setActive({ ...data, data: { shapes: [] } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create board')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (b: BoardMeta) => {
    if (!window.confirm(`Delete "${b.title}"? This can't be undone.`)) return
    const res = await fetch(`/api/whiteboards/${b.id}`, { method: 'DELETE' })
    if (!res.ok) { setError('Failed to delete board'); return }
    setBoards((cur) => (cur ?? []).filter((x) => x.id !== b.id))
  }

  if (active) {
    return (
      <BoardEditor
        key={active.id}
        board={active}
        onBack={() => { setActive(null); void load() }}
        onDeleted={() => { setActive(null); void load() }}
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-[#FAF9F6]">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-semibold text-[#1A1A1A]">Whiteboard</h2>
            <p className="text-sm text-[#9CA3AF]">Sketch, diagram and think visually.</p>
          </div>
          <button
            onClick={create}
            disabled={busy}
            className="bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-60 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex-shrink-0"
          >
            + New board
          </button>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
            {/relation|does not exist|schema cache/i.test(error) && (
              <span className="block text-xs mt-1 text-red-600">
                The whiteboards table is missing — run supabase/migrations/20261114_whiteboards.sql in Supabase.
              </span>
            )}
          </div>
        )}

        {boards === null ? (
          <p className="text-sm text-[#9CA3AF]">Loading…</p>
        ) : boards.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="text-5xl mb-4">🖍️</div>
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-1">No boards yet</h3>
            <p className="text-[#9CA3AF] text-sm max-w-xs">Create a board to start drawing.</p>
            <button onClick={create} disabled={busy} className="mt-4 bg-[#D4622A] hover:bg-[#C05520] text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors">
              Create your first board
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((b) => (
              <div key={b.id} className="group relative bg-white border border-[#E3E0D8] rounded-xl shadow-sm overflow-hidden hover:border-[#D4622A]/40 transition-colors">
                <button onClick={() => open(b.id)} disabled={busy} className="block w-full text-left" aria-label={`Open ${b.title}`}>
                  <div className="aspect-[16/10] bg-[#FAF9F6] border-b border-[#E3E0D8] flex items-center justify-center">
                    {b.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-[#C4BFB5]">Empty board</span>
                    )}
                  </div>
                  <div className="px-3 py-2.5 pr-10">
                    <div className="truncate text-sm font-medium text-[#1A1A1A]">{b.title}</div>
                    <div className="text-xs text-[#9CA3AF] mt-0.5">
                      Edited {new Date(b.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => remove(b)}
                  title="Delete board"
                  aria-label={`Delete ${b.title}`}
                  className="absolute right-2 bottom-2 w-7 h-7 flex items-center justify-center rounded-md text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
