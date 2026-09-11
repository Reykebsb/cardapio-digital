import { useEffect } from 'react'

export function ThemeProvider({ corPrimaria }: { corPrimaria: string }) {
  useEffect(() => {
    document.documentElement.style.setProperty('--color-brand', corPrimaria)
  }, [corPrimaria])

  return null
}