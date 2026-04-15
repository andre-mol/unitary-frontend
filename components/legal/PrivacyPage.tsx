import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../Navbar';
import { Footer } from '../Footer';
import { usePageMeta } from '../../hooks/usePageMeta';
import { PRIVACY_VERSION, formatVersionDate } from '../../lib/legal/versions';
import { brand } from '../../config/brand';

export const PrivacyPage: React.FC = () => {
  usePageMeta({
    title: `Política de Privacidade | ${brand.name}`,
    description: 'Política de privacidade do Patriô. Saiba como coletamos, usamos e protegemos seus dados pessoais em conformidade com a LGPD.',
    ogTitle: `Política de Privacidade | ${brand.name}`,
    ogDescription: 'Política de privacidade do Patriô em conformidade com a LGPD.'
  });

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Política de Privacidade
            </h1>
            <p className="text-zinc-400 text-sm">
              Versão {PRIVACY_VERSION} • Última atualização: {formatVersionDate(PRIVACY_VERSION)}
            </p>
          </div>

          <div className="prose prose-invert max-w-none space-y-8 text-zinc-300">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Introdução</h2>
              <p className="leading-relaxed">
                O {brand.name} está comprometido em proteger sua privacidade. Esta Política de Privacidade 
                descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais, em 
                conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Dados Coletados</h2>
              <p className="leading-relaxed mb-4">
                Coletamos os seguintes tipos de dados pessoais:
              </p>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.1. Dados de Cadastro</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>E-mail:</strong> Necessário para criação de conta, autenticação e comunicação</li>
                <li><strong>Telefone:</strong> Coletado para verificação de conta e recuperação de senha</li>
                <li><strong>Nome completo:</strong> Para personalização do serviço</li>
                <li><strong>Senha:</strong> Armazenada de forma criptografada e segura</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.2. Dados de Uso</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Informações sobre como você usa a plataforma</li>
                <li>Dados de navegação e interação com a interface</li>
                <li>Logs de acesso e atividades na conta</li>
              </ul>

              <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.3. Dados Financeiros</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Informações sobre seus ativos e patrimônio (fornecidas voluntariamente por você)</li>
                <li>Dados de transações e eventos financeiros inseridos na plataforma</li>
                <li>Metas e planejamentos financeiros</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Finalidades do Tratamento</h2>
              <p className="leading-relaxed mb-4">
                Utilizamos seus dados pessoais para as seguintes finalidades:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Criação e gerenciamento de conta:</strong> Autenticação, verificação de identidade e segurança da conta</li>
                <li><strong>Prestação do serviço:</strong> Fornecimento das funcionalidades da plataforma de gestão patrimonial</li>
                <li><strong>Segurança:</strong> Prevenção de fraudes, detecção de atividades suspeitas e proteção de dados</li>
                <li><strong>Atualizações de produto:</strong> Informações sobre novas funcionalidades, melhorias e manutenções (consulte nossa <Link to="/communications" className="text-amber-500 hover:text-amber-400 underline">Política de Comunicações</Link>)</li>
                <li><strong>Marketing:</strong> Comunicações promocionais (apenas com seu consentimento explícito - consulte nossa <Link to="/communications" className="text-amber-500 hover:text-amber-400 underline">Política de Comunicações</Link>)</li>
                <li><strong>Suporte ao cliente:</strong> Resolução de problemas e atendimento</li>
                <li><strong>Melhoria do serviço:</strong> Análise de uso para aprimorar a experiência do usuário</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Retenção de Dados</h2>
              <p className="leading-relaxed">
                Mantemos seus dados pessoais apenas pelo tempo necessário para cumprir as finalidades 
                descritas nesta política, ou conforme exigido por lei. Quando você encerra sua conta, 
                excluímos ou anonimizamos seus dados pessoais, exceto quando a retenção for necessária 
                para cumprimento de obrigações legais ou resolução de disputas.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Compartilhamento de Dados</h2>
              <p className="leading-relaxed mb-4">
                Não vendemos seus dados pessoais. Podemos compartilhar suas informações apenas nas seguintes situações:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Prestadores de serviço:</strong> Empresas que nos auxiliam na operação da plataforma (hospedagem, análise, segurança), sob contratos que garantem a proteção dos dados</li>
                <li><strong>Obrigações legais:</strong> Quando exigido por lei, ordem judicial ou autoridade competente</li>
                <li><strong>Proteção de direitos:</strong> Para proteger nossos direitos, propriedade ou segurança, ou de nossos usuários</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Segurança dos Dados</h2>
              <p className="leading-relaxed">
                Implementamos medidas técnicas e organizacionais adequadas para proteger seus dados pessoais 
                contra acesso não autorizado, alteração, divulgação ou destruição. Isso inclui criptografia, 
                controles de acesso, monitoramento de segurança e treinamento regular de nossa equipe.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">7. Seus Direitos (LGPD)</h2>
              <p className="leading-relaxed mb-4">
                De acordo com a LGPD, você tem os seguintes direitos:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Confirmação e acesso:</strong> Saber se tratamos seus dados e acessar seus dados pessoais</li>
                <li><strong>Correção:</strong> Solicitar a correção de dados incompletos, inexatos ou desatualizados</li>
                <li><strong>Anonimização, bloqueio ou eliminação:</strong> Solicitar a remoção de dados desnecessários ou tratados em desconformidade com a LGPD</li>
                <li><strong>Portabilidade:</strong> Solicitar a portabilidade de seus dados para outro fornecedor de serviço</li>
                <li><strong>Eliminação:</strong> Solicitar a eliminação de dados tratados com base no seu consentimento</li>
                <li><strong>Informação:</strong> Obter informações sobre entidades públicas e privadas com as quais compartilhamos dados</li>
                <li><strong>Revogação do consentimento:</strong> Revogar seu consentimento a qualquer momento</li>
              </ul>
              <p className="leading-relaxed mt-4">
                Para exercer seus direitos, entre em contato conosco através das informações de contato 
                disponíveis em nosso site ou através das configurações da sua conta.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">8. Cookies e Tecnologias Similares</h2>
              <p className="leading-relaxed">
                Utilizamos cookies e tecnologias similares para melhorar sua experiência, analisar o uso 
                da plataforma e personalizar conteúdo. Você pode gerenciar suas preferências de cookies 
                através das configurações do seu navegador ou através do banner de consentimento exibido 
                em nosso site.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">9. Alterações nesta Política</h2>
              <p className="leading-relaxed">
                Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você sobre 
                alterações significativas através do e-mail cadastrado ou através de um aviso em nossa 
                plataforma. Recomendamos que você revise esta política regularmente.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">10. Contato</h2>
              <p className="leading-relaxed">
                Se você tiver dúvidas, preocupações ou solicitações relacionadas a esta Política de 
                Privacidade ou ao exercício de seus direitos sob a LGPD, entre em contato conosco através 
                das informações de contato disponíveis em nosso site.
              </p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};
