import { useState, useEffect } from 'react'
import { ChevronUp } from 'lucide-react'

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const mainContainer = document.querySelector('main')
    if (!mainContainer) return

    const handleScroll = () => {
      setVisible(mainContainer.scrollTop > 300)
    }

    mainContainer.addEventListener('scroll', handleScroll)
    return () => mainContainer.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    const mainContainer = document.querySelector('main')
    if (mainContainer) {
      mainContainer.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (!visible) return null

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-slate-700 hover:bg-slate-800 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
      title="맨 위로"
    >
      <ChevronUp size={24} />
    </button>
  )
}
