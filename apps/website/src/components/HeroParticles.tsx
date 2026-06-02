import Particles from '@tsparticles/react'

const particlesOptions = {
  particles: {
    number: { value: 150, density: { enable: true } },
    color: { value: '#ffffff' },
    shape: { type: 'circle' },
    opacity: { value: { min: 0.2, max: 0.4 } },
    size: { value: { min: 1, max: 2 } },
    move: {
      enable: true,
      speed: { min: 0.35, max: 0.75 },
      direction: 'top' as const,
      random: true,
      straight: true,
      outModes: { default: 'out' as const },
    },
  },
  retina_detect: true,
}

export function HeroParticles() {
  return (
    <Particles
      className="pointer-events-none absolute -top-36 left-1/2 h-[32rem] w-full -translate-x-1/2 -translate-y-1/2 overflow-hidden lg:w-[60rem]"
      id="tsparticles"
      options={particlesOptions}
    />
  )
}
