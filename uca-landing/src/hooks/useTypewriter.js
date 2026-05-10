import { useState, useEffect } from 'react'

export function useTypewriter(lines, charDelay = 25, lineDelay = 350) {
  const [displayed, setDisplayed] = useState([])
  const [currentLine, setCurrentLine] = useState(0)
  const [currentChar, setCurrentChar] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed([])
    setCurrentLine(0)
    setCurrentChar(0)
    setDone(false)
  }, [lines])

  useEffect(() => {
    if (currentLine >= lines.length) {
      setDone(true)
      return
    }
    if (currentChar < lines[currentLine].length) {
      const t = setTimeout(() => {
        setDisplayed((prev) => {
          const next = [...prev]
          if (!next[currentLine]) next[currentLine] = ''
          next[currentLine] = lines[currentLine].slice(0, currentChar + 1)
          return next
        })
        setCurrentChar((c) => c + 1)
      }, charDelay)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      setCurrentLine((l) => l + 1)
      setCurrentChar(0)
    }, lineDelay)
    return () => clearTimeout(t)
  }, [currentLine, currentChar, lines, charDelay, lineDelay])

  return { displayed, done }
}
