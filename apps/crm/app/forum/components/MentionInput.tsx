'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Person = {
  id: string
  first_name: string | null
  last_name: string | null
  role: string
}

type MentionInputProps = {
  value: string
  onChange: (value: string) => void
  onMentionsChange: (mentionedIds: string[]) => void
  placeholder?: string
  autoFocus?: boolean
  minRows?: number
}

export default function MentionInput({
  value,
  onChange,
  onMentionsChange,
  placeholder = 'Write something...',
  autoFocus = false,
  minRows = 3,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<Person[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Track mentioned person IDs
  const extractMentionIds = useCallback((text: string, people: Person[]) => {
    const mentionPattern = /@(\w+(?:\s\w+)?)/g
    const ids: string[] = []
    let match
    while ((match = mentionPattern.exec(text)) !== null) {
      const name = match[1].toLowerCase()
      const person = people.find(p => {
        const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ').toLowerCase()
        return fullName === name || p.first_name?.toLowerCase() === name
      })
      if (person) ids.push(person.id)
    }
    return ids
  }, [])

  // Search for people when mention query changes
  useEffect(() => {
    if (!mentionQuery || mentionQuery.length < 1) {
      setSuggestions([])
      return
    }

    const search = async () => {
      const { data } = await supabase
        .from('saif_people')
        .select('id, first_name, last_name, role')
        .or(`role.eq.partner,role.eq.founder`)
        .or(`first_name.ilike.%${mentionQuery}%,last_name.ilike.%${mentionQuery}%`)
        .limit(8)

      if (data) {
        setSuggestions(data)
        setSelectedIndex(0)
      }
    }

    search()
  }, [mentionQuery, supabase])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart

    onChange(newValue)

    // Check if we're in a mention context
    const textBeforeCursor = newValue.slice(0, cursorPos)
    const atIndex = textBeforeCursor.lastIndexOf('@')

    if (atIndex >= 0) {
      const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' '
      const textAfterAt = textBeforeCursor.slice(atIndex + 1)

      // Only trigger if @ is at start or preceded by whitespace, and no spaces in query yet
      if ((charBefore === ' ' || charBefore === '\n' || atIndex === 0) && !textAfterAt.includes('\n')) {
        setMentionStart(atIndex)
        setMentionQuery(textAfterAt)
        setShowSuggestions(true)
        return
      }
    }

    setShowSuggestions(false)
    setMentionQuery('')
  }

  const insertMention = (person: Person) => {
    const name = [person.first_name, person.last_name].filter(Boolean).join(' ')
    const before = value.slice(0, mentionStart)
    const after = value.slice(mentionStart + mentionQuery.length + 1) // +1 for @
    const newValue = `${before}@${name} ${after}`

    onChange(newValue)
    setShowSuggestions(false)
    setMentionQuery('')

    // Update mentioned IDs
    // We need to re-extract from the full text since we may have multiple mentions
    const allPeople = [...suggestions]
    const ids = extractMentionIds(newValue, allPeople)
    if (!ids.includes(person.id)) ids.push(person.id)
    onMentionsChange(ids)

    // Focus back on textarea
    setTimeout(() => {
      textareaRef.current?.focus()
      const pos = mentionStart + name.length + 2 // @name + space
      textareaRef.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      insertMention(suggestions[selectedIndex])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={minRows}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
      />

      {/* Mention suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute left-0 bottom-full mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
        >
          {suggestions.map((person, index) => {
            const name = [person.first_name, person.last_name].filter(Boolean).join(' ')
            return (
              <button
                key={person.id}
                onClick={() => insertMention(person)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                  index === selectedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                  {person.first_name?.charAt(0) || '?'}
                </div>
                <span className="truncate">{name}</span>
                <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                  {person.role}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
