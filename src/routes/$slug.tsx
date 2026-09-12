import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ThemeProvider } from '@/components/ThemeProvider'
import { useCart } from '@/store/useCart'
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
} from '@/components/ui/sheet'
import { ShoppingBag, Plus, Minus, Trash2, Clock, Search, MapPin } from 'lucide-react'

export const Route = createFileRoute('/$slug')({
  component: CardapioPage,
})

function isLojaAberta(abertura: string | null, fechamento: string | null): boolean {
  if (!abertura || !fechamento) return true
  const agora = new Date()
  const [ah, am] = abertura.split(':').map(Number)
  const [fh, fm] = fechamento.split(':').map(Number)
  const agoraMin = agora.getHours() * 60 + agora.getMinutes()
  const abreMin = ah * 60 + am
  const fechaMin = fh * 60 + fm
  if (fechaMin > abreMin) return agoraMin >= abreMin && agoraMin <= fechaMin
  return agoraMin >= abreMin || agoraMin <= fechaMin
}

function CardapioPage() {
  const { slug } = Route.useParams()
  const { items, addItem, removeItem, updateQuantity, getTotal, clearCart } = useCart()

  const [busca, setBusca] = useState('')
  const [categoriaAtiva, setCategoriaAtiva] = useState('tudo')
  const [scrolled, setScrolled] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [endereco, setEndereco] = useState('')
  const [tipoEntrega, setTipoEntrega] = useState<'entrega' | 'retirada'>('entrega')
  const [formaPagamento, setFormaPagamento] = useState('Pix')
  const [observacoes, setObservacoes] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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

  // CORREÇÃO: Busca produtos através do ID das categorias do estabelecimento
  const { data: produtos } = useQuery({
    queryKey: ['produtos', estabelecimento?.id, categorias],
    enabled: !!estabelecimento?.id && !!categorias && categorias.length > 0,
    queryFn: async () => {
      const catIds = categorias!.map((c) => c.id)
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .in('categoria_id', catIds)
        .eq('ativo', true)
        .order('ordem')
      if (error) throw error
      return data
    },
  })

  if (loadingEst) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <ShoppingBag className="w-10 h-10 animate-pulse text-yellow-500/40" />
      </div>
    )
  }

  if (!estabelecimento) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <h1 className="text-xl font-bold text-white">Loja não encontrada</h1>
      </div>
    )
  }

  const subtotal = getTotal()
  const taxaEntrega = tipoEntrega === 'entrega' ? Number(estabelecimento.taxa_entrega_padrao || 0) : 0
  const totalGeral = subtotal + taxaEntrega
  const totalItens = items.reduce((acc, i) => acc + i.quantidade, 0)

  const cor = estabelecimento.cor_primaria || '#F5A623'
  const corTexto = cor
  
  const lojaAberta = isLojaAberta(estabelecimento.horario_abertura, estabelecimento.horario_fechamento)
  const logoSrc = estabelecimento.logo_url || '/logo-burger-do-ze.png'

  const produtosFiltrados = produtos?.filter((p) => {
    const atendeBusca =
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.descricao && p.descricao.toLowerCase().includes(busca.toLowerCase()))
    const atendeCat = categoriaAtiva === 'tudo' || p.categoria_id === categoriaAtiva
    return atendeBusca && atendeCat
  })

  const handleFinalizarPedido = async () => {
    if (!nome.trim()) { alert('Por favor, informe seu nome.'); return }
    if (tipoEntrega === 'entrega' && !endereco.trim()) { alert('Por favor, informe o endereço de entrega.'); return }
    
    const whats = estabelecimento.whatsapp_numero || '61999999999'
    
    setEnviando(true)
    try {
      const { data: pedido, error: errPedido } = await supabase.from('pedidos').insert({
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
      }).select().single()

      if (errPedido) throw errPedido

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

      let mensagem = `*NOVO PEDIDO #${pedido.id.slice(0, 5).toUpperCase()}*\n`
      mensagem += `*Cliente:* ${nome}\n`
      if (telefone) mensagem += `*Telefone:* ${telefone}\n`
      mensagem += `*Tipo:* ${tipoEntrega === 'entrega' ? 'Entrega 🛵' : 'Retirada 🛍️'}\n`
      if (tipoEntrega === 'entrega') mensagem += `*Endereço:* ${endereco}\n`
      mensagem += `*Pagamento:* ${formaPagamento}\n`
      if (observacoes) mensagem += `*Obs:* ${observacoes}\n\n*ITENS DO PEDIDO:*\n`
      items.forEach((item) => {
        mensagem += `• ${item.quantidade}x ${item.nome} (${(item.preco * item.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})\n`
      })
      mensagem += `\n*Subtotal:* ${subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      if (tipoEntrega === 'entrega') mensagem += `\n*Taxa de Entrega:* ${taxaEntrega.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
      mensagem += `\n*TOTAL:* *${totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*`

      const whatsappClean = whats.replace(/\D/g, '')
      window.open(`https://wa.me/55${whatsappClean}?text=${encodeURIComponent(mensagem)}`, '_blank')
      clearCart()
    } catch (err: any) {
      alert(`Erro ao salvar pedido: ${err.message}`)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <ThemeProvider corPrimaria={cor} />

      <div
        className="min-h-screen pb-28"
        style={{
          backgroundColor: '#0a0a0a',
          color: '#ffffff',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* ── Sticky mini header ── */}
        <header
          className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
            scrolled ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
          }`}
        >
          <div
            className="border-b border-white/10 backdrop-blur-md"
            style={{ backgroundColor: 'rgba(10,10,10,0.92)' }}
          >
            <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <img src={logoSrc} alt="" className="w-7 h-7 rounded-full object-cover" />
                <span
                  className="text-sm tracking-wider"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#fff', letterSpacing: '0.06em' }}
                >
                  {estabelecimento.nome}
                </span>
              </div>
              <button
                onClick={() => setSheetOpen(true)}
                className="relative p-2 rounded-full hover:bg-white/10 transition"
              >
                <ShoppingBag className="w-5 h-5" style={{ color: '#fff' }} />
                {totalItens > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: cor, color: '#000' }}
                  >
                    {totalItens}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* ── Header da loja (compacto + logo) ── */}
        <div className="max-w-lg mx-auto px-4 pt-7 pb-5">
          <div className="flex items-center gap-4">
            {/* LOGO */}
            <div
              className="w-[88px] h-[88px] rounded-full shrink-0 overflow-hidden shadow-xl"
              style={{ border: `2px solid ${cor}`, backgroundColor: '#000' }}
            >
              <img
                src={logoSrc}
                alt={estabelecimento.nome}
                className="w-full h-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>

            <div className="flex-1 min-w-0">
              {/* TÍTULO */}
              <h1
                className="leading-none uppercase"
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '2rem',
                  color: '#FFFFFF',
                  letterSpacing: '0.04em',
                  textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                }}
              >
                {estabelecimento.nome}
              </h1>

              {estabelecimento.descricao && (
                <p className="text-xs mt-1" style={{ color: '#a3a3a3' }}>
                  {estabelecimento.descricao}
                </p>
              )}

              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                {lojaAberta ? (
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1 rounded"
                    style={{ backgroundColor: cor, color: '#000' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                    ABERTO
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1 rounded"
                    style={{ backgroundColor: '#262626', color: '#a3a3a3' }}
                  >
                    FECHADO
                  </span>
                )}
                {estabelecimento.horario_fechamento && (
                  <span className="text-[11px] flex items-center gap-1" style={{ color: '#737373' }}>
                    <Clock className="w-3 h-3" />
                    Até {estabelecimento.horario_fechamento.slice(0, 5)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Conteúdo ── */}
        <main className="max-w-lg mx-auto px-4">
          {/* Busca */}
          <div className="relative mb-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#737373' }} />
            <input
              placeholder="O que você quer comer hoje?"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full h-12 pl-10 pr-4 rounded-xl text-sm outline-none transition-shadow"
              style={{
                backgroundColor: '#141414',
                border: '1px solid #262626',
                color: '#ffffff',
              }}
              onFocus={(e) => (e.target.style.borderColor = cor)}
              onBlur={(e) => (e.target.style.borderColor = '#262626')}
            />
          </div>

          {/* Categorias */}
          <div className="flex overflow-x-auto gap-2 pb-4 mb-1" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setCategoriaAtiva('tudo')}
              className="whitespace-nowrap px-4 py-2 rounded-lg text-[11px] font-extrabold uppercase tracking-widest transition-all"
              style={
                categoriaAtiva === 'tudo'
                  ? { backgroundColor: cor, color: '#000' }
                  : { backgroundColor: '#141414', color: '#a3a3a3', border: '1px solid #262626' }
              }
            >
              Todos
            </button>
            {categorias?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoriaAtiva(cat.id)}
                className="whitespace-nowrap px-4 py-2 rounded-lg text-[11px] font-extrabold uppercase tracking-widest transition-all"
                style={
                  categoriaAtiva === cat.id
                    ? { backgroundColor: cor, color: '#000' }
                    : { backgroundColor: '#141414', color: '#a3a3a3', border: '1px solid #262626' }
                }
              >
                {cat.nome}
              </button>
            ))}
          </div>

          {/* Produtos */}
          <div className="space-y-3">
            {produtosFiltrados?.map((p) => (
              <div
                key={p.id}
                className="flex overflow-hidden rounded-xl transition-colors"
                style={{
                  backgroundColor: '#141414',
                  border: '1px solid #1f1f1f',
                  height: 118,
                }}
              >
                {/* Thumb */}
                <div
                  className="w-[110px] h-full shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: '#0f0f0f', borderRight: '1px solid #1f1f1f' }}
                >
                  {p.imagem_url ? (
                    <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBag className="w-7 h-7" style={{ color: cor, opacity: 0.25 }} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                  <div>
                    <h3
                      className="text-sm leading-tight truncate"
                      style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: '1.15rem',
                        color: '#FFFFFF',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {p.nome}
                    </h3>
                    {p.descricao && (
                      <p className="text-[11px] mt-0.5 line-clamp-2 leading-snug" style={{ color: '#737373' }}>
                        {p.descricao}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span
                      className="font-black text-[15px]"
                      style={{ color: corTexto }}
                    >
                      R$ {Number(p.preco).toFixed(2).replace('.', ',')}
                    </span>
                    <button
                      onClick={() => addItem({ id: p.id, nome: p.nome, preco: Number(p.preco) })}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform active:scale-90"
                      style={{ backgroundColor: cor, color: '#000' }}
                    >
                      <Plus className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {produtosFiltrados?.length === 0 && (
              <p className="text-center py-12 text-sm" style={{ color: '#525252' }}>
                Nenhum item encontrado.
              </p>
            )}
          </div>
        </main>

        {/* ── Barra flutuante ── */}
        {items.length > 0 && (
          <div
            className="fixed bottom-0 left-0 right-0 p-4 z-50 border-t border-white/10"
            style={{ backgroundColor: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(12px)' }}
          >
            <div className="max-w-lg mx-auto">
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger
                  className="w-full h-14 rounded-xl flex items-center justify-between px-5 text-base font-black shadow-lg transition-opacity hover:opacity-90"
                  style={{ backgroundColor: cor, color: '#000' }}
                >
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" />
                    <span>Ver Sacola ({totalItens})</span>
                  </div>
                  <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                </SheetTrigger>

                <SheetContent
                  className="w-full sm:max-w-lg overflow-y-auto flex flex-col justify-between rounded-t-2xl border-t px-5"
                  style={{ backgroundColor: '#0a0a0a', borderColor: '#262626', color: '#fff' }}
                >
                  <div>
                    <SheetHeader className="mb-4">
                      <SheetTitle
                        className="text-left"
                        style={{
                          fontFamily: "'Bebas Neue', sans-serif",
                          fontSize: '1.75rem',
                          color: '#FFFFFF',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Sua Sacola
                      </SheetTitle>
                    </SheetHeader>

                    <div className="space-y-4">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between pb-3"
                          style={{ borderBottom: '1px solid #1f1f1f' }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm" style={{ color: '#fff' }}>{item.nome}</p>
                            <p className="text-xs font-black mt-0.5" style={{ color: cor }}>
                              R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div
                              className="flex items-center gap-2 rounded-lg p-1"
                              style={{ backgroundColor: '#141414', border: '1px solid #262626' }}
                            >
                              <button
                                className="w-7 h-7 flex items-center justify-center rounded"
                                style={{ backgroundColor: '#262626', color: '#d4d4d4' }}
                                onClick={() => updateQuantity(item.id, item.quantidade - 1)}
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-sm font-bold w-4 text-center" style={{ color: '#fff' }}>
                                {item.quantidade}
                              </span>
                              <button
                                className="w-7 h-7 flex items-center justify-center rounded"
                                style={{ backgroundColor: '#262626', color: '#d4d4d4' }}
                                onClick={() => updateQuantity(item.id, item.quantidade + 1)}
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <button
                              className="p-2 transition-colors"
                              style={{ color: '#525252' }}
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator className="my-6" style={{ backgroundColor: '#262626' }} />

                    <div className="space-y-4">
                      <h3
                        className="text-xs uppercase tracking-[0.2em] font-bold"
                        style={{ color: '#737373' }}
                      >
                        Dados do Pedido
                      </h3>

                      <div>
                        <Label style={{ color: '#a3a3a3' }}>Seu Nome</Label>
                        <Input
                          className="rounded-xl mt-1 border-0"
                          style={{ backgroundColor: '#141414', color: '#fff' }}
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                        />
                      </div>

                      <div>
                        <Label style={{ color: '#a3a3a3' }}>WhatsApp / Telefone</Label>
                        <Input
                          className="rounded-xl mt-1 border-0"
                          style={{ backgroundColor: '#141414', color: '#fff' }}
                          value={telefone}
                          onChange={(e) => setTelefone(e.target.value)}
                        />
                      </div>

                      <div>
                        <Label style={{ color: '#a3a3a3' }}>Tipo de Pedido</Label>
                        <div className="flex gap-2 mt-1">
                          <button
                            type="button"
                            className="flex-1 py-3 text-sm font-bold rounded-xl border transition-all"
                            style={
                              tipoEntrega === 'entrega'
                                ? { backgroundColor: cor, color: '#000', borderColor: cor }
                                : { backgroundColor: '#141414', color: '#a3a3a3', borderColor: '#262626' }
                            }
                            onClick={() => setTipoEntrega('entrega')}
                          >
                            🛵 Entrega
                          </button>
                          <button
                            type="button"
                            className="flex-1 py-3 text-sm font-bold rounded-xl border transition-all"
                            style={
                              tipoEntrega === 'retirada'
                                ? { backgroundColor: cor, color: '#000', borderColor: cor }
                                : { backgroundColor: '#141414', color: '#a3a3a3', borderColor: '#262626' }
                            }
                            onClick={() => setTipoEntrega('retirada')}
                          >
                            🛍️ Retirada
                          </button>
                        </div>
                      </div>

                      {tipoEntrega === 'entrega' && (
                        <div>
                          <Label className="flex items-center gap-1" style={{ color: '#a3a3a3' }}>
                            <MapPin className="w-3 h-3" /> Endereço Completo
                          </Label>
                          <Input
                            className="rounded-xl mt-1 border-0"
                            style={{ backgroundColor: '#141414', color: '#fff' }}
                            value={endereco}
                            onChange={(e) => setEndereco(e.target.value)}
                            placeholder="Rua, número, bairro..."
                          />
                        </div>
                      )}

                      <div>
                        <Label style={{ color: '#a3a3a3' }}>Forma de Pagamento</Label>
                        <select
                          className="w-full rounded-xl p-3 text-sm mt-1 outline-none"
                          style={{ backgroundColor: '#141414', color: '#fff', border: '1px solid #262626' }}
                          value={formaPagamento}
                          onChange={(e) => setFormaPagamento(e.target.value)}
                        >
                          <option value="Pix">Pix</option>
                          <option value="Cartão de Crédito/Débito na Entrega">Cartão (na entrega)</option>
                          <option value="Dinheiro">Dinheiro</option>
                        </select>
                      </div>

                      <div>
                        <Label style={{ color: '#a3a3a3' }}>Observações (opcional)</Label>
                        <Input
                          className="rounded-xl mt-1 border-0"
                          style={{ backgroundColor: '#141414', color: '#fff' }}
                          value={observacoes}
                          onChange={(e) => setObservacoes(e.target.value)}
                          placeholder="Tirar cebola, ponto da carne..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 pb-6" style={{ borderTop: '1px solid #262626' }}>
                    <div className="space-y-2 mb-5">
                      <div className="flex justify-between text-sm" style={{ color: '#a3a3a3' }}>
                        <span>Subtotal</span>
                        <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                      </div>
                      {tipoEntrega === 'entrega' && (
                        <div className="flex justify-between text-sm" style={{ color: '#a3a3a3' }}>
                          <span>Taxa de Entrega</span>
                          <span>R$ {taxaEntrega.toFixed(2).replace('.', ',')}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-black text-xl pt-2" style={{ color: '#fff' }}>
                        <span>Total</span>
                        <span style={{ color: cor }}>R$ {totalGeral.toFixed(2).replace('.', ',')}</span>
                      </div>
                    </div>
                    <Button
                      className="w-full h-14 rounded-xl font-black text-lg transition-opacity hover:opacity-90"
                      style={{
                        backgroundColor: lojaAberta ? cor : '#3f3f46',
                        color: lojaAberta ? '#000' : '#a3a3a3',
                      }}
                      disabled={enviando || !lojaAberta}
                      onClick={handleFinalizarPedido}
                    >
                      {enviando ? 'Processando...' : !lojaAberta ? 'Loja Fechada' : 'Confirmar Pedido'}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        )}
      </div>
    </>
  )
}