/**
 * ============================================================
 * PRIVATE DATA SERVICE
 * ============================================================
 * 
 * Wrapper para acessar dados privados criptografados via Edge Function.
 * 
 * Este service chama a Edge Function 'private-data' que:
 * - Autentica o usuário via JWT
 * - Criptografa/descriptografa usando AES-GCM
 * - Armazena dados na tabela user_private_data
 * 
 * SEGURANÇA:
 * - A chave de criptografia (PATRIO_DATA_KEY_BASE64) nunca é exposta
 * - O Service Role Key nunca é exposto
 * - Toda validação é feita no backend
 * 
 * USO:
 * ```typescript
 * import { setPrivateData, getPrivateData } from './lib/privateDataService';
 * 
 * // Salvar dados
 * await setPrivateData({ 
 *   cpf: '123.456.789-00',
 *   endereco: 'Rua Exemplo, 123'
 * });
 * 
 * // Ler dados
 * const dados = await getPrivateData();
 * console.log(dados);
 * ```
 * 
 * CONFIGURAÇÃO NECESSÁRIA:
 * 1. Edge Function 'private-data' deve estar deployada
 * 2. Secret PATRIO_DATA_KEY_BASE64 deve estar configurado na Edge Function
 * 3. Tabela user_private_data deve existir (migration add_private_data.sql)
 * ============================================================
 */

import { getSupabaseClient } from '../config/supabase';

/**
 * Erro customizado para operações de dados privados
 */
export class PrivateDataError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'PrivateDataError';
  }
}

/**
 * AIDEV-NOTE: Private data payload type. Can contain any JSON-serializable data.
 * Values can be string, number, boolean, null, object, or array of these types.
 */
export type PrivateDataValue = string | number | boolean | null | PrivateDataObject | PrivateDataArray;

export interface PrivateDataObject {
  [key: string]: PrivateDataValue;
}

export type PrivateDataArray = PrivateDataValue[];

/**
 * Payload type for private data operations.
 * Can be an object with any JSON-serializable structure.
 */
export type PrivateDataPayload = PrivateDataObject;

/**
 * Salva dados privados criptografados
 * 
 * @param payload - Dados a serem criptografados (objeto JSON-serializável)
 * @throws PrivateDataError se houver erro na operação
 * 
 * @example
 * ```typescript
 * await setPrivateData({
 *   cpf: '123.456.789-00',
 *   endereco: 'Rua Exemplo, 123',
 *   observacoes: 'Dados sensíveis do usuário'
 * });
 * ```
 */
export async function setPrivateData(payload: PrivateDataPayload): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // Chama a Edge Function
    const { data, error } = await supabase.functions.invoke('private-data', {
      body: {
        action: 'set',
        payload: payload,
      },
    });

    if (error) {
      throw new PrivateDataError(
        `Erro ao chamar Edge Function: ${error.message}`,
        error.name
      );
    }

    // Verifica resposta
    if (!data || !data.success) {
      const errorMessage = data?.error || 'Erro desconhecido ao salvar dados';
      throw new PrivateDataError(errorMessage);
    }
  } catch (error) {
    if (error instanceof PrivateDataError) {
      throw error;
    }
    
    // Erro de rede ou outro erro inesperado
    throw new PrivateDataError(
      `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
}

/**
 * Lê dados privados descriptografados
 * 
 * @returns Dados descriptografados ou null se não existirem
 * @throws PrivateDataError se houver erro na operação
 * 
 * @example
 * ```typescript
 * const dados = await getPrivateData();
 * if (dados) {
 *   console.log('CPF:', dados.cpf);
 *   console.log('Endereço:', dados.endereco);
 * } else {
 *   console.log('Nenhum dado privado encontrado');
 * }
 * ```
 */
export async function getPrivateData(): Promise<PrivateDataPayload | null> {
  try {
    const supabase = getSupabaseClient();
    
    // Chama a Edge Function
    const { data, error } = await supabase.functions.invoke('private-data', {
      body: {
        action: 'get',
      },
    });

    if (error) {
      throw new PrivateDataError(
        `Erro ao chamar Edge Function: ${error.message}`,
        error.name
      );
    }

    // Verifica resposta
    if (!data || !data.success) {
      const errorMessage = data?.error || 'Erro desconhecido ao ler dados';
      throw new PrivateDataError(errorMessage);
    }

    // Retorna dados ou null se não existirem
    return data.data ?? null;
  } catch (error) {
    if (error instanceof PrivateDataError) {
      throw error;
    }
    
    // Erro de rede ou outro erro inesperado
    throw new PrivateDataError(
      `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
}

/**
 * ============================================================
 * COMO CONFIGURAR E TESTAR
 * ============================================================
 * 
 * 1. DEPLOY DA EDGE FUNCTION:
 *    - No terminal, na raiz do projeto:
 *      supabase functions deploy private-data
 * 
 * 2. CONFIGURAR SECRET:
 *    - No Supabase Dashboard → Edge Functions → Secrets
 *    - Adicionar: PATRIO_DATA_KEY_BASE64
 *    - Valor: chave de 32 bytes em base64
 *    - Como gerar:
 *      node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *      ou
 *      openssl rand -base64 32
 * 
 * 3. RODAR MIGRATION:
 *    - Execute o SQL em docs/supabase/migrations/add_private_data.sql
 *    - No Supabase Dashboard → SQL Editor
 * 
 * 4. TESTAR VIA CONSOLE:
 *    - Abra o console do navegador (F12)
 *    - Execute:
 *      import { setPrivateData, getPrivateData } from './lib/privateDataService';
 *      await setPrivateData({ teste: 'dados sensíveis' });
 *      const dados = await getPrivateData();
 *      console.log(dados);
 * 
 * ============================================================
 */

