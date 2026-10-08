'use client';

import React, { useState, useMemo } from 'react';
import { getYouTubeThumbnail } from '@/lib/youtube';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, Pencil, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, Save, X, Check, AlertCircle } from 'lucide-react';
import Image from 'next/image';

interface SortableItem {
  id: string;
  title: string;
  image?: string | null;
  youtubeUrl?: string | null;
  active?: boolean;
}

export type { SortableItem };

interface SortableListProps {
  items: SortableItem[];
  onReorder: (items: SortableItem[]) => Promise<{ success: boolean; error?: string } | void> | void;
  onEdit: (item: SortableItem) => void;
  onDelete: (item: SortableItem) => void;
  onToggle?: (id: string, currentStatus: boolean) => void;
  isRtl?: boolean;
  showThumbnail?: boolean;
}

export default function SortableList({ items, onReorder, onEdit, onDelete, onToggle, isRtl, showThumbnail = true }: SortableListProps) {
  const [localItems, setLocalItems] = useState(items);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const itemsSignature = useMemo(
    () => items.map(i => `${i.id}:${i.active ? 1 : 0}`).join(','),
    [items],
  );

  // Pick up fresh server items unless the user has unsaved reordering (adjusted during render, not in an effect)
  const syncKey = `${itemsSignature}|${isDirty}`;
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey);
  if (prevSyncKey !== syncKey) {
    setPrevSyncKey(syncKey);
    if (!isDirty) setLocalItems(items);
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;

    const newItems = Array.from(localItems);
    const [reorderedItem] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, reorderedItem);

    setLocalItems(newItems);
    setIsDirty(true);
    setSaveStatus('idle');
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= localItems.length) return;
    const newItems = Array.from(localItems);
    [newItems[index], newItems[target]] = [newItems[target], newItems[index]];
    setLocalItems(newItems);
    setIsDirty(true);
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const result = await onReorder(localItems);
      if (result && result.success === false) {
        setSaveStatus('error');
        setErrorMsg(result.error || 'Save failed');
      } else {
        setSaveStatus('saved');
        setIsDirty(false);
        setTimeout(() => setSaveStatus('idle'), 2500);
      }
    } catch (e) {
      setSaveStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setLocalItems(items);
    setIsDirty(false);
    setSaveStatus('idle');
    setErrorMsg(null);
  };

  return (
    <div>
    {/* Save / Status Bar */}
    <div className={`mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 transition-all ${
      isDirty ? 'border-yellow-500/30 bg-yellow-500/5' :
      saveStatus === 'saved' ? 'border-green-500/30 bg-green-500/5' :
      saveStatus === 'error' ? 'border-red-500/30 bg-red-500/5' :
      'border-zinc-900 bg-zinc-950/50'
    }`}>
      <div className="flex items-center gap-2 text-sm">
        {saveStatus === 'saved' && <><Check size={16} className="text-green-500" /><span className="text-green-400">{isRtl ? 'ذخیره شد' : 'Saved'}</span></>}
        {saveStatus === 'error' && <><AlertCircle size={16} className="text-red-500" /><span className="text-red-400">{errorMsg || (isRtl ? 'خطا در ذخیره' : 'Save failed')}</span></>}
        {saveStatus === 'idle' && isDirty && <span className="text-yellow-400">{isRtl ? 'تغییرات ذخیره نشده' : 'Unsaved changes'}</span>}
        {saveStatus === 'idle' && !isDirty && <span className="text-zinc-500">{isRtl ? 'برای تغییر ترتیب بکشید یا از فلش‌ها استفاده کنید' : 'Drag or use arrows to reorder'}</span>}
      </div>
      <div className="flex items-center gap-2">
        {isDirty && (
          <button
            onClick={handleDiscard}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:border-zinc-500 hover:text-white disabled:opacity-50"
          >
            <X size={16} />
            {isRtl ? 'لغو' : 'Discard'}
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          <Save size={16} />
          {isSaving ? (isRtl ? 'در حال ذخیره...' : 'Saving...') : (isRtl ? 'ذخیره ترتیب' : 'Save Order')}
        </button>
      </div>
    </div>

    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="sortable-list">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
            {localItems.map((item, index) => (
              <Draggable key={item.id} draggableId={item.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`group flex items-center gap-3 rounded-xl border bg-zinc-950/60 p-3 transition-all ${
                      snapshot.isDragging
                        ? 'border-blue-500 bg-zinc-900 shadow-2xl shadow-blue-600/20 z-50 scale-[1.01]'
                        : 'border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/60'
                    }`}
                  >
                    <div
                      {...provided.dragHandleProps}
                      className="text-zinc-700 hover:text-zinc-400 cursor-grab active:cursor-grabbing transition-colors"
                    >
                      <GripVertical size={18} />
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveItem(index, -1)}
                        disabled={index === 0}
                        className="rounded p-0.5 text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-zinc-600"
                        aria-label="Move up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(index, 1)}
                        disabled={index === localItems.length - 1}
                        className="rounded p-0.5 text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-zinc-600"
                        aria-label="Move down"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>

                    {/* Thumbnail Logic */}
                    {showThumbnail && (() => {
                      const mediaUrl = item.image || getYouTubeThumbnail(item.youtubeUrl);
                      const isVideo = mediaUrl?.toLowerCase().includes('.mp4') || mediaUrl?.toLowerCase().includes('.webm');

                      return (
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800">
                          {isVideo ? (
                            <video
                              src={mediaUrl!}
                              className="h-full w-full object-cover"
                              muted
                              playsInline
                            />
                          ) : mediaUrl ? (
                            <Image
                              src={mediaUrl}
                              alt={item.title || 'Thumbnail'}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-zinc-700">
                              {/* Fallback empty state */}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-semibold text-white">{item.title}</h4>
                      {item.active === false && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          <EyeOff size={10} />
                          Hidden
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                      {onToggle && (
                        <button
                          type="button"
                          onClick={() => onToggle(item.id, item.active ?? false)}
                          aria-label={item.active ? 'Hide item' : 'Show item'}
                          title={item.active ? 'Hide' : 'Show'}
                          className={`rounded-lg p-2 transition-colors ${
                            item.active
                              ? 'text-blue-500 hover:bg-blue-500/10'
                              : 'text-zinc-600 hover:bg-zinc-900 hover:text-zinc-300'
                          }`}
                        >
                          {item.active ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        aria-label="Edit item"
                        title="Edit"
                        className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        aria-label="Delete item"
                        title="Delete"
                        className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
    </div>
  );
}
