import { Link } from 'react-router-dom';

export function Home() {
  return (
    <div className="min-h-screen bg-ardosia-800 flex flex-col justify-between px-6 py-10">
      <div className="max-w-lg w-full mx-auto flex-1 flex flex-col justify-center gap-12">
        <div className="text-center">
          <p className="font-display font-extrabold text-5xl text-white mb-3">Chamados Condomínio</p>
          <p className="text-ardosia-200 text-base leading-relaxed">
            Chamados de manutenção do seu condomínio, do relato à conclusão.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <Link
            to="/abrir-chamado"
            className="bg-ambar-500 hover:bg-ambar-600 active:bg-ambar-700 active:scale-[0.98] text-ardosia-950 font-semibold rounded-2xl px-6 py-5 text-center shadow-lg hover:shadow-xl transition-all duration-200 text-lg"
          >
            Relatar um problema
          </Link>
          <Link
            to="/consultar"
            className="bg-ardosia-700 hover:bg-ardosia-600 active:bg-ardosia-500 active:scale-[0.98] text-white font-semibold rounded-2xl px-6 py-5 text-center border border-ardosia-600 shadow-md hover:shadow-lg transition-all duration-200 text-lg"
          >
            Consultar meu chamado
          </Link>
        </div>
      </div>

      <div className="max-w-lg w-full mx-auto pt-8">
        <Link
          to="/login"
          className="block text-center text-sm text-ardosia-400 hover:text-ardosia-200 transition-colors duration-200"
        >
          Sou da equipe interna (síndico, compras, artífice) →
        </Link>
      </div>
    </div>
  );
}
