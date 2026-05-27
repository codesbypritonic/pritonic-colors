import React, { useState, useEffect } from 'react'

function App() {
  const [filaments, setFilaments] = useState([])
  const [filteredFilaments, setFilteredFilaments] = useState([])
  const [selectedColors, setSelectedColors] = useState([])
  const [selectedColorObjects, setSelectedColorObjects] = useState([])
  const [activeBrand, setActiveBrand] = useState('')
  const [activeTone, setActiveTone] = useState([])
  const [imageUrl, setImageUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAllColors, setShowAllColors] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Cargar datos
  useEffect(() => {
      fetch(`${import.meta.env.BASE_URL}filaments.json`)
      .then(response => response.json())
      .then(data => {
        setFilaments(data)
        setFilteredFilaments(data)
        setIsLoading(false)
      })
      .catch(error => {
        console.error('Error:', error)
        setIsLoading(false)
      })
  }, [])

  // Calcular similitud entre dos colores
  const calculateSimilarity = (color1, color2) => {
    const hexToRgb = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return [r, g, b]
    }
    
    const rgb1 = hexToRgb(color1)
    const rgb2 = hexToRgb(color2)
    
    const distance = Math.sqrt(
      Math.pow(rgb1[0] - rgb2[0], 2) +
      Math.pow(rgb1[1] - rgb2[1], 2) +
      Math.pow(rgb1[2] - rgb2[2], 2)
    )
    
    const maxDistance = 441.67
    return 1 - (distance / maxDistance)
  }

  // Encontrar los 3 filamentos más similares a un color dado
  const findTopSimilarFilaments = (colorHex, limit = 3) => {
    if (!filaments.length) return []
    
    const withSimilarity = filaments.map(filament => ({
      ...filament,
      similarity: calculateSimilarity(colorHex, filament.hex)
    }))
    
    return withSimilarity.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
  }

  // Calcular similitud promedio para múltiples colores
  const calculateAverageSimilarity = (color, selectedColors) => {
    if (selectedColors.length === 0) return 0
    const total = selectedColors.reduce((sum, c) => sum + calculateSimilarity(color, c), 0)
    return total / selectedColors.length
  }

  // Aplicar filtros
  useEffect(() => {
    let results = [...filaments]
    
    if (activeBrand) {
      results = results.filter(f => f.brand === activeBrand)
    }
    if (activeTone.length > 0) {
      results = results.filter(f => activeTone.includes(f.tone))
    }
    if (searchTerm) {
      results = results.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
    }
    
    if (selectedColors.length > 0 && !showAllColors) {
      results = results.map(f => ({
        ...f,
        similarity: calculateAverageSimilarity(f.hex, selectedColors)
      })).sort((a, b) => b.similarity - a.similarity)
    }
    
    setFilteredFilaments(results)
  }, [filaments, activeBrand, activeTone, selectedColors, showAllColors, searchTerm])

  // Subir imagen y obtener color
  const handleImageUpload = (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => setImageUrl(e.target.result)
    reader.readAsDataURL(file)
  }

  const getColorFromImage = (event) => {
    if (!imageUrl) return
    
    const img = new Image()
    img.src = imageUrl
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      
      const rect = event.target.getBoundingClientRect()
      const x = event.nativeEvent.offsetX
      const y = event.nativeEvent.offsetY
      const scaleX = img.width / rect.width
      const scaleY = img.height / rect.height
      
      const pixel = ctx.getImageData(x * scaleX, y * scaleY, 1, 1).data
      const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('')
      
      if (selectedColors.length < 4 && !selectedColors.includes(hex)) {
        setSelectedColors([...selectedColors, hex])
        
        const topFilaments = findTopSimilarFilaments(hex, 3)
        setSelectedColorObjects([...selectedColorObjects, { color: hex, suggestions: topFilaments }])
      }
    }
  }

  // Eliminar un color seleccionado
  const removeColor = (colorToRemove) => {
    const index = selectedColors.findIndex(c => c === colorToRemove)
    setSelectedColors(selectedColors.filter(c => c !== colorToRemove))
    setSelectedColorObjects(selectedColorObjects.filter((_, idx) => idx !== index))
  }

  // Resetear todos los colores seleccionados
  const resetSelectedColors = () => {
    setSelectedColors([])
    setSelectedColorObjects([])
  }

  // Manejar click en un color desde la vista compacta
  const handleColorClick = (filament) => {
    if (selectedColors.includes(filament.hex)) {
      removeColor(filament.hex)
    } else {
      if (selectedColors.length < 4) {
        setSelectedColors([...selectedColors, filament.hex])
        setSelectedColorObjects([...selectedColorObjects, { 
          color: filament.hex, 
          suggestions: [{ ...filament, similarity: 1 }] 
        }])
      }
    }
  }

  // Alternar selección de tono
  const toggleTone = (tone) => {
    if (activeTone.includes(tone)) {
      setActiveTone(activeTone.filter(t => t !== tone))
    } else {
      setActiveTone([...activeTone, tone])
    }
  }

  const brands = ['BambuLab', 'Pritonic', 'Creality', 'Elegoo', 'Polymaker', 'Sunlu']
  const tones = ['Mate', 'Brillante', 'Silk']

  const resetFilters = () => {
    setActiveBrand('')
    setActiveTone([])
    resetSelectedColors()
    setImageUrl(null)
    setSearchTerm('')
    setShowAllColors(true)
  }

const sortedByHex = [...filaments].sort((a, b) =>
  parseInt(a.hex.slice(1), 16) - parseInt(b.hex.slice(1), 16)
)
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6b7280' }}>Cargando colores...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #f3f4f6 100%)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #2563eb, #4f46e5)', borderRadius: '10px' }}></div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Pritonic Colors</h1>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>PLA Filament Color Matcher</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="Buscar filamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid #e5e7eb', fontSize: '13px', width: '180px' }}
            />
            <span style={{ padding: '4px 12px', background: '#f3f4f6', borderRadius: '20px', fontSize: '13px' }}>{filteredFilaments.length} filamentos</span>
            <button onClick={resetFilters} style={{ fontSize: '13px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>Resetear todo</button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '40px 24px', background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '12px' }}>Encuentra tu color de filamento <span style={{ color: '#2563eb' }}>ideal</span></h2>
        <p style={{ color: '#6b7280', maxWidth: '600px', margin: '0 auto 24px' }}>Sube una imagen o explora todos los colores para encontrar el color de PLA que necesitas</p>
        <p style={{ color: '#6b7280', maxWidth: '600px', margin: '0 auto 24px' }}> Nota: aquí están la mayoría de los colores PLA que manejamos, sin embargo esta app no está conectada a nuestro inventario, por favor revisa nuestra página para verificar disponibilidad</p>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <label style={{ background: '#1f2937', color: 'white', padding: '12px 28px', borderRadius: '40px', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}>
            📸 Subir imagen
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
          </label>
          <button 
            onClick={() => { setShowAllColors(!showAllColors); }}
            style={{ background: showAllColors ? '#2563eb' : 'white', color: showAllColors ? 'white' : '#1f2937', padding: '12px 28px', borderRadius: '40px', border: '1px solid #e5e7eb', cursor: 'pointer', fontWeight: '500', fontSize: '14px' }}
          >
            🎨 {showAllColors ? 'Ocultar colores' : 'Ver todos los colores'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '32px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px' }}>
          {/* Sidebar */}
          <div style={{ flex: '1', minWidth: '260px', maxWidth: '320px' }}>
            {imageUrl && (
              <div style={{ background: 'white', borderRadius: '20px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div onClick={getColorFromImage} style={{ cursor: 'crosshair' }}>
                  <img src={imageUrl} alt="Preview" style={{ width: '100%', borderRadius: '12px' }} />
                  <p style={{ fontSize: '11px', textAlign: 'center', marginTop: '8px', color: '#6b7280' }}>✚ Haz click en la imagen para seleccionar un color</p>
                </div>
              </div>
            )}

            {selectedColors.length > 0 && (
              <div style={{ background: 'white', borderRadius: '20px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontWeight: 'bold', fontSize: '14px', margin: 0 }}>
                    🎨 Colores seleccionados ({selectedColors.length}/4)
                  </h3>
                  <button 
                    onClick={resetSelectedColors}
                    style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    ✕ Limpiar todos
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {selectedColors.map((color, idx) => {
                    const suggestions = selectedColorObjects[idx]?.suggestions || []
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f3f4f6', padding: '6px 12px', borderRadius: '30px' }}>
                        <div style={{ width: '24px', height: '24px', backgroundColor: color, borderRadius: '6px', border: '1px solid #ddd' }}></div>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{color}</span>
                        <span style={{ fontSize: '10px', color: '#2563eb' }}>→ {suggestions[0]?.name || '...'}</span>
                        <button onClick={() => removeColor(color)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#999' }}>✕</button>
                      </div>
                    )
                  })}
                </div>
                {selectedColors.length === 4 && <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '8px' }}>⚠️ Máximo 4 colores seleccionados</p>}
              </div>
            )}

            <div style={{ background: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontWeight: 'bold', marginBottom: '16px' }}>🔧 Filtros</h3>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Marca</label>
                <select value={activeBrand} onChange={(e) => setActiveBrand(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                  <option value="">Todas las marcas</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Acabado (puedes seleccionar varios)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {tones.map(t => (
                    <button key={t} onClick={() => toggleTone(t)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: activeTone.includes(t) ? '#2563eb' : '#f3f4f6', color: activeTone.includes(t) ? 'white' : '#374151' }}>
                      {t} {activeTone.includes(t) && '✓'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div style={{ flex: '3' }}>
            {showAllColors && (
              <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
                  🎨 Todos los colores ({filaments.length}) 
                  <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#6b7280', marginLeft: '8px' }}>ordenados por HEX</span>
                </h2>
                <p style={{ fontSize: '12px', color: '#2563eb', marginBottom: '12px' }}>
                  ✨ Haz click en cualquier color para seleccionarlo (máximo 4). Click nuevamente para deseleccionar.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  {sortedByHex.map((f, i) => (
                    <div key={i} onClick={() => handleColorClick(f)} style={{ cursor: 'pointer', transition: 'all 0.2s', transform: 'scale(1)' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                      <div style={{ width: '100%', paddingBottom: '100%', backgroundColor: f.hex, borderRadius: '12px', boxShadow: selectedColors.includes(f.hex) ? '0 0 0 3px #2563eb, 0 2px 6px rgba(0,0,0,0.1)' : '0 2px 6px rgba(0,0,0,0.1)', border: '2px solid white', position: 'relative' }}>
                        {selectedColors.includes(f.hex) && (
                          <div style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#2563eb', color: 'white', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            ✓
                          </div>
                        )}
                        <div style={{ position: 'absolute', bottom: '6px', left: '4px', right: '4px', fontSize: '8px', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {f.name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sugerencias agrupadas por color - CON 2 IMÁGENES */}
                {selectedColorObjects.length > 0 && (
                  <div style={{ marginTop: '32px' }}>
                    {selectedColorObjects.map((item, idx) => (
                      <div key={idx} style={{ 
                        marginBottom: '40px',
                        background: 'white',
                        borderRadius: '24px',
                        padding: '20px',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                        border: '1px solid #f0f0f0'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px', 
                          marginBottom: '20px',
                          paddingBottom: '12px',
                          borderBottom: '2px solid #f0f0f0'
                        }}>
                          <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            backgroundColor: item.color, 
                            borderRadius: '10px', 
                            border: '2px solid #e5e7eb',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}></div>
                          <div>
                            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
                              Color seleccionado {idx + 1}
                            </h3>
                            <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0 0' }}>
                              {item.color} — {item.suggestions.length} filamentos sugeridos
                            </p>
                          </div>
                        </div>

                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                          gap: '20px'
                        }}>
                          {item.suggestions.map((filament, fIdx) => (
                            <div key={fIdx} style={{ 
                              backgroundColor: '#fafafa', 
                              borderRadius: '16px', 
                              overflow: 'hidden', 
                              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                              transition: 'transform 0.3s, box-shadow 0.3s',
                              position: 'relative',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)'
                              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)'
                              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'
                            }}>
                              {/* Estado normal - muestra image1 */}
                              <div className="card-normal" style={{ display: 'flex', padding: '16px', gap: '14px', transition: 'opacity 0.3s' }}>
                                {filament.image1 && (
                                  <img 
                                    src={filament.image1} 
                                    alt={filament.name} 
                                    style={{ 
                                      width: '70px', 
                                      height: '70px', 
                                      objectFit: 'cover', 
                                      borderRadius: '12px',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }} 
                                  />
                                )}
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div>
                                      <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold' }}>{filament.name}</h4>
                                      <p style={{ fontSize: '11px', color: '#666', margin: 0 }}>{filament.brand} • {filament.tone}</p>
                                    </div>
                                    <div style={{ 
                                      width: '32px', 
                                      height: '32px', 
                                      backgroundColor: filament.hex, 
                                      borderRadius: '8px', 
                                      border: '1px solid #ddd',
                                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                                    }}></div>
                                  </div>
                                  <div style={{ margin: '10px 0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                      <span style={{ fontSize: '10px', color: '#666' }}>Coincidencia</span>
                                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb' }}>{Math.round((filament.similarity || 0) * 100)}%</span>
                                    </div>
                                    <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                                      <div style={{ 
                                        width: `${(filament.similarity || 0) * 100}%`, 
                                        height: '100%', 
                                        background: 'linear-gradient(90deg, #2563eb, #4f46e5)',
                                        borderRadius: '2px'
                                      }}></div>
                                    </div>
                                  </div>
                                  <a 
                                    href={filament.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ 
                                      display: 'block', 
                                      textAlign: 'center', 
                                      backgroundColor: '#1f2937', 
                                      color: 'white', 
                                      padding: '8px 12px', 
                                      borderRadius: '10px', 
                                      textDecoration: 'none', 
                                      fontSize: '12px', 
                                      fontWeight: '500',
                                      transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
                                  >
                                    Ver producto →
                                  </a>
                                </div>
                              </div>

                              {/* Estado hover - muestra image2 ocupando toda la tarjeta */}
                              {filament.image2 && (
                                <div className="card-hover" style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  backgroundColor: 'white',
                                  borderRadius: '16px',
                                  overflow: 'hidden',
                                  opacity: 0,
                                  transition: 'opacity 0.3s ease',
                                  zIndex: 10,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}>
                                  <img 
                                    src={filament.image2} 
                                    alt={filament.name}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                      position: 'absolute',
                                      top: 0,
                                      left: 0
                                    }}
                                  />
                                  <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                                    padding: '12px',
                                    textAlign: 'center'
                                  }}>
                                    <span style={{
                                      color: 'white',
                                      fontSize: '11px',
                                      fontWeight: '500',
                                      textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                                    }}>
                                      {filament.name} • Vista detalle
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Grid de resultados por similitud - CON 2 IMÁGENES */}
            {!showAllColors && (
              <>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>
                  {selectedColors.length > 0 ? '🎯 Resultados similares' : '📦 Todos los filamentos'}
                  <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#6b7280', marginLeft: '12px' }}>{filteredFilaments.length} encontrados</span>
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                  {filteredFilaments.map((f, i) => (
                    <div key={i} style={{ 
                      backgroundColor: 'white', 
                      borderRadius: '16px', 
                      overflow: 'hidden', 
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      transition: 'transform 0.3s, box-shadow 0.3s',
                      position: 'relative',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)'
                      e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.12)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
                    }}>
                      {/* Estado normal - muestra image1 */}
                      <div className="card-normal" style={{ display: 'flex', padding: '20px', gap: '16px', transition: 'opacity 0.3s' }}>
                        {f.image1 && (
                          <img 
                            src={f.image1} 
                            alt={f.name} 
                            style={{ 
                              width: '80px', 
                              height: '80px', 
                              objectFit: 'cover', 
                              borderRadius: '12px', 
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }} 
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                            <div>
                              <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>{f.name}</h4>
                              <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>{f.brand} • {f.tone}</p>
                            </div>
                            <div style={{ width: '40px', height: '40px', backgroundColor: f.hex, borderRadius: '10px', border: '1px solid #ddd' }}></div>
                          </div>
                          {selectedColors.length > 0 && f.similarity !== undefined && (
                            <div style={{ margin: '12px 0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '11px', color: '#666' }}>Similitud promedio</span>
                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#2563eb' }}>{Math.round(f.similarity * 100)}%</span>
                              </div>
                              <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${f.similarity * 100}%`, height: '100%', background: 'linear-gradient(90deg, #2563eb, #4f46e5)' }}></div>
                              </div>
                            </div>
                          )}
                          <p style={{ fontSize: '11px', fontFamily: 'monospace', margin: '8px 0', color: '#666' }}>HEX: {f.hex}</p>
                          <a 
                            href={f.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                              display: 'inline-block', 
                              textAlign: 'center', 
                              backgroundColor: '#1f2937', 
                              color: 'white', 
                              padding: '8px 16px', 
                              borderRadius: '10px', 
                              textDecoration: 'none', 
                              fontSize: '12px', 
                              fontWeight: '500',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
                          >
                            Ver producto →
                          </a>
                        </div>
                      </div>

                      {/* Estado hover - muestra image2 ocupando toda la tarjeta */}
                      {f.image2 && (
                        <div className="card-hover" style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: 'white',
                          borderRadius: '16px',
                          overflow: 'hidden',
                          opacity: 0,
                          transition: 'opacity 0.3s ease',
                          zIndex: 10,
                          display: 'flex',
                          flexDirection: 'column',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}>
                          <img 
                            src={f.image2} 
                            alt={f.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              position: 'absolute',
                              top: 0,
                              left: 0
                            }}
                          />
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                            padding: '12px',
                            textAlign: 'center'
                          }}>
                            <span style={{
                              color: 'white',
                              fontSize: '12px',
                              fontWeight: '500',
                              textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                            }}>
                              {f.name} • Ver detalle
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {filteredFilaments.length === 0 && !showAllColors && (
              <div style={{ textAlign: 'center', padding: '60px', background: 'white', borderRadius: '20px' }}>
                <p style={{ color: '#9ca3af' }}>No se encontraron filamentos con estos filtros</p>
                <button onClick={resetFilters} style={{ marginTop: '16px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>Limpiar filtros</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #e5e7eb',
        marginTop: '48px',
        padding: '24px',
        textAlign: 'center',
        background: 'white'
      }}>
        <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
          Color matcher by <strong style={{ color: '#6366f1' }}>giucancode</strong>
        </p>
      </footer>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default App