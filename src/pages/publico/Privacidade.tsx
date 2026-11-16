import { api } from '../../lib/api';
import { useConsulta } from '../../lib/useConsulta';

export default function Privacidade() {
  const { dados: c } = useConsulta(api.getConfigPublica, []);
  return (
    <article className="mx-auto max-w-2xl space-y-6 px-4 py-10 text-zinc-300">
      <h1 className="titulo">Privacidade</h1>
      <section>
        <h2 className="font-semibold text-zinc-50">Quais dados coletamos</h2>
        <p className="mt-1">
          Apenas o seu nome, o número de WhatsApp e, se você quiser, uma observação sobre o
          atendimento.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-zinc-50">Para que usamos</h2>
        <p className="mt-1">
          Para reservar o seu horário e enviar um lembrete pelo WhatsApp cerca de 2 horas antes. Não
          enviamos promoções nem repassamos seus dados a terceiros.
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-zinc-50">Como pedir a exclusão</h2>
        <p className="mt-1">
          Fale com a barbearia
          {c && (
            <>
              {' '}
              pelo{' '}
              <a href={`https://wa.me/${c.telefone_contato}`} className="text-gold-300 underline">
                WhatsApp
              </a>{' '}
              ou pelo Instagram {c.instagram_usuario}
            </>
          )}{' '}
          e pediremos a remoção do seu nome e telefone dos nossos registros.
        </p>
      </section>
    </article>
  );
}
