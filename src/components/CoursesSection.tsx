'use client'

import { useCallback, useEffect, useState } from 'react'

type CourseMeta = { id: string; title: string; created_at: string; slide_count: number }

type Slide = {
  type: 'title' | 'content' | 'bullets' | 'quote' | 'summary'
  heading: string
  body?: string
  bullets?: string[]
}

type Course = CourseMeta & { slides: string | Slide[] }

function SlideView({ slide, index, total }: { slide: Slide; index: number; total: number }) {
  const num = `${index + 1} / ${total}`

  if (slide.type === 'title') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-12 bg-gradient-to-br from-[#D4622A] to-[#B8501F] text-white rounded-2xl">
        <div className="text-xs font-medium uppercase tracking-widest mb-6 opacity-70">{num}</div>
        <h1 className="text-3xl font-bold leading-tight mb-4">{slide.heading}</h1>
        {slide.body && <p className="text-base opacity-80 max-w-lg">{slide.body}</p>}
      </div>
    )
  }

  if (slide.type === 'quote') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-12 bg-[#FAF9F6] rounded-2xl border border-[#E3E0D8]">
        <div className="text-xs font-medium uppercase tracking-widest mb-8 text-[#9CA3AF]">{num}</div>
        <div className="border-l-4 border-[#D4622A] pl-6 max-w-lg">
          <p className="text-xl italic text-[#374151] leading-relaxed">&ldquo;{slide.body || slide.heading}&rdquo;</p>
          {slide.body && <p className="text-sm text-[#9CA3AF] mt-4 font-medium">{slide.heading}</p>}
        </div>
      </div>
    )
  }

  if (slide.type === 'bullets') {
    return (
      <div className="flex flex-col justify-center h-full px-12 bg-white rounded-2xl border border-[#E3E0D8]">
        <div className="text-xs font-medium uppercase tracking-widest mb-6 text-[#9CA3AF]">{num}</div>
        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-6">{slide.heading}</h2>
        <ul className="space-y-3">
          {slide.bullets?.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-1.5 w-2 h-2 rounded-full bg-[#D4622A] flex-shrink-0" />
              <span className="text-[#374151] text-base">{b}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (slide.type === 'summary') {
    return (
      <div className="flex flex-col justify-center h-full px-12 bg-gradient-to-br from-[#F5F3EE] to-[#ECEAE3] rounded-2xl border border-[#E3E0D8]">
        <div className="text-xs font-medium uppercase tracking-widest mb-6 text-[#9CA3AF]">{num}</div>
        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">{slide.heading}</h2>
        {slide.body && <p className="text-[#374151] text-base leading-relaxed">{slide.body}</p>}
        {slide.bullets && (
          <ul className="mt-4 space-y-2">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-[#D4622A] flex-shrink-0" />
                <span className="text-[#374151] text-sm">{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // content (default)
  return (
    <div className="flex flex-col justify-center h-full px-12 bg-white rounded-2xl border border-[#E3E0D8]">
      <div className="text-xs font-medium uppercase tracking-widest mb-6 text-[#9CA3AF]">{num}</div>
      <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">{slide.heading}</h2>
      {slide.body && <p className="text-[#374151] text-base leading-relaxed">{slide.body}</p>}
    </div>
  )
}

function CourseViewer({ course, onClose, onDelete }: { course: Course; onClose: () => void; onDelete: () => void }) {
  const slides: Slide[] = typeof course.slides === 'string' ? JSON.parse(course.slides) : course.slides
  const [current, setCurrent] = useState(0)

  const prev = () => setCurrent((c) => Math.max(0, c - 1))
  const next = () => setCurrent((c) => Math.min(slides.length - 1, c + 1))

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#FAF9F6] rounded-2xl shadow-2xl w-full max-w-3xl border border-[#E3E0D8] flex flex-col" style={{ height: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#E3E0D8]">
          <span className="text-sm font-semibold text-[#1A1A1A] truncate mr-4">{course.title}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { if (window.confirm('Delete this presentation?')) onDelete() }}
              className="text-xs text-[#9CA3AF] hover:text-red-500 px-2 py-1 rounded transition-colors"
            >Delete</button>
            <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#1A1A1A] transition-colors p-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Slide */}
        <div className="flex-1 p-6 overflow-hidden">
          <SlideView slide={slides[current]} index={current} total={slides.length} />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#E3E0D8]">
          <button
            onClick={prev}
            disabled={current === 0}
            className="flex items-center gap-1.5 text-sm text-[#6B6B6B] hover:text-[#1A1A1A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Previous
          </button>
          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`rounded-full transition-all ${i === current ? 'w-4 h-2 bg-[#D4622A]' : 'w-2 h-2 bg-[#E3E0D8] hover:bg-[#C4BFB5]'}`}
              />
            ))}
          </div>
          <button
            onClick={next}
            disabled={current === slides.length - 1}
            className="flex items-center gap-1.5 text-sm text-[#6B6B6B] hover:text-[#1A1A1A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CoursesSection() {
  const [courses, setCourses] = useState<CourseMeta[]>([])
  const [activeCourse, setActiveCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(false)

  const loadCourses = useCallback(async () => {
    const res = await fetch('/api/courses')
    const data = await res.json()
    setCourses(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => { loadCourses() }, [loadCourses])

  const openCourse = async (id: string) => {
    const res = await fetch(`/api/courses/${id}`)
    const data = await res.json()
    setActiveCourse(data)
  }

  const deleteCourse = async (id: string) => {
    await fetch(`/api/courses/${id}`, { method: 'DELETE' })
    setActiveCourse(null)
    loadCourses()
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#FAF9F6]">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-[#1A1A1A]">Presentations</h1>
            <p className="text-xs text-[#9CA3AF] mt-0.5">Select text in a daily report and choose &quot;Create Presentation&quot; to generate a presentation.</p>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
              <span className="w-4 h-4 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />
              Generating presentation…
            </div>
          )}
        </div>

        {courses.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎓</div>
            <h2 className="text-lg font-semibold text-[#1A1A1A] mb-2">No presentations yet</h2>
            <p className="text-[#9CA3AF] text-sm max-w-xs mx-auto">
              Right-click selected text in a Daily Report and choose &quot;Create Presentation&quot; to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => openCourse(c.id)}
                className="bg-white border border-[#E3E0D8] rounded-xl p-4 text-left hover:border-[#D4622A]/40 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FEF3EC] flex items-center justify-center flex-shrink-0">
                    <span className="text-base">🎓</span>
                  </div>
                  <span className="text-xs text-[#9CA3AF]">{c.slide_count} slides</span>
                </div>
                <h3 className="text-sm font-semibold text-[#1A1A1A] line-clamp-2 mb-1">{c.title}</h3>
                <p className="text-xs text-[#9CA3AF]">
                  {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {activeCourse && (
        <CourseViewer
          course={activeCourse}
          onClose={() => setActiveCourse(null)}
          onDelete={() => deleteCourse(activeCourse.id)}
        />
      )}
    </div>
  )
}
