import { useState, useMemo, useRef } from 'react'
import { TopNav } from '@/components/TopNav'
import { BottomAction } from '@/components/BottomAction'
import { AdminModal, ModalField, ModalInput } from '@/components/AdminModal'
import { useToast } from '@/components/Toast'
import { useSopStore } from '@/stores/useSopStore'
import type { SopCategory } from '@/stores/useSopStore'
import { supabase } from '@/lib/supabase'
import { Plus, Search, ChevronUp, ChevronDown, Edit3, Trash2, Upload, X } from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

function getPublicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/sop-images/${path}`
}

export default function SopManager() {
  const { categories, addCategory, updateCategory, removeCategory, swapCategoryOrder } = useSopStore()
  const { showToast } = useToast()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SopCategory | null>(null)
  const [form, setForm] = useState({ name: '', image_url: '' })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<SopCategory | null>(null)

  // Filter categories by search (also search recipe names inside)
  const filtered = useMemo(() => {
    if (!search.trim()) return categories
    const q = search.trim().toLowerCase()
    return categories.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.recipes.some((r) => r.name.toLowerCase().includes(q))
    )
  }, [categories, search])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', image_url: '' })
    setImageFile(null)
    setImagePreview('')
    setModalOpen(true)
  }

  const openEdit = (cat: SopCategory) => {
    setEditing(cat)
    setForm({ name: cat.name, image_url: cat.image_url })
    setImageFile(null)
    setImagePreview(cat.image_url || '')
    setModalOpen(true)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('請選擇圖片檔案', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('圖片大小不可超過 5MB', 'error')
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview('')
    setForm({ ...form, image_url: '' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadImage = async (catId: string): Promise<string> => {
    if (!imageFile || !supabase) return form.image_url
    const ext = imageFile.name.split('.').pop() || 'jpg'
    const path = `categories/${catId}.${ext}`
    const { error } = await supabase.storage
      .from('sop-images')
      .upload(path, imageFile, { upsert: true, contentType: imageFile.type })
    if (error) throw error
    return getPublicUrl(path)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      showToast('請填寫分類名稱', 'error')
      return
    }
    setUploading(true)
    try {
      if (editing) {
        const imageUrl = imageFile ? await uploadImage(editing.id) : form.image_url
        updateCategory(editing.id, { name: form.name.trim(), image_url: imageUrl })
        showToast('分類已更新')
      } else {
        const newId = `cat_${Date.now()}`
        const maxSort = categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 0
        const imageUrl = imageFile ? await uploadImage(newId) : ''
        addCategory({
          id: newId,
          name: form.name.trim(),
          image_url: imageUrl,
          sort_order: maxSort,
          is_active: true,
        })
        showToast('分類已新增')
      }
      setModalOpen(false)
    } catch (err) {
      console.error('[SopManager] Upload failed:', err)
      showToast('圖片上傳失敗', 'error')
    } finally {
      setUploading(false)
    }
  }

  const confirmDelete = () => {
    if (deleteConfirm) {
      removeCategory(deleteConfirm.id)
      showToast('分類已刪除')
      setDeleteConfirm(null)
    }
  }

  return (
    <div className="page-container">
      <TopNav title="SOP 管理" backTo="/admin" />

      {/* Search */}
      <div className="px-4 pt-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-lotus" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋分類或配方名稱..."
            className="w-full h-10 pl-9 pr-3 rounded-input text-sm border border-gray-200 outline-none focus:border-brand-lotus"
            style={{ backgroundColor: 'var(--color-input-bg)' }}
          />
        </div>
      </div>

      {/* Category Grid */}
      <div className="px-4 py-3 grid grid-cols-2 gap-3">
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-12 text-sm text-brand-lotus">
            {search ? '找不到相符的分類或配方' : '尚無分類，點下方按鈕新增'}
          </div>
        )}
        {filtered.map((cat, idx) => (
          <div key={cat.id} className="card !p-0 overflow-hidden group relative">
            {/* Image or placeholder */}
            <button
              onClick={() => window.location.href = `/admin/sop/${cat.id}`}
              className="w-full text-left"
            >
              <div className="aspect-[4/3] bg-surface-section flex items-center justify-center overflow-hidden">
                {cat.image_url ? (
                  <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl opacity-30">📋</span>
                )}
              </div>
              <div className="px-3 py-2.5">
                <p className="text-sm font-semibold text-brand-oak truncate">{cat.name}</p>
                <p className="text-[11px] text-brand-lotus">{cat.recipes.length} 道配方</p>
              </div>
            </button>

            {/* Action buttons */}
            <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {idx > 0 && (
                <button
                  onClick={() => swapCategoryOrder(cat.id, filtered[idx - 1].id)}
                  className="p-1 rounded bg-white/90 shadow text-brand-lotus hover:text-brand-oak"
                >
                  <ChevronUp size={14} />
                </button>
              )}
              {idx < filtered.length - 1 && (
                <button
                  onClick={() => swapCategoryOrder(cat.id, filtered[idx + 1].id)}
                  className="p-1 rounded bg-white/90 shadow text-brand-lotus hover:text-brand-oak"
                >
                  <ChevronDown size={14} />
                </button>
              )}
              <button
                onClick={() => openEdit(cat)}
                className="p-1 rounded bg-white/90 shadow text-brand-lotus hover:text-brand-oak"
              >
                <Edit3 size={14} />
              </button>
              <button
                onClick={() => setDeleteConfirm(cat)}
                className="p-1 rounded bg-white/90 shadow text-status-danger/60 hover:text-status-danger"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <BottomAction label="新增分類" onClick={openAdd} icon={<Plus size={18} />} />

      {/* Add/Edit Modal */}
      <AdminModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '編輯分類' : '新增分類'} onSubmit={handleSubmit} submitting={uploading}>
        <ModalField label="分類名稱">
          <ModalInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="例：基礎物料" />
        </ModalField>
        <ModalField label="分類圖片（選填）">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          {imagePreview ? (
            <div className="relative rounded-card overflow-hidden border border-gray-100">
              <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover" />
              <button
                type="button"
                onClick={clearImage}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 text-white active:opacity-70"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-24 rounded-card border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-brand-lotus active:bg-gray-50"
            >
              <Upload size={20} />
              <span className="text-xs">點擊上傳圖片</span>
            </button>
          )}
        </ModalField>
      </AdminModal>

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-card p-6 mx-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-brand-oak mb-2">確認刪除</h3>
            <p className="text-sm text-brand-lotus mb-4">
              確定要刪除「{deleteConfirm.name}」嗎？該分類下的 {deleteConfirm.recipes.length} 道配方也會一併刪除。
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 !h-10">取消</button>
              <button onClick={confirmDelete} className="flex-1 h-10 rounded-btn text-white font-semibold text-sm bg-status-danger active:opacity-80">刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
