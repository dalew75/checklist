'use client'

import { useState, useEffect } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ChecklistItem {
  id: string
  text: string
  completed: boolean
}

type TabType = 'open' | 'done'

export default function ChecklistApp() {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('open')
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(true)
  const [recentlyChecked, setRecentlyChecked] = useState<Set<string>>(new Set())

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('checklist-items')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed)
          setShowImport(false)
        }
      } catch (e) {
        console.error('Failed to load from localStorage', e)
      }
    }
  }, [])

  // Save to localStorage whenever items change
  useEffect(() => {
    if (items.length > 0 || localStorage.getItem('checklist-items')) {
      localStorage.setItem('checklist-items', JSON.stringify(items))
    }
  }, [items])

  const handleImport = () => {
    const lines = importText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
    
    if (lines.length === 0) return

    const newItems: ChecklistItem[] = lines.map((line, index) => ({
      id: `item-${Date.now()}-${index}`,
      text: line,
      completed: false,
    }))

    setItems(newItems)
    setImportText('')
    setShowImport(false)
  }

  const handleToggle = (id: string) => {
    const item = items.find(i => i.id === id)
    const willBeCompleted = !item?.completed
    
    setItems(items.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ))

    // If checking an item in open tab, show it crossed out briefly
    if (willBeCompleted && activeTab === 'open') {
      setRecentlyChecked(prev => new Set(prev).add(id))
      setTimeout(() => {
        setRecentlyChecked(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, 300)
    }
  }

  const handleDelete = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id)
        const newIndex = items.findIndex(item => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  // Show items in their respective tabs
  // In open tab, also show recently checked items so they appear crossed out
  const openItems = items.filter(item => !item.completed || recentlyChecked.has(item.id))
  const doneItems = items.filter(item => item.completed)

  const currentItems = activeTab === 'open' ? openItems : doneItems

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '0 1rem 1rem 1rem',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      {showImport ? (
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          marginBottom: '1rem'
        }}>
          <h2 style={{ 
            fontSize: '1.25rem', 
            marginBottom: '1rem',
            fontWeight: '600'
          }}>
            Import Your List
          </h2>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste your list here, one item per line..."
            style={{
              width: '100%',
              minHeight: '200px',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              marginBottom: '1rem'
            }}
          />
          <button
            onClick={handleImport}
            disabled={!importText.trim()}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: importText.trim() ? 'pointer' : 'not-allowed',
              opacity: importText.trim() ? 1 : 0.5
            }}
          >
            Import List
          </button>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1rem',
            borderBottom: '2px solid #e0e0e0'
          }}>
            <button
              onClick={() => setActiveTab('open')}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '1rem',
                fontWeight: activeTab === 'open' ? '600' : '400',
                color: activeTab === 'open' ? '#0070f3' : '#666',
                borderBottom: activeTab === 'open' ? '2px solid #0070f3' : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: '-2px'
              }}
            >
              Open ({openItems.length})
            </button>
            <button
              onClick={() => setActiveTab('done')}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '1rem',
                fontWeight: activeTab === 'done' ? '600' : '400',
                color: activeTab === 'done' ? '#0070f3' : '#666',
                borderBottom: activeTab === 'done' ? '2px solid #0070f3' : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: '-2px'
              }}
            >
              Done ({doneItems.length})
            </button>
          </div>

          {/* Items List */}
          {currentItems.length === 0 ? (
            <div style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#666'
            }}>
              {activeTab === 'open' ? 'No open items' : 'No completed items'}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={currentItems.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {currentItems.map((item) => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      activeTab={activeTab}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Clear all button */}
          {items.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Clear all items?')) {
                  setItems([])
                  setShowImport(true)
                  localStorage.removeItem('checklist-items')
                }
              }}
              style={{
                marginTop: '1.5rem',
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Clear All
            </button>
          )}
        </>
      )}
    </div>
  )
}

interface SortableItemProps {
  item: ChecklistItem
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  activeTab: TabType
}

function SortableItem({ item, onToggle, onDelete, activeTab }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: 'white',
        padding: '1rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        cursor: activeTab === 'open' ? 'grab' : 'pointer',
        touchAction: activeTab === 'open' ? 'none' : 'auto'
      }}
      {...(activeTab === 'open' ? { ...attributes, ...listeners } : {})}
    >
      <div
        onClick={(e) => {
          e.stopPropagation()
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
        }}
        style={{ flexShrink: 0 }}
      >
        <input
          type="checkbox"
          checked={item.completed}
          onChange={(e) => {
            e.stopPropagation()
            onToggle(item.id)
          }}
          onClick={(e) => {
            e.stopPropagation()
          }}
          style={{
            width: '20px',
            height: '20px',
            cursor: 'pointer',
            pointerEvents: 'auto'
          }}
        />
      </div>
      <span
        onClick={() => activeTab === 'done' && onToggle(item.id)}
        style={{
          flex: 1,
          textDecoration: item.completed ? 'line-through' : 'none',
          color: item.completed ? '#999' : '#333',
          fontSize: '1rem',
          wordBreak: 'break-word',
          transition: 'text-decoration 0.2s ease, color 0.2s ease'
        }}
      >
        {item.text}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(item.id)
        }}
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#ff4444'
        }}
        aria-label="Delete item"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
    </div>
  )
}

