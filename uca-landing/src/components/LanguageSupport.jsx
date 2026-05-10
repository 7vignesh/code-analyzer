import Reveal from './Reveal'

const rows = [
  ['TypeScript / TSX', 'Full', 'AST via ts-morph'],
  ['JavaScript / JSX', 'Full', 'AST via ts-morph'],
  ['Python', 'Structural', 'Regex (signatures + type hints)'],
  ['Go, Rust, Java, others', 'Basic', 'First 50 lines fallback'],
]

function badgeClass(level) {
  if (level === 'Full') return 'bg-green/15 text-green'
  if (level === 'Structural') return 'bg-yellow/20 text-yellow'
  return 'bg-white/10 text-[#c5c5c5]'
}

export default function LanguageSupport() {
  return (
    <section className="py-24 px-5">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="text-3xl md:text-5xl font-bold text-center tracking-tight">Works on your stack.</h2>
        </Reveal>
        <Reveal delay={80}>
          <div className="mt-12 overflow-hidden rounded-xl border border-border bg-card transition-colors duration-300 hover:border-white/10">
            <table className="w-full text-left">
              <thead className="border-b border-white/5">
                <tr className="text-sm text-[#888]">
                  <th className="px-6 py-4 font-medium">Language</th>
                  <th className="px-6 py-4 font-medium">Support</th>
                  <th className="px-6 py-4 font-medium">Method</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row[0]}
                    className="border-b border-white/5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-6 py-4">{row[0]}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-sm ${badgeClass(row[1])}`}>
                        {row[1]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#888]">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <a
            href="https://github.com/7vignesh/code-analyzer"
            className="mt-6 inline-block text-[#888] transition-all duration-300 hover:text-accent hover:translate-x-1"
          >
            More language adapters coming. PRs welcome →
          </a>
        </Reveal>
      </div>
    </section>
  )
}
