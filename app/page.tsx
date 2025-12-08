'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  deleted: boolean
}

type TabType = 'todo' | 'done' | 'trash'

function ChecklistAppContent() {
  const searchParams = useSearchParams()
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('todo')
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(true)
  const [recentlyChecked, setRecentlyChecked] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [newItemText, setNewItemText] = useState('')

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

  // Check for ?new=true and clear localStorage if present
  useEffect(() => {
    const isNew = searchParams.get('new') === 'true'
    if (isNew) {
      localStorage.removeItem('checklist-items')
      setItems([])
      setShowImport(true)
      // Remove the query parameter from URL without reload
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [searchParams])

  // Load from localStorage on mount
  useEffect(() => {
    // Skip loading if ?new=true was present (already cleared above)
    if (searchParams.get('new') === 'true') {
      return
    }

    const saved = localStorage.getItem('checklist-items')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Migrate old items to include deleted property
          const migrated = parsed.map(item => ({
            ...item,
            deleted: item.deleted !== undefined ? item.deleted : false
          }))
          setItems(migrated)
          setShowImport(false)
        }
      } catch (e) {
        console.error('Failed to load from localStorage', e)
      }
    }
  }, [searchParams])

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
      deleted: false,
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

    // If checking an item in todo tab, show it crossed out briefly
    if (willBeCompleted && activeTab === 'todo') {
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
    setItems(items.map(item => 
      item.id === id ? { ...item, deleted: true } : item
    ))
  }

  const handleRestore = (id: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, deleted: false } : item
    ))
  }

  const handleTodoTabClick = () => {
    if (activeTab === 'todo') {
      setShowAddModal(true)
    } else {
      setActiveTab('todo')
    }
  }

  const handleAddItem = () => {
    if (newItemText.trim()) {
      const newItem: ChecklistItem = {
        id: `item-${Date.now()}`,
        text: newItemText.trim(),
        completed: false,
        deleted: false,
      }
      setItems([newItem, ...items])
      setNewItemText('')
      setShowAddModal(false)
    }
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
  // In todo tab, also show recently checked items so they appear crossed out
  const todoItems = items.filter(item => !item.deleted && (!item.completed || recentlyChecked.has(item.id)))
  const doneItems = items.filter(item => !item.deleted && item.completed)
  const trashItems = items.filter(item => item.deleted)

  const currentItems = activeTab === 'todo' ? todoItems : activeTab === 'done' ? doneItems : trashItems

  return (
    <div style={{ 
      minHeight: '100vh', 
      maxWidth: '600px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {showImport ? (
        <div style={{
          backgroundColor: '#1a1a1a',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          margin: '1rem',
          border: '1px solid #2a2a2a'
        }}>
          <h2 style={{ 
            fontSize: '1.25rem', 
            marginBottom: '1rem',
            fontWeight: '600',
            color: '#CCCCCC'
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
              border: '1px solid #2a2a2a',
              borderRadius: '4px',
              fontSize: '1rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              marginBottom: '1rem',
              backgroundColor: '#0f0f0f',
              color: '#CCCCCC',
              outline: 'none'
            }}
          />
          <button
            onClick={handleImport}
            disabled={!importText.trim()}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#2a2a2a',
              color: '#CCCCCC',
              border: '1px solid #3a3a3a',
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
            borderBottom: '2px solid #2a2a2a',
            position: 'sticky',
            top: 0,
            backgroundColor: '#0a0a0a',
            zIndex: 10,
            padding: '1rem 1rem 0.5rem 1rem',
            marginBottom: '1rem'
          }}>
            <button
              onClick={handleTodoTabClick}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '1rem',
                fontWeight: activeTab === 'todo' ? '600' : '400',
                color: activeTab === 'todo' ? '#CCCCCC' : '#4a4a4a',
                borderBottom: activeTab === 'todo' ? '2px solid #CCCCCC' : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: '-2px'
              }}
            >
              Todo ({todoItems.length})
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
                color: activeTab === 'done' ? '#CCCCCC' : '#4a4a4a',
                borderBottom: activeTab === 'done' ? '2px solid #CCCCCC' : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: '-2px'
              }}
            >
              Done ({doneItems.length})
            </button>
            <button
              onClick={() => setActiveTab('trash')}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '1rem',
                fontWeight: activeTab === 'trash' ? '600' : '400',
                color: activeTab === 'trash' ? '#CCCCCC' : '#4a4a4a',
                borderBottom: activeTab === 'trash' ? '2px solid #CCCCCC' : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: '-2px'
              }}
            >
              Trash ({trashItems.length})
            </button>
          </div>

          {/* Items List */}
          <div style={{ padding: '0 1rem 1rem 1rem', overflowY: 'auto' }}>
            {currentItems.length === 0 ? (
              <div style={{
                backgroundColor: '#1a1a1a',
                padding: '2rem',
                borderRadius: '8px',
                textAlign: 'center',
                color: '#4a4a4a',
                border: '1px solid #2a2a2a'
              }}>
                {activeTab === 'todo' ? 'No todo items' : activeTab === 'done' ? 'No completed items' : 'No deleted items'}
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
                        onRestore={handleRestore}
                        activeTab={activeTab}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Clear all button - only show in Trash tab */}
            {activeTab === 'trash' && trashItems.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Permanently delete all items in trash?')) {
                    setItems(items.filter(item => !item.deleted))
                  }
                }}
                style={{
                  marginTop: '1.5rem',
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#2a2a2a',
                  color: '#ff6b6b',
                  border: '1px solid #3a3a3a',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Clear All
              </button>
            )}
          </div>
        </>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false)
              setNewItemText('')
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#1a1a1a',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              border: '1px solid #2a2a2a',
              width: '100%',
              maxWidth: '400px'
            }}
          >
            <h2 style={{
              fontSize: '1.25rem',
              marginBottom: '1rem',
              fontWeight: '600',
              color: '#CCCCCC'
            }}>
              Add New Item
            </h2>
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddItem()
                } else if (e.key === 'Escape') {
                  setShowAddModal(false)
                  setNewItemText('')
                }
              }}
              placeholder="Enter item text..."
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #2a2a2a',
                borderRadius: '4px',
                fontSize: '1rem',
                fontFamily: 'inherit',
                backgroundColor: '#0f0f0f',
                color: '#CCCCCC',
                outline: 'none',
                marginBottom: '1rem'
              }}
            />
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewItemText('')
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#2a2a2a',
                  color: '#CCCCCC',
                  border: '1px solid #3a3a3a',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={!newItemText.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#2a2a2a',
                  color: '#CCCCCC',
                  border: '1px solid #3a3a3a',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: newItemText.trim() ? 'pointer' : 'not-allowed',
                  opacity: newItemText.trim() ? 1 : 0.5
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ChecklistApp() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', padding: '1rem', color: '#CCCCCC' }}>Loading...</div>}>
      <ChecklistAppContent />
    </Suspense>
  )
}

interface SortableItemProps {
  item: ChecklistItem
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  activeTab: TabType
}

function SortableItem({ item, onToggle, onDelete, onRestore, activeTab }: SortableItemProps) {
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
        backgroundColor: '#1a1a1a',
        padding: '1rem',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        border: '1px solid #2a2a2a',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}
    >
      {activeTab !== 'trash' && (
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
              pointerEvents: 'auto',
              accentColor: '#60a5fa'
            }}
          />
        </div>
      )}
      <span
        onClick={() => {
          if (activeTab === 'done') {
            onToggle(item.id)
          } else if (activeTab === 'trash') {
            onRestore(item.id)
          }
        }}
        style={{
          flex: 1,
          textDecoration: item.completed ? 'line-through' : 'none',
          color: item.completed ? '#4a4a4a' : '#CCCCCC',
          fontSize: '1rem',
          wordBreak: 'break-word',
          transition: 'text-decoration 0.2s ease, color 0.2s ease',
          cursor: (activeTab === 'done' || activeTab === 'trash') ? 'pointer' : 'default'
        }}
      >
        {item.text}
      </span>
      {activeTab === 'todo' && (
        <div
          {...attributes}
          {...listeners}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.25rem',
            cursor: 'grab',
            touchAction: 'none',
            flexShrink: 0,
            color: '#4a4a4a'
          }}
          aria-label="Drag to reorder"
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
            <circle cx="9" cy="12" r="1"></circle>
            <circle cx="9" cy="5" r="1"></circle>
            <circle cx="9" cy="19" r="1"></circle>
            <circle cx="15" cy="12" r="1"></circle>
            <circle cx="15" cy="5" r="1"></circle>
            <circle cx="15" cy="19" r="1"></circle>
          </svg>
        </div>
      )}
      {activeTab === 'trash' ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRestore(item.id)
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
            color: '#60a5fa'
          }}
          aria-label="Restore item"
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
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
            <path d="M21 3v5h-5"></path>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
            <path d="M3 21v-5h5"></path>
          </svg>
        </button>
      ) : (
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
            color: '#ff6b6b'
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
      )}
    </div>
  )
}

