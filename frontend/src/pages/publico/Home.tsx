import { Link } from 'react-router-dom';

export function Home() {
  return (
    <div className="min-h-screen bg-[#101010] px-5 py-8 text-white sm:px-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col justify-between">
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <img
            src="/logo-gabriel-lima.png"
            alt="Gabriel Lima - Síndico Profissional"
            className="h-auto w-full max-w-[360px] object-contain drop-shadow-[0_0_30px_rgba(231,183,61,0.16)]"
          />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.3em] text-[#e8bd54]">
            Gestão condominial
          </p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/60">
            Chamados de manutenção do seu condomínio, do relato à conclusão.
          </p>
        </div>

        <div className="flex flex-col gap-3 pb-4">
          <Link
            to="/abrir-chamado"
            className="rounded-2xl bg-[#e8bd54] px-6 py-4 text-center text-lg font-bold text-[#171717] shadow-lg shadow-[#d7aa36]/10 transition hover:bg-[#f4d477] active:scale-[0.98]"
          >
            Relatar um problema
          </Link>
          <Link
            to="/consultar"
            className="rounded-2xl border border-white/10 bg-[#202020] px-6 py-4 text-center text-lg font-semibold text-white transition hover:border-[#e8bd54]/40 hover:text-[#f7d36d] active:scale-[0.98]"
          >
            Consultar meu chamado
          </Link>
          <Link
            to="/login"
            className="rounded-2xl border border-[#d7aa36]/25 bg-[#191919] px-6 py-4 text-center text-lg font-semibold text-[#e8bd54] transition hover:border-[#e8bd54]/60 hover:bg-[#2a2415] active:scale-[0.98]"
          >
            Equipe interna →
          </Link>
        </div>

        <p className="pt-5 text-center text-xs text-white/30">Gabriel Lima · Síndico Profissional</p>
      </div>
    </div>
  );
}
