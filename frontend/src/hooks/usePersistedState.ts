import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/** Mantém rascunhos de formulários após a aba/webview ser recriada. */
export function usePersistedState<T>(
  chave: string,
  valorInicial: T,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const [valor, setValor] = useState<T>(() => {
    try {
      const salvo = localStorage.getItem(chave);
      return salvo === null ? valorInicial : (JSON.parse(salvo) as T);
    } catch {
      return valorInicial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      // Alguns ambientes podem bloquear o storage; o formulário continua funcionando.
    }
  }, [chave, valor]);

  function limpar() {
    localStorage.removeItem(chave);
    setValor(valorInicial);
  }

  return [valor, setValor, limpar];
}
