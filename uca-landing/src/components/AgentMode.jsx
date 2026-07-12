import Reveal from './Reveal'

export default function AgentMode() {
  return (
    <section className="py-24 px-5">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="text-3xl md:text-5xl font-bold text-center tracking-tight">
            Agent mode. For when you need to explore.
          </h2>
        </Reveal>

        <Reveal delay={100} className="mt-12 block">
          <div className="overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-white/10 hover:shadow-[0_0_40px_-12px_rgba(0,212,255,0.12)]">
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="ml-2 font-mono text-xs text-[#888]">bash</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-sm leading-7 text-[#e8e8e8]">
            <span>$ skannr agent</span>
            {'\n\n'}
            <span className="text-accent">{'>'}</span> <span>/help</span>
            {'\n'}  <span className="text-white">/files</span>               List currently retrieved files
            {'\n'}  <span className="text-white">/symbols &lt;query&gt;</span>     Search for symbols in the codebase
            {'\n'}  <span className="text-white">/symbol &lt;id&gt;</span>         Get full implementation of a symbol
            {'\n'}  <span className="text-white">/deps &lt;filePath&gt;</span>     Show imports and exports for a file
            {'\n'}  <span className="text-white">/refresh</span>             Re-analyze project with new context
            {'\n'}  <span className="text-white">/stats</span>               Show cache and mapping statistics
            {'\n'}  <span className="text-white">/exit</span>                Quit
            {'\n\n'}
            <span className="text-accent">{'>'}</span> <span>/symbols auth</span>
            {'\n'}  Found 4 symbols:
            {'\n'}  <span className="text-accent">→</span> AuthManager (class)     <span className="text-[#888]">src/auth/AuthManager.ts:12</span>
            {'\n'}  <span className="text-accent">→</span> validateToken (fn)      <span className="text-[#888]">src/auth/AuthManager.ts:24</span>
            {'\n'}  <span className="text-accent">→</span> AuthMiddleware (class)  <span className="text-[#888]">src/middleware/auth.ts:8</span>
            {'\n'}  <span className="text-accent">→</span> authRouter (const)      <span className="text-[#888]">src/routes/auth.ts:3</span>
            </pre>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
