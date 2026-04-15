import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../Navbar';
import { Footer } from '../Footer';
import { usePageMeta } from '../../hooks/usePageMeta';
import { COMMUNICATIONS_VERSION, formatVersionDate } from '../../lib/legal/versions';
import { brand } from '../../config/brand';

export const CommunicationsPage: React.FC = () => {
  usePageMeta({
    title: `Política de Comunicações | ${brand.name}`,
    description: 'Política de comunicações do Patriô. Saiba como gerenciar suas preferências de e-mail, marketing e atualizações de produto.',
    ogTitle: `Política de Comunicações | ${brand.name}`,
    ogDescription: 'Política de comunicações do Patriô - gerencie suas preferências de e-mail.'
  });

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Política de Comunicações
            </h1>
            <p className="text-zinc-400 text-sm">
              Versão {COMMUNICATIONS_VERSION} • Última atualização: {formatVersionDate(COMMUNICATIONS_VERSION)}
            </p>
          </div>

          <div className="prose prose-invert max-w-none space-y-8 text-zinc-300">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Introdução</h2>
              <p className="leading-relaxed">
                Esta Política de Comunicações descreve os tipos de comunicações que você pode receber do 
                {brand.name}, como gerenciar suas preferências e como cancelar sua assinatura de comunicações 
                específicas. Respeitamos sua privacidade e oferecemos controle total sobre as comunicações 
                que você recebe.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Tipos de Comunicações</h2>
              
              <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.1. E-mails de Marketing (Opt-in Opcional)</h3>
              <p className="leading-relaxed mb-4">
                Os <strong>e-mails de marketing</strong> incluem:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Ofertas promocionais e descontos</li>
                <li>Conteúdo educacional sobre gestão patrimonial</li>
                <li>Webinars e eventos</li>
                <li>Parcerias e recomendações de produtos/serviços</li>
                <li>Newsletters com dicas e tendências do mercado</li>
              </ul>
              <p className="leading-relaxed mt-4">
                <strong>Estes e-mails são opcionais e requerem seu consentimento explícito (opt-in).</strong> 
                Você não receberá e-mails de marketing a menos que tenha optado por recebê-los durante o 
                cadastro ou posteriormente através das configurações da sua conta.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.2. Atualizações de Produto (Opt-out Padrão)</h3>
              <p className="leading-relaxed mb-4">
                As <strong>atualizações de produto</strong> incluem:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Anúncios de novas funcionalidades e melhorias</li>
                <li>Notificações sobre manutenções programadas</li>
                <li>Informações sobre mudanças importantes nos termos de serviço ou políticas</li>
                <li>Alertas de segurança relevantes para sua conta</li>
                <li>Orientações sobre como usar novas ferramentas</li>
              </ul>
              <p className="leading-relaxed mt-4">
                <strong>Estas comunicações são enviadas por padrão (opt-out)</strong> para garantir que 
                você esteja informado sobre melhorias e mudanças importantes no serviço. Você pode optar 
                por não receber atualizações de produto através das configurações da sua conta, mas 
                recomendamos mantê-las ativadas para não perder informações importantes.
              </p>

              <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.3. Comunicações Transacionais (Obrigatórias)</h3>
              <p className="leading-relaxed mb-4">
                As <strong>comunicações transacionais</strong> são essenciais para o funcionamento da sua conta:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Confirmação de cadastro e verificação de e-mail</li>
                <li>Recuperação de senha e redefinição de credenciais</li>
                <li>Notificações de segurança (tentativas de login, alterações de senha)</li>
                <li>Informações sobre sua assinatura e faturamento</li>
                <li>Respostas a solicitações de suporte</li>
              </ul>
              <p className="leading-relaxed mt-4">
                <strong>Estas comunicações não podem ser desativadas</strong> pois são necessárias para 
                a segurança e operação da sua conta.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Como Gerenciar Suas Preferências</h2>
              <p className="leading-relaxed mb-4">
                Você pode gerenciar suas preferências de comunicação a qualquer momento:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Através das Configurações da Conta:</strong> Acesse sua conta e vá para a 
                seção "Configurações" ou "Preferências de Comunicação" para ativar ou desativar e-mails 
                de marketing e atualizações de produto.</li>
                <li><strong>Através dos Links nos E-mails:</strong> Todos os e-mails de marketing e 
                atualizações de produto incluem um link para gerenciar suas preferências ou cancelar a 
                assinatura na parte inferior do e-mail.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Como Cancelar a Assinatura</h2>
              <p className="leading-relaxed mb-4">
                Para cancelar sua assinatura de e-mails de marketing ou atualizações de produto:
              </p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li><strong>Método 1 - Link no E-mail:</strong> Clique no link "Cancelar assinatura" ou 
                "Gerenciar preferências" localizado na parte inferior de qualquer e-mail de marketing ou 
                atualização de produto que você receber.</li>
                <li><strong>Método 2 - Configurações da Conta:</strong> Faça login na sua conta, acesse 
                "Configurações" e desative as opções de comunicação desejadas.</li>
                <li><strong>Método 3 - Contato Direto:</strong> Entre em contato conosco através das 
                informações de contato disponíveis em nosso site e solicite o cancelamento.</li>
              </ol>
              <p className="leading-relaxed mt-4">
                <strong>Nota:</strong> O cancelamento de e-mails de marketing ou atualizações de produto 
                não afeta as comunicações transacionais, que continuarão sendo enviadas conforme necessário 
                para a operação da sua conta.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Frequência das Comunicações</h2>
              <p className="leading-relaxed mb-4">
                <strong>E-mails de Marketing:</strong> Geralmente enviados de 1 a 4 vezes por mês, 
                dependendo das campanhas e conteúdo disponível.
              </p>
              <p className="leading-relaxed mb-4">
                <strong>Atualizações de Produto:</strong> Enviadas conforme necessário, geralmente quando 
                há lançamentos significativos, melhorias importantes ou mudanças relevantes. Normalmente 
                não excedem 2 a 3 e-mails por mês.
              </p>
              <p className="leading-relaxed">
                <strong>Comunicações Transacionais:</strong> Enviadas apenas quando necessário para a 
                operação da sua conta (ex: recuperação de senha, confirmações de ação).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Privacidade e Segurança</h2>
              <p className="leading-relaxed">
                Todas as comunicações são enviadas de forma segura e respeitamos sua privacidade. Não 
                compartilhamos suas preferências de comunicação com terceiros para fins de marketing. 
                Para mais informações sobre como tratamos seus dados pessoais, consulte nossa{' '}
                <Link to="/privacy" className="text-amber-500 hover:text-amber-400 underline">
                  Política de Privacidade
                </Link>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">7. Alterações nesta Política</h2>
              <p className="leading-relaxed">
                Podemos atualizar esta Política de Comunicações periodicamente. Alterações significativas 
                serão comunicadas através de e-mail ou notificação em nossa plataforma. Recomendamos que 
                você revise esta política regularmente.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">8. Contato</h2>
              <p className="leading-relaxed">
                Se você tiver dúvidas sobre esta Política de Comunicações ou precisar de ajuda para 
                gerenciar suas preferências, entre em contato conosco através das informações de contato 
                disponíveis em nosso site.
              </p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};
