import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Clock, CheckCircle2, Truck, PackageCheck, AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/admin/$slug')({
  component: AdminPage,
})

export function AdminPage() {
  const { slug } = Route.useParams()
  const queryClient = useQueryClient()
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  // Buscar dados do estabelecimento
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

  // Buscar pedidos com os itens vinculados
  const { data: pedidos, isLoading: loadingPedidos } = useQuery({
    queryKey: ['admin-pedidos', estabelecimento?.id],
    enabled: !!estabelecimento?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          *,
          pedido_itens (*)
        `)
        .eq('estabelecimento_id', estabelecimento!.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
  })

  // Escutar novos pedidos em tempo real (Supabase Realtime)
  useEffect(() => {
    if (!estabelecimento?.id) return

    const channel = supabase
      .channel('realtime-pedidos')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pedidos',
          filter: `estabelecimento_id=eq.${estabelecimento.id}`,
        },
        () => {
          // Atualiza a lista de pedidos automaticamente na tela
          queryClient.invalidateQueries({ queryKey: ['admin-pedidos', estabelecimento.id] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [estabelecimento?.id, queryClient])

  // Atualizar status do pedido
  const handleAtualizarStatus = async (pedidoId: string, novoStatus: string) => {
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ status: novoStatus })
        .eq('id', pedidoId)

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['admin-pedidos', estabelecimento?.id] })
    } catch (err) {
      alert('Erro ao atualizar status do pedido.')
    }
  }

  if (loadingEst) return <div className="p-6 text-center">Carregando painel admin...</div>
  if (!estabelecimento) return <div className="p-6 text-center">Estabelecimento não encontrado.</div>

  const pedidosFiltrados = pedidos?.filter((p) => {
    if (filtroStatus === 'todos') return true
    return p.status === filtroStatus
  })

  // Cores e rótulos para cada status
  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pendente: { label: 'Pendente', color: 'bg-yellow-500 text-white', icon: Clock },
    preparo: { label: 'Em Preparo', color: 'bg-blue-500 text-white', icon: AlertCircle },
    saiu_entrega: { label: 'Saiu p/ Entrega', color: 'bg-purple-500 text-white', icon: Truck },
    concluido: { label: 'Concluído', color: 'bg-green-600 text-white', icon: CheckCircle2 },
    cancelado: { label: 'Cancelado', color: 'bg-red-500 text-white', icon: PackageCheck },
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-4 max-w-4xl mx-auto">
      {/* Topo do Painel */}
      <header className="bg-white p-4 rounded-lg shadow mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Painel de Pedidos — {estabelecimento.nome}</h1>
          <p className="text-xs text-neutral-500">Acompanhamento e gestão em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <span className="w-2 h-2 mr-1.5 bg-green-400 rounded-full animate-pulse"></span>
            Ao Vivo
          </span>
        </div>
      </header>

      {/* Filtros de Status */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {['todos', 'pendente', 'preparo', 'saiu_entrega', 'concluido'].map((status) => (
          <Button
            key={status}
            size="sm"
            variant={filtroStatus === status ? 'default' : 'outline'}
            onClick={() => setFiltroStatus(status)}
            className="capitalize text-xs"
          >
            {status === 'todos' ? 'Todos os Pedidos' : statusConfig[status]?.label || status}
          </Button>
        ))}
      </div>

      {/* Lista de Pedidos */}
      {loadingPedidos ? (
        <div className="text-center p-6 text-neutral-500">Carregando pedidos...</div>
      ) : pedidosFiltrados?.length === 0 ? (
        <div className="bg-white p-8 text-center rounded-lg shadow text-neutral-500">
          Nenhum pedido encontrado neste status.
        </div>
      ) : (
        <div className="space-y-4">
          {pedidosFiltrados?.map((pedido) => {
            const config = statusConfig[pedido.status] || statusConfig.pendente
            const StatusIcon = config.icon

            return (
              <Card key={pedido.id} className="border-l-4 border-l-neutral-800 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <span>#{pedido.id.slice(0, 5).toUpperCase()} — {pedido.cliente_nome}</span>
                      </CardTitle>
                      <p className="text-xs text-neutral-500">
                        {new Date(pedido.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        • {pedido.cliente_telefone}
                      </p>
                    </div>
                    <Badge className={config.color}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Endereço e Entrega */}
                  <div className="bg-neutral-50 p-2 rounded text-xs text-neutral-700">
                    <p><strong>Tipo:</strong> {pedido.tipo_entrega === 'entrega' ? '🛵 Entrega' : '🛍️ Retirada'}</p>
                    {pedido.tipo_entrega === 'entrega' && <p><strong>Endereço:</strong> {pedido.cliente_endereco}</p>}
                    <p><strong>Pagamento:</strong> {pedido.forma_pagamento}</p>
                    {pedido.observacoes && <p className="text-amber-700"><strong>Obs:</strong> {pedido.observacoes}</p>}
                  </div>

                  {/* Itens do Pedido */}
                  <div>
                    <p className="text-xs font-bold text-neutral-500 mb-1">ITENS:</p>
                    <ul className="text-sm space-y-1">
                      {pedido.pedido_itens?.map((item: any) => (
                        <li key={item.id} className="flex justify-between border-b pb-1 text-xs">
                          <span>
                            <strong>{item.quantidade}x</strong> {item.produto_nome}
                          </span>
                          <span>
                            {Number(item.subtotal).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Separator />

                  {/* Total e Ações de Status */}
                  <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-2 pt-1">
                    <div className="text-sm font-bold">
                      Total: {Number(pedido.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {pedido.status === 'pendente' && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-xs h-8"
                          onClick={() => handleAtualizarStatus(pedido.id, 'preparo')}
                        >
                          Mover p/ Preparo
                        </Button>
                      )}
                      {pedido.status === 'preparo' && (
                        <Button
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700 text-xs h-8"
                          onClick={() => handleAtualizarStatus(pedido.id, 'saiu_entrega')}
                        >
                          Saiu p/ Entrega
                        </Button>
                      )}
                      {pedido.status === 'saiu_entrega' && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-xs h-8"
                          onClick={() => handleAtualizarStatus(pedido.id, 'concluido')}
                        >
                          Concluir Pedido
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}