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
      
      if (selectedColors.length < 6 && !selectedColors.includes(hex)) {
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

  // Manejar click en un color desde el grid
  const handleColorClick = (filament) => {
    if (selectedColors.includes(filament.hex)) {
      removeColor(filament.hex)
    } else {
      if (selectedColors.length < 6) {
        setSelectedColors([...selectedColors, filament.hex])
        setSelectedColorObjects([...selectedColorObjects, { 
          color: filament.hex, 
          suggestions: [{ ...filament, similarity: 1 }] 
        }])
      }
    }
  }

  // Manejar selección desde el catálogo completo (tarjetas)
  const handleFilamentSelect = (filament) => {
    if (selectedColorObjects.some(obj => obj.suggestions[0]?.hex === filament.hex)) {
      // Ya está seleccionado, lo quitamos
      const index = selectedColorObjects.findIndex(obj => obj.suggestions[0]?.hex === filament.hex)
      if (index !== -1) {
        const colorToRemove = selectedColors[index]
        removeColor(colorToRemove)
      }
    } else {
      if (selectedColors.length < 6) {
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

  // Filtrar los colores para el grid
  const filteredColors = filaments.filter(f => {
    if (activeBrand && f.brand !== activeBrand) return false
    if (activeTone.length > 0 && !activeTone.includes(f.tone)) return false
    if (searchTerm && !f.name.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

  // Agrupación por familias de color
  const getColorFamily = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    
    if (r > 200 && g > 200 && b > 200) return 'Blancos'
    if (r < 50 && g < 50 && b < 50) return 'Negros'
    if (r > g && r > b && r - g > 50) return 'Rojos'
    if (g > r && g > b && g - r > 30) return 'Verdes'
    if (b > r && b > g && b - r > 30) return 'Azules'
    if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && r > 100) return 'Grises/Neutros'
    if (r > 200 && g > 150 && b < 100) return 'Tierra/Naranjas'
    if (r > 200 && g > 100 && b > 200) return 'Rosas/Morados'
    return 'Otros'
  }

  const groupedColors = filteredColors.reduce((acc, filament) => {
    const family = getColorFamily(filament.hex)
    if (!acc[family]) acc[family] = []
    acc[family].push(filament)
    return acc
  }, {})

  const familyOrder = ['Blancos', 'Negros', 'Rojos', 'Verdes', 'Azules', 'Grises/Neutros', 'Tierra/Naranjas', 'Rosas/Morados', 'Otros']

  // Verificar si un filamento está seleccionado
  const isFilamentSelected = (filament) => {
    return selectedColorObjects.some(obj => obj.suggestions[0]?.hex === filament.hex)
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '2px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Cargando colores...</p>
        </div>
      </div>
    )
  }

  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 32px',
    borderBottom: '1px solid #f0f0f0',
    backgroundColor: '#ffffff',
    position: 'sticky',
    top: 0,
    zIndex: 100
  }

  const uploadButtonStyles = {
    backgroundColor: '#3b82f6',
    color: 'white',
    padding: '8px 20px',
    borderRadius: '40px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: 'none'
  }

  const filterPillStyles = (isActive) => ({
    padding: '6px 14px',
    borderRadius: '40px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: isActive ? '#3b82f6' : '#f3f4f6',
    color: isActive ? 'white' : '#374151',
    border: 'none'
  })

  const colorSwatchStyles = (hex, isSelected) => ({
    width: '100%',
    paddingBottom: '100%',
    backgroundColor: hex,
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: isSelected ? '0 0 0 3px #3b82f6, 0 0 0 6px rgba(59,130,246,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
    position: 'relative'
  })

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* Header Compacto */}
      <div style={headerStyles}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', borderRadius: '8px' }}></div>
          <span style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>Pritonic Colors</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <input 
            type="text" 
            placeholder="Buscar color..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '8px 16px', borderRadius: '40px', border: '1px solid #e5e7eb', fontSize: '14px', width: '200px', outline: 'none', transition: 'all 0.2s' }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
          />
          <span style={{ fontSize: '13px', color: '#6b7280' }}>{filteredColors.length} colores</span>
          <button onClick={resetFilters} style={{ fontSize: '13px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>Resetear</button>
        </div>
      </div>

      {/* Hero Simplificado */}
      <div style={{ textAlign: 'center', padding: '48px 24px', background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)' }}>
        <h2 style={{ fontSize: '36px', fontWeight: '600', marginBottom: '16px', color: '#111827' }}>
          Encuentra tu <span style={{ color: '#3b82f6' }}>color ideal</span>
        </h2>
        <p style={{ color: '#6b7280', maxWidth: '500px', margin: '0 auto 24px', fontSize: '15px', lineHeight: '1.5' }}>
          Sube una foto o explora nuestra paleta de colores PLA
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <label style={uploadButtonStyles}>
            📸 Subir imagen
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
          </label>
          <button 
            onClick={() => setShowAllColors(!showAllColors)}
            style={{ padding: '8px 20px', borderRadius: '40px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', backgroundColor: '#f3f4f6', color: '#374151', border: 'none' }}
          >
            {showAllColors ? 'Ocultar explorador' : 'Explorar colores'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '40px 48px' }}>
        <div style={{ display: 'flex', gap: '48px', alignItems: 'flex-start' }}>
          
          {/* Panel Izquierdo - Filtros */}
          <div style={{ width: '220px', flexShrink: 0, position: 'sticky', top: '80px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280', marginBottom: '16px', letterSpacing: '0.5px' }}>FILTROS</h4>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '8px' }}>Marca</label>
              <select value={activeBrand} onChange={(e) => setActiveBrand(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', backgroundColor: 'white' }}>
                <option value="">Todas</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '8px' }}>Acabado</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {tones.map(t => (
                  <button key={t} onClick={() => toggleTone(t)} style={filterPillStyles(activeTone.includes(t))}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            
            {imageUrl && (
              <div style={{ marginTop: '32px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280', marginBottom: '12px', letterSpacing: '0.5px' }}>PREVIEW</h4>
                <div onClick={getColorFromImage} style={{ cursor: 'crosshair' }}>
                  <img src={imageUrl} alt="Preview" style={{ width: '100%', borderRadius: '12px', border: '1px solid #f0f0f0' }} />
                  <p style={{ fontSize: '11px', textAlign: 'center', marginTop: '8px', color: '#9ca3af' }}>Click para capturar color</p>
                </div>
              </div>
            )}
          </div>

          {/* Panel Central - Grid de Colores */}
          <div style={{ flex: 1 }}>
            {showAllColors && (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>Explorar paleta</h3>
                  <p style={{ fontSize: '13px', color: '#6b7280' }}>Selecciona hasta 6 colores para comparar</p>
                </div>
                
                {familyOrder.map(family => {
                  const colors = groupedColors[family]
                  if (!colors || colors.length === 0) return null
                  return (
                    <div key={family} style={{ marginBottom: '32px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280', marginBottom: '16px', letterSpacing: '0.3px' }}>{family}</h4>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
                        gap: '16px',
                        marginBottom: '24px'
                      }}>
                        {colors.map((f, i) => (
                          <div key={i} style={{ textAlign: 'center' }}>
                            <div 
                              onClick={() => handleColorClick(f)} 
                              style={colorSwatchStyles(f.hex, selectedColors.includes(f.hex))}
                              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                              {selectedColors.includes(f.hex) && (
                                <div style={{
                                  position: 'absolute',
                                  top: '-8px',
                                  right: '-8px',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  borderRadius: '50%',
                                  width: '20px',
                                  height: '20px',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}>✓</div>
                              )}
                            </div>
                            <p style={{ fontSize: '11px', marginTop: '8px', color: '#4b5563', fontWeight: '500' }}>{f.name.split(' ').slice(0, 2).join(' ')}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {filteredColors.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px', backgroundColor: '#f9fafb', borderRadius: '16px' }}>
                    <p style={{ color: '#9ca3af' }}>No hay colores con estos filtros</p>
                  </div>
                )}
              </div>
            )}

            {/* Catálogo Completo - Tarjetas seleccionables */}
            {!showAllColors && (
              <>
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                    {selectedColors.length > 0 ? 'Mejores coincidencias' : 'Catálogo completo'}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#6b7280' }}>
                    {selectedColors.length > 0 ? `${filteredFilaments.length} resultados` : `Haz click en cualquier tarjeta para seleccionarlo (${selectedColors.length}/6)`}
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                  {filteredFilaments.map((f, i) => (
                    <div key={i} style={{ 
                      backgroundColor: 'white', 
                      borderRadius: '16px', 
                      overflow: 'hidden', 
                      border: isFilamentSelected(f) ? '2px solid #3b82f6' : '1px solid #f0f0f0',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                    onClick={() => handleFilamentSelect(f)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)'
                      e.currentTarget.style.boxShadow = '0 12px 24px -12px rgba(0,0,0,0.15)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}>
                      {isFilamentSelected(f) && (
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 10,
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>✓</div>
                      )}
                      <div style={{ display: 'flex', gap: '16px', padding: '16px' }}>
                        <div style={{ position: 'relative', width: '80px', height: '80px', flexShrink: 0, borderRadius: '12px', overflow: 'hidden', backgroundColor: '#f9fafb' }}>
                          {f.image1 && <img src={f.image1} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          {f.image2 && (
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              backgroundColor: 'white',
                              opacity: 0,
                              transition: 'opacity 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}>
                              <img src={f.image2} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div>
                            <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px', color: '#111827' }}>{f.name}</h4>
                            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>{f.brand} • {f.tone}</p>
                          </div>
                          {selectedColors.length > 0 && f.similarity !== undefined && (
                            <div style={{ marginBottom: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                                <span>Coincidencia</span>
                                <span style={{ fontWeight: '600', color: '#3b82f6' }}>{Math.round(f.similarity * 100)}%</span>
                              </div>
                              <div style={{ height: '3px', backgroundColor: '#f0f0f0', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${f.similarity * 100}%`, height: '100%', backgroundColor: '#3b82f6' }}></div>
                              </div>
                            </div>
                          )}
                          <a href={f.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', fontSize: '12px', fontWeight: '500', color: '#3b82f6', textDecoration: 'none' }}>
                            Ver producto →
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {filteredFilaments.length === 0 && !showAllColors && (
              <div style={{ textAlign: 'center', padding: '60px', backgroundColor: '#f9fafb', borderRadius: '16px' }}>
                <p style={{ color: '#9ca3af' }}>No se encontraron filamentos con estos filtros</p>
                <button onClick={resetFilters} style={{ marginTop: '16px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Limpiar filtros</button>
              </div>
            )}
          </div>

          {/* Panel Derecho - Colores seleccionados (sticky, hasta 6) */}
          <div style={{ width: '300px', flexShrink: 0, position: 'sticky', top: '80px' }}>
            {selectedColors.length > 0 && (
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', border: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280', margin: 0 }}>SELECCIONADOS ({selectedColors.length}/6)</h4>
                  <button onClick={resetSelectedColors} style={{ fontSize: '12px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Limpiar todo</button>
                </div>
                {selectedColors.map((color, idx) => {
                  const suggestions = selectedColorObjects[idx]?.suggestions || []
                  const filament = suggestions[0]
                  if (!filament) return null
                  return (
                    <div key={idx} style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: idx === selectedColors.length - 1 ? 'none' : '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ 
                          width: '50px', 
                          height: '50px', 
                          backgroundColor: filament.hex, 
                          borderRadius: '10px',
                          border: '1px solid #f0f0f0',
                          flexShrink: 0
                        }}></div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '2px', color: '#111827' }}>{filament.name}</p>
                              <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>{filament.brand} • {filament.tone}</p>
                            </div>
                            <button onClick={() => removeColor(color)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                          </div>
                          <p style={{ fontSize: '11px', fontWeight: '600', color: '#3b82f6', marginBottom: '8px' }}>{Math.round(filament.similarity * 100)}% match</p>
                          <a 
                            href={filament.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                              display: 'inline-block', 
                              fontSize: '11px', 
                              fontWeight: '500', 
                              color: '#3b82f6', 
                              textDecoration: 'none' 
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Ver producto →
                          </a>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {selectedColors.length === 6 && <p style={{ fontSize: '11px', color: '#f59e0b', textAlign: 'center', marginTop: '12px' }}>Máximo 6 colores alcanzado</p>}
              </div>
            )}
            {selectedColors.length === 0 && (
              <div style={{ backgroundColor: '#f9fafb', borderRadius: '16px', padding: '32px 20px', textAlign: 'center', border: '1px solid #f0f0f0' }}>
                <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>✨ Selecciona un color<br/>desde la paleta o el catálogo</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #f0f0f0', marginTop: '60px', padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', color: '#9ca3af' }}>Color matcher by <strong style={{ color: '#3b82f6' }}>giucancode</strong></p>
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