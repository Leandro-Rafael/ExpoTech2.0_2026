-- =====================================================================
-- Dados de referência: categorias, ecopontos, recompensas e organizações.
-- Cores seguem a Resolução CONAMA 275/2001 (coleta seletiva).
-- Fatores de CO2 (kg CO2e evitados por kg encaminhado corretamente) são
-- aproximações de literatura (EPA WARM / estudos de ACV) para fins didáticos.
-- Endereços e parceiros são fictícios/ilustrativos, para demonstração.
-- =====================================================================

insert into categories (id, code, name, description, guidance, points_per_kg, co2_factor_kg, recyclable, color, icon, max_kg_per_disposal, active, created_at, updated_at)
values
(gen_random_uuid(), 'PLASTICO', 'Plástico',
 'Garrafas PET, potes, frascos de limpeza, sacolas, tampas e embalagens plásticas em geral.',
 E'Enxágue as embalagens para remover restos de alimento.\nAmasse as garrafas PET para ocupar menos espaço.\nTampas e rótulos também são recicláveis: descarte junto.\nNão misture embalagens metalizadas (salgadinho) nem isopor sujo.',
 10, 1.500, true, '#E53935', 'milk', 20, true, now(), now()),
(gen_random_uuid(), 'PAPEL', 'Papel e papelão',
 'Jornais, revistas, folhas, caixas de papelão, embalagens longa vida e envelopes.',
 E'Mantenha o papel seco e limpo: papel engordurado vai para o rejeito.\nDesmonte as caixas de papelão antes de descartar.\nEmbalagens longa vida devem ser enxaguadas e achatadas.\nPapel higiênico, guardanapo usado e fotografias não são recicláveis.',
 6, 0.900, true, '#1E88E5', 'newspaper', 30, true, now(), now()),
(gen_random_uuid(), 'VIDRO', 'Vidro',
 'Garrafas, potes de conserva, frascos de perfume e copos de vidro.',
 E'Enxágue e retire as tampas (que vão para metal ou plástico).\nEmbrulhe vidros quebrados em papel grosso e identifique o pacote.\nEspelhos, lâmpadas e vidros temperados NÃO vão para a reciclagem comum.\nNão é necessário retirar os rótulos.',
 5, 0.300, true, '#43A047', 'wine', 25, true, now(), now()),
(gen_random_uuid(), 'METAL', 'Metal',
 'Latas de alumínio e aço, tampas metálicas, panelas sem cabo e pequenas sucatas.',
 E'Amasse as latas para economizar espaço.\nEnxágue latas de alimentos para evitar odores.\nAerossóis só podem ser descartados totalmente vazios.\nPilhas e baterias NÃO são metal comum: leve a um ponto de eletrônicos.',
 12, 3.500, true, '#FDD835', 'cylinder', 20, true, now(), now()),
(gen_random_uuid(), 'ORGANICO', 'Orgânico',
 'Restos de frutas, legumes, cascas de ovo, borra de café e folhas secas (compostáveis).',
 E'Separe apenas restos vegetais para a compostagem doméstica ou comunitária.\nEvite carnes, laticínios e óleo em composteiras caseiras.\nGuarde em recipiente fechado para evitar insetos e odores.\nÓleo de cozinha deve ser armazenado em garrafa PET e levado a um ponto de coleta.',
 3, 0.500, true, '#6D4C41', 'apple', 15, true, now(), now()),
(gen_random_uuid(), 'ELETRONICO', 'Eletrônico',
 'Celulares, carregadores, cabos, pilhas, baterias e pequenos eletroeletrônicos.',
 E'Nunca descarte eletrônicos no lixo comum: contêm metais pesados.\nApague seus dados pessoais antes de entregar celulares e computadores.\nIsole os polos de pilhas e baterias com fita adesiva.\nEntregue em ecopontos ou pontos de logística reversa (lojas e fabricantes).',
 20, 2.000, true, '#FB8C00', 'cpu', 15, true, now(), now()),
(gen_random_uuid(), 'REJEITO', 'Rejeito',
 'Resíduos sem possibilidade de reciclagem: papel higiênico, fraldas, bitucas e embalagens contaminadas.',
 E'Reduza ao máximo: o rejeito vai para o aterro sanitário.\nEmbale bem antes de colocar para a coleta comum.\nAntes de classificar como rejeito, verifique se o item não é reciclável.\nMedicamentos vencidos devem ir para farmácias com coleta específica.',
 1, 0.000, false, '#757575', 'trash-2', 10, true, now(), now());

-- ---------- Ecopontos (região de Taboão da Serra e zona oeste de São Paulo) ----------
insert into collection_points (id, name, address, neighborhood, latitude, longitude, opening_hours, active, created_at, updated_at)
values
(gen_random_uuid(), 'PEV UniFECAF – Campus Taboão', 'Av. Vida Nova, 166', 'Jardim Maria Rosa', -23.6019, -46.7526, 'Seg a Sex, 7h às 22h; Sáb, 8h às 13h', true, now(), now()),
(gen_random_uuid(), 'Ecoponto Jardim Maria Rosa', 'Rua Cesário Dau, 520', 'Jardim Maria Rosa', -23.6047, -46.7561, 'Seg a Sáb, 8h às 17h', true, now(), now()),
(gen_random_uuid(), 'Ecoponto Parque Pinheiros', 'Av. Aprígio Bezerra da Silva, 1200', 'Parque Pinheiros', -23.6128, -46.7689, 'Seg a Sáb, 7h às 19h', true, now(), now()),
(gen_random_uuid(), 'Ecoponto Centro de Taboão', 'Av. Dr. José Maciel, 300', 'Centro', -23.6229, -46.7840, 'Seg a Sáb, 8h às 18h; Dom, 8h às 12h', true, now(), now()),
(gen_random_uuid(), 'Ecoponto Jardim Record', 'Estrada São Francisco, 2100', 'Jardim Record', -23.6178, -46.7804, 'Seg a Sáb, 7h às 19h', true, now(), now()),
(gen_random_uuid(), 'Cooperativa Recicla Taboão', 'Rua das Palmeiras, 85', 'Vila Iasi', -23.6075, -46.7743, 'Seg a Sex, 8h às 17h', true, now(), now()),
(gen_random_uuid(), 'Horta Comunitária Pirajuçara (compostagem)', 'Rua Ribeirão Pirajuçara, 40', 'Jardim Helena', -23.6150, -46.7605, 'Ter a Dom, 7h às 12h', true, now(), now()),
(gen_random_uuid(), 'Ecoponto Vila Sônia', 'Av. Prof. Francisco Morato, 4800', 'Vila Sônia', -23.5930, -46.7400, 'Seg a Sáb, 6h às 22h; Dom, 6h às 18h', true, now(), now()),
(gen_random_uuid(), 'Ecoponto Butantã', 'Rua Alvarenga, 1500', 'Butantã', -23.5740, -46.7180, 'Seg a Sáb, 6h às 22h; Dom, 6h às 18h', true, now(), now()),
(gen_random_uuid(), 'Ecoponto Campo Limpo', 'Estrada do Campo Limpo, 3000', 'Campo Limpo', -23.6390, -46.7610, 'Seg a Sáb, 6h às 22h', true, now(), now()),
(gen_random_uuid(), 'PEV Supermercado Parque Laguna', 'Av. Elias Yazbek, 900', 'Parque Laguna', -23.6205, -46.7930, 'Todos os dias, 7h às 22h', true, now(), now()),
(gen_random_uuid(), 'Ponto de Eletrônicos – Shopping Taboão', 'Rod. Régis Bittencourt, 1835', 'Jardim Mituzi', -23.6230, -46.7710, 'Todos os dias, 10h às 22h', true, now(), now()),
(gen_random_uuid(), 'Ecoponto Jardim Mituzi', 'Rua José Milani, 210', 'Jardim Mituzi', -23.6305, -46.7765, 'Seg a Sáb, 8h às 17h', true, now(), now()),
(gen_random_uuid(), 'Ecoponto Embu das Artes', 'Av. Rotary, 1000', 'Centro (Embu das Artes)', -23.6440, -46.8480, 'Seg a Sáb, 7h às 17h', true, now(), now()),
(gen_random_uuid(), 'Cooperativa Coopervida', 'Rua Clemente Rocha, 350', 'Jardim Umarizal', -23.6290, -46.7480, 'Seg a Sex, 8h às 17h', true, now(), now()),
(gen_random_uuid(), 'Ecoponto Jardim Bonfiglioli', 'Rua Ananás, 120', 'Jardim Bonfiglioli', -23.5860, -46.7330, 'Seg a Sáb, 6h às 22h', true, now(), now()),
(gen_random_uuid(), 'PEV Condomínio Parque das Flores', 'Rua das Hortênsias, 300', 'Jardim Santa Rosa', -23.6100, -46.7470, 'Todos os dias, 24h (portaria)', true, now(), now()),
(gen_random_uuid(), 'Compostagem Feira Livre Vila Iasi', 'Praça da Feira, s/n', 'Vila Iasi', -23.6055, -46.7790, 'Sáb e Dom, 7h às 13h', true, now(), now());

insert into collection_point_categories (collection_point_id, category_code)
select cp.id, code
from collection_points cp
join (values
    ('PEV UniFECAF – Campus Taboão', array['PLASTICO', 'PAPEL', 'METAL', 'ELETRONICO']),
    ('Ecoponto Jardim Maria Rosa', array['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'ELETRONICO', 'REJEITO']),
    ('Ecoponto Parque Pinheiros', array['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'REJEITO']),
    ('Ecoponto Centro de Taboão', array['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'ELETRONICO', 'REJEITO']),
    ('Ecoponto Jardim Record', array['PLASTICO', 'PAPEL', 'VIDRO', 'METAL']),
    ('Cooperativa Recicla Taboão', array['PLASTICO', 'PAPEL', 'VIDRO', 'METAL']),
    ('Horta Comunitária Pirajuçara (compostagem)', array['ORGANICO']),
    ('Ecoponto Vila Sônia', array['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'ELETRONICO', 'REJEITO']),
    ('Ecoponto Butantã', array['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'ELETRONICO', 'REJEITO']),
    ('Ecoponto Campo Limpo', array['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'REJEITO']),
    ('PEV Supermercado Parque Laguna', array['PLASTICO', 'VIDRO', 'METAL', 'ELETRONICO']),
    ('Ponto de Eletrônicos – Shopping Taboão', array['ELETRONICO']),
    ('Ecoponto Jardim Mituzi', array['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'ORGANICO']),
    ('Ecoponto Embu das Artes', array['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'REJEITO']),
    ('Cooperativa Coopervida', array['PLASTICO', 'PAPEL', 'METAL']),
    ('Ecoponto Jardim Bonfiglioli', array['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'ELETRONICO']),
    ('PEV Condomínio Parque das Flores', array['PLASTICO', 'PAPEL', 'VIDRO', 'METAL', 'ORGANICO']),
    ('Compostagem Feira Livre Vila Iasi', array['ORGANICO'])
) as v(name, codes) on v.name = cp.name
cross join lateral unnest(v.codes) as code;

-- ---------- Catálogo de recompensas (parceiros ilustrativos) ----------
insert into rewards (id, name, description, cost_points, stock, icon, partner, active, created_at, updated_at)
values
(gen_random_uuid(), 'Café na cantina', 'Um café coado grátis na cantina do campus.', 120, 100, 'coffee', 'Cantina UniFECAF', true, now(), now()),
(gen_random_uuid(), 'Muda de árvore nativa', 'Retire uma muda de ipê, pitanga ou aroeira para plantar.', 150, 80, 'sprout', 'Viveiro Municipal (ilustrativo)', true, now(), now()),
(gen_random_uuid(), '10% na feira orgânica', 'Cupom de 10% de desconto em compras na feira orgânica.', 200, 100, 'shopping-basket', 'Feira Orgânica Vila Iasi (ilustrativo)', true, now(), now()),
(gen_random_uuid(), 'Ecobag de algodão', 'Sacola reutilizável de algodão orgânico com estampa Lixo Zero 2050.', 250, 60, 'shopping-bag', 'EcoTech Zero', true, now(), now()),
(gen_random_uuid(), 'Garrafa reutilizável', 'Garrafa térmica de aço inox (500 ml).', 400, 40, 'glass-water', 'EcoTech Zero', true, now(), now()),
(gen_random_uuid(), 'Plantio de 5 árvores', 'Doação convertida no plantio de 5 árvores em área de reflorestamento.', 500, 999, 'trees', 'ONG Verde Taboão (ilustrativo)', true, now(), now()),
(gen_random_uuid(), 'Ingresso de cinema', 'Um ingresso 2D válido de segunda a quinta.', 700, 30, 'ticket', 'Cine Taboão (ilustrativo)', true, now(), now()),
(gen_random_uuid(), 'Kit compostagem doméstica', 'Composteira de 3 caixas com minhocas e manual de uso.', 900, 15, 'flower-2', 'Horta Comunitária Pirajuçara (ilustrativo)', true, now(), now()),
(gen_random_uuid(), 'Crédito de transporte', 'R$ 10,00 de crédito no cartão de transporte.', 1000, 50, 'bus', 'Parceiro de mobilidade (ilustrativo)', true, now(), now());

-- ---------- Organizações (para ranking por turma/empresa) ----------
insert into organizations (id, name, type, created_at, updated_at)
values
(gen_random_uuid(), 'Ciência da Computação – 4º semestre', 'TURMA', now(), now()),
(gen_random_uuid(), 'Análise e Desenvolvimento de Sistemas – 2º semestre', 'TURMA', now(), now()),
(gen_random_uuid(), 'Engenharia de Software – 6º semestre', 'TURMA', now(), now()),
(gen_random_uuid(), 'Logística Verde Taboão (empresa parceira)', 'EMPRESA', now(), now()),
(gen_random_uuid(), 'Condomínio Parque das Flores', 'CONDOMINIO', now(), now()),
(gen_random_uuid(), 'Escola Estadual Jardim Verde (ilustrativa)', 'ESCOLA', now(), now());
