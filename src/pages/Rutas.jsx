import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from '@components/Sidebar/Sidebar';
import '@components/Dashboard/dashboard.css';
import { Spinner } from 'react-bootstrap';
import { showToast } from '@components/Toast/Toast';
import ModalBase from '@components/ModalBase/ModalBase';
import RutaEditor from '@components/RutaEditor/RutaEditor';
import Swal from 'sweetalert2';

//const API_URL = "https://bcentinela.dev-wit.com/api";
const API_URL = "http://localhost:3000/api"; // dev

const ROUTES_ENDPOINT = `${API_URL}/routemasters`;

const Rutas = () => {
  const [rutas, setRutas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [modalRutaVisible, setModalRutaVisible] = useState(false);
  const [rutaEditando, setRutaEditando] = useState(null);
  const [formRuta, setFormRuta] = useState({
    origin: '',
    destination: '',
    startTime: '',
    durationMinutes: '',
    direction: '',
    stops: []
  });

  const [rutasExpandida, setRutasExpandida] = useState(null);
  const [filtro, setFiltro] = useState('');

  const rutasFiltradas = useMemo(() => {
    const term = filtro.trim().toLowerCase();
    if (!term) return rutas;
    return rutas.filter(r =>
      (r.origin || '').toLowerCase().includes(term) ||
      (r.destination || '').toLowerCase().includes(term) ||
      (r.direction || '').toLowerCase().includes(term)
    );
  }, [rutas, filtro]);

  const isExpanded = (id) => rutasExpandida === id;

  // ---- CARGA INICIAL RUTAS ----
  useEffect(() => {
    const fetchRutas = async () => {
      try {
        const res = await fetch(ROUTES_ENDPOINT);
        const data = await res.json();
        setRutas(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error al cargar rutas:', error);
      } finally {
        setCargando(false);
      }
    };
    fetchRutas();
  }, []);

  const toggleExpandirRuta = (rutaId) => {
    setRutasExpandida((prev) => (prev === rutaId ? null : rutaId));
  };

  // ---- CREAR / EDITAR RUTA ----
  const abrirModalNuevaRuta = () => {
    setRutaEditando(null);
    setFormRuta({ origin: '', destination: '', startTime: '', durationMinutes: '', direction: '', stops: [] });
    setModalRutaVisible(true);
  };

  const handleGuardarRuta = async () => {
    const esNuevaRuta = !rutaEditando;

    if (!formRuta.origin || !formRuta.destination) {
      showToast('Datos incompletos', 'Debes ingresar origen y destino', true);
      return;
    }

    const dataAGuardar = { ...formRuta };

    const endpoint = esNuevaRuta
      ? ROUTES_ENDPOINT
      : `${ROUTES_ENDPOINT}/${encodeURIComponent(rutaEditando)}`;
    const metodo = esNuevaRuta ? 'POST' : 'PUT';

    try {
      const res = await fetch(endpoint, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataAGuardar),
      });

      const body = await res.json();

      if (!res.ok) {
        const msg = body?.message || `${res.status} ${res.statusText}`;
        throw new Error(msg);
      }

      const rutaGuardada = body;
      setRutas(prev =>
        esNuevaRuta
          ? [...prev, rutaGuardada]
          : prev.map(t => (t._id === rutaEditando ? rutaGuardada : t))
      );
      showToast(
        esNuevaRuta ? 'Ruta creada' : 'Ruta actualizada',
        esNuevaRuta ? 'Se creó correctamente' : 'Cambios guardados'
      );
      setModalRutaVisible(false);
      setRutaEditando(null);
    } catch (err) {
      console.error(err);
      showToast('Error', err.message || 'No se pudo guardar la ruta', true);
    }
  };

  const handleEliminar = async (id) => {
    const result = await Swal.fire({
      title: '¿Eliminar ruta?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`${ROUTES_ENDPOINT}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error al eliminar');

      setRutas((prev) => prev.filter((t) => t._id !== id));
      await Swal.fire('Ruta eliminada', 'La ruta fue eliminada exitosamente.', 'success');
    } catch (err) {
      console.error(err);
      await Swal.fire('Error', 'No se pudo eliminar la ruta', 'error');
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar activeItem="rutas" />
      <main className="main-content">
        <div className="header">
          <h1 className="mb-0">Rutas</h1>
          <p className="text-muted">Aquí puedes visualizar y gestionar las rutas</p>
        </div>

        <div className="stats-box">
          <div className="d-flex flex-column gap-2 mb-3">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h5 className="mb-0">Listado de Rutas</h5>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-outline-secondary"
                  onClick={async () => {
                    try {
                      const res = await fetch(ROUTES_ENDPOINT);
                      const data = await res.json();
                      setRutas(Array.isArray(data) ? data : []);
                      showToast('Actualizado', 'Lista de rutas sincronizada');
                    } catch (err) {
                      console.error(err);
                      showToast('Error al actualizar', err.message || 'No se pudo sincronizar', true);
                    }
                  }}
                >
                  <i className="bi bi-arrow-repeat" /> Actualizar
                </button>

                <button className="btn btn-primary" onClick={abrirModalNuevaRuta}>
                  <i className="bi bi-plus-lg me-1" /> Nueva ruta
                </button>
              </div>
            </div>

            <div className="input-group w-100">
              <span className="input-group-text"><i className="bi bi-search" /></span>
              <input
                className="form-control"
                placeholder="Buscar por origen, destino o dirección…"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
              {filtro && (
                <button className="btn btn-outline-secondary" onClick={() => setFiltro('')}>
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {cargando ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Cargando rutas...</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th></th>
                    <th>Origen</th>
                    <th>Destino</th>
                    <th>Inicio</th>
                    <th>Duración</th>
                    <th>Dirección</th>
                    <th>Paradas</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rutasFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={8}>Sin resultados</td>
                    </tr>
                  )}

                  {rutasFiltradas.map((ruta) => {
                    const totalParadas = ruta?.stops?.length || 0;
                    const duracion = `${Math.floor(ruta.durationMinutes / 60)}h ${ruta.durationMinutes % 60}m`;

                    return (
                      <React.Fragment key={ruta._id}>
                        <tr className={isExpanded(ruta._id) ? 'table-active' : ''}>
                          <td>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => toggleExpandirRuta(ruta._id)}
                            >
                              <i className={`bi ${isExpanded(ruta._id) ? 'bi-chevron-down' : 'bi-chevron-right'}`} />
                            </button>
                          </td>
                          <td>{ruta.origin}</td>
                          <td>{ruta.destination}</td>
                          <td>{ruta.startTime}</td>
                          <td>{duracion}</td>
                          <td>{ruta.direction}</td>
                          <td>
                            <span className="badge bg-info-subtle text-info-emphasis border">
                              {totalParadas}
                            </span>
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-outline-danger"
                                onClick={() => handleEliminar(ruta._id)}
                              >
                                <i className="bi bi-trash" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded(ruta._id) && (
                          <tr>
                            <td colSpan={8}>
                              <div className="p-2 border rounded bg-light">
                                <h6>Paradas</h6>
                                <table className="table table-sm mb-0">
                                  <thead>
                                    <tr>
                                      <th>#</th>
                                      <th>ID Parada</th>
                                      <th>Offset (min)</th>
                                      <th>Precio</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {[...(ruta.stops || [])]
                                      .sort((a, b) => (a.order || 0) - (b.order || 0))
                                      .map((stop) => (
                                        <tr key={stop._id}>
                                          <td>{stop.order}</td>
                                          <td>{stop.stop}</td>
                                          <td>{stop.offsetMinutes}</td>
                                          <td>{stop.segmentPrice}</td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <ModalBase
        visible={modalRutaVisible}
        title={rutaEditando ? 'Editar Ruta' : 'Nueva Ruta'}
        onClose={() => {
          setModalRutaVisible(false);
          setRutaEditando(null);
        }}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalRutaVisible(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleGuardarRuta}>
              Guardar Cambios
            </button>
          </>
        }
      >
        <RutaEditor formRuta={formRuta} setFormRuta={setFormRuta} />
      </ModalBase>
    </div>
  );
};

export default Rutas;