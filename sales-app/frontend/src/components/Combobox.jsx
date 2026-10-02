import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Combobox - 키보드 네비게이션 지원 드롭다운 + 직접 입력
 *
 * @param {string} value - 현재 값
 * @param {function} onChange - 값 변경 핸들러
 * @param {array} options - 드롭다운 옵션 배열
 * @param {string} placeholder - 플레이스홀더 텍스트
 * @param {string} className - 추가 CSS 클래스
 * @param {boolean} required - 필수 입력 여부
 */
export default function Combobox({ value, onChange, options = [], placeholder = '', className = '', required = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [inputValue, setInputValue] = useState(value || '')
  const [originalValue, setOriginalValue] = useState(value || '') // 원래 값 저장
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // value prop이 변경되면 inputValue 동기화
  useEffect(() => {
    setInputValue(value || '')
    setOriginalValue(value || '')
  }, [value])

  // 입력값에 따라 옵션 필터링
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes((inputValue || '').toLowerCase())
  )

  const handleInputChange = (e) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)
    setIsOpen(true)
    setHighlightedIndex(-1)
  }

  const handleOptionSelect = (option) => {
    setInputValue(option)
    onChange(option)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        setHighlightedIndex(0)
      } else {
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        )
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (isOpen) {
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0))
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleOptionSelect(filteredOptions[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
      setHighlightedIndex(-1)
    }
  }

  const handleFocus = () => {
    setIsOpen(true)
  }

  const handleClick = (e) => {
    // 클릭 시 텍스트 전체 선택하고 드롭다운 열기
    e.target.select()
    setOriginalValue(inputValue)
    setIsOpen(true)
    setHighlightedIndex(-1)
  }

  const handleBlur = (e) => {
    // listRef 내부 클릭은 무시
    if (listRef.current && listRef.current.contains(e.relatedTarget)) {
      return
    }
    setTimeout(() => {
      // 드롭다운이 열려있고 입력값이 비어있으면 원래 값으로 복원
      if (isOpen && !inputValue && originalValue) {
        setInputValue(originalValue)
      }
      setIsOpen(false)
      setHighlightedIndex(-1)
    }, 150)
  }

  const handleChevronClick = () => {
    if (isOpen) {
      setIsOpen(false)
      // 입력값이 비어있으면 원래 값으로 복원
      if (!inputValue && originalValue) {
        setInputValue(originalValue)
      }
    } else {
      // 드롭다운 열 때 원래 값 저장하고 입력값을 임시로 비워서 모든 옵션 표시
      setOriginalValue(inputValue)
      setInputValue('')
      setIsOpen(true)
      setHighlightedIndex(0)
      inputRef.current?.focus()
    }
  }

  // 하이라이트된 항목이 보이도록 스크롤
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex]
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, isOpen])

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onClick={handleClick}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          className={`w-full px-3 py-2 pr-8 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${className}`}
        />
        <button
          type="button"
          onClick={handleChevronClick}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          tabIndex={-1}>
          <ChevronDown size={18} />
        </button>
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredOptions.map((option, index) => (
            <li
              key={option}
              onMouseDown={(e) => {
                e.preventDefault()
                handleOptionSelect(option)
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-3 py-2 cursor-pointer text-sm ${
                index === highlightedIndex
                  ? 'bg-green-100 text-green-900'
                  : 'hover:bg-slate-50'
              }`}>
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
