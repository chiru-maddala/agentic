'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import to avoid SSR issues with canvas/WebGL
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

type NodeType = 'concept' | 'technology' | 'organization' | 'theme'
type Pillar = 'Learning AI' | 'Enterprise AI' | 'AI Infrastructure' | 'General'
type RelType = 'related_to' | 'enables' | 'builds_on' | 'competes_with' | 'part_of'

type GraphNode = {
  id: string
  label: string
  type: NodeType
  pillar: Pillar
  description: string
  mention_count: number
  // force-graph internals
  x?: number
  y?: number
  fx?: number
  fy?: number
}

type GraphEdge = {
  id: string
  source_id: string
  target_id: string
  relationship: RelType
  weight: number
}

type GraphData = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ── Colors ────────────────────────────────────────────────────────────────────

const PILLAR_COLORS: Record<Pillar, string> = {
  'Learning AI':       '#D4622A',  // brand orange
  'Enterprise AI':     '#3B82F6',  // blue
  'AI Infrastructure': '#10B981',  // green
  'General':           '#9CA3AF',  // gray
}

const PILLAR_BG: Record<Pillar, string> = {
  'Learning AI':       'bg-[#FEF3EC] text-[#D4622A] border-[#F5D3BC]',
  'Enterprise AI':     'bg-blue-50 text-blue-700 border-blue-200',
  'AI Infrastructure': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'General':           'bg-[#F5F3EE] text-[#6B6B6B] border-[#E3E0D8]',
}

const REL_LABELS: Record<RelType, string> = {
  related_to:    'Related to',
  enables:       'Enables',
  builds_on:     'Builds on',
  competes_with: 'Competes with',
  part_of:       'Part of',
}

const TYPE_ICONS: Record<NodeType, string> = {
  concept:      '💡',
  technology:   '⚙️',
  organization: '🏢',
  theme:        '🎯',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nodeSize(n: GraphNode) {
  return Math.max(5, Math.min(18, 5 + n.mention_count * 2.5))
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function KnowledgeGraphSection() {
  const [data, setData] = useState<GraphData>({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [filterPillar, setFilterPillar] = useState<Pillar | 'All'>('All')
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/graph')
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleRefresh = async () => {
    setRefreshing(true)
    setRefreshMsg(null)
    setSelectedNode(null)
    try {
      const res = await fetch('/api/graph/refresh', { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        setRefreshMsg(`Graph updated — ${json.nodes} concepts, ${json.edges} connections`)
        await load()
      } else {
        setRefreshMsg('Refresh failed. Try again.')
      }
    } catch {
      setRefreshMsg('Refresh failed. Try again.')
    } finally {
      setRefreshing(false)
      setTimeout(() => setRefreshMsg(null), 4000)
    }
  }

  // Track container size for responsive graph
  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  // Filtered graph data
  const filteredNodes: GraphNode[] = filterPillar === 'All'
    ? data.nodes
    : data.nodes.filter((n) => n.pillar === filterPillar)

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id))

  const graphData = {
    nodes: filteredNodes.map((n) => ({ ...n })),
    links: data.edges
      .filter((e) => filteredNodeIds.has(e.source_id) && filteredNodeIds.has(e.target_id))
      .map((e) => ({
        source: e.source_id,
        target: e.target_id,
        relationship: e.relationship,
        weight: e.weight,
      })),
  }

  // Node connections for side panel
  type LinkObj = { source: string | GraphNode; target: string | GraphNode; relationship: RelType; weight: number }
  const connectedEdges = selectedNode
    ? (graphData.links as LinkObj[]).filter((l) => {
        const src = typeof l.source === 'object' ? l.source.id : l.source
        const tgt = typeof l.target === 'object' ? l.target.id : l.target
        return src === selectedNode.id || tgt === selectedNode.id
      })
    : []

  const connectedNodes = selectedNode
    ? connectedEdges.map((l) => {
        const src = typeof l.source === 'object' ? l.source : filteredNodes.find((n) => n.id === l.source)
        const tgt = typeof l.target === 'object' ? l.target : filteredNodes.find((n) => n.id === l.target)
        const other = (src as GraphNode)?.id === selectedNode.id ? tgt : src
        return { node: other as GraphNode, relationship: l.relationship, weight: l.weight }
      }).filter((c) => c.node)
    : []

  const isEmpty = data.nodes.length === 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#FAF9F6]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-[#E3E0D8] bg-[#F5F3EE] flex-shrink-0 flex-wrap gap-2">
        <div>
          <h1 className="text-base font-semibold text-[#1A1A1A]">Knowledge Graph</h1>
          <p className="text-xs text-[#9CA3AF]">
            {refreshMsg ? (
              <span className="text-green-600">{refreshMsg}</span>
            ) : (
              <>{data.nodes.length} concepts · {data.edges.length} connections</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['All', 'Learning AI', 'Enterprise AI', 'AI Infrastructure', 'General'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setFilterPillar(p)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filterPillar === p
                  ? p === 'All'
                    ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                    : `border-transparent ${PILLAR_BG[p as Pillar]}`
                  : 'bg-white text-[#6B6B6B] border-[#E3E0D8] hover:border-[#C4BFB5]'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            {refreshing ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Refreshing…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
                </svg>
                Refresh KG
              </>
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph canvas */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="w-6 h-6 border-2 border-[#D4622A] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : isEmpty ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
              <div className="text-5xl mb-4">🕸️</div>
              <h2 className="text-xl font-semibold text-[#1A1A1A] mb-2">No graph yet</h2>
              <p className="text-[#9CA3AF] text-sm max-w-xs mb-4">
                Click &quot;Refresh KG&quot; to build the graph from all your reports, notes, tasks, and content.
              </p>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 text-sm bg-[#D4622A] hover:bg-[#C05520] disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors font-medium"
              >
                {refreshing ? (
                  <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Refreshing…</>
                ) : (
                  <>🕸️ Refresh KG</>
                )}
              </button>
            </div>
          ) : (
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="#FAF9F6"
              nodeRelSize={1}
              nodeVal={(n) => nodeSize(n as GraphNode) ** 2}
              nodeColor={(n) => PILLAR_COLORS[(n as GraphNode).pillar] ?? '#9CA3AF'}
              nodeLabel={(n) => (n as GraphNode).label}
              nodeCanvasObject={(node, ctx, globalScale) => {
                const n = node as GraphNode & { x: number; y: number }
                const r = nodeSize(n)
                const isSelected = selectedNode?.id === n.id

                // Glow for selected
                if (isSelected) {
                  ctx.beginPath()
                  ctx.arc(n.x, n.y, r + 4, 0, 2 * Math.PI)
                  ctx.fillStyle = PILLAR_COLORS[n.pillar] + '33'
                  ctx.fill()
                }

                // Circle
                ctx.beginPath()
                ctx.arc(n.x, n.y, r, 0, 2 * Math.PI)
                ctx.fillStyle = PILLAR_COLORS[n.pillar] ?? '#9CA3AF'
                ctx.fill()

                if (isSelected) {
                  ctx.strokeStyle = '#fff'
                  ctx.lineWidth = 1.5
                  ctx.stroke()
                }

                // Label
                const fontSize = Math.max(8, Math.min(13, r * 1.2))
                if (globalScale > 0.5 || isSelected) {
                  ctx.font = `${isSelected ? 600 : 500} ${fontSize}px Inter, sans-serif`
                  ctx.fillStyle = isSelected ? '#1A1A1A' : '#374151'
                  ctx.textAlign = 'center'
                  ctx.textBaseline = 'middle'
                  ctx.fillText(n.label, n.x, n.y + r + fontSize * 0.9)
                }
              }}
              linkColor={() => '#D1CFC9'}
              linkWidth={(l) => Math.max(0.5, ((l as { weight?: number }).weight ?? 1) * 0.6)}
              linkDirectionalParticles={0}
              onNodeClick={(node) => {
                const n = node as GraphNode
                setSelectedNode((prev) => prev?.id === n.id ? null : n)
              }}
              onBackgroundClick={() => setSelectedNode(null)}
              cooldownTicks={100}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
            />
          )}
        </div>

        {/* Side panel */}
        {selectedNode && (
          <div className="w-72 flex-shrink-0 border-l border-[#E3E0D8] bg-white flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#E3E0D8]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl flex-shrink-0">{TYPE_ICONS[selectedNode.type]}</span>
                  <h2 className="text-sm font-semibold text-[#1A1A1A] leading-tight">{selectedNode.label}</h2>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-[#9CA3AF] hover:text-[#6B6B6B] flex-shrink-0"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${PILLAR_BG[selectedNode.pillar]}`}>
                  {selectedNode.pillar}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full border bg-[#F5F3EE] text-[#6B6B6B] border-[#E3E0D8] capitalize">
                  {selectedNode.type}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full border bg-[#F5F3EE] text-[#6B6B6B] border-[#E3E0D8]">
                  {selectedNode.mention_count}× mentioned
                </span>
              </div>
              {selectedNode.description && (
                <p className="mt-3 text-xs text-[#6B6B6B] leading-relaxed">{selectedNode.description}</p>
              )}
            </div>

            {/* Connections */}
            <div className="flex-1 overflow-y-auto p-4">
              {connectedNodes.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3">
                    Connections ({connectedNodes.length})
                  </p>
                  <div className="space-y-2">
                    {connectedNodes.map(({ node, relationship }, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedNode(node)}
                        className="w-full text-left bg-[#FAF9F6] hover:bg-[#F5F3EE] border border-[#E3E0D8] rounded-lg p-2.5 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs">{TYPE_ICONS[node.type]}</span>
                          <span className="text-xs font-medium text-[#1A1A1A] truncate">{node.label}</span>
                        </div>
                        <span className="text-[11px] text-[#9CA3AF]">{REL_LABELS[relationship]}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-[#C4BFB5] text-center py-4">No connections yet.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 border-t border-[#E3E0D8] bg-[#F5F3EE] px-4 py-2 flex items-center gap-4 flex-wrap">
        <span className="text-[11px] text-[#9CA3AF] font-medium">Pillar:</span>
        {Object.entries(PILLAR_COLORS).map(([pillar, color]) => (
          <div key={pillar} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-[#6B6B6B]">{pillar}</span>
          </div>
        ))}
        <span className="text-[11px] text-[#9CA3AF] ml-auto">Node size = mention frequency</span>
      </div>
    </div>
  )
}
