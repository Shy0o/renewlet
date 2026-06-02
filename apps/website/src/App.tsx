import { useState } from 'react'

import { CallToAction } from './components/CallToAction'
import { FeatureGrid } from './components/FeatureGrid'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Intro } from './components/Intro'
import { RuntimeSection } from './components/RuntimeSection'
import { DeployDialog } from './features/deploy/DeployDialog'
import type { Locale } from './content/site'

function App() {
  const [deployOpen, setDeployOpen] = useState(false)
  const [locale, setLocale] = useState<Locale>('zh')

  function openDeployDialog() {
    setDeployOpen(true)
  }

  return (
    <>
      <div className="overflow-clip">
        <Header locale={locale} onLocaleChange={setLocale} />
        <main>
          <Hero locale={locale} onDeployClick={openDeployDialog} />
          <Intro locale={locale} />
          <FeatureGrid locale={locale} />
          <RuntimeSection locale={locale} />
          <CallToAction locale={locale} onDeployClick={openDeployDialog} />
        </main>
        <Footer locale={locale} />
      </div>
      <DeployDialog locale={locale} onOpenChange={setDeployOpen} open={deployOpen} />
    </>
  )
}

export default App
