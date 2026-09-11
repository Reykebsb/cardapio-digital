import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ThemeProvider } from '@/components/ThemeProvider'
import { useCart } from '@/store/useCart'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet'
import { ShoppingBag, Plus, Minus, Trash2 } from 'lucide-react'

export const Route = createFileRoute('/$slug')({
  component: CardapioPage,
})

function CardapioPage() {
  const { slug } = Route.useParams()
  const { items, addItem, removeItem, updateQuantity, getTotal, clearCart } = useCart()

  // Estado do formulário de checkout
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [endereco, setEndereco] = useState('')
  const [tipoEntrega, setTipoEntrega] = useState<'entrega' | 'retirada'>('entrega')
  const [formaPagamento, setFormaPagamento] = useState('Pix')
  const [observacoes, setObservacoes] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Consultas Supabase
  const { data: estabelecimento, isLoading: loadingEst } = useQuery({
    queryKey: ['estabelecimento', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estabelecimentos')
        .select('*')
        .eq('slug', slug)
        .eq('ativo', true)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: categorias } = useQuery({
    queryKey: ['categorias', estabelecimento?.id],
    enabled: !!estabelecimento?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('estabelecimento_id', estabelecimento!.id)
        .eq('ativo', true)
        .order('ordem')
      if (error) throw error
      return data
    },
  })

  const { data: produtos } = useQuery({
    queryKey: ['produtos', estabelecimento?.id],
    enabled: !!estabelecimento?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('estabelecimento_id', estabelecimento!.id)
        .eq('ativo', true)
        .order('ordem')
      if (error) throw error
      return data
    },
  })

  if (loadingEst) {
    return <div className="p-6 text-center">Carregando cardápio...</div>
  }

  if (!estabelecimento) {
    return <div className="p-6 text-center font-bold">Estabelecimento não encontrado</div>
  }

  const subtotal = getTotal()
  const taxaEntrega = tipoEntrega === 'entrega' ? Number(estabelecimento.taxa_entrega_padrao || 0) : 0
  const totalGeral = subtotal + taxaEntrega

  // Enviar Pedido para o Supabase + Gerar link do WhatsApp
  const handleFinalizarPedido = async () => {
    if (!nome.trim()) {
      alert('Por favor, informe seu nome.')
      return
    }
    if (tipoEntrega === 'entrega' && !endereco.trim()) {
      alert('Por favor, informe o endereço de entrega.')
      return
    }

    setEnviando(true)

    try {
      // 1. Salvar no Supabase
      const { data: pedido, error: errPedido } = await supabase
        .from('pedidos')
        .insert({
          estabelecimento_id: estabelecimento.id,
          cliente_nome: nome,
          cliente_telefone: telefone || 'Não informado',
          cliente_endereco: tipoEntrega === 'entrega' ? endereco : 'Retirada no Balcão',
          tipo_entrega: tipoEntrega,
          forma_pagamento: formaPagamento,
          subtotal,
          taxa_entrega: taxaEntrega,
          total: totalGeral,
          observacoes: observacoes || 'Nenhuma',
          status: 'pendente',
        })
        .select()
        .single()

      if (errPedido) throw errPedido

      // 2. Salvar itens do pedido
      const itensPayload = items.map((item) => ({
        pedido_id: pedido.id,
        produto_id: item.id,
        produto_nome: item.nome,
        quantidade: item.quantidade,
        preco_unitario: item.preco,
        subtotal: item.preco * item.quantidade,
      }))

      const { error: errItens } = await supabase.from('pedido_itens').insert(itensPayload)
      if (errItens) throw errItens

      // 3. Montar Mensagem do WhatsApp
      let mensagem = `*NOVO PEDIDO #${pedido.id.slice(0, 5).toUpperCase()}*\n`
      mensagem += `*Cliente:* ${nome}\n`
      if (telefone) mensagem += `*Telefone:* ${telefone}\n`
      mensagem += `*Tipo:* ${tipoEntrega === 'entrega' ? 'Entrega 🛵' : 'Retirada 🛍️'}\n`
      if (tipoEntrega === 'entrega') mensagem += `*Endereço:* ${endereco}\n`
      mensagem += `*Pagamento:* ${formaPagamento}\n`
      if (observacoes) mensagem += `*Obs:* ${observacoes}\n`
      mensagem += `\n*ITENS DO PEDIDO:*\n`

      items.forEach((item) => {
        mensagem += `• ${item.quantidade}x ${item.nome} (${(item.preco * item.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})\n`
      })

      mensagem += `\n*Subtotal:* ${subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      if (tipoEntrega === 'entrega') {
        mensagem += `\n*Taxa de Entrega:* ${taxaEntrega.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      }
      mensagem += `\n*TOTAL:* *${totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*`

      // 4. Abrir o WhatsApp do Estabelecimento
      const whatsappClean = estabelecimento.whatsapp_numero.replace(/\D/g, '')
      const urlWhatsapp = `https://wa.me/${whatsappClean}?text=${encodeURIComponent(mensagem)}`

      clearCart()
      window.open(urlWhatsapp, '_blank')
    } catch (err: any) {
      console.error('Erro detalhado:', err)
      alert(`Erro ao salvar pedido: ${err.message || 'Verifique as permissões do banco'}`)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <ThemeProvider corPrimaria={estabelecimento.cor_primaria} />
      <div className="min-h-screen bg-neutral-50 pb-24 p-4">
        {/* Header */}
        <header className="mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold">{estabelecimento.nome}</h1>
          <p className="text-neutral-600 text-sm">{estabelecimento.descricao}</p>
        </header>

        {/* Lista de Categorias e Produtos */}
        {categorias?.map((cat) => (
          <section key={cat.id} className="mb-8">
            <h2 className="text-lg font-bold mb-3">{cat.nome}</h2>
            <div className="grid gap-3">
              {produtos
                ?.filter((p) => p.categoria_id === cat.id)
                .map((p) => (
                  <Card key={p.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-base font-semibold">
                        <span>{p.nome}</span>
                        <Badge variant="secondary">
                          {Number(p.preco).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-end justify-between gap-2">
                      <p className="text-xs text-neutral-600 flex-1">{p.descricao}</p>
                      <Button
                        size="sm"
                        onClick={() =>
                          addItem({ id: p.id, nome: p.nome, preco: Number(p.preco) })
                        }
                      >
                        <Plus className="w-4 h-4 mr-1" /> Adicionar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </section>
        ))}

        {/* Barra Flutuante do Carrinho */}
        {items.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg max-w-md mx-auto z-50">
            <Sheet>
              <SheetTrigger asChild>
                <Button className="w-full flex items-center justify-between py-6 text-base font-bold bg-neutral-900 text-white hover:bg-neutral-800">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" />
                    <span>Ver Sacola ({items.reduce((acc, i) => acc + i.quantidade, 0)})</span>
                  </div>
                  <span>
                    {subtotal.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </Button>
              </SheetTrigger>

              <SheetContent className="w-full sm:max-w-lg overflow-y-auto flex flex-col justify-between">
                <div>
                  <SheetHeader>
                    <SheetTitle>Seu Pedido</SheetTitle>
                  </SheetHeader>

                  {/* Itens na Sacola */}
                  <div className="my-4 space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between border-b pb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{item.nome}</p>
                          <p className="text-xs text-neutral-500">
                            {(item.preco * item.quantidade).toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.id, item.quantidade - 1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="text-sm font-bold w-4 text-center">{item.quantidade}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.id, item.quantidade + 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-500"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-4" />

                  {/* Dados de Entrega / Checkout */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-sm">Dados de Entrega & Pagamento</h3>
                    
                    <div>
                      <Label htmlFor="nome">Seu Nome *</Label>
                      <Input
                        id="nome"
                        placeholder="Ex: João Silva"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="telefone">WhatsApp / Telefone</Label>
                      <Input
                        id="telefone"
                        placeholder="(11) 99999-9999"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label>Tipo de Pedido</Label>
                      <div className="flex gap-2 mt-1">
                        <button
                          type="button"
                          className={`flex-1 py-2 text-sm font-semibold rounded-md border transition-all ${
                            tipoEntrega === 'entrega'
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-white text-neutral-800 border-neutral-300'
                          }`}
                          onClick={() => setTipoEntrega('entrega')}
                        >
                          Entrega 🛵
                        </button>
                        <button
                          type="button"
                          className={`flex-1 py-2 text-sm font-semibold rounded-md border transition-all ${
                            tipoEntrega === 'retirada'
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-white text-neutral-800 border-neutral-300'
                          }`}
                          onClick={() => setTipoEntrega('retirada')}
                        >
                          Retirada 🛍️
                        </button>
                      </div>
                    </div>

                    {tipoEntrega === 'entrega' && (
                      <div>
                        <Label htmlFor="endereco">Endereço Completo *</Label>
                        <Input
                          id="endereco"
                          placeholder="Rua, Número, Bairro e Complemento"
                          value={endereco}
                          onChange={(e) => setEndereco(e.target.value)}
                        />
                      </div>
                    )}

                    <div>
                      <Label htmlFor="pagamento">Forma de Pagamento</Label>
                      <select
                        id="pagamento"
                        className="w-full border rounded-md p-2 text-sm mt-1 bg-white"
                        value={formaPagamento}
                        onChange={(e) => setFormaPagamento(e.target.value)}
                      >
                        <option value="Pix">Pix (Chave enviada no Whats)</option>
                        <option value="Cartão de Crédito/Débito na Entrega">Cartão (Máquina na entrega)</option>
                        <option value="Dinheiro">Dinheiro</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="obs">Observações do Pedido</Label>
                      <Input
                        id="obs"
                        placeholder="Ex: Tirar a cebola, troco para 50..."
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Resumo dos Valores e Botão Finalizar */}
                <div className="pt-4 border-t mt-4">
                  <div className="space-y-1 text-sm mb-4">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    {tipoEntrega === 'entrega' && (
                      <div className="flex justify-between text-neutral-600">
                        <span>Taxa de Entrega:</span>
                        <span>{taxaEntrega.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-base pt-2 border-t">
                      <span>Total:</span>
                      <span>{totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  </div>

                  <SheetFooter>
                    <Button
                      className="w-full py-6 font-bold text-base bg-neutral-900 text-white hover:bg-neutral-800"
                      disabled={enviando}
                      onClick={handleFinalizarPedido}
                    >
                      {enviando ? 'Enviando Pedido...' : 'Enviar Pedido pelo WhatsApp'}
                    </Button>
                  </SheetFooter>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        )}
      </div>
    </>
  )
}