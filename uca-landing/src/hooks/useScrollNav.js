import { useState, useEffect } from 'react'

export function useScrollNav(threshold = 60) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > threshold)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [threshold])

  return scrolled
}
