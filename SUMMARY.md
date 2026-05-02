# Resumo Histórico de Desenvolvimento

## Sessão: 02/05/2026 22:20

### Status Atual
- Coluna `is_cleared` adicionada no schema (`setup_supabase.sql`) e mapeamento garantido no cadastro e atualização de transações.
- Cálculo de saldo global das contas revertido para ser totalitário (todas as transações entram, sem filtro).
- Exibição do "Saldo Atual" no Dashboard alterada para calcular dinamicamente a diferença (Receitas - Despesas) considerando as datas selecionadas.

### Arquivos Alterados
- `setup_supabase.sql`
- `src/app/page.tsx`

### Decisões Técnicas
- **SQL Updates:** `ALTER TABLE` implementado no script de configuração para resolver a ausência da coluna `is_cleared` que estava causando falhas de gravação.
- **Isolamento de Saldo do Dashboard:** O número grande no dashboard parou de consultar a `activeAccount.balance` (que é o total global), passando a computar `filteredIncome - filteredExpense`. Isso permite ao usuário ver o fluxo de caixa real do período sem afetar a integridade matemática da conta total.
- **Segurança de Tipos (Math/NaN):** Aplicado o encapsulamento `Number(t.amount || 0)` em todos os loops `reduce` para garantir que conversões implícitas não falhem nem retornem valores concatenados caso `amount` venha vazio ou como string da base de dados.

### Pendências (Backlog)
- Confirmar se a propriedade `is_cleared` (Transação Compensada) deve gerar alguma outra ramificação em relatórios PDF ou em filtros avançados no futuro.
- Executar e testar a funcionalidade da integração de OCR de faturas reais com a IA.
- **Ação Obrigatória do Usuário:** Rodar o SQL atualizado no Supabase para aplicar o schema novo em produção.

### Contexto de Erros
- **Bug Fixado:** "Aviso: Could not find the 'is_cleared' column of 'transactions' in the schema cache". Falha ao gravar a despesa corrigida provisionando a coluna através de `setup_supabase.sql`.

---

## Sessão: 02/05/2026 18:20

### Status Atual
- Identificada causa raiz da falha de upload: o bucket `receipts` não existe no Supabase.
- Melhorada a validação de formatos no frontend para evitar falsos negativos em ficheiros `.jpg` e `.pdf`.
- Disponibilizado script SQL para configuração manual do banco de dados.

### Arquivos Alterados
- `src/app/page.tsx`
- `setup_supabase.sql` (Novo arquivo)

### Decisões Técnicas
- **Validação Dupla:** Passamos a validar tanto o `MIME type` quanto a extensão do ficheiro como fallback, garantindo que ficheiros válidos não sejam bloqueados por inconsistências do navegador.
- **Tratamento de Erros de Infraestrutura:** O código agora identifica especificamente o erro `Bucket not found` e orienta o utilizador a realizar a configuração necessária.
- **Segurança (RLS):** O script SQL fornecido configura políticas de RLS granulares, permitindo leitura pública mas restringindo uploads apenas a utilizadores autenticados.

### Pendências (Backlog)
- **Ação Necessária do Utilizador:** Executar o script `setup_supabase.sql` no painel do Supabase.
- Integrar uma API real de OCR (ex: OpenAI Vision) para substituir o mock atual.
- Adicionar compressão de imagem no client-side para otimizar o storage.

---

## Sessão: 27/04/2026 22:48

### Status Atual
- Ajustada a funcionalidade de geração e download de relatórios PDF com a biblioteca jsPDF e jsPDF-autoTable.
- Implementado sistema de fallback para forçar o download programaticamente e contornar eventuais restrições do navegador ou ambiente de sandbox.

### Arquivos Alterados
- `src/app/page.tsx`

### Decisões Técnicas
- **Validação explícita de Blob:** Em vez de confiar apenas no método `doc.save()`, passamos a gerar o Blob do PDF de forma explícita (`doc.output('blob')`) e validar seu tamanho antes de continuar.
- **Fallback Programático de Download:** Implementamos um mecanismo de `try...catch` que, em caso de falha no `doc.save()`, gera uma URL temporária e tenta disparar o download com dois métodos: `window.open(url, '_blank')` para lidar com restrições severas de sandbox e uma âncora invisível (`<a>`) simulando um clique humano. 
- **Debug e Monitoramento:** Inserimos logs no console (`console.log('Tamanho do Blob:', pdfBlob.size)`) para monitorar o tamanho do arquivo durante o processo, permitindo diferenciar problemas de download de problemas reais na geração do relatório.

### Pendências (Backlog)
- Avaliar o retorno dos novos logs do console para confirmar se o tamanho do Blob do PDF é superior a zero.
- Testar o comportamento da aplicação em ambiente real e validar qual método de download (doc.save, nova aba, clique forçado) está de fato funcionando.
- Se o Blob retornar zerado, investigar o fluxo que precede a geração do PDF (população de tabelas e processamento de imagens do autoTable).

### Contexto de Erros
- **Bug Reportado:** O usuário clica para gerar o relatório, e o "toast" de sucesso é exibido, mas nenhum arquivo é baixado e nenhuma aba nova é aberta. Causa provável: falha silenciosa em navegadores restritivos/sandbox.
