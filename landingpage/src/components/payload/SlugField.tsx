'use client'

import { useEffect, useRef } from 'react'
import { useFormFields, useField, FieldLabel } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'
import './SlugField.scss'

const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const SlugField: TextFieldClientComponent = ({ field, path }) => {
  const { value, setValue } = useField<string>({ path })
  const title = useFormFields(([fields]) => fields.title?.value as string)

  // Track if slug was manually edited
  const isManualEdit = useRef(false)
  const prevTitleSlug = useRef<string>('')

  useEffect(() => {
    if (!title) return

    const newSlug = slugify(title)

    // Auto-update slug if:
    // 1. Slug is empty, OR
    // 2. Slug matches the previous auto-generated value (user hasn't manually edited)
    if (!value || (!isManualEdit.current && value === prevTitleSlug.current)) {
      setValue(newSlug)
      isManualEdit.current = false
    }

    prevTitleSlug.current = newSlug
  }, [title, value, setValue])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isManualEdit.current = true
    setValue(e.target.value)
  }

  const handleGenerate = () => {
    if (title) {
      setValue(slugify(title))
      isManualEdit.current = false
    }
  }

  const width = field.admin?.width

  return (
    <div
      className="field-type slug-field"
      style={width ? { '--field-width': width } as React.CSSProperties : undefined}
    >
      <FieldLabel label={field.label || 'Slug'} required={field.required} path={path} />
      <div className="slug-field__input-wrap">
        <input
          type="text"
          className="slug-field__input"
          value={value || ''}
          onChange={handleChange}
          id={`field-${path}`}
        />
        <button
          type="button"
          className="slug-field__button"
          onClick={handleGenerate}
          title="Auto-synced with title. Click to regenerate."
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </div>
    </div>
  )
}

