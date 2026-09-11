import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/$slug')({
  component: CardapioPage,
})

function CardapioPage() {
  const { slug } = Route.useParams()

  const { data: estabelecimento, isLoading: loadingEst, error: erroEst } = useQuery({
    queryKey: ['estabelecimento', slug],
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
    return <div className="p-6">Carregando cardápio...</div>
  }

  if (erroEst) {
    return (
      <div className="p-6 text-red-600 font-mono">
        <h2 className="font-bold text-lg">Erro na consulta do Supabase:</h2>
        <p>{(erroEst as Error).message}</p>
      </div>
    )
  }

  if (!estabelecimento) {
    return <div className="p-6">Estabelecimento não encontrado</div>
  }

  return (
    <>
      <ThemeProvider corPrimaria={estabelecimento.cor_primaria} />
      <div className="min-h-screen bg-neutral-50 p-4">
        <header className="mb-6 border-b pb-4">
          {estabelecimento.logo_url && (
            <img src={estabelecimento.logo_url} alt="" className="h-16 mb-2" />
          )}
          <h1 className="text-2xl font-bold">{estabelecimento.nome}</h1>
          <p className="text-neutral-600">{estabelecimento.descricao}</p>
        </header>

        {categorias?.map((cat) => (
          <section key={cat.id} className="mb-8">
            <h2 className="text-xl font-semibold mb-3">{cat.nome}</h2>
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
                    <CardContent>
                      <p className="text-sm text-neutral-600">{p.descricao}</p>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}