import { copy, text, type Locale } from '../content/site'

type IntroProps = {
  locale: Locale
}

export function Intro({ locale }: IntroProps) {
  return (
    <section
      className="mx-auto max-w-7xl p-6 py-16 md:py-24 lg:px-8"
      data-section="intro"
      id="intro"
    >
      <div className="grid items-start justify-between gap-5 md:grid-cols-2">
        <div className="pr-8 text-[2rem]/[1.07] font-bold tracking-tight md:pr-16 md:text-5xl/[1.07]">
          <span className="bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
            {text(copy.intro.title, locale)}
          </span>
        </div>
        <div className="text-lg text-zinc-400/80">
          {text(copy.intro.body, locale)}{' '}
          <span className="text-zinc-200">{text(copy.intro.highlight, locale)}</span>
        </div>
      </div>
    </section>
  )
}
