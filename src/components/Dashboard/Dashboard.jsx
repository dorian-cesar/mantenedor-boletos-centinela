import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './dashboard.css';
import Sidebar from '@components/Sidebar/Sidebar';

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
    const sessionUser = sessionStorage.getItem('user');
    
    if (sessionUser) {
      user = JSON.parse(sessionUser);
    } else {
      const recordarSession = localStorage.getItem('recordarSession');
      if (recordarSession) {
        try {
          const sessionData = JSON.parse(recordarSession);
          user = sessionData.user;
        } catch (e) {
          console.error("Failed to parse remembered session:", e);
        }
      }
    }

    if (!user) {
      navigate('/');
      return;
    }

    if (user.role !== 'admin') {
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
      console.error("Token no encontrado");
      setStats(prev => ({ ...prev, users: 0 }));
      return;
    }

    try {
      const res = await fetch('https://boletos.dev-wit.com/api/users/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (Array.isArray(data)) {
        setStats(prev => ({ ...prev, users: data.length }));
      } else if (Array.isArray(data.users)) {
        setStats(prev => ({ ...prev, users: data.users.length }));
      } else {
        console.error('Respuesta inesperada de la API:', data);
        setStats(prev => ({ ...prev, users: 0 }));
      }
    } catch (err) {
      console.error('Error al obtener usuarios:', err);
      setStats(prev => ({ ...prev, users: 0 }));
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
          <div className="stat-item">Usuarios Registrados <span>{stats.users}</span></div>          
        </div>
      </main>
    </div>
  );
};

export default Dashboard;