import { useState } from 'react';

interface VisualizadorImagemProps {
  url: string;
  alt?: string;
  className?: string;
}

export function VisualizadorImagem({ url, alt, className = '' }: VisualizadorImagemProps) {
  const [modalAberto, setModalAberto] = useState(false);

  return (
    <>
      <img
        src={url}
        alt={alt}
        className={`cursor-pointer hover:opacity-90 transition-opacity ${className}`}
        onClick={() => setModalAberto(true)}
      />
      
      {modalAberto && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setModalAberto(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
            onClick={(e) => {
              e.stopPropagation();
              setModalAberto(false);
            }}
            aria-label="Fechar"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={url}
            alt={alt}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
