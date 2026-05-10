import Reveal from './Reveal'

const tools = [
  {
    name: 'Gemini CLI',
    desc: 'Add as MCP server in ~/.gemini/config.json',
    barClass: 'bg-accent',
  },
  {
    name: 'Claude Code',
    desc: 'Works via MCP over stdio',
    barClass: 'bg-purple',
  },
  {
    name: 'Cursor',
    desc: 'Add to ~/.cursor/mcp.json',
    barClass: 'bg-green',
  },
  {
    name: 'Any MCP Client',
    desc: 'Standard Model Context Protocol over stdio',
    barClass: 'bg-yellow',
  },
]

export default function WorksWith() {
  return (
    <section id="works-with" className="py-24 px-5">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <h2 className="text-3xl md:text-5xl font-bold text-center tracking-tight">
            Works with the tools you already use.
          </h2>
        </Reveal>
        <div className="mt-12 grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((tool, i) => (
            <Reveal key={tool.name} delay={i * 90} className="h-full">
              <article className="group flex h-full min-h-[160px] gap-4 rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/25 hover:bg-card-hover hover:shadow-[0_24px_48px_-28px_rgba(0,0,0,0.9)]">
                <div
                  className={`h-12 w-1 shrink-0 origin-top rounded-full ${tool.barClass} motion-safe:animate-bar-grow motion-reduce:opacity-100 motion-reduce:scale-y-100 transition-transform duration-300 motion-safe:group-hover:scale-y-110`}
                  aria-hidden
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <h3 className="text-lg font-semibold leading-snug text-[#f0f0f0] transition-colors duration-300 group-hover:text-white">
                    {tool.name}
                  </h3>
                  <p className="flex-1 text-sm leading-relaxed text-[#888]">{tool.desc}</p>
                  <span className="mt-3 inline-flex w-fit rounded-full bg-green/15 px-3 py-1 text-xs font-medium text-green transition-transform duration-300 group-hover:scale-105">
                    Ready
                  </span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
