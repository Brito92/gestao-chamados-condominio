import { useRef, useState, type ReactNode } from 'react';

interface MultiImageUploadProps {
  label: string;
  arquivos: File[];
  onChange: (arquivos: File[]) => void;
  obrigatorio?: boolean;
  maxImagens?: number;
}

/**
 * Componente para upload de múltiplas imagens com compressão no cliente.
 * Permite até 5 imagens (padrão), com preview em miniatura e botão remover.
 * Comprime cada imagem redimensionando para no máx. ~1280px no maior lado,
 * exportando como JPEG com qualidade ~0.7.
 */
export function MultiImageUpload({
  label,
  arquivos,
  onChange,
  obrigatorio,
  maxImagens = 5,
}: MultiImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [carregandoCompressao, setCarregandoCompressao] = useState(false);

  /**
   * Comprime uma imagem usando Canvas, redimensionando para no máx. ~1280px
   * e exportando como JPEG com qualidade ~0.7.
   */
  async function comprimirImagem(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calcula novo tamanho mantendo proporção
          const maxDim = 1280;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          // Cria canvas e desenha imagem comprimida
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Não foi possível obter contexto do canvas'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Exporta como JPEG com qualidade 0.7
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Não foi possível converter blob'));
                return;
              }

              // Cria novo File com o blob comprimido
              const nomeArquivo = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
              const arquivoComprimido = new File([blob], nomeArquivo, {
                type: 'image/jpeg',
              });
              resolve(arquivoComprimido);
            },
            'image/jpeg',
            0.7
          );
        };
        img.onerror = () => reject(new Error('Não foi possível carregar imagem'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Não foi possível ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;

    const novosArquivos = Array.from(files);
    const totalArquivos = arquivos.length + novosArquivos.length;

    if (totalArquivos > maxImagens) {
      alert(`Máximo de ${maxImagens} imagens permitidas.`);
      return;
    }

    setCarregandoCompressao(true);
    try {
      // Comprime todas as imagens em paralelo
      const arquivosComprimidos = await Promise.all(
        novosArquivos.map((f) => comprimirImagem(f))
      );

      // Cria previews para as imagens comprimidas
      const novosPreviews = { ...previews };
      arquivosComprimidos.forEach((arq) => {
        novosPreviews[arq.name] = URL.createObjectURL(arq);
      });

      setPreviews(novosPreviews);
      onChange([...arquivos, ...arquivosComprimidos]);
    } catch (err) {
      alert(
        `Erro ao comprimir imagem: ${err instanceof Error ? err.message : 'desconhecido'}`
      );
    } finally {
      setCarregandoCompressao(false);
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
        disabled={carregandoCompressao || !podeLancarMais}
      />

      {/* Grid de previews */}
      {arquivos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-3">
          {arquivos.map((arq) => (
            <div key={arq.name} className="relative group">
              <img
                src={previews[arq.name] || ''}
                alt={arq.name}
                className="w-full h-24 object-cover rounded-xl border border-ardosia-200 transition-shadow duration-200 group-hover:shadow-md"
              />
              <button
                type="button"
                onClick={() => removerImagem(arq.name)}
                disabled={carregandoCompressao}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 active:bg-red-700 disabled:opacity-60 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-md transition-all duration-200"
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
          disabled={carregandoCompressao}
          className="w-full h-32 rounded-xl border-2 border-dashed border-ardosia-300 text-ardosia-500 disabled:opacity-60 flex flex-col items-center justify-center gap-2 hover:border-ambar-400 hover:text-ambar-600 active:bg-ardosia-50 transition-all duration-200"
        >
          {carregandoCompressao ? (
            <>
              <span className="text-sm leading-none font-medium">Comprimindo...</span>
            </>
          ) : (
            <>
              <span className="text-3xl leading-none">＋</span>
              <span className="text-sm font-medium">Adicionar foto</span>
              <span className="text-xs text-ardosia-400">
                {arquivos.length}/{maxImagens}
              </span>
            </>
          )}
        </button>
      )}

      {/* Mensagem quando atingiu máximo */}
      {!podeLancarMais && (
        <div className="rounded-xl bg-ardosia-100 px-4 py-3 text-sm text-ardosia-600 text-center">
          Máximo de {maxImagens} imagens atingido
        </div>
      )}
    </div>
  );
}
