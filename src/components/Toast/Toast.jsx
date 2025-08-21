import React, { useEffect, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { Toast } from 'bootstrap';



export function ToastContainer() {
  // Este contenedor se puede poner una sola vez en el layout principal
  return (
    <div
      id="toast-container"
      style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '550px'
      }}
    />
  );
}

export function showToast(title, message, isError = false) {
  const id = `toast-${Date.now()}`;
  const typeClass = isError ? 'error' : 'success';
  const headerClass = isError ? 'bg-danger text-white' : 'bg-success text-white';

  const toastHTML = `
    <div id="${id}" class="toast show position-relative" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header ${headerClass}">
        <strong class="me-auto">${title}</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">${message}</div>
      <div class="toast-progress ${typeClass}"></div>
    </div>
  `;

  const container = document.getElementById('toast-container');
  if (!container) return;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = toastHTML.trim();
  const toastElement = tempDiv.firstElementChild;

  container.appendChild(toastElement);
  
  const bsToast = new Toast(toastElement, { autohide: true, delay: 3800 });

  bsToast.show();

  toastElement.addEventListener('hidden.bs.toast', () => {
    toastElement.remove();
  });
}

// Agrega los estilos de animación dinámicamente
(function initToastStyles() {
  if (!document.getElementById('toast-style')) {
    const style = document.createElement('style');
    style.id = 'toast-style';
    style.innerHTML = `
      .toast-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 4px;
        width: 100%;
        animation: toast-progress-animation 4s linear forwards;
      }

      .toast-progress.success {
        background-color: #198754;
      }

      .toast-progress.error {
        background-color: #dc3545;
      }

      .toast {
        opacity: 0;
        transform: translateY(-10px);
        animation: toast-fade-in 0.3s ease forwards;
      }

      @keyframes toast-fade-in {
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes toast-progress-animation {
        from { width: 100%; }
        to { width: 0%; }
      }
    `;
    document.head.appendChild(style);
  }
})();
