import { useNavigate } from 'react-router-dom';

export function BackButton({ to }: { to?: string }) {
  const navigate = useNavigate();

  function handleClick() {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="text-white hover:text-white/70 active:text-white/50 font-semibold text-base leading-none px-3 py-2 -ml-3 rounded-lg transition-colors duration-200"
      aria-label="Voltar"
    >
      ← Voltar
    </button>
  );
}
