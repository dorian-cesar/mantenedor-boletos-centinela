import React, { useEffect, useState, useRef } from 'react';
import '@components/Login/login.css';
import { showToast } from '@components/Toast/Toast';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const API_TIMEOUT = 10000;
  const navigate = useNavigate();  

  useEffect(() => {
    const recordarSession = localStorage.getItem('recordarSession');
    if (recordarSession) {
      const sessionData = JSON.parse(recordarSession);
      if (sessionData.expiresAt > Date.now()) {
        setRememberMe(true);
        setEmail(sessionData.user?.email || '');
      } else {
        localStorage.removeItem('recordarSession');
      }
    }
  }, []);

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const saveSessionData = (token, user, remember) => {
    if (remember) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);
      const sessionData = {
        token,
        user,
        expiresAt: expirationDate.getTime()
      };
      localStorage.setItem('recordarSession', JSON.stringify(sessionData));
    } else {
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user', JSON.stringify(user));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      showToast("Error", "Por favor complete todos los campos", true);
      return;
    }

    if (!isValidEmail(email.trim())) {
      showToast("Error", "Por favor ingrese un email válido", true);
      return;
    }

    const datos = {
      email: email.trim(),
      password: password.trim()
    };

    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      const respuesta = await fetch('https://bcentinela.dev-wit.com/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!respuesta.ok) {
        const errorData = await respuesta.json().catch(() => ({}));
        const mensaje = (errorData?.message || errorData?.error || '').toLowerCase();

        if (respuesta.status === 401) {
          if (mensaje.includes("user no encontrado")) throw new Error("El correo ingresado no está registrado.");
          if (mensaje.includes("credenciales inválidas")) throw new Error("La contraseña ingresada es incorrecta.");
          if (mensaje.includes("contraseña incorrecta")) throw new Error("Contraseña incorrecta");
          throw new Error("No autorizado. Verifica tus datos.");
        }

        if (respuesta.status === 404 && mensaje.includes("usuario no encontrado")) {
          throw new Error("El correo ingresado no está registrado.");
        }

        throw new Error("Error inesperado del servidor. Intenta nuevamente más tarde.");
      }

      const resultado = await respuesta.json();
      if (!resultado.token || !resultado.user) throw new Error('Respuesta inválida del servidor.');

      if (resultado.user.role !== 'admin') {
        showToast("Acceso denegado", "Tu cuenta no cumple con los requisitos para acceder a esta sección.", true);
        setLoading(false);
        return;
      }

      saveSessionData(resultado.token, resultado.user, rememberMe);
      navigate('/dashboard');
      
    } catch (error) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      localStorage.removeItem('recordarSession');

      const mensaje = error.name === 'AbortError'
        ? 'La solicitud tardó demasiado. Por favor intente nuevamente.'
        : error.message;

      showToast("Error", mensaje, true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="text-center mb-5">
        <div className="rounded-4 bg-flotante bg-opacity-75 d-inline-flex p-4 position-relative shadow floating" style={{ width: 96, height: 96 }}>
          <img src="/img/bus.svg" alt="Ícono de bus" className="img-fluid" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
        <h1 className="gradient-bg fw-bold display-5 mt-3">Panel de Administración</h1>
        <p className="text-secondary">Sistema de Gestión Buses Centinela</p>
      </div>

      <div className="card shadow rounded-4 border-0 bg-white bg-opacity-75 mx-auto w-100" style={{ maxWidth: 420 }}>
        <div className="card-header bg-transparent border-bottom-0 text-center pt-4">
          <h5 className="text-login fw-bold">Acceso de Mantenedor</h5>
        </div>
        <div className="card-body p-4">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="email" className="form-label fw-bold text-login">Correo Electrónico</label>
              <div className="input-group">
                <span className="input-group-text bg-white border-login text-login"><i className="bi bi-person"></i></span>
                <input
                  type="email"
                  className="form-control border-login"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@empresa.com"
                  required
                />
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="form-label fw-bold text-login">Contraseña</label>
              <div className="input-group">
                <span className="input-group-text bg-white border-login text-login"><i className="bi bi-lock"></i></span>
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control border-login"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button className="btn btn-outline-secondary" type="button" onClick={() => setShowPassword(!showPassword)}>
                  <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                </button>
              </div>
            </div>

            <div className="form-check mb-3">
              <input
                className="form-check-input border-login"
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
              />
              <label className="form-check-label text-muted" htmlFor="rememberMe">Recordar sesión</label>
            </div>

            <div className="d-grid mb-3">
              <button type="submit" className="btn btn-warning fw-bold" disabled={loading}>
                <span>Iniciar Sesión</span>
                {loading && <span className="spinner-border spinner-border-sm ms-2" role="status"></span>}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="text-center mt-4">
        <p className="text-muted small">¿Problemas para acceder?</p>
        <div className="d-flex justify-content-center gap-3">
          <button className="btn btn-warning btn-sm">📞 Contactar soporte técnico</button>
          <button className="btn btn-primary btn-sm">📧 Enviar ticket de ayuda</button>
        </div>
        <p className="text-secondary mt-4 small">© 2025 WIT Innovasión Tecnológica</p>
      </div>
    </div>
  );
}

export default Login;