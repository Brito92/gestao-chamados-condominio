import { useNavigate } from 'react-router-dom';

export function BackButton({ to }: { to?: string }) {
  const navigate = useNavigate();

  function handleClick() {
    if (to) navigate(to);
    else navigate(-1);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="self-start text-ardosia-700 hover:text-ardosia-950 active:text-ardosia-500 font-semibold text-base leading-none px-3 py-2 -ml-3 rounded-lg transition-colors duration-200"
      aria-label="Voltar"
    >
      ← Voltar
    </button>
  );
}
