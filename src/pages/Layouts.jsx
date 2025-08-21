import React, { useEffect, useState } from 'react';
import Sidebar from '@components/Sidebar/Sidebar';
import '@components/Dashboard/dashboard.css';
import { Spinner } from 'react-bootstrap';
import ModalBase from '@components/ModalBase/ModalBase';
import { showToast } from '@components/Toast/Toast';
import SeatGridEditor from '../components/SeatGridEditor/SeatGridEditor';
import Swal from 'sweetalert2';

const Layout = () => {
  const [layouts, setLayouts] = useState([]);
  const [cargando, setCargando] = useState(true);   
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [layoutEditando, setLayoutEditando] = useState(null);
  const [modoCreacion, setModoCreacion] = useState(true);


  const [formLayout, setFormLayout] = useState({
    name: '',
    pisos: '1',
    capacidad: '',
    tipo_Asiento_piso_1: '',
    tipo_Asiento_piso_2: '',
    rows_piso_1: '',
    columns_piso_1: '',
    rows_piso_2: '',
    columns_piso_2: ''
  });  

  const [actualizando, setActualizando] = useState(false);  
  const [currentStep, setCurrentStep] = useState(1);
  const [seatMap, setSeatMap] = useState({
    floor1: { seatMap: [] },
    floor2: { seatMap: [] }
  });

  const contarAsientos = (seatMap) => {
    if (!seatMap || !Array.isArray(seatMap)) return 0;
    return seatMap.reduce(
      (total, fila) =>
        total +
        fila.filter(asiento => asiento && typeof asiento === 'object' && asiento.type === 'asiento').length,
      0
    );
  };

  const normalizarSeatMap = (rawMap) => {
    if (!Array.isArray(rawMap)) return [];
    return rawMap.map(row =>
      row.map(cell => {
        // Ya viene como objeto válido
        if (typeof cell === 'object' && cell !== null) return cell;

        // Strings desde la DB
        if (typeof cell === 'string') {
          const s = cell.trim();
          if (s === '')  return { type: 'pasillo', label: '' };
          if (s === 'WC') return { type: 'baño', label: 'WC' };
          if (s === '#')  return { type: 'vacio', label: '' }; // o muestra '#' si quieres
          // Cualquier otro string se asume asiento
          return { type: 'asiento', label: cell };
        }

        // Fallback seguro
        return { type: 'pasillo', label: '' };
      })
    );
  };

  const pisosNum = Number(formLayout.pisos);
  const capacidadCalculada =
    contarAsientos(seatMap.floor1.seatMap) +
    (pisosNum === 2 ? contarAsientos(seatMap.floor2.seatMap) : 0);

  const handleEditar = async (layout) => {
    try {
      if (!layout?._id) throw new Error('Este layout no tiene _id. No se puede cargar.');

      const res = await fetch(`https://boletos.dev-wit.com/api/layouts/${layout._id}`);

      if (!res.ok) throw new Error('No se pudo cargar el layout completo');
      const fullLayout = await res.json();
      setLayoutEditando(fullLayout._id);

      setFormLayout({ 
        name: fullLayout.name, 
        rows: fullLayout.rows,
        columns: fullLayout.columns,
        pisos: fullLayout.pisos?.toString() || '1',
        capacidad: fullLayout.capacidad, 
        tipo_Asiento_piso_1: fullLayout.tipo_Asiento_piso_1, 
        tipo_Asiento_piso_2: fullLayout.tipo_Asiento_piso_2,
        rows_piso_1: fullLayout.floor1?.seatMap?.length || 0,
        columns_piso_1: fullLayout.floor1?.seatMap?.[0]?.length || 0,
        rows_piso_2: fullLayout.floor2?.seatMap?.length || 0,
        columns_piso_2: fullLayout.floor2?.seatMap?.[0]?.length || 0
      });

      setSeatMap({
        floor1: { seatMap: normalizarSeatMap(fullLayout.floor1?.seatMap || []) },
        floor2: { seatMap: normalizarSeatMap(fullLayout.floor2?.seatMap || []) }
      });

      setModoCreacion(false);
      setCurrentStep(1);
      setModalEditarVisible(true);

    } catch (error) {
      console.error('Error al cargar layout completo:', error);
      showToast('Error', error.message || 'No se pudo cargar el layout completo', true);
    }
  };

  const handleEliminar = async (_id) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: '¿Estás seguro de eliminar este layout de servicio?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      confirmButtonColor: '#3085d6',
      cancelButtonText: 'Cancelar',
      cancelButtonColor: '#d33',
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`https://boletos.dev-wit.com/api/layouts/${_id}`, {
        method: 'DELETE',
      });
      await showToast('Layout eliminado', 'El layout fue eliminado exitosamente.');

      if (!res.ok) throw new Error('Error al eliminar');
      setLayouts((prev) => prev.filter((t) => t._id !== _id));
    } catch (err) {
      console.error(err);
      alert('Error al eliminar');
    }
  };

  useEffect(() => {
    const fetchLayouts = async () => {
      setCargando(true);
      try {
        const res = await fetch('https://boletos.dev-wit.com/api/layouts/');
        const text = await res.text();
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          throw new Error('Respuesta no JSON al listar layouts.');
        }

        if (!res.ok) {
          throw new Error(body?.message || `Error HTTP ${res.status}`);
        }
        if (!Array.isArray(body)) {
          throw new Error('El backend no devolvió un arreglo de layouts.');
        }
        
        setLayouts(
          body.map(layout => ({
            ...layout,
            floor1: layout.floor1,
            floor2: layout.floor2,
          }))
        );
      } catch (error) {
        console.error('Error al cargar layout de servicio:', error);
        showToast('Error', error.message || 'No se pudo cargar la lista de layouts', true);
        setLayouts([]);
      } finally {
        setCargando(false);
      }
    };

    fetchLayouts();
  }, []);

  // Piso 1 - Independiente
  useEffect(() => {
    if (!modoCreacion) return;
    if (!formLayout.rows_piso_1 || !formLayout.columns_piso_1) return;

    const generateSeatMap = (rows, cols, startNum = 1) => {
      return Array.from({ length: rows }, (_, rowIdx) =>
        Array.from({ length: cols }, (_, colIdx) => {
          if (cols === 5 && colIdx === 2) return { type: 'pasillo', label: '' };
          const rowNum = rowIdx + startNum;
          const colLetter = String.fromCharCode(65 + colIdx - (cols === 5 && colIdx > 2 ? 1 : 0));
          return { type: 'asiento', label: `${rowNum}${colLetter}` };
        })
      );
    };

    const floor1Map = generateSeatMap(
      parseInt(formLayout.rows_piso_1),
      parseInt(formLayout.columns_piso_1),
      1
    );

    setSeatMap(prev => ({
      floor1: { seatMap: normalizarSeatMap(floor1Map) },
      floor2: prev.floor2 || { seatMap: [] } 
    }));
  }, [modoCreacion, formLayout.rows_piso_1, formLayout.columns_piso_1]);

  // Piso 2 - generar/ajustar grilla también en edición
  useEffect(() => {
    const pisosNum = Number(formLayout.pisos);
    if (pisosNum !== 2) return;

    const rows = parseInt(formLayout.rows_piso_2 || 0);
    const cols = parseInt(formLayout.columns_piso_2 || 0);
    if (!rows || !cols) return;

    const yaExiste = Array.isArray(seatMap.floor2?.seatMap) && seatMap.floor2.seatMap.length > 0;
    const dimsIguales =
      yaExiste &&
      seatMap.floor2.seatMap.length === rows &&
      seatMap.floor2.seatMap[0]?.length === cols;

    // Si no hay grilla o cambian filas/columnas -> regenerar
    if (!yaExiste || !dimsIguales) {
      const floor2Map = Array.from({ length: rows }, (_, rowIdx) =>
        Array.from({ length: cols }, (_, colIdx) => {
          if (cols === 5 && colIdx === 2) return { type: 'pasillo', label: '' };
          const colOffset = (cols === 5 && colIdx > 2) ? (colIdx - 1) : colIdx;
          const label = `${rowIdx + 1}${String.fromCharCode(65 + colOffset)}`;
          return { type: 'asiento', label };
        })
      );

      setSeatMap(prev => ({
        ...prev,
        floor2: { seatMap: floor2Map },
      }));
    }
  }, [formLayout.pisos, formLayout.rows_piso_2, formLayout.columns_piso_2]);

  const handleGuardar = async () => {
    const pisosNum = Number(formLayout.pisos);
    const capacidadCalculada =
      contarAsientos(seatMap.floor1.seatMap) +
      (pisosNum === 2 ? contarAsientos(seatMap.floor2.seatMap) : 0);

    const rowsTotal =
      parseInt(formLayout.rows_piso_1 || 0) +
      (pisosNum === 2 ? parseInt(formLayout.rows_piso_2 || 0) : 0);

    const columnsTotal =
      parseInt(formLayout.columns_piso_1 || 0) +
      (pisosNum === 2 ? parseInt(formLayout.columns_piso_2 || 0) : 0);

    const mapCellToString = (cell) => {
      if (!cell || typeof cell !== 'object') return '';
      switch (cell.type) {
        case 'asiento': return cell.label || '';
        case 'baño':    return 'WC';
        case 'vacio':   return '#';      
        default:        return '';       // pasillo y otros
      }
    };

    const payload = {
      ...formLayout,
      floor1: {
        seatMap: seatMap.floor1.seatMap.map(row => row.map(mapCellToString))
      },
      floor2: {
        seatMap: seatMap.floor2.seatMap.map(row => row.map(mapCellToString))
      },
      pisos: parseInt(formLayout.pisos),
      rows_piso_1: parseInt(formLayout.rows_piso_1),
      columns_piso_1: parseInt(formLayout.columns_piso_1),
      rows_piso_2: parseInt(formLayout.rows_piso_2),
      columns_piso_2: parseInt(formLayout.columns_piso_2),
      capacidad: capacidadCalculada,
      rows: rowsTotal,
      columns: columnsTotal
    };

    try {
      const url = layoutEditando
      ? `https://boletos.dev-wit.com/api/layouts/${layoutEditando}`
      : 'https://boletos.dev-wit.com/api/layouts/';
      const method = layoutEditando ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Error al ${layoutEditando ? 'actualizar' : 'crear'} layout`);

      await showToast('Éxito', `Layout ${layoutEditando ? 'actualizado' : 'creado'} correctamente`);
      setModalEditarVisible(false);
      setCurrentStep(1);
      setLayoutEditando(null);
      setModoCreacion(true);

      // Recarga la lista desde el backend
      setCargando(true);
      const resList = await fetch('https://boletos.dev-wit.com/api/layouts/');
      const data = await resList.json();
      setLayouts(data.map(layout => ({
        ...layout,
        floor1: layout.floor1,
        floor2: layout.floor2
      })));
      setCargando(false);

    } catch (error) {
      console.error(error);
      showToast('Error', error.message, true);
    }
  };

  const renderStepContent = () => {
    const pisosNum = Number(formLayout.pisos);
    const capacidadCalculada =
      contarAsientos(seatMap.floor1.seatMap) +
      (pisosNum === 2 ? contarAsientos(seatMap.floor2.seatMap) : 0);

    switch (currentStep) {
      case 1:
        return (
          
          <div className="row g-3">
            <h6 className="text-uppercase text-muted fw-semibold mb-2">Configuración</h6>

            <div className="col-md-6">
              <label className="form-label">Nombre del Layout*</label>
              <input
                className="form-control"
                value={formLayout.name}
                onChange={(e) => setFormLayout({ ...formLayout, name: e.target.value })}
                placeholder="Ej: bus_2pisos_48Seat"
                required
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">Número de Pisos*</label>
              <select
                className="form-select"
                value={formLayout.pisos}
                onChange={(e) => setFormLayout({
                  ...formLayout,
                  pisos: e.target.value,
                  rows_piso_2: e.target.value === '2' ? (formLayout.rows_piso_2 || 1) : '',
                  columns_piso_2: e.target.value === '2' ? (formLayout.columns_piso_2 || 1) : ''
                })}
                required
              >
                <option value="">Seleccionar...</option>
                <option value="1">1 Piso</option>
                <option value="2">2 Pisos</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label">Filas Piso 1*</label>
              <input
                type="number"
                className="form-control"
                min="1"
                value={formLayout.rows_piso_1 || ''}
                onChange={(e) => setFormLayout({ ...formLayout, rows_piso_1: e.target.value })}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Columnas Piso 1*</label>
              <input
                type="number"
                className="form-control"
                min="1"
                max="6"
                value={formLayout.columns_piso_1 || ''}
                onChange={(e) => setFormLayout({ ...formLayout, columns_piso_1: e.target.value })}
                required
              />
            </div>

            {formLayout.pisos === '2' && (
              <>
                <div className="col-md-6">
                  <label className="form-label">Filas Piso 2*</label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    value={formLayout.rows_piso_2 || ''}
                    onChange={(e) => setFormLayout({ ...formLayout, rows_piso_2: e.target.value })}
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Columnas Piso 2*</label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    max="6"
                    value={formLayout.columns_piso_2 || ''}
                    onChange={(e) => setFormLayout({ ...formLayout, columns_piso_2: e.target.value })}
                    required
                  />
                </div>
              </>
            )}

            {formLayout.rows_piso_1 && formLayout.columns_piso_1 && (
              <div className="mt-4">
                <h5 className="mb-3">Editor Visual de Asientos</h5>
                <div className="d-flex gap-4">
                  <SeatGridEditor
                    grid={seatMap.floor1.seatMap}
                    setGrid={setGridFn =>
                      setSeatMap(prevSeatMap => {
                        const gridActual = prevSeatMap.floor1.seatMap;
                        const nuevoGrid = setGridFn(gridActual);
                        return {
                          ...prevSeatMap,
                          floor1: {
                            ...prevSeatMap.floor1,
                            seatMap: nuevoGrid
                          }
                        };
                      })
                    }
                    title="Editor Piso 1"
                  />

                  {Number(formLayout.pisos) === 2 && (
                  <SeatGridEditor
                    grid={seatMap.floor2.seatMap}
                    setGrid={(setGridFn) =>
                      setSeatMap(prev => ({
                        ...prev,
                        floor2: { seatMap: setGridFn(prev.floor2.seatMap) }
                      }))
                    }
                    title="Piso 2"
                  />
                )}
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="row g-3">
            <h6 className="text-uppercase text-muted fw-semibold mb-2">Seleccione el tipo de asiento</h6>

            <div className="col-md-6">
              <label className="form-label">Tipo de Asiento - Piso 1*</label>
              <select
                className="form-select"
                value={formLayout.tipo_Asiento_piso_1}
                onChange={(e) => setFormLayout({ ...formLayout, tipo_Asiento_piso_1: e.target.value })}
                required
              >
                <option value="">Seleccionar...</option>
                <option value="Salón-Cama">Salón Cama</option>
                <option value="Semi-Cama">Semi Cama</option>
                <option value="Ejecutivo">Ejecutivo</option>
              </select>
            </div>

            {parseInt(formLayout.pisos) === 2 && (
              <div className="col-md-6">
                <label className="form-label">Tipo de Asiento - Piso 2*</label>
                <select
                  className="form-select"
                  value={formLayout.tipo_Asiento_piso_2}
                  onChange={(e) => setFormLayout({ ...formLayout, tipo_Asiento_piso_2: e.target.value })}
                  required
                >
                  <option value="">Seleccionar...</option>
                  <option value="Salón-Cama">Salón Cama</option>
                  <option value="Semi-Cama">Semi Cama</option>
                  <option value="Ejecutivo">Ejecutivo</option>
                </select>
              </div>
            )}

            <div className="col-12">
              <div className="card mt-3">
                <div className="card-body">
                  <h5 className="card-title">Resumen</h5>
                  <ul className="list-group list-group-flush">
                    <li className="list-group-item d-flex justify-content-between">
                      <span>Nombre:</span>
                      <strong>{formLayout.name || 'No definido'}</strong>
                    </li>
                    <li className="list-group-item d-flex justify-content-between">
                      <span>Pisos:</span>
                      <strong>
                        Piso 1: {formLayout.rows_piso_1 || '0'} filas × {formLayout.columns_piso_1 || '0'} columnas
                        {formLayout.pisos === '2' && (
                          <> | Piso 2: {formLayout.rows_piso_2 || '0'} filas × {formLayout.columns_piso_2 || '0'} columnas</>
                        )}
                      </strong>
                    </li>
                    <li className="list-group-item d-flex justify-content-between">
                      <span>Capacidad:</span>
                      <strong>{capacidadCalculada} asientos</strong>
                    </li>
                    <li className="list-group-item d-flex justify-content-between">
                      <span>Tipo asiento piso 1:</span>
                      <strong>{formLayout.tipo_Asiento_piso_1 || 'No definido'}</strong>
                    </li>
                    {formLayout.pisos === '2' && (
                      <li className="list-group-item d-flex justify-content-between">
                        <span>Tipo asiento piso 2:</span>
                        <strong>{formLayout.tipo_Asiento_piso_2 || 'No definido'}</strong>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const Stepper = ({ currentStep, total = 2 }) => {
    const steps = [
      { id: 1, label: 'Configuración' },
      { id: 2, label: 'Detalles' },
    ];
    const pct = total > 1 ? ((currentStep - 1) / (total - 1)) * 100 : 0;

    return (
      <div className="mb-3">
        <div className="d-flex align-items-center justify-content-between">
          {steps.map((s) => {
            const active = currentStep === s.id;
            const completed = currentStep > s.id;
            return (
              <div key={s.id} className="text-center flex-fill">
                <div
                  className={`mx-auto rounded-circle d-flex align-items-center justify-content-center
                    ${active ? 'bg-primary text-white' : completed ? 'bg-success text-white' : 'bg-light text-muted'}`}
                  style={{ width: 36, height: 36, fontWeight: 600 }}
                  aria-current={active ? 'step' : undefined}
                >
                  {s.id}
                </div>
                <div className={`mt-2 small ${active ? 'fw-semibold text-body' : 'text-muted'}`}>{s.label}</div>
              </div>
            );
          })}
        </div>

        <div className="progress mt-3" style={{ height: 6 }} aria-hidden="true">
          <div className="progress-bar" role="progressbar" style={{ width: `${pct}%` }} />
        </div>

        <div className="text-muted small mt-2 d-flex justify-content-between">
          <span className="visually-hidden" aria-live="polite">
            Estás en el paso {currentStep} de {steps.length}
          </span>
          <span>Paso {currentStep} de {steps.length}</span>
          {currentStep === 1 ? <span>Completa los campos para continuar</span> : <span>Revisa y guarda</span>}
        </div>
      </div>
    );
  };

  
  return (
    <div className="dashboard-container">
      <Sidebar activeItem="layout" />
      <main className="main-content">
        <div className="header">
          <h1 className="mb-0">Layouts de Buses</h1>
          <p className="text-muted">Aquí puedes gestionar los layouts de buses</p>
        </div>

        <div className="stats-box">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className="mb-0">Listado</h4>
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-secondary btn-sm"
                disabled={actualizando}
                onClick={async () => {
                  setActualizando(true);
                  try {
                    const res = await fetch('https://boletos.dev-wit.com/api/layouts/');
                    if (!res.ok) throw new Error('Error al obtener layouts desde el servidor');
                    const data = await res.json();

                    setLayouts((prev) => {
                      const nuevos = [];

                      data.forEach((nuevo) => {
                        const antiguo =
                          prev.find(t => t._id === nuevo._id) ||
                          prev.find(t => !t._id && t.name === nuevo.name); // fallback por name si algún legacy no trae _id
                        
                        const haCambiado =
                          !antiguo ||
                          antiguo._id !== nuevo._id ||
                          antiguo.name !== nuevo.name ||
                          antiguo.rows !== nuevo.rows ||
                          antiguo.columns !== nuevo.columns ||
                          antiguo.pisos !== nuevo.pisos ||
                          antiguo.capacidad !== nuevo.capacidad ||
                          antiguo.tipo_Asiento_piso_1 !== nuevo.tipo_Asiento_piso_1 ||
                          antiguo.tipo_Asiento_piso_2 !== nuevo.tipo_Asiento_piso_2;

                        nuevos.push(haCambiado || !antiguo ? nuevo : antiguo);
                      });

                      // Eliminar Layouts que ya no están
                      const ids = data.map(t => t._id);
                      const names = data.map(t => t.name);
                      return nuevos.filter(t => (t._id ? ids.includes(t._id) : names.includes(t.name)));
                    });

                    showToast('Actualizado', 'Se sincronizó la lista de layouts de servicio');
                  } catch (error) {
                    console.error(error);
                    showToast('Error', error.message || 'No se pudo actualizar la lista', true);
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
                  setLayoutEditando(null);
                  setFormLayout({
                    name: '',
                    rows: '',
                    columns: '',
                    pisos: '1',
                    capacidad: '',
                    tipo_Asiento_piso_1: '',
                    tipo_Asiento_piso_2: '',
                    rows_piso_1: '',
                    columns_piso_1: '',
                    rows_piso_2: '',
                    columns_piso_2: ''
                  });
                  setSeatMap({ floor1: { seatMap: [] }, floor2: { seatMap: [] } }); // <-- añadir
                  setModalEditarVisible(true);
                }}
              >
                <i className="bi bi-plus-lg me-2"></i> Nuevo Layout
              </button>
            </div>
          </div>

          {cargando ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">Cargando layouts de servicio...</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-hover align-middle">
                <thead className="table-light">
                  <tr>                    
                    <th>Nombre</th>                   
                    <th>Pisos</th>
                    <th>Capacidad</th>
                    <th>Tipo asiento piso 1</th>
                    <th>Tipo asiento piso 2</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {layouts.map((layout) => (
                    <tr key={layout._id || layout.name}>                     
                      <td>{layout.name}</td>                     
                      <td>{layout.pisos}</td>
                      <td>{layout.capacidad}</td>
                      <td>{layout.tipo_Asiento_piso_1}</td>
                      <td>{layout.tipo_Asiento_piso_2}</td>
                      <td>
                        <button className="btn btn-sm btn-warning me-2" onClick={() => handleEditar(layout)}>
                          <i className="bi bi-pencil-square"></i>
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleEliminar(layout._id)}>
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* MODAL MEJORADO */}
      <ModalBase
        visible={modalEditarVisible}
        title={layoutEditando ? 'Editar Layout' : 'Nuevo Layout'}
        onClose={() => {
          setModalEditarVisible(false);
          setLayoutEditando(null);
          setCurrentStep(1);
          setModoCreacion(true);
          setFormLayout({
            name: '',
            pisos: '1',
            capacidad: '',
            tipo_Asiento_piso_1: '',
            tipo_Asiento_piso_2: '',
            rows_piso_1: '',
            columns_piso_1: '',
            rows_piso_2: '',
            columns_piso_2: ''
          });
          setSeatMap({
            floor1: { seatMap: [] },
            floor2: { seatMap: [] }
          });
        }}
        size="lg"
        footer={
          <div className="d-flex justify-content-between w-100">
            {currentStep > 1 ? (
              <button 
                className="btn btn-secondary"
                onClick={() => setCurrentStep(currentStep - 1)}
              >
                <i className="bi bi-arrow-left me-2"></i> Anterior
              </button>
            ) : (
              <div></div>
            )}
            
            {currentStep < 2 ? (
              <button 
                className="btn btn-primary"
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={
                  !formLayout.name ||
                  !formLayout.pisos ||
                  !formLayout.rows_piso_1 ||
                  !formLayout.columns_piso_1 ||
                  (formLayout.pisos === '2' && (!formLayout.rows_piso_2 || !formLayout.columns_piso_2))
                }
              >
                Siguiente <i className="bi bi-arrow-right ms-2"></i>
              </button>
            ) : (
              <button 
                className="btn btn-success"
                onClick={handleGuardar}
                disabled={!formLayout.tipo_Asiento_piso_1 || (!formLayout.tipo_Asiento_piso_2 && formLayout.pisos === '2')}
              >
                <i className="bi bi-check-circle me-2"></i> Guardar Layout
              </button>
            )}
          </div>
        }
      >
        <div className="mb-2">
          <Stepper currentStep={currentStep} total={2} />
        </div>

        {renderStepContent()}
      </ModalBase>
    </div>
  );
};

export default Layout;