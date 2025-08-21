import React, { useEffect, useRef, useCallback } from 'react';
import './ModalBase.css';

/**
 * ModalBase
 * -----------------------------------------------------------------------------
 * Componente base para modales.
 *
 * Props:
 *  - visible: boolean               -> controla la visibilidad del modal
 *  - title: string | ReactNode      -> título del modal (renderizado en el header)
 *  - onClose: () => void            -> callback para cerrar (X, fondo o tecla ESC)
 *  - children: ReactNode            -> contenido del modal (cuerpo)
 *  - footer: ReactNode | null       -> contenido del pie; si viene null/undefined
 *                                      insertamos un "shim" de altura 0 para
 *                                      conservar el borde redondeado inferior
 *  - size: 'sm' | 'md' | 'lg' | 'xl'-> ancho máximo del modal (default: 'md')
 *
 * Detalles clave:
 *  - overflow-hidden en el contenedor con borde redondeado para que las
 *    esquinas inferiores se vean redondeadas incluso si no hay footer.
 *  - "footer shim": cuando no pasas footer, agregamos un div de altura 0 para
 *    que los temas que aplican radius en el pie lo conserven igualmente.
 *  - Cierre por: tecla ESC, clic fuera (overlay) y botón X.
 */

const maxWidthMap = {
  sm: '480px',
  md: '720px', // tamaño por defecto
  lg: '960px',
  xl: '1140px',
};

const ModalBase = ({ visible, title, onClose, children, footer, size = 'md' }) => {
  const overlayRef = useRef(null);

  // --- Cerrar con tecla ESC ---
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onClose]);

  // --- Cerrar al clickear fuera del contenido (overlay) ---
  const handleOverlayMouseDown = useCallback(
    (e) => {
      if (e.target === overlayRef.current) {
        onClose?.();
      }
    },
    [onClose]
  );

  // No renderizar nada si no está visible
  if (!visible) return null;

  // Determina si hay footer "real" o insertaremos el shim
  const hasFooter = footer !== undefined && footer !== null;
  const maxWidth = maxWidthMap[size] || maxWidthMap.md;

  return (
    <div
      className="modal-overlay d-flex justify-content-center align-items-center"
      ref={overlayRef}
      onMouseDown={handleOverlayMouseDown}
      role="dialog"
      aria-modal="true"
    >
      {/*
        Contenedor principal del modal:
        - rounded-4: bordes redondeados
        - overflow-hidden: recorta contenido interno para conservar esquinas inferiores
        - flex-column: header / body / footer
      */}
      <div
        className="bg-white text-dark rounded-4 overflow-hidden shadow-lg d-flex flex-column"
        style={{
          maxWidth,
          width: '90%',
          maxHeight: '90vh',
        }}
      >
        {/* Header con título y botón de cierre (X) */}
        <div className="modal-header border-bottom-0 p-4 pb-2 d-flex justify-content-between align-items-start">
          <h5 className="modal-title fw-semibold fs-5 mb-0">{title}</h5>
          <button type="button" className="btn-close" aria-label="Cerrar" onClick={onClose} />
        </div>

        {/*
          Body scrolleable:
          - overflow:auto y flexGrow para ocupar el espacio disponible
          - minHeight:0 para que el flexbox permita el scroll correctamente
          - background:inherit para que herede el color del contenedor y evitar
            “parches” de color que rompan las esquinas redondeadas
        */}
        <div
          className="modal-body px-4 py-3"
          style={{
            overflow: 'auto',
            flexGrow: 1,
            minHeight: 0,
            background: 'inherit',
          }}
        >
          {children}
        </div>

        {/*
          Footer:
          - Si nos pasan 'footer', lo mostramos como footer real.
          - Si NO, agregamos un "footer shim" (altura 0) para preservar el
            borde redondeado inferior en temas/estilos que apliquen el radius allí.
        */}
        {hasFooter ? (
          <div className="modal-footer border-top-0 px-4 pt-2 pb-4 d-flex justify-content-end gap-2 bg-light">
            {footer}
          </div>
        ) : (
          <div className="modal-footer border-top-0 p-0 m-0" style={{ height: 0 }} />
        )}
      </div>
    </div>
  );
};

export default ModalBase;
