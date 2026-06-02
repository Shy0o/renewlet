import { copy, runtimeCards, text, type Locale, type RuntimeCard } from '../content/site'

type RuntimeSectionProps = {
  locale: Locale
}

function RuntimeCardView({ card, locale }: { card: RuntimeCard; locale: Locale }) {
  const Icon = card.icon

  return (
    <article
      className="col-span-full flex h-[480px] flex-col overflow-hidden rounded-2xl bg-zinc-900/50 ring-1 ring-zinc-100/10 lg:col-span-1"
      data-card={card.key}
    >
      <div className="relative flex h-full flex-col justify-between overflow-hidden p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.2),transparent_38%),linear-gradient(135deg,rgba(24,24,27,0.96),rgba(9,9,11,0.98))]" />
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-emerald-300/10" />
        <div className="absolute -right-8 top-20 h-32 w-32 rounded-full border border-white/10" />

        <div className="relative">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-emerald-300">
            <Icon aria-hidden="true" className="h-7 w-7" strokeWidth={1.4} />
          </div>
          <h3 className="text-2xl font-semibold text-zinc-100">{text(card.title, locale)}</h3>
          <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-400">{text(card.body, locale)}</p>
        </div>

        <ul className="relative grid gap-3">
          {card.details.map((detail) => (
            <li
              className="rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3 text-sm leading-6 text-zinc-300"
              key={text(detail, locale)}
            >
              {text(detail, locale)}
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

export function RuntimeSection({ locale }: RuntimeSectionProps) {
  const isChinese = locale === 'zh'

  return (
    <section className="mx-auto max-w-7xl p-6 py-16 md:py-24 lg:px-8" data-section="genius">
      <div className="grid max-w-4xl items-start justify-between gap-5">
        <div
          className={`text-[2rem]/[1.07] font-bold tracking-tight [text-wrap:balance] md:text-5xl/[1.07] ${isChinese ? 'lg:whitespace-nowrap' : ''}`}
        >
          <span className="bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
            {text(copy.runtimeHeading.title, locale)}
          </span>
        </div>
        <div className="text-lg text-zinc-400/80">
          {text(copy.runtimeHeading.body, locale)}{' '}
          <span className="text-zinc-200">{text(copy.runtimeHeading.highlight, locale)}</span>
        </div>
      </div>

      <div className="mt-16 grid gap-4 lg:grid-cols-2 lg:gap-6 xl:gap-8">
        {runtimeCards.map((card) => (
          <RuntimeCardView key={card.key} card={card} locale={locale} />
        ))}
      </div>
    </section>
  )
}
