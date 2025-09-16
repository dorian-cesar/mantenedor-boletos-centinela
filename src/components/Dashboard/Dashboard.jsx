import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './dashboard.css';
import Sidebar from '@components/Sidebar/Sidebar';

//const API_URL = "https://bcentinela.dev-wit.com/api";
const API_URL = "http://localhost:3000/api";

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    users: '--',
  });

  useEffect(() => {
    checkAuthAndRole();
  }, []);

  const checkAuthAndRole = () => {
    let user = null;

    // 1. Intentar con sessionStorage
    const sessionUser = sessionStorage.getItem('user');
    if (sessionUser) {
      user = JSON.parse(sessionUser);
    } else {
      // 2. Intentar con localStorage (recordarSession)
      const recordarSession = localStorage.getItem('recordarSession');
      if (recordarSession) {
        try {
          const sessionData = JSON.parse(recordarSession);
          user = sessionData.user;
        } catch (e) {
          console.error("Error al parsear la sesión recordada:", e);
        }
      }
    }

    // 3. Validar existencia de usuario
    if (!user) {
      navigate('/');
      return;
    }

    // 4. Validar roles permitidos
    if (user.role !== 'admin' && user.role !== 'superAdmin') {
      navigate('/');
      return;
    }

    loadDashboard();
  };

  const loadDashboard = async () => {
    const token =
      sessionStorage.getItem('token') ||
      (JSON.parse(localStorage.getItem('recordarSession') || '{}').token);

    if (!token) {
      console.error('Token no encontrado');
      setStats((prev) => ({ ...prev, users: 0 }));
      return;
    }

    try {
      const res = await fetch(`${API_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      // ✅ Nuevo backend usa items
      if (Array.isArray(data.items)) {
        setStats((prev) => ({ ...prev, users: data.items.length }));
      } else {
        console.error("Respuesta inesperada de la API:", data);
        setStats((prev) => ({ ...prev, users: 0 }));
      }
    } catch (err) {
      console.error("Error al obtener usuarios:", err);
      setStats((prev) => ({ ...prev, users: 0 }));
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar activeItem="dashboard" />
      <main className="main-content">
        <div className="header">
          <h1>Panel General</h1>
        </div>

        <div className="stats-box mt-5">
          <h6>Estadísticas del Sistema</h6>
          <div className="stat-item">
            Usuarios Registrados <span>{stats.users}</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;