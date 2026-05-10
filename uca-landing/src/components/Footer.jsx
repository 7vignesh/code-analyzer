import Reveal from './Reveal'

export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 px-5">
      <Reveal>
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 md:grid-cols-3">
          <div>
            <p className="font-mono text-lg">Universal Code Analyzer</p>
            <p className="mt-1 text-[#888]">Open-source · MIT License</p>
          </div>

          <p className="text-[#888] md:text-center">
            Built by Vignesh <span className="text-accent">♥</span>
          </p>

          <div className="flex gap-5 md:justify-self-end">
            <a
              href="https://github.com/7vignesh/code-analyzer"
              className="text-[#888] transition-colors hover:text-accent"
            >
              GitHub
            </a>
            <a
              href="https://npmjs.com/package/universal-code-analyzer"
              className="text-[#888] transition-colors hover:text-accent"
            >
              npm
            </a>
          </div>
        </div>
      </Reveal>
    </footer>
  )
}
