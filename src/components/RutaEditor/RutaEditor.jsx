// @components/RutaEditor/RutaEditor.jsx
import React from 'react';
import { ReactSortable } from 'react-sortablejs';
import './RutaEditor.css';

const RutaEditor = ({ formRuta, setFormRuta, ciudades }) => {
  const stops = Array.isArray(formRuta?.stops) ? formRuta.stops : [];
  const safeCiudades = Array.isArray(ciudades) ? ciudades : [];

  const handleInputChange = (campo, valor) => {
    setFormRuta((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleStopsChange = (nuevasStops) => {
    // Mantener la estructura correcta: { city: nombre, order: número }
    const normalizadas = (nuevasStops || [])
      .filter((s) => s && typeof s === 'object')
      .map((s, i) => ({ 
        city: s.city ?? '', 
        order: i + 1 
      }));
    setFormRuta((prev) => ({ ...prev, stops: normalizadas }));
  };

  const handleAgregarStop = () => {
    const nuevasStops = [...stops, { city: '', order: stops.length + 1 }];
    handleStopsChange(nuevasStops);
  };

  const handleDeleteStop = (index) => {
    const nuevasStops = stops.filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, order: i + 1 }));
    handleStopsChange(nuevasStops);
  };

  const actualizarOrden = (nuevoOrden) => {
    // Reconstruir el array manteniendo los objetos completos
    const nuevasStops = nuevoOrden.map((item, index) => {
      // Si item es un string (ciudad), convertirlo a objeto
      if (typeof item === 'string') {
        return { city: item, order: index + 1 };
      }
      // Si ya es objeto, mantenerlo y actualizar order
      return { ...item, order: index + 1 };
    });
    handleStopsChange(nuevasStops);
  };

  return (
    <>
      <div className="mb-3">
        <label className="form-label">Nombre de la ruta</label>
        <input
          className="form-control"
          value={formRuta?.name ?? ''}
          onChange={(e) => handleInputChange('name', e.target.value)}
        />
      </div>

      <div className="mb-3">
        <label className="form-label">Origen</label>
        <select
          className="form-select"
          value={formRuta?.origin ?? ''}
          onChange={(e) => handleInputChange('origin', e.target.value)}
        >
          <option value="">Selecciona ciudad</option>
          {safeCiudades.map((c) => (
            <option key={c._id || c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="form-label">Destino</label>
        <select
          className="form-select"
          value={formRuta?.destination ?? ''}
          onChange={(e) => handleInputChange('destination', e.target.value)}
        >
          <option value="">Selecciona ciudad</option>
          {safeCiudades.map((c) => (
            <option key={c._id || c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="form-label">Paradas intermedias</label>
        <ReactSortable
          tag="div"
          className="d-flex flex-column gap-2"
          list={stops}
          setList={actualizarOrden}
          handle=".drag-handle"
        >
          {stops.map((stop, index) => (
            <div key={`${index}-${stop?.city ?? ''}`} className="d-flex gap-2 align-items-center bg-light border rounded p-2">
              <span className="drag-handle d-flex flex-column justify-content-center me-2 cursor-grab">
                <i className="bi bi-grip-vertical"></i>
              </span>

              <select
                className="form-select form-select-sm flex-grow-1"
                value={stop?.city ?? ''}
                onChange={(e) => {
                  const nuevasStops = [...stops];
                  nuevasStops[index] = { ...stop, city: e.target.value };
                  handleStopsChange(nuevasStops);
                }}
              >
                <option value="">Selecciona ciudad</option>
                {safeCiudades.map((c) => (
                  <option key={c._id || c.name} value={c.name}>{c.name}</option>
                ))}
              </select>

              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => handleDeleteStop(index)}
              >
                <i className="bi bi-trash"></i>
              </button>
            </div>
          ))}
        </ReactSortable>

        <button
          type="button"
          className="btn btn-outline-primary btn-sm mt-2"
          onClick={handleAgregarStop}
        >
          <i className="bi bi-plus"></i> Agregar parada
        </button>
      </div>
    </>
  );
};

export default RutaEditor;