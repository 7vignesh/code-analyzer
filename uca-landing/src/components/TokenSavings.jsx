import { ArrowDown, Flame, Zap } from 'lucide-react'
import Reveal from './Reveal'

const comparison = [
  {
    label: 'Without Skannr',
    scenario: 'AI reads full files to answer your question',
    files: '10 files × 300 lines',
    tokens: '~15,000 tokens',
    cost: 'Full context burned every time',
    highlight: false,
  },
  {
    label: 'With Skannr',
    scenario: 'Skannr returns ranked skeletons (signatures + types only)',
    files: '8 relevant files, compressed',
    tokens: '~500 tokens',
    cost: '96.5% less context used',
    highlight: true,
  },
]

const flows = [
  {
    icon: Flame,
    title: 'Direct CLI — zero tokens',
    command: 'skannr "how does auth work?"',
    desc: 'Answers locally. No AI API call, no tokens burned. Free.',
  },
  {
    icon: Zap,
    title: 'MCP — 96% fewer tokens',
    command: 'AI calls scan_codebase via MCP',
    desc: 'Instead of reading 10+ full files, your assistant gets compressed skeletons in one tool call. Same answer, 30x cheaper.',
  },
]

export default function TokenSavings() {
  return (
    <section className="py-24 px-5">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="text-3xl md:text-5xl font-bold text-center tracking-tight">
            Stop burning tokens on full file reads.
          </h2>
          <p className="mt-4 text-center text-[#888] max-w-2xl mx-auto">
            Every time your AI reads a file, you pay for every line — including the function bodies
            it doesn't need. Skannr strips the noise and returns only structure.
          </p>
        </Reveal>

        {/* Before/After comparison cards */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
          {comparison.map((item) => (
            <Reveal key={item.label} delay={item.highlight ? 100 : 0} className="h-full">
              <article
                className={`group h-full rounded-xl border p-6 transition-all duration-300 ${
                  item.highlight
                    ? 'border-accent/40 bg-accent/[0.04] hover:border-accent/60 hover:shadow-[0_0_36px_rgba(0,212,255,0.12)]'
                    : 'border-border bg-card hover:border-white/10 hover:bg-card-hover'
                }`}
              >
                <h3 className={`text-lg font-semibold mb-3 ${item.highlight ? 'text-accent' : 'text-white'}`}>
                  {item.label}
                </h3>
                <p className="text-[#888] text-sm mb-4">{item.scenario}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#888]">Files processed</span>
                    <span className="font-mono text-[#d0d0d0]">{item.files}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#888]">Tokens in context</span>
                    <span className={`font-mono font-semibold ${item.highlight ? 'text-accent' : 'text-yellow'}`}>
                      {item.tokens}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-white/5">
                    <span className={`text-sm font-medium ${item.highlight ? 'text-green' : 'text-[#888]'}`}>
                      {item.cost}
                    </span>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Arrow indicator */}
        <Reveal delay={150}>
          <div className="flex justify-center my-8">
            <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-2">
              <ArrowDown size={16} className="text-green" />
              <span className="text-sm font-mono text-green">96.5% reduction</span>
              <ArrowDown size={16} className="text-green" />
            </div>
          </div>
        </Reveal>

        {/* Two modes of saving */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          {flows.map(({ icon: Icon, title, command, desc }, i) => (
            <Reveal key={title} delay={i * 80} className="h-full">
              <article className="group h-full rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:bg-card-hover">
                <Icon size={20} className="mb-3 text-accent" />
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <code className="block w-fit rounded-lg border border-border px-3 py-1.5 font-mono text-xs text-accent mb-3">
                  {command}
                </code>
                <p className="text-[#888] text-sm">{desc}</p>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Clarification */}
        <Reveal delay={200}>
          <p className="mt-10 text-center text-sm text-[#888] max-w-xl mx-auto">
            Skeletons show structure — signatures, types, imports. If you need a function body,
            use the symbol mapping to retrieve just that one implementation on demand.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
