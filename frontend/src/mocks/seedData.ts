/**
 * Dados de referência da demonstração (mesmos do V2__reference_data.sql do back-end) e
 * cadastro fictício de moradores/residências da região de Taboão da Serra.
 * Endereços, parceiros e pessoas são ilustrativos.
 */
import type { CategoryCode, OrganizationType } from '@/api/types';

export interface SementeCategoria {
  code: CategoryCode; name: string; description: string; guidance: string[]; pointsPerKg: number; co2FactorKg: number;
  recyclable: boolean; color: string; icon: string; maxKgPerDisposal: number;
}

export const CATEGORIAS: SementeCategoria[] = [
  {
    code: 'PLASTICO', name: 'Plástico', description: 'Garrafas PET, potes, frascos de limpeza, sacolas, tampas e embalagens plásticas em geral.',
    guidance: [
      'Enxágue as embalagens para remover restos de alimento.',
      'Amasse as garrafas PET para ocupar menos espaço.',
      'Tampas e rótulos também são recicláveis: descarte junto.',
      'Não misture embalagens metalizadas (salgadinho) nem isopor sujo.',
    ],
    pointsPerKg: 10, co2FactorKg: 1.5, recyclable: true, color: '#E53935', icon: 'milk', maxKgPerDisposal: 20,
  },
  {
    code: 'PAPEL', name: 'Papel e papelão', description: 'Jornais, revistas, folhas, caixas de papelão, embalagens longa vida e envelopes.',
    guidance: [
      'Mantenha o papel seco e limpo: papel engordurado vai para o rejeito.',
      'Desmonte as caixas de papelão antes de descartar.',
      'Embalagens longa vida devem ser enxaguadas e achatadas.',
      'Papel higiênico, guardanapo usado e fotografias não são recicláveis.',
    ],
    pointsPerKg: 6, co2FactorKg: 0.9, recyclable: true, color: '#1E88E5', icon: 'newspaper', maxKgPerDisposal: 30,
  },
  {
    code: 'VIDRO', name: 'Vidro', description: 'Garrafas, potes de conserva, frascos de perfume e copos de vidro.',
    guidance: [
      'Enxágue e retire as tampas (que vão para metal ou plástico).',
      'Embrulhe vidros quebrados em papel grosso e identifique o pacote.',
      'Espelhos, lâmpadas e vidros temperados NÃO vão para a reciclagem comum.',
      'Não é necessário retirar os rótulos.',
    ],
    pointsPerKg: 5, co2FactorKg: 0.3, recyclable: true, color: '#43A047', icon: 'wine', maxKgPerDisposal: 25,
  },
  {
    code: 'METAL', name: 'Metal', description: 'Latas de alumínio e aço, tampas metálicas, panelas sem cabo e pequenas sucatas.',
    guidance: [
      'Amasse as latas para economizar espaço.',
      'Enxágue latas de alimentos para evitar odores.',
      'Aerossóis só podem ser descartados totalmente vazios.',
      'Pilhas e baterias NÃO são metal comum: leve a um ponto de eletrônicos.',
    ],
    pointsPerKg: 12, co2FactorKg: 3.5, recyclable: true, color: '#FDD835', icon: 'cylinder', maxKgPerDisposal: 20,
  },
  {
    code: 'ORGANICO', name: 'Orgânico', description: 'Restos de frutas, legumes, cascas de ovo, borra de café e folhas secas (compostáveis).',
    guidance: [
      'Separe apenas restos vegetais para a compostagem doméstica ou comunitária.',
      'Evite carnes, laticínios e óleo em composteiras caseiras.',
      'Guarde em recipiente fechado para evitar insetos e odores.',
      'Óleo de cozinha deve ser armazenado em garrafa PET e levado a um ponto de coleta.',
    ],
    pointsPerKg: 3, co2FactorKg: 0.5, recyclable: true, color: '#6D4C41', icon: 'apple', maxKgPerDisposal: 15,
  },
  {
    code: 'ELETRONICO', name: 'Eletrônico', description: 'Celulares, carregadores, cabos, pilhas, baterias e pequenos eletroeletrônicos.',
    guidance: [
      'Nunca descarte eletrônicos no lixo comum: contêm metais pesados.',
      'Apague seus dados pessoais antes de entregar celulares e computadores.',
      'Isole os polos de pilhas e baterias com fita adesiva.',
      'Entregue em ecopontos ou pontos de logística reversa (lojas e fabricantes).',
    ],
    pointsPerKg: 20, co2FactorKg: 2.0, recyclable: true, color: '#FB8C00', icon: 'cpu', maxKgPerDisposal: 15,
  },
  {
    code: 'REJEITO', name: 'Rejeito', description: 'Resíduos sem possibilidade de reciclagem: papel higiênico, fraldas, bitucas e embalagens contaminadas.',
    guidance: [
      'Reduza ao máximo: o rejeito vai para o aterro sanitário.',
      'Embale bem antes de colocar para a coleta comum.',
      'Antes de classificar como rejeito, verifique se o item não é reciclável.',
      'Medicamentos vencidos devem ir para farmácias com coleta específica.',
    ],
    pointsPerKg: 1, co2FactorKg: 0, recyclable: false, color: '#757575', icon: 'trash-2', maxKgPerDisposal: 10,
  },
];

const TODOS_SECOS: CategoryCode[] = ['PLASTICO', 'PAPEL', 'VIDRO', 'METAL'];

export const ECOPONTOS: { name: string; address: string; neighborhood: string; latitude: number; longitude: number; openingHours: string; categories: CategoryCode[] }[] = [
  { name: 'PEV UniFECAF – Campus Taboão', address: 'Av. Vida Nova, 166', neighborhood: 'Jardim Maria Rosa', latitude: -23.6019, longitude: -46.7526, openingHours: 'Seg a Sex, 7h às 22h; Sáb, 8h às 13h', categories: ['PLASTICO', 'PAPEL', 'METAL', 'ELETRONICO'] },
  { name: 'Ecoponto Jardim Maria Rosa', address: 'Rua Cesário Dau, 520', neighborhood: 'Jardim Maria Rosa', latitude: -23.6047, longitude: -46.7561, openingHours: 'Seg a Sáb, 8h às 17h', categories: [...TODOS_SECOS, 'ELETRONICO', 'REJEITO'] },
  { name: 'Ecoponto Parque Pinheiros', address: 'Av. Aprígio Bezerra da Silva, 1200', neighborhood: 'Parque Pinheiros', latitude: -23.6128, longitude: -46.7689, openingHours: 'Seg a Sáb, 7h às 19h', categories: [...TODOS_SECOS, 'REJEITO'] },
  { name: 'Ecoponto Centro de Taboão', address: 'Av. Dr. José Maciel, 300', neighborhood: 'Centro', latitude: -23.6229, longitude: -46.784, openingHours: 'Seg a Sáb, 8h às 18h; Dom, 8h às 12h', categories: [...TODOS_SECOS, 'ELETRONICO', 'REJEITO'] },
  { name: 'Ecoponto Jardim Record', address: 'Estrada São Francisco, 2100', neighborhood: 'Jardim Record', latitude: -23.6178, longitude: -46.7804, openingHours: 'Seg a Sáb, 7h às 19h', categories: [...TODOS_SECOS] },
  { name: 'Cooperativa Recicla Taboão', address: 'Rua das Palmeiras, 85', neighborhood: 'Vila Iasi', latitude: -23.6075, longitude: -46.7743, openingHours: 'Seg a Sex, 8h às 17h', categories: [...TODOS_SECOS] },
  { name: 'Horta Comunitária Pirajuçara (compostagem)', address: 'Rua Ribeirão Pirajuçara, 40', neighborhood: 'Jardim Helena', latitude: -23.615, longitude: -46.7605, openingHours: 'Ter a Dom, 7h às 12h', categories: ['ORGANICO'] },
  { name: 'Ecoponto Vila Sônia', address: 'Av. Prof. Francisco Morato, 4800', neighborhood: 'Vila Sônia', latitude: -23.593, longitude: -46.74, openingHours: 'Seg a Sáb, 6h às 22h; Dom, 6h às 18h', categories: [...TODOS_SECOS, 'ELETRONICO', 'REJEITO'] },
  { name: 'Ecoponto Butantã', address: 'Rua Alvarenga, 1500', neighborhood: 'Butantã', latitude: -23.574, longitude: -46.718, openingHours: 'Seg a Sáb, 6h às 22h; Dom, 6h às 18h', categories: [...TODOS_SECOS, 'ELETRONICO', 'REJEITO'] },
  { name: 'Ecoponto Campo Limpo', address: 'Estrada do Campo Limpo, 3000', neighborhood: 'Campo Limpo', latitude: -23.639, longitude: -46.761, openingHours: 'Seg a Sáb, 6h às 22h', categories: [...TODOS_SECOS, 'REJEITO'] },
  { name: 'PEV Supermercado Parque Laguna', address: 'Av. Elias Yazbek, 900', neighborhood: 'Parque Laguna', latitude: -23.6205, longitude: -46.793, openingHours: 'Todos os dias, 7h às 22h', categories: ['PLASTICO', 'VIDRO', 'METAL', 'ELETRONICO'] },
  { name: 'Ponto de Eletrônicos – Shopping Taboão', address: 'Rod. Régis Bittencourt, 1835', neighborhood: 'Jardim Mituzi', latitude: -23.623, longitude: -46.771, openingHours: 'Todos os dias, 10h às 22h', categories: ['ELETRONICO'] },
  { name: 'Ecoponto Jardim Mituzi', address: 'Rua José Milani, 210', neighborhood: 'Jardim Mituzi', latitude: -23.6305, longitude: -46.7765, openingHours: 'Seg a Sáb, 8h às 17h', categories: [...TODOS_SECOS, 'ORGANICO'] },
  { name: 'Ecoponto Embu das Artes', address: 'Av. Rotary, 1000', neighborhood: 'Centro (Embu das Artes)', latitude: -23.644, longitude: -46.848, openingHours: 'Seg a Sáb, 7h às 17h', categories: [...TODOS_SECOS, 'REJEITO'] },
  { name: 'Cooperativa Coopervida', address: 'Rua Clemente Rocha, 350', neighborhood: 'Jardim Umarizal', latitude: -23.629, longitude: -46.748, openingHours: 'Seg a Sex, 8h às 17h', categories: ['PLASTICO', 'PAPEL', 'METAL'] },
  { name: 'Ecoponto Jardim Bonfiglioli', address: 'Rua Ananás, 120', neighborhood: 'Jardim Bonfiglioli', latitude: -23.586, longitude: -46.733, openingHours: 'Seg a Sáb, 6h às 22h', categories: [...TODOS_SECOS, 'ELETRONICO'] },
  { name: 'PEV Condomínio Parque das Flores', address: 'Rua das Hortênsias, 300', neighborhood: 'Jardim Santa Rosa', latitude: -23.61, longitude: -46.747, openingHours: 'Todos os dias, 24h (portaria)', categories: [...TODOS_SECOS, 'ORGANICO'] },
  { name: 'Compostagem Feira Livre Vila Iasi', address: 'Praça da Feira, s/n', neighborhood: 'Vila Iasi', latitude: -23.6055, longitude: -46.779, openingHours: 'Sáb e Dom, 7h às 13h', categories: ['ORGANICO'] },
];

export const RECOMPENSAS = [
  { name: 'Café na cantina', description: 'Um café coado grátis na cantina do campus.', costPoints: 120, stock: 100, icon: 'coffee', partner: 'Cantina UniFECAF' },
  { name: 'Muda de árvore nativa', description: 'Retire uma muda de ipê, pitanga ou aroeira para plantar.', costPoints: 150, stock: 80, icon: 'sprout', partner: 'Viveiro Municipal (ilustrativo)' },
  { name: '10% na feira orgânica', description: 'Cupom de 10% de desconto em compras na feira orgânica.', costPoints: 200, stock: 100, icon: 'shopping-basket', partner: 'Feira Orgânica Vila Iasi (ilustrativo)' },
  { name: 'Ecobag de algodão', description: 'Sacola reutilizável de algodão orgânico com estampa Lixo Zero 2050.', costPoints: 250, stock: 60, icon: 'shopping-bag', partner: 'EcoTech Zero' },
  { name: 'Garrafa reutilizável', description: 'Garrafa térmica de aço inox (500 ml).', costPoints: 400, stock: 40, icon: 'glass-water', partner: 'EcoTech Zero' },
  { name: 'Plantio de 5 árvores', description: 'Doação convertida no plantio de 5 árvores em área de reflorestamento.', costPoints: 500, stock: 999, icon: 'trees', partner: 'ONG Verde Taboão (ilustrativo)' },
  { name: 'Ingresso de cinema', description: 'Um ingresso 2D válido de segunda a quinta.', costPoints: 700, stock: 30, icon: 'ticket', partner: 'Cine Taboão (ilustrativo)' },
  { name: 'Kit compostagem doméstica', description: 'Composteira de 3 caixas com minhocas e manual de uso.', costPoints: 900, stock: 3, icon: 'flower-2', partner: 'Horta Comunitária Pirajuçara (ilustrativo)' },
  { name: 'Crédito de transporte', description: 'R$ 10,00 de crédito no cartão de transporte.', costPoints: 1000, stock: 0, icon: 'bus', partner: 'Parceiro de mobilidade (ilustrativo)' },
];

export const ORGANIZACOES: { key: string; name: string; type: OrganizationType }[] = [
  { key: 'CC4', name: 'Ciência da Computação – 4º semestre', type: 'TURMA' },
  { key: 'ADS2', name: 'Análise e Desenvolvimento de Sistemas – 2º semestre', type: 'TURMA' },
  { key: 'ES6', name: 'Engenharia de Software – 6º semestre', type: 'TURMA' },
  { key: 'LOG', name: 'Logística Verde Taboão (empresa parceira)', type: 'EMPRESA' },
  { key: 'COND', name: 'Condomínio Parque das Flores', type: 'CONDOMINIO' },
  { key: 'ESC', name: 'Escola Estadual Jardim Verde (ilustrativa)', type: 'ESCOLA' },
];

/** Senha de todos os moradores fictícios (além das 3 contas de demonstração). */
export const SENHA_MORADOR = 'Recicla@2050';

export interface SementeResidencia {
  key: string; name: string; neighborhood: string; address: string;
  members: { name: string; email: string; org: string | null; activity: number; joinedDaysAgo: number }[];
}

export const RESIDENCIAS: SementeResidencia[] = [
  {
    key: 'MARIANA', name: 'Casa da Mariana', neighborhood: 'Jardim Maria Rosa', address: 'Rua Cesário Dau, 610 – Jardim Maria Rosa, Taboão da Serra',
    members: [
      { name: 'Rafael Alves', email: 'rafael.alves@exemplo.com.br', org: 'LOG', activity: 0.7, joinedDaysAgo: 300 },
      { name: 'Lúcia Alves', email: 'lucia.alves@exemplo.com.br', org: null, activity: 0.9, joinedDaysAgo: 280 },
    ],
  },
  {
    key: 'SOUZA', name: 'Família Souza', neighborhood: 'Parque Pinheiros', address: 'Rua Itapecerica, 455 – Parque Pinheiros, Taboão da Serra',
    members: [
      { name: 'João Souza', email: 'joao.souza@exemplo.com.br', org: 'LOG', activity: 1.3, joinedDaysAgo: 360 },
      { name: 'Patrícia Souza', email: 'patricia.souza@exemplo.com.br', org: null, activity: 1.1, joinedDaysAgo: 350 },
      { name: 'Pedro Souza', email: 'pedro.souza@exemplo.com.br', org: 'ESC', activity: 0.6, joinedDaysAgo: 200 },
    ],
  },
  {
    key: 'REPUBLICA', name: 'República Verde UniFECAF', neighborhood: 'Jardim Maria Rosa', address: 'Rua Vereador José Brazil, 92 – Jardim Maria Rosa, Taboão da Serra',
    members: [
      { name: 'Gabriel Martins', email: 'gabriel.martins@exemplo.com.br', org: 'CC4', activity: 1.5, joinedDaysAgo: 330 },
      { name: 'Larissa Prado', email: 'larissa.prado@exemplo.com.br', org: 'ADS2', activity: 1.2, joinedDaysAgo: 240 },
      { name: 'Thiago Rocha', email: 'thiago.rocha@exemplo.com.br', org: 'ES6', activity: 0.8, joinedDaysAgo: 180 },
      { name: 'Beatriz Lima', email: 'beatriz.lima@exemplo.com.br', org: 'CC4', activity: 1.0, joinedDaysAgo: 120 },
    ],
  },
  {
    key: 'APTO42', name: 'Apto 42 – Parque das Flores', neighborhood: 'Jardim Santa Rosa', address: 'Rua das Hortênsias, 300, apto 42 – Jardim Santa Rosa, Taboão da Serra',
    members: [
      { name: 'Fernanda Castro', email: 'fernanda.castro@exemplo.com.br', org: 'COND', activity: 1.4, joinedDaysAgo: 340 },
      { name: 'Ricardo Castro', email: 'ricardo.castro@exemplo.com.br', org: 'COND', activity: 0.5, joinedDaysAgo: 330 },
    ],
  },
  {
    key: 'NAKAMURA', name: 'Família Nakamura', neighborhood: 'Vila Sônia', address: 'Rua Dr. Luiz Migliano, 1210 – Vila Sônia, São Paulo',
    members: [
      { name: 'Kenji Nakamura', email: 'kenji.nakamura@exemplo.com.br', org: 'ES6', activity: 1.2, joinedDaysAgo: 310 },
      { name: 'Aiko Nakamura', email: 'aiko.nakamura@exemplo.com.br', org: null, activity: 1.0, joinedDaysAgo: 300 },
      { name: 'Hiro Nakamura', email: 'hiro.nakamura@exemplo.com.br', org: 'ADS2', activity: 0.4, joinedDaysAgo: 25 },
    ],
  },
  {
    key: 'OLIVEIRA', name: 'Casa dos Oliveira', neighborhood: 'Vila Iasi', address: 'Rua das Palmeiras, 140 – Vila Iasi, Taboão da Serra',
    members: [
      { name: 'Marcos Oliveira', email: 'marcos.oliveira@exemplo.com.br', org: 'LOG', activity: 0.6, joinedDaysAgo: 270 },
      { name: 'Sandra Oliveira', email: 'sandra.oliveira@exemplo.com.br', org: null, activity: 0.8, joinedDaysAgo: 260 },
    ],
  },
  {
    key: 'SANTOS', name: 'Família Santos', neighborhood: 'Jardim Record', address: 'Estrada São Francisco, 1980 – Jardim Record, Taboão da Serra',
    members: [
      { name: 'Antônio Santos', email: 'antonio.santos@exemplo.com.br', org: null, activity: 0.9, joinedDaysAgo: 290 },
      { name: 'Cláudia Santos', email: 'claudia.santos@exemplo.com.br', org: 'ESC', activity: 1.1, joinedDaysAgo: 280 },
      { name: 'Vitor Santos', email: 'vitor.santos@exemplo.com.br', org: 'ESC', activity: 0.5, joinedDaysAgo: 150 },
    ],
  },
  {
    key: 'FERREIRA', name: 'Lar Ferreira', neighborhood: 'Centro', address: 'Av. Dr. José Maciel, 512 – Centro, Taboão da Serra',
    members: [
      { name: 'Helena Ferreira', email: 'helena.ferreira@exemplo.com.br', org: 'CC4', activity: 1.0, joinedDaysAgo: 220 },
      { name: 'Paulo Ferreira', email: 'paulo.ferreira@exemplo.com.br', org: null, activity: 0.3, joinedDaysAgo: 210 },
    ],
  },
  {
    key: 'COSTA', name: 'Família Costa', neighborhood: 'Jardim Mituzi', address: 'Rua José Milani, 388 – Jardim Mituzi, Taboão da Serra',
    members: [
      { name: 'Bruno Costa', email: 'bruno.costa@exemplo.com.br', org: 'ADS2', activity: 0.9, joinedDaysAgo: 160 },
      { name: 'Camila Costa', email: 'camila.costa@exemplo.com.br', org: null, activity: 0.7, joinedDaysAgo: 18 },
    ],
  },
  {
    key: 'PEREIRA', name: 'Sítio Urbano Pirajuçara', neighborhood: 'Jardim Helena', address: 'Rua Ribeirão Pirajuçara, 77 – Jardim Helena, Taboão da Serra',
    members: [
      { name: 'Rosa Pereira', email: 'rosa.pereira@exemplo.com.br', org: null, activity: 1.3, joinedDaysAgo: 365 },
      { name: 'Joaquim Pereira', email: 'joaquim.pereira@exemplo.com.br', org: null, activity: 0.6, joinedDaysAgo: 365 },
    ],
  },
];

/** Ruas usadas nas solicitações de coleta, por bairro. */
export const RUAS: Record<string, string[]> = {
  'Jardim Maria Rosa': ['Rua Cesário Dau', 'Av. Vida Nova', 'Rua Vereador José Brazil', 'Rua Maria Rosa'],
  'Parque Pinheiros': ['Av. Aprígio Bezerra da Silva', 'Rua Itapecerica', 'Rua dos Pinheiros'],
  'Centro': ['Av. Dr. José Maciel', 'Rua Elizabeth', 'Rua Benedito Raymundo'],
  'Jardim Record': ['Estrada São Francisco', 'Rua Record', 'Rua Ernesto Bazzo'],
  'Vila Iasi': ['Rua das Palmeiras', 'Rua Jamil Iasi', 'Praça da Feira'],
  'Jardim Helena': ['Rua Ribeirão Pirajuçara', 'Rua Helena Maria', 'Rua das Acácias'],
  'Vila Sônia': ['Av. Prof. Francisco Morato', 'Rua Dr. Luiz Migliano', 'Rua Sebastião Gil'],
  'Jardim Mituzi': ['Rua José Milani', 'Rua Mituzi', 'Rua Kenkiti Shimomoto'],
  'Jardim Santa Rosa': ['Rua das Hortênsias', 'Rua Santa Rosa', 'Rua das Orquídeas'],
  'Jardim Bonfiglioli': ['Rua Ananás', 'Rua Bonfiglioli', 'Rua Caraíbas'],
};

export const MOTIVOS_RECUSA = [
  'A foto não mostra o material informado.',
  'Quantidade incompatível com a foto enviada.',
  'Material contaminado: deveria ser classificado como rejeito.',
  'Descarte duplicado (mesma foto de outro registro).',
  'Foto ilegível; registre novamente com uma imagem nítida.',
];

export const OBSERVACOES_DESCARTE = [
  'Garrafas lavadas e amassadas.', 'Caixas desmontadas.', 'Separado durante a faxina do fim de semana.',
  'Entregue no ecoponto perto de casa.', 'Potes de vidro da cozinha.', 'Latinhas da festa de aniversário.',
  'Carregadores e cabos antigos.', 'Restos de feira para a composteira.', null, null, null, null, null, null,
];
