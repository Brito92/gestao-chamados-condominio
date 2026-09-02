import { useRef, useState } from 'react';

interface CampoFotoProps {
  label: string;
  arquivo: File | null;
  onChange: (arquivo: File | null) => void;
  obrigatorio?: boolean;
  accept?: string;
}

/**
 * Campo de anexo de imagem otimizado para mobile: abre diretamente a
 * câmera/galeria do dispositivo (capture) e mostra uma pré-visualização.
 */
export function CampoFoto({ label, arquivo, onChange, obrigatorio, accept = 'image/*' }: CampoFotoProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function handleFile(files: FileList | null) {
    const file = files?.[0] ?? null;
    onChange(file);
    if (file) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-ardosia-700 mb-1.5">
        {label} {obrigatorio && <span className="text-ambar-600">*</span>}
      </label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={accept === 'image/*' ? 'environment' : undefined}
        className="hidden"
        onChange={(e) => handleFile(e.target.files)}
      />
      {preview && arquivo?.type.startsWith('image/') ? (
        <div className="relative">
          <img
            src={preview}
            alt={label}
            className="w-full h-44 object-cover rounded-xl border border-ardosia-200"
          />
          <button
            type="button"
            onClick={() => {
              handleFile(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="absolute top-2 right-2 bg-white/90 text-ardosia-700 text-xs font-medium px-2.5 py-1 rounded-full shadow-card"
          >
            Trocar
          </button>
        </div>
      ) : arquivo ? (
        <div className="w-full min-h-28 rounded-xl border-2 border-dashed border-ardosia-300 text-ardosia-600 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <span className="text-sm font-medium break-all">{arquivo.name}</span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs font-semibold text-ambar-700"
          >
            Trocar arquivo
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-28 rounded-xl border-2 border-dashed border-ardosia-300 text-ardosia-500 flex flex-col items-center justify-center gap-1 active:bg-ardosia-100"
        >
          <span className="text-2xl leading-none">＋</span>
          <span className="text-xs font-medium">Adicionar foto</span>
        </button>
      )}
      {arquivo && <p className="text-xs text-ardosia-400 mt-1 truncate">{arquivo.name}</p>}
    </div>
  );
}
