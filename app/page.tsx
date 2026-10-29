'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { applyOp, ChecklistItem, ListOp } from '@/lib/listOps'

type TabType = 'todo' | 'done' | 'trash'

const LIST_ID_KEY = 'checklist-list-id'
const LEGACY_ITEMS_KEY = 'checklist-items'
const isListId = (id: string | null | undefined): id is string => !!id && /^[a-z0-9]{8,40}$/.test(id)

// crypto.randomUUID needs a secure context, which a plain-http LAN address isn't
function newListId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, b => (b % 36).toString(36)).join('')
}

function ChecklistAppContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [listId, setListId] = useState<string | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('todo')
  const [importText, setImportText] = useState('')
  const [recentlyChecked, setRecentlyChecked] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [newItemText, setNewItemText] = useState('')
  const [lanUrl, setLanUrl] = useState<string | null>(null)

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

  // Fetch the server's LAN IP so the page can be opened on a phone
  useEffect(() => {
    fetch('/api/lan-ip')
      .then(res => res.json())
      .then(({ ips }: { ips: string[] }) => {
        if (ips.length > 0) {
          const port = window.location.port ? `:${window.location.port}` : ''
          setLanUrl(`http://${ips[0]}${port}`)
        }
      })
      .catch(() => {})
  }, [])

  // Pick the list: ?list= in the URL, else the last one used, else a new one.
  // ?new=true always starts a new list (the old one stays on the server).
  useEffect(() => {
    const fromUrl = searchParams?.get('list')
    const isNew = searchParams?.get('new') === 'true'

    let id: string | null = null
    if (isNew) {
      localStorage.removeItem(LEGACY_ITEMS_KEY)
    } else if (isListId(fromUrl)) {
      id = fromUrl
    } else {
      const last = localStorage.getItem(LIST_ID_KEY)
      if (isListId(last)) id = last
    }
    if (!id) id = newListId()

    localStorage.setItem(LIST_ID_KEY, id)
    if (fromUrl !== id || isNew) {
      router.replace(`/?list=${id}`)
    }
    setListId(id)
  }, [searchParams, router])

  // Live updates: the server sends the whole list on connect and after every change
  useEffect(() => {
    if (!listId) return
    setLoaded(false)
    const source = new EventSource(`/api/lists/${listId}/events`)
    source.onmessage = (event) => {
      setItems(JSON.parse(event.data))
      setLoaded(true)
    }
    return () => source.close()
  }, [listId])

  // Apply a change locally right away, then send it to the server,
  // which saves it and broadcasts the result to every open browser
  const dispatch = (op: ListOp) => {
    setItems(prev => applyOp(prev, op))
    fetch(`/api/lists/${listId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op }),
    }).catch(e => console.error('Failed to save change', e))
  }

  // One-time migration of a list saved by the old localStorage-only version
  useEffect(() => {
    if (!loaded || items.length > 0) return
    const saved = localStorage.getItem(LEGACY_ITEMS_KEY)
    if (!saved) return
    localStorage.removeItem(LEGACY_ITEMS_KEY)
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        dispatch({
          type: 'import',
          items: parsed.map(item => ({
            id: String(item.id),
            text: String(item.text),
            completed: !!item.completed,
            deleted: !!item.deleted,
          })),
        })
      }
    } catch (e) {
      console.error('Failed to migrate saved list', e)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  const showImport = loaded && items.length === 0

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

    dispatch({ type: 'import', items: newItems })
    setImportText('')
  }

  const handleToggle = (id: string) => {
    const item = items.find(i => i.id === id)
    const willBeCompleted = !item?.completed

    dispatch({ type: 'toggle', id })

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
    dispatch({ type: 'delete', id })
  }

  const handleRestore = (id: string) => {
    dispatch({ type: 'restore', id })
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
      dispatch({
        type: 'add',
        item: {
          id: `item-${Date.now()}`,
          text: newItemText.trim(),
          completed: false,
          deleted: false,
        },
      })
      setNewItemText('')
      setShowAddModal(false)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      dispatch({ type: 'move', activeId: String(active.id), overId: String(over.id) })
    }
  }

  // Show items in their respective tabs
  // In todo tab, also show recently checked items so they appear crossed out
  const todoItems = items.filter(item => !item.deleted && (!item.completed || recentlyChecked.has(item.id)))
  const doneItems = items.filter(item => !item.deleted && item.completed)
  const trashItems = items.filter(item => item.deleted)

  const currentItems = activeTab === 'todo' ? todoItems : activeTab === 'done' ? doneItems : trashItems

  // Includes the list id, so the phone opens this same list
  const phoneUrl = lanUrl && listId ? `${lanUrl}/?list=${listId}` : null

  return (
    <div style={{ 
      minHeight: '100vh', 
      maxWidth: '600px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* LAN link for opening on phone */}
      {phoneUrl && (
        <div style={{
          padding: '0.5rem 1rem 0 1rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: '#4a4a4a',
          wordBreak: 'break-all'
        }}>
          Phone link:{' '}
          <a href={phoneUrl} style={{ color: '#60a5fa' }}>
            {phoneUrl}
          </a>
        </div>
      )}

      {!loaded ? (
        <div style={{ padding: '1rem', color: '#4a4a4a' }}>Loading...</div>
      ) : showImport ? (
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
                    dispatch({ type: 'clearTrash' })
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

