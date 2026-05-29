import React, { useState, useEffect, useRef } from 'react'
import html2canvas from 'html2canvas'

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
  const [showShareModal, setShowShareModal] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const modalRef = useRef(null)
  const exportRef = useRef(null)

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

  // Encontrar el filamento más similar a un color dado (para colores que no existen en el catálogo)
  const findBestMatchForColor = (colorHex) => {
    if (!filaments.length) return null
    
    let bestMatch = null
    let highestSimilarity = -1
    
    for (const filament of filaments) {
      const similarity = calculateSimilarity(colorHex, filament.hex)
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity
        bestMatch = { ...filament, similarity }
      }
    }
    return bestMatch
  }

  // Encontrar los filamentos más similares EXCLUYENDO un filamento específico
  const findTopSimilarFilaments = (colorHex, excludeFilamentHex = null, limit = 3) => {
    if (!filaments.length) return []
    
    const withSimilarity = filaments
      .filter(filament => !excludeFilamentHex || filament.hex !== excludeFilamentHex)
      .map(filament => ({
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
        // Encontrar el mejor match para este color (puede que no exista exactamente)
        const bestMatch = findBestMatchForColor(hex)
        
        setSelectedColors([...selectedColors, hex])
        
        // Obtener sugerencias excluyendo el mejor match si existe
        const suggestions = findTopSimilarFilaments(hex, bestMatch?.hex, 3)
        
        setSelectedColorObjects([...selectedColorObjects, { 
          color: hex, 
          selected: bestMatch,  // Guardar el mejor match (puede ser null)
          suggestions: suggestions 
        }])
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
        const suggestions = findTopSimilarFilaments(filament.hex, filament.hex, 3)
        setSelectedColorObjects([...selectedColorObjects, { 
          color: filament.hex, 
          selected: filament,  // El filamento seleccionado existe en el catálogo
          suggestions: suggestions 
        }])
      }
    }
  }

  // Manejar selección desde el catálogo completo
  const handleFilamentSelect = (filament) => {
    if (selectedColorObjects.some(obj => obj.selected?.hex === filament.hex)) {
      const index = selectedColorObjects.findIndex(obj => obj.selected?.hex === filament.hex)
      if (index !== -1) {
        const colorToRemove = selectedColors[index]
        removeColor(colorToRemove)
      }
    } else {
      if (selectedColors.length < 6) {
        setSelectedColors([...selectedColors, filament.hex])
        const suggestions = findTopSimilarFilaments(filament.hex, filament.hex, 3)
        setSelectedColorObjects([...selectedColorObjects, { 
          color: filament.hex, 
          selected: filament,
          suggestions: suggestions 
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

  // Función para determinar contraste de color
  const getContrastColor = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const brightness = (r * 0.299 + g * 0.587 + b * 0.114)
    return brightness > 128 ? '#111827' : '#ffffff'
  }

  // Función para fondo suave
  const getSoftBackground = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, 0.12)`
  }

  // Exportar imagen del modal
  const exportAsImage = async () => {
    if (!exportRef.current) return
    
    setIsExporting(true)
    try {
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        windowWidth: exportRef.current.scrollWidth,
        windowHeight: exportRef.current.scrollHeight
      })
      const link = document.createElement('a')
      const date = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      link.download = `pritonic-colors-${date}.png`
      link.href = canvas.toDataURL()
      link.click()
    } catch (error) {
      console.error('Error exporting image:', error)
    } finally {
      setIsExporting(false)
    }
  }

  // Copiar imagen al portapapeles
  const copyImageToClipboard = async () => {
    if (!exportRef.current) return
    
    setIsExporting(true)
    try {
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        windowWidth: exportRef.current.scrollWidth,
        windowHeight: exportRef.current.scrollHeight
      })
      
      canvas.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob
            })
          ])
          alert('✅ Imagen copiada al portapapeles')
        } catch (err) {
          console.error('Error copying:', err)
          alert('❌ No se pudo copiar la imagen')
        }
      })
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsExporting(false)
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
    return selectedColorObjects.some(obj => obj.selected?.hex === filament.hex)
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

  const responsiveStyles = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    @media (max-width: 1200px) {
      .main-layout { flex-direction: column; }
      .filters-panel { width: 100% !important; position: relative !important; top: 0 !important; margin-bottom: 32px; }
      .selected-panel { width: 100% !important; position: relative !important; top: 0 !important; margin-bottom: 32px; max-height: none !important; }
      .comparison-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .header-container { flex-direction: column; gap: 16px; align-items: stretch !important; }
    }
    @media (max-width: 768px) {
      .hero-title { font-size: 28px !important; }
      .catalog-grid { grid-template-columns: 1fr !important; }
      .palette-grid { grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)) !important; }
      .comparison-grid { grid-template-columns: 1fr !important; }
    }
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: modalFadeIn 0.2s ease-out;
    }
    .selected-panel-scroll {
      max-height: calc(100vh - 120px);
      overflow-y: auto;
    }
  `

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '16px 32px', 
        borderBottom: '1px solid #f0f0f0', 
        backgroundColor: '#ffffff', 
        position: 'sticky', 
        top: 0, 
        zIndex: 100,
        flexWrap: 'wrap',
        gap: '16px'
      }} className="header-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', borderRadius: '8px' }}></div>
          <span style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>Pritonic Colors</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
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

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '48px 24px', background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)' }}>
        <h2 style={{ fontSize: '36px', fontWeight: '600', marginBottom: '16px', color: '#111827' }} className="hero-title">
          Encuentra tu <span style={{ color: '#3b82f6' }}>color ideal</span>
        </h2>
        <p style={{ color: '#6b7280', maxWidth: '500px', margin: '0 auto 24px', fontSize: '15px', lineHeight: '1.5' }}>
          Sube una foto o explora nuestra paleta de colores PLA
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <label style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '8px 20px',
            borderRadius: '40px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s',
            border: 'none'
          }}>
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
        <div style={{ display: 'flex', gap: '48px', alignItems: 'flex-start' }} className="main-layout">
          
          {/* Panel Izquierdo - Filtros */}
          <div style={{ width: '240px', flexShrink: 0, position: 'sticky', top: '80px' }} className="filters-panel">
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
                  <button key={t} onClick={() => toggleTone(t)} style={{
                    padding: '6px 14px',
                    borderRadius: '40px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: activeTone.includes(t) ? '#3b82f6' : '#f3f4f6',
                    color: activeTone.includes(t) ? 'white' : '#374151',
                    border: 'none'
                  }}>
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

          {/* Panel Central */}
          <div style={{ flex: 1 }}>
            {/* Explorador de paleta */}
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
                      }} className="palette-grid">
                        {colors.map((f, i) => (
                          <div key={i} style={{ textAlign: 'center' }}>
                            <div 
                              onClick={() => handleColorClick(f)} 
                              style={{
                                width: '100%',
                                paddingBottom: '100%',
                                backgroundColor: f.hex,
                                borderRadius: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: selectedColors.includes(f.hex) ? '0 0 0 3px #3b82f6, 0 0 0 6px rgba(59,130,246,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                                position: 'relative'
                              }}
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
              </div>
            )}

            {/* SECCIÓN DE COMPARACIÓN */}
            {selectedColors.length > 0 && (
              <div style={{ marginBottom: '48px' }}>
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                    🎨 Comparando {selectedColors.length} {selectedColors.length === 1 ? 'color' : 'colores'}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#6b7280' }}>
                    Alternativas reales para cada selección
                  </p>
                </div>
                
                <div className="comparison-grid" style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
                  gap: '24px' 
                }}>
                  {selectedColorObjects.map((item, idx) => {
                    // Usar el mejor match guardado (selected) o suggestions[0] como fallback
                    const primaryFilament = item.selected || item.suggestions[0]
                    const recommendations = item.suggestions || []
                    
                    if (!primaryFilament) return null
                    
                    return (
                      <div key={idx} style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '20px',
                        border: '1px solid #f0f0f0',
                        overflow: 'hidden',
                        transition: 'all 0.2s ease'
                      }}>
                        {/* Cabecera con el color seleccionado */}
                        <div style={{
                          padding: '16px',
                          backgroundColor: getSoftBackground(primaryFilament.hex),
                          borderBottom: '1px solid #f0f0f0'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '12px',
                              backgroundColor: primaryFilament.hex,
                              overflow: 'hidden'
                            }}>
                              {primaryFilament.image1 && (
                                <img src={primaryFilament.image1} alt={primaryFilament.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              )}
                            </div>
                            <div>
                              <h4 style={{ fontSize: '15px', fontWeight: '600', color: '#111827', marginBottom: '2px' }}>{primaryFilament.name}</h4>
                              <p style={{ fontSize: '12px', color: '#6b7280' }}>{primaryFilament.brand} • {primaryFilament.tone}</p>
                              <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>HEX original: {item.color}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Recomendaciones */}
                        <div style={{ padding: '16px' }}>
                          <p style={{ fontSize: '11px', fontWeight: '600', color: '#9ca3af', marginBottom: '12px', letterSpacing: '0.3px' }}>
                            🎯 {recommendations.length} alternativas encontradas
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {recommendations.map((filament, fIdx) => (
                              <div 
                                key={fIdx} 
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  padding: '10px',
                                  backgroundColor: '#f9fafb',
                                  borderRadius: '12px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onClick={() => handleFilamentSelect(filament)}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                              >
                                <div style={{
                                  width: '48px',
                                  height: '48px',
                                  borderRadius: '10px',
                                  backgroundColor: filament.hex,
                                  overflow: 'hidden',
                                  flexShrink: 0
                                }}>
                                  {filament.image1 ? (
                                    <img src={filament.image1} alt={filament.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <div style={{ width: '100%', height: '100%', backgroundColor: filament.hex }}></div>
                                  )}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: '13px', fontWeight: '500', color: '#111827', marginBottom: '2px' }}>{filament.name}</p>
                                  <p style={{ fontSize: '11px', color: '#6b7280' }}>{filament.brand} • {Math.round(filament.similarity * 100)}% match</p>
                                </div>
                              </div>
                            ))}
                            {recommendations.length === 0 && (
                              <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', padding: '20px' }}>
                                No hay alternativas disponibles
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Catálogo Completo */}
            {!showAllColors && (
              <>
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                    {selectedColors.length > 0 ? 'Más coincidencias' : 'Catálogo completo'}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#6b7280' }}>
                    {selectedColors.length > 0 ? `${filteredFilaments.length} resultados` : `Haz click en cualquier tarjeta para seleccionarlo (${selectedColors.length}/6)`}
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }} className="catalog-grid">
                  {filteredFilaments.map((f, i) => {
                    const isSelected = isFilamentSelected(f)
                    const contrastColor = getContrastColor(f.hex)
                    const softBg = getSoftBackground(f.hex)
                    
                    return (
                      <div key={i} style={{ 
                        backgroundColor: softBg,
                        borderRadius: '16px', 
                        overflow: 'hidden', 
                        border: isSelected ? '2px solid #3b82f6' : '1px solid rgba(0,0,0,0.05)',
                        transition: 'all 0.2s ease',
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
                        {isSelected && (
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
                              <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '4px', color: contrastColor }}>{f.name}</h4>
                              <p style={{ fontSize: '12px', color: contrastColor === '#ffffff' ? 'rgba(255,255,255,0.7)' : '#6b7280', marginBottom: '8px' }}>{f.brand} • {f.tone}</p>
                            </div>
                            {selectedColors.length > 0 && f.similarity !== undefined && (
                              <div style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: contrastColor === '#ffffff' ? 'rgba(255,255,255,0.7)' : '#6b7280', marginBottom: '4px' }}>
                                  <span>Coincidencia</span>
                                  <span style={{ fontWeight: '600', color: '#3b82f6' }}>{Math.round(f.similarity * 100)}%</span>
                                </div>
                                <div style={{ height: '3px', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
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
                    )
                  })}
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

          {/* Panel Derecho - Sidebar Compacto */}
          <div style={{ width: '280px', flexShrink: 0, position: 'sticky', top: '80px' }} className="selected-panel">
            {selectedColors.length > 0 && (
              <div style={{ 
                backgroundColor: 'white', 
                borderRadius: '16px', 
                border: '1px solid #f0f0f0',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '16px 20px',
                  borderBottom: '1px solid #f0f0f0'
                }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280', margin: 0 }}>
                    SELECCIONADOS ({selectedColors.length}/6)
                  </h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => setShowShareModal(true)}
                      style={{ 
                        backgroundColor: '#3b82f6', 
                        color: 'white', 
                        padding: '6px 12px', 
                        borderRadius: '20px', 
                        fontSize: '11px', 
                        fontWeight: '500',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                    >
                      Compartir
                    </button>
                    <button 
                      onClick={resetSelectedColors} 
                      style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
                
                <div className="selected-panel-scroll">
                  {selectedColorObjects.map((item, idx) => {
                    // Usar el mejor match guardado
                    const primaryFilament = item.selected || item.suggestions[0]
                    if (!primaryFilament) return null
                    
                    return (
                      <div 
                        key={idx} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px, ',
                          padding: '12px 16px',
                          borderBottom: '1px solid #f0f0f0',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '10px', 
                          backgroundColor: primaryFilament.hex,
                          overflow: 'hidden',
                          flexShrink: 0
                        }}>
                          {primaryFilament.image1 && (
                            <img src={primaryFilament.image1} alt={primaryFilament.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '13px', fontWeight: '500', color: '#111827', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {primaryFilament.name}
                          </p>
                          <p style={{ fontSize: '10px', color: '#6b7280' }}>{Math.round(primaryFilament.similarity * 100)}% match</p>
                        </div>
                        <button 
                          onClick={() => removeColor(item.color)} 
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: '#9ca3af', 
                            cursor: 'pointer', 
                            fontSize: '16px',
                            padding: '4px',
                            borderRadius: '20px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = '#fee2e2' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.backgroundColor = 'transparent' }}
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>
                
                {selectedColors.length === 6 && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
                    <p style={{ fontSize: '11px', color: '#f59e0b', textAlign: 'center', margin: 0 }}>⚠️ Máximo 6 colores</p>
                  </div>
                )}
              </div>
            )}
            
            {selectedColors.length === 0 && (
              <div style={{ 
                backgroundColor: '#f9fafb', 
                borderRadius: '16px', 
                padding: '32px 20px', 
                textAlign: 'center', 
                border: '1px solid #f0f0f0' 
              }}>
                <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>✨ Selecciona un color<br/>para comenzar</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #f0f0f0', marginTop: '60px', padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', color: '#9ca3af' }}>Color matcher by <strong style={{ color: '#3b82f6' }}>giucancode</strong></p>
      </footer>

      {/* Modal para Compartir / Exportar */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div 
            ref={modalRef}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              maxWidth: '1200px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div ref={exportRef} style={{ padding: '32px', backgroundColor: '#ffffff' }}>
              {/* Cabecera con logo y fecha */}
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  borderRadius: '16px',
                  margin: '0 auto 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '28px' }}>🎨</span>
                </div>
                <h3 style={{ fontSize: '28px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>Pritonic Color Match</h3>
                <p style={{ fontSize: '13px', color: '#6b7280' }}>
                  {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              
              {/* Imagen de referencia */}
              {imageUrl && (
                <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', marginBottom: '12px', letterSpacing: '0.5px' }}>IMAGEN DE REFERENCIA</p>
                  <div style={{
                    maxWidth: '400px',
                    margin: '0 auto',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    border: '1px solid #f0f0f0'
                  }}>
                    <img src={imageUrl} alt="Referencia" style={{ width: '100%', height: 'auto', display: 'block' }} />
                  </div>
                </div>
              )}
              
              {/* Grid de colores seleccionados */}
              <div>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#9ca3af', marginBottom: '16px', textAlign: 'center', letterSpacing: '0.5px' }}>
                  COLORES SELECCIONADOS ({selectedColors.length}/6)
                </p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '16px'
                }}>
                  {selectedColorObjects.map((item, idx) => {
                    const primaryFilament = item.selected || item.suggestions[0]
                    if (!primaryFilament) return null
                    
                    return (
                      <div key={idx} style={{
                        backgroundColor: '#f9fafb',
                        borderRadius: '16px',
                        padding: '16px',
                        border: '1px solid #f0f0f0',
                        transition: 'transform 0.2s'
                      }}>
                        <div style={{
                          width: '100%',
                          height: '100px',
                          borderRadius: '12px',
                          backgroundColor: primaryFilament.hex,
                          overflow: 'hidden',
                          marginBottom: '12px'
                        }}>
                          {primaryFilament.image1 && (
                            <img src={primaryFilament.image1} alt={primaryFilament.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )}
                        </div>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '4px', textAlign: 'center' }}>
                          {primaryFilament.name.length > 25 ? primaryFilament.name.slice(0, 22) + '...' : primaryFilament.name}
                        </h4>
                        <p style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', marginBottom: '8px' }}>
                          {primaryFilament.brand} • {primaryFilament.tone}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            backgroundColor: primaryFilament.hex,
                            border: '1px solid #e5e7eb'
                          }}></div>
                          <p style={{ fontSize: '11px', fontFamily: 'monospace', color: '#9ca3af' }}>{primaryFilament.hex}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              
              {/* Footer del modal */}
              <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
                <p style={{ fontSize: '11px', color: '#9ca3af' }}>Generado con Pritonic Colors - Encuentra tu color ideal</p>
              </div>
            </div>
            
            {/* Botones de acción */}
            <div style={{ display: 'flex', gap: '12px', padding: '20px 32px 32px 32px', borderTop: '1px solid #f0f0f0' }}>
              <button 
                onClick={exportAsImage}
                disabled={isExporting}
                style={{
                  flex: 1,
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  padding: '12px',
                  borderRadius: '40px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: isExporting ? 'default' : 'pointer',
                  opacity: isExporting ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { if (!isExporting) e.currentTarget.style.backgroundColor = '#2563eb' }}
                onMouseLeave={(e) => { if (!isExporting) e.currentTarget.style.backgroundColor = '#3b82f6' }}
              >
                {isExporting ? 'Generando...' : '📸 Descargar PNG'}
              </button>
              <button 
                onClick={copyImageToClipboard}
                disabled={isExporting}
                style={{
                  flex: 1,
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  padding: '12px',
                  borderRadius: '40px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: isExporting ? 'default' : 'pointer',
                  opacity: isExporting ? 0.6 : 1,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { if (!isExporting) e.currentTarget.style.backgroundColor = '#e5e7eb' }}
                onMouseLeave={(e) => { if (!isExporting) e.currentTarget.style.backgroundColor = '#f3f4f6' }}
              >
                📋 Copiar imagen
              </button>
              <button 
                onClick={() => setShowShareModal(false)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  color: '#9ca3af',
                  borderRadius: '40px',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{responsiveStyles}</style>
    </div>
  )
}

export default App