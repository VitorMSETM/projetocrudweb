// ==========================================
// ProdSmart — Servidor Node.js + Express
// ==========================================

const express = require('express');
const mysql = require('mysql2/promise');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ==========================================
// POOL DE CONEXÃO MYSQL
// ==========================================

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ==========================================
// MIDDLEWARE DE AUTENTICAÇÃO JWT
// ==========================================

function verificarToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ erro: 'Token não fornecido' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ erro: 'Token inválido' });
    }
    req.usuario = decoded;
    next();
  });
}

// ==========================================
// ROTAS DE AUTENTICAÇÃO
// ==========================================

app.post('/api/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body;

    if (!usuario || !senha) {
      return res.status(400).json({ erro: 'Usuário e senha obrigatórios' });
    }

    const conn = await pool.getConnection();
    const [usuarios] = await conn.query(
      'SELECT id, usuario, senha FROM usuarios WHERE usuario = ?',
      [usuario]
    );
    conn.release();

    if (usuarios.length === 0) {
      return res.status(401).json({ erro: 'Usuário ou senha incorretos' });
    }

    const user = usuarios[0];
    const senhaValida = await bcryptjs.compare(senha, user.senha);

    if (!senhaValida) {
      return res.status(401).json({ erro: 'Usuário ou senha incorretos' });
    }

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, usuario: user.usuario });

  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ erro: 'Erro no servidor' });
  }
});

// ==========================================
// ROTAS DE CUPONS
// ==========================================

app.get('/api/cupons', verificarToken, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [cupons] = await conn.query(
      'SELECT cupom, influenciador, comissao_percentual FROM cupons WHERE ativo = 1 ORDER BY cupom'
    );
    conn.release();

    res.json({ cupons });

  } catch (err) {
    console.error('Erro ao buscar cupons:', err);
    res.status(500).json({ erro: 'Erro ao buscar cupons' });
  }
});

app.get('/api/cupons/:cupom', verificarToken, async (req, res) => {
  try {
    const { cupom } = req.params;
    
    const conn = await pool.getConnection();
    const [cupons] = await conn.query(
      'SELECT cupom, influenciador, comissao_percentual FROM cupons WHERE UPPER(cupom) = UPPER(?) AND ativo = 1',
      [cupom]
    );
    conn.release();

    if (cupons.length === 0) {
      return res.json({ valido: false });
    }

    res.json({ valido: true, cupom: cupons[0] });

  } catch (err) {
    console.error('Erro ao validar cupom:', err);
    res.status(500).json({ erro: 'Erro ao validar cupom' });
  }
});

app.post('/api/cupons', verificarToken, async (req, res) => {
  try {
    const { cupom, influenciador, comissao_percentual } = req.body;

    if (!cupom || !influenciador) {
      return res.status(400).json({ erro: 'Cupom e influenciador obrigatórios' });
    }

    const conn = await pool.getConnection();
    await conn.query(
      'INSERT INTO cupons (cupom, influenciador, comissao_percentual) VALUES (?, ?, ?)',
      [cupom.toUpperCase(), influenciador, comissao_percentual || 25]
    );
    conn.release();

    res.json({ sucesso: true, mensagem: 'Cupom criado com sucesso' });

  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ erro: 'Este cupom já existe' });
    }
    console.error('Erro ao criar cupom:', err);
    res.status(500).json({ erro: 'Erro ao criar cupom' });
  }
});

// ==========================================
// ROTAS DE VENDAS
// ==========================================

app.post('/api/vendas', verificarToken, async (req, res) => {
  let conn;
  try {
    const { data, produto, custo, preco_venda, cupom } = req.body;

    console.log('Tentando registrar venda:', { data, produto, custo, preco_venda, cupom });

    if (!data || !produto || custo === undefined || preco_venda === undefined) {
      return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
    }

    const custoNum = parseFloat(custo);
    const precoNum = parseFloat(preco_venda);
    const lucro_bruto = precoNum - custoNum;

    let comissao = 0;
    let lucro_liquido = lucro_bruto;

    // Validar cupom se fornecido
    if (cupom && cupom.trim()) {
      conn = await pool.getConnection();
      const [cupons] = await conn.query(
        'SELECT comissao_percentual FROM cupons WHERE UPPER(cupom) = UPPER(?) AND ativo = 1',
        [cupom]
      );

      if (cupons.length > 0) {
        const percentual = cupons[0].comissao_percentual / 100;
        comissao = lucro_bruto * percentual;
        lucro_liquido = lucro_bruto * (1 - percentual);
        console.log(`✓ Cupom ${cupom} validado. Comissão: ${comissao}`);
      } else {
        console.log(`✗ Cupom ${cupom} não validado, tratando como sem cupom`);
      }
    }

    // Inserir venda
    if (!conn) conn = await pool.getConnection();
    
    await conn.query(
      `INSERT INTO prodsmart 
       (data, produto, custo, preco_venda, cupom, comissao, lucro_liquido) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data,
        produto,
        custoNum,
        precoNum,
        cupom || null,
        parseFloat(comissao.toFixed(2)),
        parseFloat(lucro_liquido.toFixed(2))
      ]
    );

    console.log('Venda registrada com sucesso');

    if (conn) conn.release();

    res.json({
      sucesso: true,
      mensagem: 'Venda registrada com sucesso',
      dados: {
        produto,
        custo: custoNum,
        preco_venda: precoNum,
        lucro_bruto: parseFloat(lucro_bruto.toFixed(2)),
        comissao: parseFloat(comissao.toFixed(2)),
        lucro_liquido: parseFloat(lucro_liquido.toFixed(2))
      }
    });

  } catch (err) {
    if (conn) conn.release();
    console.error('Erro ao registrar venda:', err.message);
    res.status(500).json({ erro: 'Erro ao registrar venda: ' + err.message });
  }
});

// GET todas as vendas
app.get('/api/vendas', verificarToken, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [vendas] = await conn.query(
      `SELECT 
        id, data, produto, custo, preco_venda, cupom, comissao, lucro_liquido
       FROM prodsmart 
       ORDER BY data DESC, id DESC`
    );
    conn.release();

    res.json({ vendas });

  } catch (err) {
    console.error('❌ Erro ao listar vendas:', err);
    res.status(500).json({ erro: 'Erro ao listar vendas' });
  }
});

// GET uma venda específica
app.get('/api/vendas/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const conn = await pool.getConnection();
    const [vendas] = await conn.query(
      `SELECT 
        id, data, produto, custo, preco_venda, cupom, comissao, lucro_liquido
       FROM prodsmart 
       WHERE id = ?`,
      [id]
    );
    conn.release();

    if (vendas.length === 0) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    res.json({ venda: vendas[0] });

  } catch (err) {
    console.error('Erro ao buscar venda:', err);
    res.status(500).json({ erro: 'Erro ao buscar venda' });
  }
});

// UPDATE uma venda
app.put('/api/vendas/:id', verificarToken, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { data, produto, custo, preco_venda, cupom } = req.body;

    if (!data || !produto || custo === undefined || preco_venda === undefined) {
      return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
    }

    const custoNum = parseFloat(custo);
    const precoNum = parseFloat(preco_venda);
    const lucro_bruto = precoNum - custoNum;

    let comissao = 0;
    let lucro_liquido = lucro_bruto;

    // Validar cupom se fornecido
    if (cupom && cupom.trim()) {
      conn = await pool.getConnection();
      const [cupons] = await conn.query(
        'SELECT comissao_percentual FROM cupons WHERE UPPER(cupom) = UPPER(?) AND ativo = 1',
        [cupom]
      );

      if (cupons.length > 0) {
        const percentual = cupons[0].comissao_percentual / 100;
        comissao = lucro_bruto * percentual;
        lucro_liquido = lucro_bruto * (1 - percentual);
      }
    }

    // Atualizar venda
    if (!conn) conn = await pool.getConnection();
    
    const [result] = await conn.query(
      `UPDATE prodsmart 
       SET data = ?, produto = ?, custo = ?, preco_venda = ?, cupom = ?, comissao = ?, lucro_liquido = ?
       WHERE id = ?`,
      [
        data,
        produto,
        custoNum,
        precoNum,
        cupom || null,
        parseFloat(comissao.toFixed(2)),
        parseFloat(lucro_liquido.toFixed(2)),
        id
      ]
    );

    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    res.json({
      sucesso: true,
      mensagem: 'Venda atualizada com sucesso',
      dados: {
        id,
        produto,
        custo: custoNum,
        preco_venda: precoNum,
        lucro_bruto: parseFloat(lucro_bruto.toFixed(2)),
        comissao: parseFloat(comissao.toFixed(2)),
        lucro_liquido: parseFloat(lucro_liquido.toFixed(2))
      }
    });

  } catch (err) {
    if (conn) conn.release();
    console.error('Erro ao atualizar venda:', err);
    res.status(500).json({ erro: 'Erro ao atualizar venda' });
  }
});

// DELETE uma venda
app.delete('/api/vendas/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;

    const conn = await pool.getConnection();
    const [result] = await conn.query(
      'DELETE FROM prodsmart WHERE id = ?',
      [id]
    );
    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }

    res.json({
      sucesso: true,
      mensagem: 'Venda deletada com sucesso'
    });

  } catch (err) {
    console.error('Erro ao deletar venda:', err);
    res.status(500).json({ erro: 'Erro ao deletar venda' });
  }
});

app.get('/api/vendas/semana/:inicio/:fim', verificarToken, async (req, res) => {
  try {
    const { inicio, fim } = req.params;

    const conn = await pool.getConnection();
    const [vendas] = await conn.query(
      `SELECT 
        id, data, produto, custo, preco_venda, cupom, comissao, lucro_liquido
       FROM prodsmart 
       WHERE data BETWEEN ? AND ?
       ORDER BY data DESC`,
      [inicio, fim]
    );
    conn.release();

    res.json({ vendas });

  } catch (err) {
    console.error('❌ Erro ao listar vendas por período:', err);
    res.status(500).json({ erro: 'Erro ao listar vendas' });
  }
});

// ==========================================
// ROTAS DE RESUMO SEMANAL
// ==========================================

app.get('/api/resumo/semanal', verificarToken, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    
    const hoje = new Date();
    const dia = hoje.getDay();
    const diff = hoje.getDate() - dia + (dia === 0 ? -6 : 1);
    const segunda = new Date(hoje.setDate(diff));
    segunda.setHours(0, 0, 0, 0);
    
    const dataInicio = segunda.toISOString().split('T')[0];
    const dataFim = new Date(segunda.getTime() + 6 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const [vendas] = await conn.query(
      `SELECT 
        COALESCE(SUM(preco_venda), 0) as faturamento_total,
        COALESCE(SUM(preco_venda - custo), 0) as lucro_bruto,
        COALESCE(SUM(comissao), 0) as total_comissoes,
        COALESCE(SUM(lucro_liquido), 0) as lucro_liquido
       FROM prodsmart 
       WHERE data BETWEEN ? AND ?`,
      [dataInicio, dataFim]
    );
    conn.release();

    const resultado = vendas[0] || {};

    res.json({
      semana: `Semana do ${dataInicio} ao ${dataFim}`,
      faturamento_total: parseFloat(resultado.faturamento_total) || 0,
      lucro_bruto: parseFloat(resultado.lucro_bruto) || 0,
      total_comissoes: parseFloat(resultado.total_comissoes) || 0,
      lucro_liquido: parseFloat(resultado.lucro_liquido) || 0,
      periodo: { inicio: dataInicio, fim: dataFim }
    });

  } catch (err) {
    console.error('Erro ao buscar resumo semanal:', err);
    res.status(500).json({ erro: 'Erro ao buscar resumo semanal' });
  }
});

app.post('/api/resumo/salvar', verificarToken, async (req, res) => {
  try {
    const { semana, faturamento_total, lucro_bruto, total_comissoes, lucro_liquido } = req.body;

    if (!semana || faturamento_total === undefined) {
      return res.status(400).json({ erro: 'Dados incompletos' });
    }

    const conn = await pool.getConnection();
    await conn.query(
      `INSERT INTO resumo_semanal 
       (semana, faturamento_total, lucro_bruto, total_comissoes, lucro_liquido)
       VALUES (?, ?, ?, ?, ?)`,
      [
        semana,
        parseFloat(faturamento_total),
        parseFloat(lucro_bruto),
        parseFloat(total_comissoes),
        parseFloat(lucro_liquido)
      ]
    );
    conn.release();

    res.json({ sucesso: true, mensagem: 'Resumo salvo com sucesso' });

  } catch (err) {
    console.error('Erro ao salvar resumo:', err);
    res.status(500).json({ erro: 'Erro ao salvar resumo' });
  }
});

app.get('/api/resumo/historico', verificarToken, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [resumos] = await conn.query(
      `SELECT 
        id, semana, faturamento_total, lucro_bruto, total_comissoes, lucro_liquido
       FROM resumo_semanal 
       ORDER BY created_at DESC`
    );
    conn.release();

    res.json({ resumos });

  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
    res.status(500).json({ erro: 'Erro ao buscar histórico' });
  }
});

// DELETE um resumo semanal
app.delete('/api/resumo/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;

    const conn = await pool.getConnection();
    const [result] = await conn.query(
      'DELETE FROM resumo_semanal WHERE id = ?',
      [id]
    );
    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Resumo não encontrado' });
    }

    res.json({
      sucesso: true,
      mensagem: 'Resumo deletado com sucesso'
    });

  } catch (err) {
    console.error('Erro ao deletar resumo:', err);
    res.status(500).json({ erro: 'Erro ao deletar resumo' });
  }
});

// ==========================================
// ROTA DE HEALTH CHECK
// ==========================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', servidor: 'ProdSmart ativo' });
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('ProdSmart rodando em http://localhost:' + PORT);
  console.log('Dashboard: http://localhost:' + PORT + '/painel.html');
  console.log('Registrar venda: http://localhost:' + PORT + '/registrar.html');
  console.log('='.repeat(60) + '\n');
});