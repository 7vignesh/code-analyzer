import { Code2, Database, FileSearch, Network, Plug, Zap } from 'lucide-react'
import Reveal from './Reveal'

const features = [
  {
    icon: Network,
    title: 'Hybrid Retrieval',
    body: 'Lexical + structural + dependency-graph ranking. Finds architecturally central files, not just keyword matches.',
  },
  {
    icon: Zap,
    title: '96.5% Token Reduction',
    body: 'Skeleton generation strips bodies while preserving signatures and types. Feed entire codebases to your AI without hitting limits.',
  },
  {
    icon: Code2,
    title: 'Auto Language Detection',
    body: "Detects the repo's dominant language automatically. TypeScript, JavaScript, and Python supported. Generic fallback for everything else.",
  },
  {
    icon: Database,
    title: 'Smart Caching',
    body: 'MD5-based file hashing detects changes automatically. Repeated queries run in milliseconds. 24-hour TTL with manual controls.',
  },
  {
    icon: FileSearch,
    title: 'Grounded Citations',
    body: 'Every response includes an Evidence section listing the exact files and symbols used. Verify AI answers by tracing to source.',
  },
  {
    icon: Plug,
    title: 'MCP Server Built In',
    body: 'Runs as a Model Context Protocol server. Plug into Gemini CLI, Claude Code, Cursor, or any MCP-compatible tool.',
  },
]

export default function Features() {
  return (
    <section id="features" className="py-24 px-5">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <h2 className="text-3xl md:text-5xl font-bold text-center tracking-tight">
            Everything you need. Nothing you don't.
          </h2>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 70} className="h-full">
              <article className="group h-full rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:bg-card-hover hover:shadow-[0_0_36px_rgba(0,212,255,0.12)]">
                <Icon
                  size={24}
                  className="mb-4 text-accent transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                />
                <h3 className="mb-2 text-xl font-semibold">{title}</h3>
                <p className="text-[#888]">{body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
