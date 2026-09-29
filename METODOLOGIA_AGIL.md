# Metodologia Ágil — GuardPets

## Metodologia adotada

**Kanban pessoal + entrega contínua**, adaptado para desenvolvimento individual
com validação constante do responsável pelo projeto (papel de Product Owner).
Não seguimos Scrum formal com cerimônias fixas (não há daily/sprint de time,
já que o desenvolvimento é individual) — o que se aplica são os princípios
centrais do Manifesto Ágil que fazem sentido nesse contexto:

- **Entregas incrementais e frequentes**, em vez de um único "big bang" no final.
- **Colaboração constante com quem decide as prioridades** (revisão a cada
  entrega, não só no fim do projeto).
- **Resposta a mudanças de prioridade** conforme o projeto evoluía — vários
  commits corrigem ou refazem decisões anteriores a partir de feedback
  (ex.: layout consolidado em página única, depois estrutura revista de novo).
- **Simplicidade e entrega de valor de verdade**, priorizando o que
  funcionava sobre o que só "parecia" funcionar (vários commits de correção
  imediatamente após uma feature nova, característico de ciclo curto de
  feedback).

## Papéis

| Papel | Responsável |
|---|---|
| Product Owner (prioriza o que entra em cada entrega) | Aluno responsável pelo projeto |
| Desenvolvedor | Aluno responsável pelo projeto |
| Ferramenta de apoio ao desenvolvimento | Claude Code (par de programação) |

## Quadro de trabalho (Kanban)

O backlog foi conduzido de forma informal, por prioridade de conversa —
funcionalmente equivalente a um quadro **To Do → Em andamento → Concluído**,
refletido diretamente na sequência de commits do Git (cada commit representa
uma entrega concluída e testada antes de avançar pra próxima).

## Iterações reais (extraídas do histórico do Git)

O projeto teve **31 commits** ao longo de 3 ciclos de trabalho:

### Iteração 1 — Fundação (08/06/2026)
Setup inicial do projeto, deploy na Vercel, roteamento da API e dos arquivos
estáticos, conexão inicial do login/cadastro ao backend.

### Iteração 2 — Funcionalidades (15/06/2026)
Maior ciclo do projeto: painel do agente (denúncias/adoções), estrutura
multi-página com o catálogo de 16 animais, autenticação via Supabase Auth
com confirmação de e-mail, transformação em PWA instalável, polimento visual
(scroll, animações, lazy load). Vários commits de correção logo em seguida
a cada feature nova — ciclo curto de "implementa → testa → corrige".

### Iteração 3 — Reestruturação (29/09/2026)
Reconstrução do backend com banco de dados real (antes perdido), arquitetura
em camadas (repositories/services), remoção de funcionalidades que só
pareciam funcionar mas não persistiam dado nenhum (voluntariado, mapa,
rastreamento de protocolo), correções de bugs encontradas em revisão de
código, paginação nas consultas e suíte de testes automatizados.

## Artefatos usados como evidência

- **Histórico do Git** (`git log`) como registro de cada entrega — funciona
  como "sprint log": o que foi feito, quando, e por quê (mensagem do commit).
- **Revisão de código antes de cada entrega maior** (seção de testes/QSS
  documenta o resultado dessa prática na Iteração 3).
- **Este documento**, atualizado a cada entrega significativa.
