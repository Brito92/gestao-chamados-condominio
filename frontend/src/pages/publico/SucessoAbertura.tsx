import { Link } from 'react-router-dom';
import { LayoutPublico } from '@/components/LayoutPublico';

export function SucessoAbertura() {
  return (
    <LayoutPublico titulo="Solicitação enviada">
      <div className="flex flex-col items-center text-center gap-4 mt-10">
        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">
          ✓
        </div>
        <h1 className="font-display font-bold text-xl text-ardosia-800">
          Recebemos sua solicitação!
        </h1>
        <p className="text-ardosia-500 text-sm max-w-xs">
          O síndico vai analisar o problema relatado. Assim que a solicitação for aprovada,
          você receberá o número do chamado e as atualizações pelo WhatsApp informado.
        </p>
        <Link
          to="/"
          className="mt-4 bg-ardosia-800 text-white font-semibold rounded-2xl px-6 py-3 w-full"
        >
          Voltar ao início
        </Link>
      </div>
    </LayoutPublico>
  );
}
