'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { drawShape, shapesBounds, type Shape, type View } from '@/lib/whiteboard'

const MIN_K = 0.05
const MAX_K = 8

/** Read-only whiteboard: pan, zoom and full screen, no editing. */
export default function WhiteboardViewer({ title, shapes, updatedAt }: { title: string; shapes: Shape[]; updatedAt: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 })
  const dragRef = useRef<null | { sx: number; sy: number; vx: number; vy: number }>(null)
  const rafRef = useRef(0)
  const fittedRef = useRef(false)
  const [zoom, setZoom] = useState(1)
  const [isFull, setIsFull] = useState(false)

  const draw = useCallback(() => {
    rafRef.current = 0
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { w, h, dpr } = sizeRef.current
    const v = viewRef.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)
    const step = 32 * v.k
    if (step >= 10) {
      ctx.fillStyle = '#D9D5CA'
      const ox = ((v.x % step) + step) % step
      const oy = ((v.y % step) + step) % step
      for (let x = ox; x < w; x += step) for (let y = oy; y < h; y += step) ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5)
    }
    ctx.setTransform(dpr * v.k, 0, 0, dpr * v.k, dpr * v.x, dpr * v.y)
    for (const s of shapes) drawShape(ctx, s)
  }, [shapes])

  const requestDraw = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(draw)
  }, [draw])

  const setView = useCallback((v: View) => {
    viewRef.current = v
    setZoom(v.k)
    requestDraw()
  }, [requestDraw])

  const fit = useCallback(() => {
    const { w, h } = sizeRef.current
    const b = shapesBounds(shapes)
    if (!b || w === 0) { setView({ x: 0, y: 0, k: 1 }); return }
    const margin = 48
    const bw = Math.max(b.maxX - b.minX, 1)
    const bh = Math.max(b.maxY - b.minY, 1)
    const k = Math.min(MAX_K, Math.max(MIN_K, Math.min((w - margin * 2) / bw, (h - margin * 2) / bh, 1.5)))
    setView({ k, x: (w - bw * k) / 2 - b.minX * k, y: (h - bh * k) / 2 - b.minY * k })
  }, [shapes, setView])

  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    const v = viewRef.current
    const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor))
    const wx = (cx - v.x) / v.k
    const wy = (cy - v.y) / v.k
    setView({ k, x: cx - wx * k, y: cy - wy * k })
  }, [setView])

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
      if (!fittedRef.current && w > 0) { fittedRef.current = true; fit() } else requestDraw()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.01))
      else setView({ ...viewRef.current, x: viewRef.current.x - e.deltaX, y: viewRef.current.y - e.deltaY })
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      ro.disconnect()
      canvas.removeEventListener('wheel', onWheel)
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
    }
  }, [fit, requestDraw, zoomAt, setView])

  useEffect(() => {
    const onChange = () => setIsFull(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void rootRef.current?.requestFullscreen?.().catch(() => {})
  }

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const r = e.currentTarget.getBoundingClientRect()
    dragRef.current = { sx: e.clientX - r.left, sy: e.clientY - r.top, vx: viewRef.current.x, vy: viewRef.current.y }
    e.currentTarget.style.cursor = 'grabbing'
  }
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current
    if (!d) return
    const r = e.currentTarget.getBoundingClientRect()
    setView({ ...viewRef.current, x: d.vx + (e.clientX - r.left - d.sx), y: d.vy + (e.clientY - r.top - d.sy) })
  }
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null
    e.currentTarget.style.cursor = 'grab'
  }

  const btn = 'w-8 h-8 flex items-center justify-center rounded-md text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#F5F3EE] transition-colors text-base'

  return (
    <div ref={rootRef} className="h-screen flex flex-col bg-white">
      <header className={`${isFull ? 'hidden' : 'flex'} items-center gap-3 px-4 py-2.5 border-b border-[#E3E0D8] bg-white`}>
        <span className="text-xs bg-[#FEF3EC] text-[#D4622A] border border-[#F5D3BC] px-2 py-0.5 rounded-full font-medium flex-shrink-0">Whiteboard</span>
        <h1 className="flex-1 min-w-0 truncate text-base font-semibold text-[#1A1A1A]">{title}</h1>
        <span className="hidden sm:inline text-xs text-[#9CA3AF] flex-shrink-0">
          Updated {new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <span className="hidden md:inline text-xs text-[#9CA3AF] flex-shrink-0">
          <span className="font-semibold text-[#D4622A]">AI Ready School</span> · view only
        </span>
      </header>

      <div ref={wrapRef} className="relative flex-1 min-h-0 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ touchAction: 'none', cursor: 'grab' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        {shapes.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-[#9CA3AF] pointer-events-none">This board is empty.</p>
        )}
        <div className="absolute right-3 bottom-3 flex items-center gap-0.5 bg-white border border-[#E3E0D8] rounded-lg shadow-md px-1 py-1">
          <button className={btn} aria-label="Zoom out" title="Zoom out" onClick={() => zoomAt(sizeRef.current.w / 2, sizeRef.current.h / 2, 1 / 1.25)}>−</button>
          <button className="text-xs tabular-nums text-[#6B6B6B] hover:text-[#1A1A1A] w-11 text-center" title="Fit to screen" onClick={fit}>{Math.round(zoom * 100)}%</button>
          <button className={btn} aria-label="Zoom in" title="Zoom in" onClick={() => zoomAt(sizeRef.current.w / 2, sizeRef.current.h / 2, 1.25)}>+</button>
          <div className="w-px h-5 bg-[#E3E0D8] mx-1" />
          <button className={btn} aria-label={isFull ? 'Exit full screen' : 'Full screen'} title={isFull ? 'Exit full screen' : 'Full screen'} onClick={toggleFull}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              {isFull
                ? <><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></>
                : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>}
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
