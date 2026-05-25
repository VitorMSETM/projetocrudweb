-- ===============================================
-- ProdSmart — Sistema de Gerenciamento de Vendas
-- Base de dados MySQL
-- ===============================================

CREATE DATABASE IF NOT EXISTS prodsmart_db;
USE prodsmart_db;

-- ===============================================
-- TABELA: usuarios
-- Login e autenticação
-- ===============================================
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario VARCHAR(50) NOT NULL UNIQUE,
  senha VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usuário padrão (senha: admin123)
-- Gere o hash: npm install bcryptjs, depois use bcryptjs.hashSync('admin123', 10)
INSERT INTO usuarios (usuario, senha) VALUES 
('admin', '$2a$10$YOixZH5S.Jy6v5oR.gZ2ue7HxQT0oJ3lL5K8Q2X5Y9Z1A2B3C4D5E6');

-- ===============================================
-- TABELA: cupons
-- Cupons de influenciadores
-- ===============================================
CREATE TABLE IF NOT EXISTS cupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cupom VARCHAR(50) NOT NULL UNIQUE,
  influenciador VARCHAR(100) NOT NULL,
  comissao_percentual DECIMAL(5, 2) DEFAULT 25.00,
  ativo TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- TABELA: prodsmart
-- Tabela principal de vendas
-- ===============================================
CREATE TABLE IF NOT EXISTS prodsmart (
  id INT AUTO_INCREMENT PRIMARY KEY,
  data DATE NOT NULL,
  produto VARCHAR(150) NOT NULL,
  custo DECIMAL(10, 2) NOT NULL,
  preco_venda DECIMAL(10, 2) NOT NULL,
  cupom VARCHAR(50),
  comissao DECIMAL(10, 2) DEFAULT 0.00,
  lucro_liquido DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cupom) REFERENCES cupons(cupom) ON DELETE SET NULL
);

-- ===============================================
-- TABELA: resumo_semanal
-- Resumo consolidado por semana
-- ===============================================
CREATE TABLE IF NOT EXISTS resumo_semanal (
  id INT AUTO_INCREMENT PRIMARY KEY,
  semana VARCHAR(100) NOT NULL,
  faturamento_total DECIMAL(12, 2) NOT NULL,
  lucro_bruto DECIMAL(12, 2) NOT NULL,
  total_comissoes DECIMAL(12, 2) DEFAULT 0.00,
  lucro_liquido DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- ÍNDICES para otimização
-- ===============================================
CREATE INDEX idx_prodsmart_data ON prodsmart(data);
CREATE INDEX idx_prodsmart_cupom ON prodsmart(cupom);
CREATE INDEX idx_cupons_ativo ON cupons(ativo);