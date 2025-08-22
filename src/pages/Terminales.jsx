import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '@components/Sidebar/Sidebar';
import '@components/Dashboard/dashboard.css';
import { Spinner } from 'react-bootstrap';
import { showToast } from '@components/Toast/Toast';
import ModalBase from '@components/ModalBase/ModalBase';
import Swal from 'sweetalert2';

const Terminales = () => {
  const [terminales, setTerminales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);

  // Modal / creación / edición
  const [modalVisible, setModalVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [formTerminal, setFormTerminal] = useState({
    _id: '',
    name: '',
    address: '',
    city: '',
    region: '',
  });
  const [editando, setEditando] = useState(false);

  // Ciudades
  const [ciudades, setCiudades] = useState([]);
  const [cargandoCiudades, setCargandoCiudades] = useState(false);
  const [errorCiudades, setErrorCiudades] = useState('');
  const [filtroCiudad, setFiltroCiudad] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');

  const canSave = useMemo(() => {
    const n = (formTerminal.name || '').trim();
    const a = (formTerminal.address || '').trim();
    const c = (formTerminal.city || '').trim();
    const r = (formTerminal.region || '').trim();
    return n.length >= 3 && a.length >= 5 && c.length >= 2 && r.length >= 2 && !guardando;
  }, [formTerminal, guardando]);

  const cargarTerminales = async () => {
    const res = await fetch('https://bcentinela.dev-wit.com/api/terminals');
    if (!res.ok) throw new Error('Error al obtener terminales desde el servidor');
    const data = await res.json();
    setTerminales(data);
  };

  const cargarCiudades = async () => {
    setCargandoCiudades(true);
    setErrorCiudades('');
    try {
      const res = await fetch('https://bcentinela.dev-wit.com/api/cities');
      if (!res.ok) throw new Error('No se pudieron obtener las ciudades');
      const data = await res.json();
      data.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
      setCiudades(data);
    } catch (err) {
      console.error(err);
      setErrorCiudades(err.message || 'Error al cargar ciudades');
      showToast('Error', err.message || 'No se pudieron cargar las ciudades', true);
    } finally {
      setCargandoCiudades(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await cargarTerminales();
      } catch (error) {
        console.error('Error al cargar terminales:', error);
        showToast('Error', error.message || 'No se pudieron cargar los terminales.', true);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const abrirModalNuevo = async () => {
    setFormTerminal({ _id: '', name: '', address: '', city: '', region: '' });
    setSelectedCityId('');
    setFiltroCiudad('');
    setEditando(false);
    setModalVisible(true);
    if (ciudades.length === 0) {
      await cargarCiudades();
    }
  };

  const abrirModalEditar = async (terminal) => {
    setFormTerminal({
      _id: terminal._id,
      name: terminal.name,
      address: terminal.address,
      city: terminal.city,
      region: terminal.region,
    });
    setSelectedCityId('');
    setFiltroCiudad('');
    setEditando(true);
    setModalVisible(true);
    if (ciudades.length === 0) {
      await cargarCiudades();
    }
  };

  const eliminarTerminal = async (id) => {
    const result = await Swal.fire({
      title: '¿Eliminar terminal?',
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
        const res = await fetch(`https://bcentinela.dev-wit.com/api/terminals/${id}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('No se pudo eliminar el terminal');
        setTerminales((prev) => prev.filter((t) => t._id !== id));
        showToast('Éxito', 'Terminal eliminado correctamente');
      } catch (err) {
        console.error(err);
        showToast('Error', err.message || 'No se pudo eliminar el terminal', true);
      }
    }
  };

  const onSelectCiudad = (cityId) => {
    setSelectedCityId(cityId);
    const city = ciudades.find(c => c._id === cityId);
    if (city) {
      setFormTerminal(ft => ({
        ...ft,
        city: city.name,
        region: city.region || ''
      }));
    } else {
      setFormTerminal(ft => ({ ...ft, city: '', region: '' }));
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar activeItem="terminales" />
      <main className="main-content">
        <div className="header">
          <h1 className="mb-0">Gestión de Terminales</h1>
          <p className="text-muted">Aquí puedes visualizar, crear, editar o eliminar terminales</p>
        </div>

        <div className="stats-box">
          {/* Header + acciones */}
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <h4 className="mb-0">Terminales registrados</h4>
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-secondary btn-sm"
                disabled={actualizando}
                onClick={async () => {
                  setActualizando(true);
                  try {
                    await cargarTerminales();
                    showToast('Actualizado', 'Se sincronizó la lista de terminales');
                  } catch (err) {
                    console.error(err);
                    showToast('Error al actualizar', err.message || 'No se pudo actualizar la lista de terminales', true);
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

              <button className="btn btn-primary btn-sm" onClick={abrirModalNuevo}>
                <i className="bi bi-plus-lg me-1" /> Nuevo Terminal
              </button>
            </div>
          </div>

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
                    <th>Nombre</th>
                    <th>Dirección</th>
                    <th>Ciudad</th>
                    <th>Región</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {terminales.map((t) => (
                    <tr key={t._id}>
                      <td>{t.name}</td>
                      <td>{t.address}</td>
                      <td>{t.city}</td>
                      <td>{t.region}</td>
                      <td>
                        <div className="btn-group btn-group-sm" role="group">
                          <button
                            className="btn btn-outline-primary"
                            title="Editar"
                            onClick={() => abrirModalEditar(t)}
                          >
                            <i className="bi bi-pencil-square" />
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            title="Eliminar"
                            onClick={() => eliminarTerminal(t._id)}
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
          title={editando ? 'Editar terminal' : 'Registrar nuevo terminal'}
          onClose={() => {
            setModalVisible(false);
            setFormTerminal({ _id: '', name: '', address: '', city: '', region: '' });
            setSelectedCityId('');
            setFiltroCiudad('');
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
                      ? `https://bcentinela.dev-wit.com/api/terminals/${formTerminal._id}`
                      : 'https://bcentinela.dev-wit.com/api/terminals';
                    const method = editando ? 'PUT' : 'POST';
                    const res = await fetch(url, {
                      method,
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: formTerminal.name.trim(),
                        address: formTerminal.address.trim(),
                        city: formTerminal.city.trim(),
                        region: formTerminal.region.trim(),
                      }),
                    });
                    if (!res.ok) throw new Error('Error al guardar terminal');
                    const data = await res.json();

                    if (editando) {
                      setTerminales((prev) =>
                        prev.map((t) => (t._id === formTerminal._id ? data : t))
                      );
                      showToast('Éxito', 'Terminal editado correctamente');
                    } else {
                      setTerminales((prev) => [...prev, data]);
                      showToast('Éxito', 'Terminal creado correctamente');
                    }

                    setModalVisible(false);
                    setFormTerminal({ _id: '', name: '', address: '', city: '', region: '' });
                    setEditando(false);
                  } catch (err) {
                    console.error(err);
                    showToast('Error', err.message || 'No se pudo guardar el terminal', true);
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
            <div className="col-md-6">
              <label className="form-label">Nombre</label>
              <input
                type="text"
                className="form-control"
                value={formTerminal.name}
                onChange={(e) => setFormTerminal({ ...formTerminal, name: e.target.value })}
                placeholder="Ej: Terminal Alameda"
                disabled={guardando}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">Ciudad</label>
              <input
                type="text"
                className="form-control mb-2"
                placeholder="Filtrar ciudades…"
                value={filtroCiudad}
                onChange={(e) => setFiltroCiudad(e.target.value)}
                disabled={cargandoCiudades || guardando}
              />
              <select
                className="form-select"
                value={selectedCityId}
                onChange={(e) => onSelectCiudad(e.target.value)}
                disabled={cargandoCiudades || !!errorCiudades || guardando}
              >
                <option value="">
                  {cargandoCiudades ? 'Cargando ciudades…' : 'Selecciona una ciudad'}
                </option>
                {ciudades
                  .filter((c) =>
                    c.name.toLowerCase().includes(filtroCiudad.toLowerCase())
                  )
                  .map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} — {c.region}
                    </option>
                  ))}
              </select>
              {errorCiudades && (
                <div className="form-text text-danger">{errorCiudades}</div>
              )}
            </div>

            <div className="col-12">
              <label className="form-label">Dirección</label>
              <input
                type="text"
                className="form-control"
                value={formTerminal.address}
                onChange={(e) => setFormTerminal({ ...formTerminal, address: e.target.value })}
                placeholder="Ej: Av. Libertador Bernardo O'Higgins 3850"
                disabled={guardando}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">Región</label>
              <input
                type="text"
                className="form-control"
                value={formTerminal.region}
                readOnly
                disabled
              />
            </div>
          </div>
        </ModalBase>
      </main>
    </div>
  );
};

export default Terminales;
