import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://rwrroevvvzztpeovvloe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3cnJvZXZ2dnp6dHBlb3Z2bG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MDE4NzAsImV4cCI6MjA4MTk3Nzg3MH0.kIZ1D8jKwbc5aqK-AWdFm240V48sbYPjGo0iNytSZqA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Função global para limpar url_imagem
window.cleanImageUrl = function(url) {
  if (!url) return '';
  // Se for formato Airtable: nome.png (http://...)
  const match = url.match(/\((https?:\/\/[^)]+)\)/);
  return match ? match[1] : url;
};

// Constrói uma lista de URLs de imagem a partir de uma string possivelmente separada por vírgulas
function buildImagesList(rawUrl) {
  if (!rawUrl) return [];

  return String(rawUrl)
    .split(',')
    .map(part => window.cleanImageUrl(part.trim()))
    .filter(Boolean);
}

// Função para buscar produtos
export async function fetchProducts() {
  const { data, error } = await supabase
    .from('produtos')
    .select('slug, nome, preco_promocional, preco_antigo, em_promocao, categoria, estoque, url_imagem, descricao, especificacoes');

  if (error) {
    console.error('Erro ao buscar produtos:', error);
    return [];
  }

  return data.map(p => ({
    slug: p.slug || '',
    name: p.nome || '',
    price: p.preco_promocional || 'R$ 0,00',
    oldPrice: p.preco_antigo || '',
    promo: p.em_promocao || false,
    category: p.categoria || 'Outros',
    stock: Number(p.estoque || 0),
    url_imagem: p.url_imagem || '',
    images: buildImagesList(p.url_imagem),
    description: p.descricao || '',
    specs: p.especificacoes || ''
  }));
}

// Função para buscar produto por slug
export async function fetchProductBySlug(slug) {
  const { data, error } = await supabase
    .from('produtos')
    .select('slug, nome, preco_promocional, preco_antigo, em_promocao, categoria, estoque, url_imagem, descricao, especificacoes')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Erro ao buscar produto:', error);
    return null;
  }

  return {
    slug: data.slug,
    name: data.nome,
    price: data.preco_promocional,
    oldPrice: data.preco_antigo,
    promo: data.em_promocao,
    category: data.categoria,
    stock: data.estoque,
    url_imagem: data.url_imagem || '',
    images: buildImagesList(data.url_imagem),
    description: data.descricao || '',
    specs: data.especificacoes || ''
  };
}

// Função para buscar produtos similares
export async function fetchSimilarProducts(tags, currentSlug) {
  if (!tags || !tags.length) return [];

  // Como não temos tags no Supabase, vamos buscar por categoria
  const { data, error } = await supabase
    .from('produtos')
    .select('slug, nome, preco_promocional, preco_antigo, em_promocao, categoria, estoque, url_imagem, descricao, especificacoes')
    .neq('slug', currentSlug)
    .limit(12);

  if (error) {
    console.error('Erro ao buscar produtos similares:', error);
    return [];
  }

  return data.map(p => ({
    slug: p.slug,
    name: p.nome,
    price: p.preco_promocional,
    oldPrice: p.preco_antigo,
    promo: p.em_promocao,
    category: p.categoria,
    stock: p.estoque,
    url_imagem: p.url_imagem || '',
    images: buildImagesList(p.url_imagem),
    description: p.descricao || '',
    specs: p.especificacoes || ''
  }));
}

// Função para verificar cupom
export async function fetchCupom(code) {
  console.log('Buscando cupom:', code);
  // Tentar primeiro com 'codigo', depois com 'code' se não encontrar
  let { data, error } = await supabase
    .from('cupons')
    .select('*')
    .eq('codigo', code.toUpperCase())
    .eq('status', 'ativo')
    .single();

  if (error || !data) {
    console.log('Tentando com campo "code"');
    // Tentar com 'code'
    const result = await supabase
      .from('cupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('status', 'ativo')
      .single();
    
    data = result.data;
    error = result.error;
  }

  if (error) {
    console.error('Erro ao buscar cupom:', error);
    return null;
  }

  console.log('Cupom encontrado:', data);
  return data;
}