import { AppWindow, Clock, GitBranch } from 'lucide-react'
import Reveal from './Reveal'

const cards = [
  {
    icon: AppWindow,
    title: 'Context window limits',
    body: "Large repos have hundreds of files. You can't paste them all. The AI only sees what you show it - and guesses the rest.",
  },
  {
    icon: Clock,
    title: 'One file at a time is slow',
    body: "You manually hunt for relevant files, paste them one by one, and re-explain the architecture every session. It's exhausting.",
  },
  {
    icon: GitBranch,
    title: 'No structural awareness',
    body: "Keyword search finds files that mention your term. It doesn't find the files that ARE the answer architecturally - the central import hubs and interfaces.",
  },
]

export default function Problem() {
  return (
    <section className="py-24 px-5">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <h2 className="text-3xl md:text-5xl font-bold text-center tracking-tight">
            AI is brilliant. But it can't read your whole codebase.
          </h2>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
          {cards.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 100} className="h-full">
              <article className="group h-full rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/20 hover:bg-card-hover hover:shadow-[0_20px_40px_-24px_rgba(0,0,0,0.8)]">
                <Icon
                  className="mb-5 text-accent transition-transform duration-300 group-hover:scale-110 group-hover:text-accent"
                  size={24}
                />
                <h3 className="mb-2 text-xl font-semibold">{title}</h3>
                <p className="text-[#888]">{body}</p>
              </article>
            </Reveal>
          ))}
        </div>
        <Reveal delay={200}>
          <p className="mt-10 text-center text-[#888]">Skannr fixes all three.</p>
        </Reveal>
      </div>
    </section>
  )
}
