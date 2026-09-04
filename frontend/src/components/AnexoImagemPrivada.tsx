import { useEffect, useState } from 'react';
import { VisualizadorImagem } from '@/components/VisualizadorImagem';
import { criarSignedUrlAnexo } from '@/utils/signedUrlAnexo';

interface Props {
  url: string;
  alt: string;
  className?: string;
}

export function AnexoImagemPrivada({ url, alt, className }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    setSignedUrl(null);
    setErro(null);

    criarSignedUrlAnexo(url)
      .then((valor) => {
        if (ativo) setSignedUrl(valor);
      })
      .catch((err) => {
        if (ativo) {
          setErro(err instanceof Error ? err.message : 'Erro ao carregar anexo.');
        }
      });

    return () => {
      ativo = false;
    };
  }, [url]);

  if (erro) {
    return <p className="text-sm text-red-600">{erro}</p>;
  }

  if (!signedUrl) {
    return <p className="text-sm text-ardosia-400">Carregando anexo...</p>;
  }

  return (
    <VisualizadorImagem
      url={signedUrl}
      alt={alt}
      className={className}
    />
  );
}