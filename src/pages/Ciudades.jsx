import React, { useEffect, useState } from 'react';
import Sidebar from '@components/Sidebar/Sidebar';
import '@components/Dashboard/dashboard.css';
import { Spinner } from 'react-bootstrap';
import { showToast } from '@components/Toast/Toast';
import Swal from 'sweetalert2';
import ModalBase from '@components/ModalBase/ModalBase';

const Ciudades = () => {
  const [ciudades, setCiudades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [ciudadEditando, setCiudadEditando] = useState(null);

  const [formCiudad, setFormCiudad] = useState({
    name: '',
    region: '',
    country: ''
  });
  const regionesUnicas = [...new Set(ciudades.map((c) => c.region).filter(Boolean))];

  const ciudadesPorRegion = regionesUnicas.reduce((acc, region) => {
    acc[region] = ciudades.filter((c) => c.region === region);
    return acc;
  }, {});

  const paisesUnicos = [...new Set(ciudades.map((c) => c.country).filter(Boolean))];
  const [usarRegionManual, setUsarRegionManual] = useState(false);
  const [usarPaisManual, setUsarPaisManual] = useState(false);

  useEffect(() => {
    const fetchCiudades = async () => {
      try {
        const res = await fetch('https://boletos.dev-wit.com/api/cities');
        const data = await res.json();
        setCiudades(data);
      } catch (error) {
        console.error('Error al cargar ciudades:', error);
      } finally {
        setCargando(false);
      }
    };

    fetchCiudades();
  }, []);

  const resetFormularioCiudad = () => {
    setModalVisible(false);
    setCiudadEditando(null);
    setFormCiudad({ name: '', region: '', country: '' });
    setUsarRegionManual(false);
    setUsarPaisManual(false);
  };

  const handleEditar = (ciudad) => {
    setCiudadEditando(ciudad._id);
    setFormCiudad({
      name: ciudad.name,
      region: ciudad.region,
      country: ciudad.country
    });
    setModalVisible(true);
  };

  const handleGuardar = async () => {
    const esNueva = !ciudadEditando;
    const url = esNueva
      ? 'https://boletos.dev-wit.com/api/cities'
      : `https://boletos.dev-wit.com/api/cities/${ciudadEditando}`;
    const metodo = esNueva ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formCiudad)
      });

      if (!res.ok) throw new Error('No se pudo guardar la ciudad');

      const data = await res.json();

      setCiudades((prev) => {
        if (esNueva) return [...prev, data];
        return prev.map((c) => (c._id === ciudadEditando ? data : c));
      });

      showToast(
        esNueva ? 'Ciudad creada' : 'Ciudad actualizada',
        esNueva ? 'La ciudad fue creada exitosamente' : 'Cambios guardados correctamente'
      );

      setModalVisible(false);
      setCiudadEditando(null);
    } catch (err) {
      console.error(err);
      showToast('Error', err.message || 'No se pudo guardar la ciudad', true);
    }
  };

  const handleEliminar = async (id) => {
    const confirm = await Swal.fire({
      title: '¿Eliminar ciudad?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`https://boletos.dev-wit.com/api/cities/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('No se pudo eliminar');

      setCiudades((prev) => prev.filter((c) => c._id !== id));
      showToast('Ciudad eliminada', 'La ciudad fue eliminada correctamente');
    } catch (err) {
      console.error(err);
      showToast('Error', err.message || 'No se pudo eliminar la ciudad', true);
    }
  };

  return (
    <div className="dashboard-container">
      <Sidebar activeItem="ciudades" />
      <main className="main-content">
        <div className="header">
          <h1 className="mb-0">Gestión de Ciudades</h1>
          <p className="text-muted">Aquí puedes visualizar las ciudades disponibles en el sistema</p>
        </div>

        <div className="stats-box">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className="mb-0">Ciudades registradas</h4>
            
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-secondary btn-sm"
                disabled={actualizando}
                onClick={async () => {
                  setActualizando(true);
                  try {
                    const res = await fetch('https://boletos.dev-wit.com/api/cities');
                    const data = await res.json();

                    setCiudades((prevCiudades) => {
                      const nuevasCiudades = [];

                      data.forEach((nuevaCiudad) => {
                        const antigua = prevCiudades.find((c) => c._id === nuevaCiudad._id);

                        const haCambiado =
                          !antigua ||
                          antigua.name !== nuevaCiudad.name ||
                          antigua.region !== nuevaCiudad.region ||
                          antigua.country !== nuevaCiudad.country;

                        if (haCambiado || !antigua) {
                          nuevasCiudades.push(nuevaCiudad);
                        } else {
                          nuevasCiudades.push(antigua);
                        }
                      });

                      return nuevasCiudades;
                    });

                    showToast('Actualizado', 'Se sincronizó la lista de ciudades con el servidor');
                  } catch (err) {
                    console.error(err);
                    showToast('Error al actualizar', err.message || 'No se pudo actualizar la lista de ciudades', true);
                  } finally {
                    setActualizando(false);
                  }
                }}
              >
                {actualizando ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <>
                    <i className="bi bi-arrow-repeat me-1"></i> Actualizar
                  </>
                )}
              </button>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setCiudadEditando(null);
                  setFormCiudad({ name: '', region: '', country: '' });
                  setModalVisible(true);
                }}
              >
                <i className="bi bi-plus-lg me-2"></i> Nueva ciudad
              </button>
            </div>
          </div>

          {cargando ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Cargando ciudades...</p>
            </div>
          ) : (
            <div className="listado-agrupado">
              {regionesUnicas.map((region) => (
                <div key={region} className="mb-4">
                  <h5 className="fw-bold text-primary border-bottom pb-1">{region}</h5>

                  {ciudadesPorRegion[region].map((ciudad) => (
                    <div key={ciudad._id} className="d-flex justify-content-between align-items-center border-bottom py-2">
                      <div>
                        <strong>{ciudad.name}</strong> <span className="text-muted">({ciudad.country})</span>
                      </div>
                      <div>
                        <button className="btn btn-sm btn-warning me-2" onClick={() => handleEditar(ciudad)}>
                          <i className="bi bi-pencil-square"></i>
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleEliminar(ciudad._id)}>
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <ModalBase
        visible={modalVisible}
        title={ciudadEditando ? 'Editar ciudad' : 'Nueva ciudad'}
        onClose={() => {
          setModalVisible(false);
          setCiudadEditando(null);
          setFormCiudad({ name: '', region: '', country: '' });
          setUsarRegionManual(false);
          setUsarPaisManual(false);
        }}
        footer={
          <>
            <button className="btn btn-secondary" onClick={resetFormularioCiudad}>
              Cancelar
            </button>

            <button className="btn btn-primary" onClick={handleGuardar}>
              Guardar
            </button>
          </>
        }
      >
        <div className="mb-3">
          <label className="form-label">Nombre</label>
          <input
            type="text"
            className="form-control"
            value={formCiudad.name}
            onChange={(e) => setFormCiudad({ ...formCiudad, name: e.target.value })}
          />
        </div>

        {/* REGIÓN */}
        <div className="mb-3">
          <label className="form-label">Región</label>
          {usarRegionManual ? (
            <input
              type="text"
              className="form-control"
              placeholder="Escribe una nueva región"
              value={formCiudad.region}
              onChange={(e) => {
                const valor = e.target.value;
                setFormCiudad({ ...formCiudad, region: valor });
                if (valor.trim() === '') {
                  setUsarRegionManual(false);
                }
              }}
            />
          ) : (
            <select
              className="form-select"
              value={formCiudad.region}
              onChange={(e) => {
                const valor = e.target.value;
                if (valor === '__otra__') {
                  setUsarRegionManual(true);
                  setFormCiudad({ ...formCiudad, region: '' });
                } else {
                  setFormCiudad({ ...formCiudad, region: valor });
                }
              }}
            >
              <option value="">Seleccione una región</option>
              {regionesUnicas.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
              <option value="__otra__">Otro...</option>
            </select>
          )}
        </div>

        {/* PAÍS */}
        <div className="mb-3">
          <label className="form-label">País</label>
          {usarPaisManual ? (
            <input
              type="text"
              className="form-control"
              placeholder="Escribe un nuevo país"
              value={formCiudad.country}
              onChange={(e) => {
                const valor = e.target.value;
                setFormCiudad({ ...formCiudad, country: valor });
                if (valor.trim() === '') {
                  setUsarPaisManual(false);
                }
              }}
            />
          ) : (
            <select
              className="form-select"
              value={formCiudad.country}
              onChange={(e) => {
                const valor = e.target.value;
                if (valor === '__otro__') {
                  setUsarPaisManual(true);
                  setFormCiudad({ ...formCiudad, country: '' });
                } else {
                  setFormCiudad({ ...formCiudad, country: valor });
                }
              }}
            >
              <option value="">Seleccione un país</option>
              {paisesUnicos.map((pais) => (
                <option key={pais} value={pais}>
                  {pais}
                </option>
              ))}
              <option value="__otro__">Otro...</option>
            </select>
          )}
        </div>
      </ModalBase>
    </div>
  );
};

export default Ciudades;