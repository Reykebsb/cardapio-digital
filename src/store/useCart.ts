import { create } from 'zustand'

export interface CartItem {
  id: string
  nome: string
  preco: number
  quantidade: number
  observacao?: string
}

interface CartStore {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantidade'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantidade: number) => void
  clearCart: () => void
  getTotal: () => number
}

export const useCart = create<CartStore>((set, get) => ({
  items: [],
  addItem: (product) => {
    set((state) => {
      const existing = state.items.find((item) => item.id === product.id)
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.id === product.id
              ? { ...item, quantidade: item.quantidade + 1 }
              : item
          ),
        }
      }
      return { items: [...state.items, { ...product, quantidade: 1 }] }
    })
  },
  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }))
  },
  updateQuantity: (id, quantidade) => {
    set((state) => {
      if (quantidade <= 0) {
        return { items: state.items.filter((item) => item.id !== id) }
      }
      return {
        items: state.items.map((item) =>
          item.id === id ? { ...item, quantidade } : item
        ),
      }
    })
  },
  clearCart: () => set({ items: [] }),
  getTotal: () => {
    return get().items.reduce((acc, item) => acc + item.preco * item.quantidade, 0)
  },
}))