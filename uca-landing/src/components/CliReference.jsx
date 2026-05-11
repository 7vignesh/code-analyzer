import Reveal from './Reveal'

const flags = [
  ['-V, --version', 'Print the CLI version'],
  ['-h, --help', 'Show all options and examples'],
  ['--root <path>', 'Project root (default: current directory)'],
  ['--question <text>', 'Natural language question about the codebase'],
  ['--limit <n>', 'Number of top files to return (default: 10 or skannr.config)'],
  ['--with-mapping', 'Generate symbol mapping for on-demand retrieval'],
  ['--mapping-output <path>', 'Write mapping JSON here (implies --with-mapping)'],
  ['--modules <keys>', 'Comma-separated module keys (auto-discovered when omitted)'],
  ['--lang <mode>', 'typescript | javascript | python | auto (default: auto)'],
  ['--skip-cache', 'Skip cache and force a full analysis'],
  ['--cache-clear', 'Clear all cached analysis results'],
  ['--cache-stats', 'Print cache hit/miss statistics'],
  ['--report', 'Print repository health report as JSON (no --question)'],
  ['--diff <ref>', 'Git-scoped analysis (not available yet)'],
  ['--format <fmt>', 'human | markdown | json (default: human)'],
  ['--watch', 'Watch the tree and re-run analysis when files change'],
  ['--telemetry-on', 'Enable anonymous flag-only usage telemetry'],
  ['--telemetry-off', 'Disable telemetry (stored in ~/.skannr/config.json)'],
  ['--mcp', 'Run as Model Context Protocol stdio server (same as skannr-mcp)'],
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
