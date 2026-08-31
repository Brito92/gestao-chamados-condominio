import { useRef, useState } from 'react';
import { comprimirFotos, formatarTamanho } from '@/utils/comprimirFoto';

interface MultiImageUploadProps {
  label: string;
  arquivos: File[];
  onChange: (arquivos: File[]) => void;
  obrigatorio?: boolean;
  maxImagens?: number;
}

/**
 * Componente para upload de múltiplas imagens com compressão automática.
 * Limita a 3 imagens, comprime automaticamente para economizar espaço.
 * Reduz tamanho em até 90% usando browser-image-compression.
 */
export function MultiImageUpload({
  label,
  arquivos,
  onChange,
  obrigatorio,
  maxImagens = 3,
}: MultiImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [comprimindo, setComprimindo] = useState(false);
  const [progresso, setProgresso] = useState<Record<string, number>>({});

  async function handleFiles(files: FileList | null) {
    if (!files) return;

    const novasFortos = Array.from(files);
    const totalArquivos = arquivos.length + novasFortos.length;

    if (totalArquivos > maxImagens) {
      alert(`Máximo de ${maxImagens} imagens permitidas.`);
      return;
    }

    setComprimindo(true);
    try {
      // Comprime todas as imagens em paralelo
      const resultado = await comprimirFotos(novasFortos);

      // Cria previews para as imagens comprimidas
      const novosPreviews = { ...previews };
      resultado.arquivos.forEach((arq) => {
        novosPreviews[arq.name] = URL.createObjectURL(arq);
      });

      setPreviews(novosPreviews);
      onChange([...arquivos, ...resultado.arquivos]);

      // Mostra estatísticas
      if (resultado.estatisticas.reducao > 0) {
        const economia = (
          resultado.estatisticas.tamanhoOriginal - resultado.estatisticas.tamanhoComprimido
        ) / 1024;
        console.log(`💾 Total economizado: ${economia.toFixed(1)}KB`);
      }
    } catch (err) {
      alert(
        `Erro ao processar imagens: ${err instanceof Error ? err.message : 'desconhecido'}`
      );
    } finally {
      setComprimindo(false);
      setProgresso({});
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function removerImagem(nome: string) {
    const novosPreviews = { ...previews };
    delete novosPreviews[nome];
    setPreviews(novosPreviews);

    const novosArquivos = arquivos.filter((a) => a.name !== nome);
    onChange(novosArquivos);
  }

  const podeLancarMais = arquivos.length < maxImagens;

  return (
    <div>
      <label className="block text-sm font-medium text-ardosia-700 mb-1.5">
        {label} {obrigatorio && <span className="text-ambar-600">*</span>}
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={comprimindo || !podeLancarMais}
      />

      {/* Grid de previews com tamanho */}
      {arquivos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-3">
          {arquivos.map((arq) => (
            <div key={arq.name} className="relative group">
              <img
                src={previews[arq.name] || ''}
                alt={arq.name}
                className="w-full h-24 object-cover rounded-xl border border-ardosia-200 transition-shadow duration-200 group-hover:shadow-md"
              />
              <div className="absolute bottom-1 left-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-center">
                {formatarTamanho(arq.size)}
              </div>
              <button
                type="button"
                onClick={() => removerImagem(arq.name)}
                disabled={comprimindo}
                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 active:bg-red-700 disabled:opacity-60 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-md transition-all duration-200"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Botão para adicionar mais imagens */}
      {podeLancarMais && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={comprimindo}
          className="w-full h-32 rounded-xl border-2 border-dashed border-ardosia-300 text-ardosia-500 disabled:opacity-60 flex flex-col items-center justify-center gap-2 hover:border-ambar-400 hover:text-ambar-600 active:bg-ardosia-50 transition-all duration-200"
        >
          {comprimindo ? (
            <>
              <div className="w-8 h-8 rounded-full border-2 border-ardosia-300 border-t-ambar-500 animate-spin" />
              <span className="text-sm leading-none font-medium">Comprimindo fotos...</span>
            </>
          ) : (
            <>
              <span className="text-3xl leading-none">📷</span>
              <span className="text-sm font-medium">Adicionar foto</span>
              <span className="text-xs text-ardosia-400">
                {arquivos.length}/{maxImagens} fotos
              </span>
            </>
          )}
        </button>
      )}

      {/* Mensagem quando atingiu máximo */}
      {!podeLancarMais && (
        <div className="rounded-xl bg-emerald-100 px-4 py-3 text-sm text-emerald-700 text-center font-medium">
          ✓ Máximo de {maxImagens} fotos adicionadas
        </div>
      )}

      {/* Info sobre compressão */}
      {!comprimindo && arquivos.length > 0 && (
        <p className="text-xs text-ardosia-400 mt-2 text-center">
          💾 Fotos comprimidas automaticamente para economizar espaço
        </p>
      )}
    </div>
  );
}
