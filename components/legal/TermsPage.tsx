import React from 'react';
import { Navbar } from '../Navbar';
import { Footer } from '../Footer';
import { usePageMeta } from '../../hooks/usePageMeta';
import { TERMS_VERSION, formatVersionDate } from '../../lib/legal/versions';
import { brand } from '../../config/brand';

export const TermsPage: React.FC = () => {
  usePageMeta({
    title: `Termos de Uso | ${brand.name}`,
    description: 'Termos de uso e condições de serviço do Patriô. Leia nossos termos antes de usar a plataforma.',
    ogTitle: `Termos de Uso | ${brand.name}`,
    ogDescription: 'Termos de uso e condições de serviço do Patriô.'
  });

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Termos de Uso
            </h1>
            <p className="text-zinc-400 text-sm">
              Versão {TERMS_VERSION} • Última atualização: {formatVersionDate(TERMS_VERSION)}
            </p>
          </div>

          <div className="prose prose-invert max-w-none space-y-8 text-zinc-300">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">1. Aceitação dos Termos</h2>
              <p className="leading-relaxed">
                Ao acessar e usar o {brand.name}, você concorda em cumprir e estar vinculado a estes Termos de Uso. 
                Se você não concordar com qualquer parte destes termos, não deve usar nosso serviço.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">2. Definições e Escopo do Serviço</h2>
              <p className="leading-relaxed mb-4">
                O {brand.name} é uma plataforma de gestão patrimonial que permite aos usuários:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Consolidar e organizar informações sobre seus ativos financeiros</li>
                <li>Realizar análises e cálculos relacionados ao patrimônio</li>
                <li>Definir metas e planejamento financeiro</li>
                <li>Acessar ferramentas de cálculo e relatórios</li>
              </ul>
              <p className="leading-relaxed mt-4">
                O {brand.name} não é um banco, corretora ou instituição financeira. Não realizamos transações 
                financeiras, não oferecemos produtos de investimento e não fornecemos consultoria financeira regulamentada.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">3. Responsabilidades do Usuário</h2>
              <p className="leading-relaxed mb-4">
                Você é responsável por:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Manter a confidencialidade de suas credenciais de acesso</li>
                <li>Fornecer informações precisas e atualizadas</li>
                <li>Usar o serviço apenas para fins legais e de acordo com estes termos</li>
                <li>Não compartilhar sua conta com terceiros</li>
                <li>Notificar-nos imediatamente sobre qualquer uso não autorizado de sua conta</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">4. Limitações de Responsabilidade</h2>
              <p className="leading-relaxed mb-4">
                O {brand.name} é fornecido "como está" e "conforme disponível". Não garantimos que:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>O serviço será ininterrupto, seguro ou livre de erros</li>
                <li>Os resultados obtidos serão precisos ou confiáveis</li>
                <li>Os defeitos serão corrigidos</li>
              </ul>
              <p className="leading-relaxed mt-4">
                Em nenhuma circunstância seremos responsáveis por danos diretos, indiretos, incidentais, 
                especiais ou consequenciais resultantes do uso ou incapacidade de usar nosso serviço.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">5. Propriedade Intelectual</h2>
              <p className="leading-relaxed">
                Todo o conteúdo do {brand.name}, incluindo mas não limitado a textos, gráficos, logotipos, 
                ícones, imagens, compilações de dados e software, é propriedade do {brand.name} ou de seus 
                fornecedores de conteúdo e está protegido por leis de direitos autorais e outras leis de 
                propriedade intelectual.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">6. Modificações dos Termos</h2>
              <p className="leading-relaxed">
                Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entrarão 
                em vigor imediatamente após a publicação. O uso continuado do serviço após as alterações constitui 
                sua aceitação dos novos termos. Recomendamos que você revise periodicamente esta página para 
                estar ciente de quaisquer alterações.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">7. Encerramento de Conta</h2>
              <p className="leading-relaxed">
                Reservamo-nos o direito de suspender ou encerrar sua conta a qualquer momento, com ou sem 
                aviso prévio, por violação destes termos ou por qualquer outra razão que consideremos apropriada. 
                Você também pode encerrar sua conta a qualquer momento através das configurações da sua conta.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">8. Lei Aplicável</h2>
              <p className="leading-relaxed">
                Estes termos são regidos pelas leis do Brasil. Qualquer disputa relacionada a estes termos 
                será resolvida nos tribunais competentes do Brasil.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">9. Contato</h2>
              <p className="leading-relaxed">
                Se você tiver dúvidas sobre estes Termos de Uso, entre em contato conosco através das 
                informações de contato disponíveis em nosso site.
              </p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};
