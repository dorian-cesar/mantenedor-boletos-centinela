import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '@components/Sidebar/Sidebar';
import '@components/Dashboard/dashboard.css';
import { Spinner } from 'react-bootstrap';
import { showToast } from '@components/Toast/Toast';
import ModalBase from '@components/ModalBase/ModalBase';
import Swal from 'sweetalert2';

const Companias = () => {
  const [companias, setCompanias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [formCompania, setFormCompania] = useState({
    _id: '',
    name: '',
    rut: '',
    address: '',
    phone: '',
    email: '',
    website: '',
  });

  const canSave = useMemo(() => {
    const n = (formCompania.name || '').trim();
    const r = (formCompania.rut || '').trim();
    const a = (formCompania.address || '').trim();
    return n.length >= 2 && r.length >= 7 && a.length >= 5 && !guardando;
  }, [formCompania, guardando]);

  const cargarCompanias = async () => {
    const res = await fetch('https://bcentinela.dev-wit.com/api/companies');
    if (!res.ok) throw new Error('Error al obtener compañías desde el servidor');
    const data = await res.json();
    setCompanias(data);
  };

  useEffect(() => {
    (async () => {
      try {
        await cargarCompanias();
      } catch (err) {
        console.error(err);
        showToast('Error', 'No se pudieron cargar las compañías', true);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const abrirModalNueva = () => {
    setFormCompania({
      _id: '',
      name: '',
      rut: '',
      address: '',
      phone: '',
      email: '',
      website: '',
    });
    setEditando(false);
    setModalVisible(true);
  };

  const abrirModalEditar = (compania) => {
    setFormCompania({
      _id: compania._id,
      name: compania.name || '',
      rut: compania.rut || '',
      address: compania.address || '',
      phone: compania.phone || '',
      email: compania.email || '',
      website: compania.website || '',
    });
    setEditando(true);
    setModalVisible(true);
  };

  const eliminarCompania = async (id) => {
    const result = await Swal.fire({
      title: '¿Eliminar compañía?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`https://bcentinela.dev-wit.com/api/companies/${id}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('No se pudo eliminar la compañía');
        setCompanias((prev) => prev.filter((c) => c._id !== id));
        showToast('Éxito', 'Compañía eliminada correctamente');
      } catch (err) {
        console.error(err);
        showToast('Error', err.message || 'No se pudo eliminar la compañía', true);
      }
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar activeItem="companias" />
      <main className="main-content">
        <div className="header">
          <h1 className="mb-0">Gestión de Compañías</h1>
          <p className="text-muted">Aquí puedes visualizar, crear, editar o eliminar compañías</p>
        </div>

        <div className="stats-box">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <h4 className="mb-0">Compañías registradas</h4>
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-secondary btn-sm"
                disabled={actualizando}
                onClick={async () => {
                  setActualizando(true);
                  try {
                    await cargarCompanias();
                    showToast('Actualizado', 'Se sincronizó la lista de compañías');
                  } catch (err) {
                    console.error(err);
                    showToast('Error', 'No se pudo actualizar la lista de compañías', true);
                  } finally {
                    setActualizando(false);
                  }
                }}
              >
                {actualizando ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <>
                    <i className="bi bi-arrow-repeat me-1" />
                    Actualizar
                  </>
                )}
              </button>

              <button className="btn btn-primary btn-sm" onClick={abrirModalNueva}>
                <i className="bi bi-plus-lg me-1" /> Nueva Compañía
              </button>
            </div>
          </div>

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
                    <th>Nombre</th>
                    <th>RUT</th>
                    <th>Dirección</th>
                    <th>Teléfono</th>
                    <th>Email</th>
                    <th>Sitio Web</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {companias.map((c) => (
                    <tr key={c._id}>
                      <td>{c.name}</td>
                      <td>{c.rut}</td>
                      <td>{c.address}</td>
                      <td>{c.phone || '—'}</td>
                      <td>{c.email || '—'}</td>
                      <td>
                        {c.website ? (() => {
                          try {
                            const hostname = new URL(c.website).hostname;
                            return (
                              <a href={c.website} target="_blank" rel="noopener noreferrer">
                                {hostname}
                              </a>
                            );
                          } catch {
                            return (
                              <a href={c.website} target="_blank" rel="noopener noreferrer">
                                {c.website}
                              </a>
                            );
                          }
                        })() : '—'}
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm" role="group">
                          <button
                            className="btn btn-outline-primary"
                            title="Editar"
                            onClick={() => abrirModalEditar(c)}
                          >
                            <i className="bi bi-pencil-square" />
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            title="Eliminar"
                            onClick={() => eliminarCompania(c._id)}
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal creación/edición */}
        <ModalBase
          visible={modalVisible}
          title={editando ? 'Editar compañía' : 'Registrar nueva compañía'}
          onClose={() => {
            setModalVisible(false);
            setEditando(false);
          }}
          footer={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setModalVisible(false)}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={!canSave}
                onClick={async () => {
                  setGuardando(true);
                  try {
                    const url = editando
                      ? `https://bcentinela.dev-wit.com/api/companies/${formCompania._id}`
                      : 'https://bcentinela.dev-wit.com/api/companies';
                    const method = editando ? 'PUT' : 'POST';

                    const res = await fetch(url, {
                      method,
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: formCompania.name.trim(),
                        rut: formCompania.rut.trim(),
                        address: formCompania.address.trim(),
                        phone: formCompania.phone?.trim(),
                        email: formCompania.email?.trim(),
                        website: formCompania.website?.trim(),
                      }),
                    });
                    if (!res.ok) throw new Error('Error al guardar compañía');
                    const data = await res.json();

                    if (editando) {
                      setCompanias((prev) =>
                        prev.map((c) => (c._id === formCompania._id ? data : c))
                      );
                      showToast('Éxito', 'Compañía editada correctamente');
                    } else {
                      setCompanias((prev) => [...prev, data]);
                      showToast('Éxito', 'Compañía creada correctamente');
                    }

                    setModalVisible(false);
                    setEditando(false);
                  } catch (err) {
                    console.error(err);
                    showToast('Error', err.message || 'No se pudo guardar la compañía', true);
                  } finally {
                    setGuardando(false);
                  }
                }}
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </>
          }
        >
          <div className="row g-3">
            {/* Identificación */}
            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-building me-1" /> Nombre *
              </label>
              <input
                type="text"
                className="form-control"
                value={formCompania.name}
                onChange={(e) => setFormCompania({ ...formCompania, name: e.target.value })}
                placeholder="Ej: Buses Norte"
                disabled={guardando}
              />
              <div className="form-text">Nombre legal o comercial de la compañía.</div>
            </div>

            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-credit-card-2-front me-1" /> RUT *
              </label>
              <input
                type="text"
                className="form-control"
                value={formCompania.rut}
                onChange={(e) => setFormCompania({ ...formCompania, rut: e.target.value })}
                placeholder="77.987.654-3"
                disabled={guardando}
              />
              <div className="form-text">Formato: 99.999.999-9</div>
            </div>

            {/* Ubicación */}
            <div className="col-12">
              <label className="form-label">
                <i className="bi bi-geo-alt me-1" /> Dirección *
              </label>
              <input
                type="text"
                className="form-control"
                value={formCompania.address}
                onChange={(e) => setFormCompania({ ...formCompania, address: e.target.value })}
                placeholder="Ej: Terminal Norte 123, Arica"
                disabled={guardando}
              />
              <div className="form-text">Dirección física de la compañía.</div>
            </div>

            {/* Teléfono */}
            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-telephone me-1" /> Teléfono
              </label>
              <input
                type="tel"
                className={`form-control ${
                  formCompania.phone && !/^\+?\d+$/.test(formCompania.phone) ? 'is-invalid' : ''
                }`}
                value={formCompania.phone}
                onChange={(e) => setFormCompania({ ...formCompania, phone: e.target.value })}
                placeholder="+56912345678"
                disabled={guardando}
              />
              <div className="invalid-feedback">El teléfono solo puede contener números y opcionalmente + al inicio.</div>
            </div>

            {/* Email */}
            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-envelope me-1" /> Email
              </label>
              <input
                type="email"
                className={`form-control ${
                  formCompania.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formCompania.email) ? 'is-invalid' : ''
                }`}
                value={formCompania.email}
                onChange={(e) => setFormCompania({ ...formCompania, email: e.target.value })}
                placeholder="info@busesnorte.cl"
                disabled={guardando}
              />
              <div className="invalid-feedback">Ingresa un correo válido con @ y dominio.</div>
            </div>

            {/* Sitio web */}
            <div className="col-12">
              <label className="form-label">
                <i className="bi bi-globe me-1" /> Sitio web
              </label>
              <input
                type="url"
                className={`form-control ${
                  formCompania.website &&
                  !/^[^\s]+\.[a-z]{2,}(\/.*)?$/i.test(formCompania.website)
                    ? 'is-invalid'
                    : ''
                }`}
                value={formCompania.website}
                onChange={(e) => setFormCompania({ ...formCompania, website: e.target.value })}
                placeholder="busesnorte.cl"
                disabled={guardando}
              />
              <div className="invalid-feedback">
                Ingresa un dominio válido que termine en .cl, .com, .org, etc.
              </div>
            </div>
          </div>
        </ModalBase>
      </main>
    </div>
  );
};

export default Companias;