import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Clock,
  CheckCircle2,
  Bike,
  ChefHat,
  Phone,
  MapPin,
  RefreshCw,
  MessageCircle,
  LayoutDashboard,
  ListOrdered,
  UtensilsCrossed,
  Settings,
  LogOut,
  ExternalLink,
  BarChart3,
} from 'lucide-react'

export const Route = createFileRoute('/admin/$slug')({
  component: AdminPage,
})

interface PedidoItem {
  id: string
  produto_nome: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  adicionais?: string | null
}

interface Pedido {
  id: string
  cliente_nome: string
  cliente_telefone: string
  cliente_endereco: string
  tipo_entrega: string
  forma_pagamento: string
  subtotal: number
  taxa_entrega: number
  total: number
  observacoes?: string | null
  status: 'pendente' | 'preparo' | 'saiu_entrega' | 'concluido' | 'cancelado'
  created_at: string
  pedido_itens: PedidoItem[]
}

type TabType = 'dashboard' | 'pedidos' | 'cardapio' | 'configuracoes'

// ═══════════════════════════════════════════════
// COMPONENTES AUXILIARES
// ═══════════════════════════════════════════════

interface MenuButtonProps {
  icon: React.ElementType
  label: string
  isActive: boolean
  onClick: () => void
  cor: string
  badge?: number
}

function MenuButton({ icon: Icon, label, isActive, onClick, cor, badge }: MenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all"
      style={isActive ? { backgroundColor: `${cor}15`, color: cor } : { color: '#a3a3a3' }}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5" />
        {label}
      </div>
      {badge !== undefined && (
        <span
          className="px-2 py-0.5 rounded-md text-[10px] font-black"
          style={{ backgroundColor: cor, color: '#000' }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

interface KPICardProps {
  title: string
  value: string
  subtitle: string
  icon: React.ElementType
  color: string
  bg: string
}

function KPICard({ title, value, subtitle, icon: Icon, color, bg }: KPICardProps) {
  return (
    <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 flex flex-col justify-between hover:border-white/10 transition-colors">
      <div className="flex items-center justify-between text-neutral-400 mb-4">
        <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
        <div className={`p-2.5 rounded-xl ${bg} ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-black text-white tracking-tight">{value}</p>
        <p className="text-[11px] text-neutral-500 mt-1 font-medium uppercase tracking-wider">{subtitle}</p>
      </div>
    </div>
  )
}

function BadgeStatus({ status }: { status: string }) {
  const configs: Record<string, { label: string; color: string; bg: string }> = {
    pendente: { label: '🟡 Pendente', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    preparo: { label: '🟠 Em Preparo', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
    saiu_entrega: { label: '🛵 Em Entrega', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    concluido: { label: '🟢 Concluído', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    cancelado: { label: '🔴 Cancelado', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
  }
  const conf = configs[status]
  if (!conf) return null
  return (
    <span
      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${conf.bg} ${conf.color}`}
    >
      {conf.label}
    </span>
  )
}

interface AcoesPedidoProps {
  status: string
  onMudarStatus: (s: string) => void
  cor: string
}

function AcoesPedido({ status, onMudarStatus, cor }: AcoesPedidoProps) {
  if (status === 'pendente') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onMudarStatus('preparo')}
          className="py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition hover:opacity-90 shadow-lg shadow-amber-500/10"
          style={{ backgroundColor: cor, color: '#000' }}
        >
          <ChefHat className="w-4 h-4" /> Aceitar Pedido
        </button>
        <button
          onClick={() => onMudarStatus('cancelado')}
          className="py-3 rounded-xl bg-[#1f1f1f] hover:bg-rose-500/10 text-neutral-300 hover:text-rose-400 font-bold text-xs transition border border-white/5 hover:border-rose-500/20"
        >
          Recusar
        </button>
      </div>
    )
  }
  if (status === 'preparo') {
    return (
      <button
        onClick={() => onMudarStatus('saiu_entrega')}
        className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-blue-500/20"
      >
        <Bike className="w-4 h-4" /> Despachar p/ Entrega
      </button>
    )
  }
  if (status === 'saiu_entrega') {
    return (
      <button
        onClick={() => onMudarStatus('concluido')}
        className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20"
      >
        <CheckCircle2 className="w-4 h-4" /> Marcar como Concluído
      </button>
    )
  }
  return (
    <div className="text-center py-2 text-xs text-neutral-600 font-bold uppercase tracking-widest bg-white/[0.02] rounded-xl border border-white/5">
      {status === 'concluido' ? '✓ Pedido Finalizado' : '✕ Pedido Cancelado'}
    </div>
  )
}

// ═══════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════

function AdminPage() {
  const { slug } = Route.useParams()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [filtroStatus, setFiltroStatus] = useState<string>('pendente')

  const { data: estabelecimento, isLoading: loadingEst } = useQuery({
    queryKey: ['admin-estabelecimento', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estabelecimentos')
        .select('*')
        .eq('slug', slug)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: pedidos = [], isLoading: loadingPedidos } = useQuery({
    queryKey: ['admin-pedidos', estabelecimento?.id],
    enabled: !!estabelecimento?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*, pedido_itens(*)')
        .eq('estabelecimento_id', estabelecimento!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as Pedido[]) || []
    },
  })

  useEffect(() => {
    if (!estabelecimento?.id) return
    const channel = supabase
      .channel(`pedidos-realtime-${estabelecimento.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pedidos',
          filter: `estabelecimento_id=eq.${estabelecimento.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-pedidos', estabelecimento.id] })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [estabelecimento?.id, queryClient])

  const handleMudarStatus = async (pedidoId: string, novoStatus: string) => {
    try {
      const { error } = await supabase.from('pedidos').update({ status: novoStatus }).eq('id', pedidoId)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['admin-pedidos', estabelecimento?.id] })
    } catch (err: any) {
      alert(`Erro ao atualizar status: ${err.message}`)
    }
  }

  if (loadingEst || loadingPedidos) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0a] text-white flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (!estabelecimento) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0a] text-white flex items-center justify-center">
        <h1 className="text-xl font-bold">Estabelecimento não encontrado</h1>
      </div>
    )
  }

  const cor = estabelecimento.cor_primaria || '#F5A623'
  const logoSrc = estabelecimento.logo_url || '/logo-burger-do-ze.png'

  const hojeStr = new Date().toISOString().split('T')[0]
  const pedidosHoje = pedidos.filter((p) => p.created_at.startsWith(hojeStr) && p.status !== 'cancelado')
  const vendasHoje = pedidosHoje.reduce((sum, p) => sum + Number(p.total), 0)
  const ticketMedio = pedidosHoje.length > 0 ? vendasHoje / pedidosHoje.length : 0
  const emAndamento = pedidos.filter(
    (p) => p.status === 'pendente' || p.status === 'preparo' || p.status === 'saiu_entrega'
  ).length

  const pedidosExibidos = pedidos.filter((p) => {
    if (filtroStatus === 'todos') return true
    return p.status === filtroStatus
  })

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] text-neutral-200 font-sans flex overflow-hidden selection:bg-yellow-500 selection:text-black">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0f0f0f] border-r border-white/10 flex flex-col justify-between shrink-0 h-full">
        <div>
          <div className="h-20 flex items-center gap-3 px-6 border-b border-white/5">
            <div className="w-10 h-10 rounded-full bg-black border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
              <img
                src={logoSrc}
                alt="Logo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-black text-white truncate uppercase tracking-wider">
                {estabelecimento.nome}
              </h2>
              <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-widest">
                Painel Admin
              </span>
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            <MenuButton
              icon={LayoutDashboard}
              label="Dashboard"
              isActive={activeTab === 'dashboard'}
              onClick={() => setActiveTab('dashboard')}
              cor={cor}
            />
            <MenuButton
              icon={ListOrdered}
              label="Pedidos"
              isActive={activeTab === 'pedidos'}
              onClick={() => setActiveTab('pedidos')}
              cor={cor}
              badge={emAndamento > 0 ? emAndamento : undefined}
            />
            <MenuButton
              icon={UtensilsCrossed}
              label="Cardápio"
              isActive={activeTab === 'cardapio'}
              onClick={() => setActiveTab('cardapio')}
              cor={cor}
            />
            <MenuButton
              icon={Settings}
              label="Configurações"
              isActive={activeTab === 'configuracoes'}
              onClick={() => setActiveTab('configuracoes')}
              cor={cor}
            />
          </nav>
        </div>

        <div className="p-4 border-t border-white/5 space-y-2">
          <a
            href={`/${estabelecimento.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4" /> Ver Loja
            </span>
          </a>
          <button className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* CONTEÚDO */}
      <main className="flex-1 h-full overflow-y-auto p-8 bg-[#0a0a0a]">
        {activeTab === 'dashboard' && (
          <div className="space-y-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight">Visão Geral</h2>
                <p className="text-sm text-neutral-400 mt-1">
                  Acompanhe o desempenho do seu restaurante em tempo real.
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-emerald-400">Realtime Ativo</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <KPICard
                title="Vendas Hoje"
                value={`R$ ${vendasHoje.toFixed(2).replace('.', ',')}`}
                subtitle={`${pedidosHoje.length} pedido(s) hoje`}
                icon={DollarSign}
                color="text-emerald-400"
                bg="bg-emerald-500/10"
              />
              <KPICard
                title="Em Andamento"
                value={emAndamento.toString()}
                subtitle="Pedidos na cozinha"
                icon={Clock}
                color="text-amber-400"
                bg="bg-amber-500/10"
              />
              <KPICard
                title="Total Pedidos"
                value={pedidosHoje.length.toString()}
                subtitle="Recebidos hoje"
                icon={ShoppingBag}
                color="text-blue-400"
                bg="bg-blue-500/10"
              />
              <KPICard
                title="Ticket Médio"
                value={`R$ ${ticketMedio.toFixed(2).replace('.', ',')}`}
                subtitle="Média por venda"
                icon={TrendingUp}
                color="text-purple-400"
                bg="bg-purple-500/10"
              />
            </div>

            <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 h-80 flex flex-col">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4" /> Vendas do Dia
              </h3>
              <div className="flex-1 flex items-center justify-center border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
                <p className="text-neutral-500 text-sm font-medium">
                  Gráfico de desempenho acumulado por hora...
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pedidos' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            <div>
              <h2 className="text-3xl font-black text-white tracking-tight">Gestão de Pedidos</h2>
              <p className="text-sm text-neutral-400 mt-1">
                Gerencie e altere os status dos pedidos recebidos.
              </p>
            </div>

            <div
              className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/5"
              style={{ scrollbarWidth: 'none' }}
            >
              {[
                { id: 'todos', label: 'Todos', count: pedidos.length },
                {
                  id: 'pendente',
                  label: '🟡 Pendentes',
                  count: pedidos.filter((p) => p.status === 'pendente').length,
                },
                {
                  id: 'preparo',
                  label: '🟠 Em Preparo',
                  count: pedidos.filter((p) => p.status === 'preparo').length,
                },
                {
                  id: 'saiu_entrega',
                  label: '🛵 Em Entrega',
                  count: pedidos.filter((p) => p.status === 'saiu_entrega').length,
                },
                {
                  id: 'concluido',
                  label: '🟢 Concluídos',
                  count: pedidos.filter((p) => p.status === 'concluido').length,
                },
                {
                  id: 'cancelado',
                  label: '🔴 Cancelados',
                  count: pedidos.filter((p) => p.status === 'cancelado').length,
                },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltroStatus(f.id)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border ${
                    filtroStatus === f.id
                      ? 'text-black border-transparent'
                      : 'bg-[#141414] text-neutral-400 border-white/5 hover:text-white hover:bg-white/5'
                  }`}
                  style={filtroStatus === f.id ? { backgroundColor: cor, color: '#000', borderColor: cor } : {}}
                >
                  <span>{f.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[10px] ${
                      filtroStatus === f.id ? 'bg-black/20 text-black' : 'bg-white/10 text-neutral-300'
                    }`}
                  >
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-12">
              {pedidosExibidos.length === 0 && (
                <div className="col-span-full py-16 text-center">
                  <p className="text-neutral-500 text-sm font-medium">Nenhum pedido neste filtro.</p>
                </div>
              )}

              {pedidosExibidos.map((pedido) => (
                <div
                  key={pedido.id}
                  className="bg-[#141414] border border-white/5 rounded-2xl p-6 flex flex-col justify-between hover:border-white/10 transition-colors shadow-xl"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-sm font-black uppercase tracking-widest" style={{ color: cor }}>
                          #{pedido.id.slice(0, 5).toUpperCase()}
                        </span>
                        <p className="text-[11px] text-neutral-500 font-medium mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{' '}
                          {new Date(pedido.created_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <BadgeStatus status={pedido.status} />
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 mb-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-white text-sm truncate">{pedido.cliente_nome}</h3>
                        {pedido.cliente_telefone && (
                          <a
                            href={`https://wa.me/55${pedido.cliente_telefone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition shrink-0"
                          >
                            <MessageCircle className="w-3 h-3" /> WhatsApp
                          </a>
                        )}
                      </div>

                      {pedido.cliente_telefone && (
                        <p className="text-xs text-neutral-400 flex items-center gap-1.5">
                          <Phone className="w-3 h-3 shrink-0" />
                          {pedido.cliente_telefone}
                        </p>
                      )}

                      {pedido.cliente_endereco && (
                        <p className="text-xs text-neutral-400 flex items-start gap-1.5">
                          <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                          <span>{pedido.cliente_endereco}</span>
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 text-neutral-300 border border-white/5">
                          {pedido.tipo_entrega === 'entrega' ? '🛵 Entrega' : '🏪 Retirada'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 text-neutral-300 border border-white/5">
                          💳 {pedido.forma_pagamento}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      {(pedido.pedido_itens || []).map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                          <div className="flex gap-2 min-w-0">
                            <span
                              className="font-black text-xs shrink-0 mt-0.5"
                              style={{ color: cor }}
                            >
                              {item.quantidade}x
                            </span>
                            <div className="min-w-0">
                              <p className="text-neutral-200 font-medium text-xs leading-snug">
                                {item.produto_nome}
                              </p>
                              {item.adicionais && (
                                <p className="text-[10px] text-neutral-500 mt-0.5">{item.adicionais}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-neutral-400 font-medium shrink-0">
                            R$ {Number(item.subtotal).toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      ))}
                    </div>

                    {pedido.observacoes && (
                      <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <p className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider mb-0.5">
                          Observações
                        </p>
                        <p className="text-xs text-neutral-300">{pedido.observacoes}</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Total</span>
                      <span className="text-lg font-black text-white">
                        R$ {Number(pedido.total).toFixed(2).replace('.', ',')}
                      </span>
                    </div>

                    <AcoesPedido
                      status={pedido.status}
                      cor={cor}
                      onMudarStatus={(novoStatus) => handleMudarStatus(pedido.id, novoStatus)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'cardapio' && (
          <div className="max-w-7xl mx-auto py-16 text-center">
            <UtensilsCrossed className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-white mb-2">Cardápio</h2>
            <p className="text-sm text-neutral-500">
              CRUD de produtos em breve. Por enquanto edite direto no Supabase.
            </p>
          </div>
        )}

        {activeTab === 'configuracoes' && (
          <div className="max-w-7xl mx-auto py-16 text-center">
            <Settings className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-white mb-2">Configurações</h2>
            <p className="text-sm text-neutral-500">
              Edição de dados do estabelecimento em breve.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}