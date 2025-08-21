import React, { useEffect, useState } from 'react';
import Sidebar from '@components/Sidebar/Sidebar';
import '@components/Dashboard/dashboard.css';
import { Spinner } from 'react-bootstrap';
import { showToast } from '@components/Toast/Toast';

const Terminales = () => {
  const [terminales, setTerminales] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const fetchTerminales = async () => {
      try {
        const res = await fetch('https://boletos.dev-wit.com/api/terminals');
        const data = await res.json();
        setTerminales(data);
      } catch (error) {
        console.error('Error al cargar terminales:', error);
        showToast('Error', 'No se pudieron cargar los terminales.', true);
      } finally {
        setCargando(false);
      }
    };

    fetchTerminales();
  }, []);

  return (
    <div className="dashboard-container">
      <Sidebar activeItem="terminales" />
      <main className="main-content">
        <div className="header">
          <h1 className="mb-0">Gestión de Terminales</h1>
          <p className="text-muted">Aquí puedes visualizar los terminales disponibles en el sistema</p>
        </div>

        <div className="stats-box">
          <h4 className="mb-3">Terminales registrados</h4>

          {cargando ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Cargando terminales...</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Dirección</th>
                    <th>Ciudad</th>
                    <th>Región</th>
                  </tr>
                </thead>
                <tbody>
                  {terminales.map((t) => (
                    <tr key={t._id}>
                      <td><code>{t._id}</code></td>
                      <td>{t.name}</td>
                      <td>{t.address}</td>
                      <td>{t.city}</td>
                      <td>{t.region}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Terminales;
