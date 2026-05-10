import Reveal from './Reveal'

const flags = [
  ['--question', 'The question to answer (required)'],
  ['--root', 'Path to repo (default: current directory)'],
  ['--limit', 'Number of files to return (default: 10)'],
  ['--modules', 'Comma-separated module names to focus on'],
  ['--lang', 'Force language: typescript, python, auto'],
  ['--with-mapping', 'Generate symbol-to-file mapping'],
  ['--skip-cache', 'Bypass cache for this query'],
  ['--cache-stats', 'Show cache statistics'],
  ['--cache-clear', 'Clear the cache'],
  ['--interactive', 'Start interactive agent mode'],
]

export default function CliReference() {
  return (
    <section className="py-24 px-5">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="text-3xl md:text-5xl font-bold text-center tracking-tight">All CLI options.</h2>
        </Reveal>
        <Reveal delay={80}>
          <div className="mt-12 overflow-hidden rounded-xl border border-border bg-card transition-colors duration-300 hover:border-white/10">
            <table className="w-full text-left">
              <thead className="border-b border-white/5">
                <tr className="text-[#888] text-sm">
                  <th className="px-6 py-4 font-medium">Flag</th>
                  <th className="px-6 py-4 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {flags.map(([flag, description]) => (
                  <tr
                    key={flag}
                    className="border-b border-white/5 transition-colors duration-200 last:border-b-0 hover:bg-white/[0.03]"
                  >
                    <td className="px-6 py-4 font-mono text-accent">{flag}</td>
                    <td className="px-6 py-4 text-[#d0d0d0]">{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
