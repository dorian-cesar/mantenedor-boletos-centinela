import React, { useEffect, useState } from 'react';
import Sidebar from '@components/Sidebar/Sidebar';
import '@components/Dashboard/dashboard.css';
import { showToast } from '@components/Toast/Toast';
import { Spinner } from 'react-bootstrap';


const Companias = () => {
  const [companias, setCompanias] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const fetchCompanias = async () => {
      try {
        const res = await fetch('https://boletos.dev-wit.com/api/companies');
        const data = await res.json();
        setCompanias(data);
      } catch (error) {
        console.error('Error al cargar companias:', error);
      } finally {
        setCargando(false);
      }
    };

    fetchCompanias();
  }, []);

  return (
    <div className="dashboard-container">
      <Sidebar activeItem="companias" />
      <main className="main-content">
        <div className="header">
          <h1 className="mb-0">Gestión de Compañías</h1>
          <p className="text-muted">Aquí puedes visualizar las compañías disponibles en el sistema</p>
        </div>

        <div className="stats-box">
          <h4 className="mb-3">Compañías registradas</h4>

          {cargando ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Cargando compañías...</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>RUT</th>
                    <th>Dirección</th>
                    <th>Teléfono</th>
                    <th>Email</th>
                    <th>Sitio Web</th>
                  </tr>
                </thead>
                <tbody>
                  {companias.map((c) => (
                    <tr key={c._id}>
                      <td><code>{c._id}</code></td>
                      <td>{c.name}</td>
                      <td>{c.rut}</td>
                      <td>{c.address}</td>
                      <td>{c.phone}</td>
                      <td>{c.email}</td>
                      <td>
                        {c.website ? (
                          <a href={c.website} target="_blank" rel="noopener noreferrer">
                            {new URL(c.website).hostname}
                          </a>
                        ) : '—'}
                      </td>
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

export default Companias;
