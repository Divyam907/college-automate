import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Grid, FormControl, InputLabel,
  Select, MenuItem, Button, Chip, Alert, Paper, CircularProgress, List,
  ListItem, ListItemIcon, ListItemText, Divider
} from '@mui/material'
import {
  CameraAlt, CheckCircle, AccessTime, Block, Videocam,
  FiberManualRecord, Person
} from '@mui/icons-material'
import { getBatches, getBranches, getClasses, getSections, getPeriods, markAttendance } from '../../api'

export default function TeacherAttendance() {
  const [batches, setBatches] = useState([])
  const [branches, setBranches] = useState([])
  const [classes, setClasses] = useState([])
  const [sections, setSections] = useState([])
  const [periods, setPeriods] = useState([])

  const [selectedBatch, setSelectedBatch] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [allMarked, setAllMarked] = useState([])
  const [error, setError] = useState('')
  const [detectedFaces, setDetectedFaces] = useState([]) // faces with boxes to draw
  const [imgDims, setImgDims] = useState({ w: 1280, h: 720 }) // backend processed image dimensions
  const [forceEnabled, setForceEnabled] = useState(false) // override time window

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const periodCheckRef = useRef(null)
  const processingRef = useRef(false) // prevent overlapping requests

  useEffect(() => {
    getBatches().then(r => setBatches(r.data)).catch(() => {})
    return () => {
      stopCamera()
    }
  }, [])

  const handleBatchChange = async (val) => {
    setSelectedBatch(val)
    setSelectedBranch(''); setSelectedClass(''); setSelectedSection('')
    setPeriods([]); setSelectedPeriod(null); stopCamera()
    if (val) { const r = await getBranches(val); setBranches(r.data) }
  }

  const handleBranchChange = async (val) => {
    setSelectedBranch(val)
    setSelectedClass(''); setSelectedSection('')
    setPeriods([]); setSelectedPeriod(null); stopCamera()
    if (val) { const r = await getClasses(val, selectedBatch); setClasses(r.data) }
  }

  const handleClassChange = async (val) => {
    setSelectedClass(val)
    setSelectedSection('')
    setPeriods([]); setSelectedPeriod(null); stopCamera()
    if (val) { const r = await getSections(val); setSections(r.data) }
  }

  const handleSectionChange = async (val) => {
    setSelectedSection(val)
    setPeriods([]); setSelectedPeriod(null)
    setResult(null); setAllMarked([]); setDetectedFaces([])
    if (val) {
      const r = await getPeriods(val)
      setPeriods(r.data)
      const active = r.data.find(p => p.can_mark)
      if (active) {
        setSelectedPeriod(active)
        startCamera()
      }
    }
  }

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 }
      })
      streamRef.current = stream
      setCameraActive(true)
    } catch (e) {
      setError('Camera access denied: ' + e.message)
    }
  }, [])

  // Attach stream to video element once it renders
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraActive])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (periodCheckRef.current) { clearInterval(periodCheckRef.current); periodCheckRef.current = null }
  }, [])

  const captureFrame = () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.8)
  }

  const captureAndMark = async () => {
    if (processingRef.current) return // skip if still processing previous
    if (!selectedSection || (!selectedPeriod?.can_mark && !forceEnabled)) return
    const photo = captureFrame()
    if (!photo) return

    processingRef.current = true
    setProcessing(true)

    try {
      const res = await markAttendance(photo, selectedSection, selectedPeriod.id, forceEnabled)
      const data = res.data
      setResult(data)

      // Update face boxes for canvas drawing
      if (data.faces) {
        setDetectedFaces(data.faces)
      }
      if (data.image_width && data.image_height) {
        setImgDims({ w: data.image_width, h: data.image_height })
      }

      // Track all marked students
      if (data.students_present?.length) {
        setAllMarked(prev => {
          const existing = new Set(prev.map(s => s.id))
          const newOnes = data.students_present.filter(s => !existing.has(s.id))
          return [...prev, ...newOnes]
        })
      }
      setError('')
    } catch (e) {
      const msg = e.response?.data?.error || ''
      if (msg && !msg.includes('not available now')) setError(msg)
    }
    processingRef.current = false
    setProcessing(false)
  }

  // Auto-start continuous capture when camera active + period selected
  useEffect(() => {
    if (cameraActive && (selectedPeriod?.can_mark || forceEnabled)) {
      const startDelay = setTimeout(() => {
        captureAndMark() // immediate first
        intervalRef.current = setInterval(captureAndMark, 3000)
      }, 1500)
      return () => {
        clearTimeout(startDelay)
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      }
    }
  }, [cameraActive, selectedPeriod, forceEnabled])

  // Auto-stop when period ends (skip if force enabled)
  useEffect(() => {
    if (selectedPeriod && cameraActive && !forceEnabled) {
      periodCheckRef.current = setInterval(() => {
        const now = new Date()
        const [h, m] = selectedPeriod.to_time.split(':').map(Number)
        const endTime = new Date()
        endTime.setHours(h, m + 10, 0)
        if (now > endTime) {
          stopCamera()
          setError('Period ended. Camera stopped.')
        }
      }, 10000)
      return () => { if (periodCheckRef.current) clearInterval(periodCheckRef.current) }
    }
  }, [selectedPeriod, cameraActive])

  // Draw face boxes on canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    canvas.width = video.clientWidth
    canvas.height = video.clientHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (detectedFaces.length === 0) return

    // Scale from backend processed image dimensions to display size
    const scaleX = canvas.width / (imgDims.w || 1280)
    const scaleY = canvas.height / (imgDims.h || 720)

    detectedFaces.forEach(face => {
      const x = face.x * scaleX
      const y = face.y * scaleY
      const w = face.w * scaleX
      const h = face.h * scaleY

      // Color: green=recognized, orange=already marked, red=unknown
      let color = '#ef4444' // red
      let label = 'Unknown'
      if (face.recognized) {
        color = face.already_marked ? '#f59e0b' : '#10b981' // orange or green
        label = face.name + (face.already_marked ? ' ✓' : '')
      }

      // Draw box
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.strokeRect(x, y, w, h)

      // Draw label background
      ctx.font = 'bold 14px Arial'
      const textW = ctx.measureText(label).width + 10
      ctx.fillStyle = color
      ctx.fillRect(x, y - 24, textW, 22)

      // Draw label text
      ctx.fillStyle = '#fff'
      ctx.fillText(label, x + 5, y - 8)
    })
  }, [detectedFaces, imgDims])

  const hasNoPeriodNow = periods.length > 0 && !periods.find(p => p.can_mark)

  return (
    <Box>
      {/* Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CameraAlt color="primary" /> Select Class Details
          </Typography>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Batch</InputLabel>
                <Select value={selectedBatch} label="Batch" onChange={e => handleBatchChange(e.target.value)}>
                  {batches.map(b => <MenuItem key={b.id} value={b.id}>{b.name} ({b.year})</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth disabled={!selectedBatch}>
                <InputLabel>Branch</InputLabel>
                <Select value={selectedBranch} label="Branch" onChange={e => handleBranchChange(e.target.value)}>
                  {branches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth disabled={!selectedBranch}>
                <InputLabel>Class</InputLabel>
                <Select value={selectedClass} label="Class" onChange={e => handleClassChange(e.target.value)}>
                  {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth disabled={!selectedClass}>
                <InputLabel>Section</InputLabel>
                <Select value={selectedSection} label="Section" onChange={e => handleSectionChange(e.target.value)}>
                  {sections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Period Status */}
      {periods.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTime color="primary" /> Today's Periods
            </Typography>
            <Grid container spacing={2}>
              {periods.map(p => {
                const isSelected = selectedPeriod?.id === p.id
                const isForced = isSelected && forceEnabled && !p.can_mark
                const canClick = p.can_mark || isForced
                return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
                  <Paper
                    elevation={isSelected ? 4 : 0}
                    onClick={() => {
                      if (p.can_mark) { setSelectedPeriod(p); setForceEnabled(false); if (!cameraActive) startCamera() }
                      else if (isForced) { /* already selected + forced */ }
                    }}
                    sx={{
                      p: 2, cursor: canClick ? 'pointer' : 'default',
                      opacity: canClick ? 1 : 0.6,
                      border: '2px solid',
                      borderColor: isSelected ? 'primary.main' : p.can_mark ? 'success.main' : 'error.main',
                      bgcolor: isSelected ? 'action.selected' : 'transparent',
                      borderLeft: `5px solid ${isForced ? '#f59e0b' : p.can_mark ? '#10b981' : '#ef4444'}`,
                      transition: 'all 0.2s',
                      '&:hover': canClick ? { borderColor: 'primary.main', transform: 'translateY(-2px)' } : {},
                    }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{p.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{p.from_time} - {p.to_time}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                      <Chip size="small" icon={p.can_mark ? <CheckCircle /> : isForced ? <AccessTime /> : <Block />}
                        label={p.can_mark ? 'Active' : isForced ? 'Force Enabled' : p.window_message}
                        color={p.can_mark ? 'success' : isForced ? 'warning' : 'error'}
                        variant={p.can_mark || isForced ? 'filled' : 'outlined'} />
                      {!p.can_mark && !isForced && (
                        <Button
                          size="small" variant="outlined" color="warning"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedPeriod(p)
                            setForceEnabled(true)
                            if (!cameraActive) startCamera()
                          }}
                          sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.25, px: 1 }}
                        >
                          Enable Marking
                        </Button>
                      )}
                    </Box>
                  </Paper>
                </Grid>
                )
              })}
            </Grid>
            {hasNoPeriodNow && (
              <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                <strong>No active period.</strong> Attendance marking is not available now.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {selectedSection && periods.length === 0 && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>No periods scheduled today for this section.</Alert>
      )}

      {/* Camera Feed with Canvas Overlay for face boxes */}
      {cameraActive && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FiberManualRecord sx={{ color: '#ef4444', fontSize: 14, animation: 'pulse 1.5s infinite' }} />
                <Videocam color="error" /> Live Camera — Auto Detecting
                {processing && <Chip label="SCANNING..." color="warning" size="small" sx={{ ml: 1 }} />}
              </Typography>
              <Button variant="outlined" color="error" onClick={stopCamera} size="small">Stop & Close</Button>
            </Box>

            <Box sx={{ position: 'relative', borderRadius: 3, overflow: 'hidden', boxShadow: 3, mb: 2, maxWidth: 800, mx: 'auto' }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', borderRadius: 12 }} />
              <canvas
                ref={canvasRef}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: 12 }}
              />
            </Box>

            <Typography variant="caption" color="text.secondary" display="block" sx={{ textAlign: 'center' }}>
              🟢 Green box = Recognized & Marked &nbsp; 🟠 Orange = Already Marked &nbsp; 🔴 Red = Unknown face
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Result Stats */}
      {result && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 4 }}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'action.hover' }}>
                  <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>{result.total_faces_detected}</Typography>
                  <Typography variant="caption" color="text.secondary">Faces Detected</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#f0fdf4' }}>
                  <Typography variant="h4" color="success.main" sx={{ fontWeight: 700 }}>{result.total_matched}</Typography>
                  <Typography variant="caption" color="text.secondary">Matched</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#eff6ff' }}>
                  <Typography variant="h4" color="info.main" sx={{ fontWeight: 700 }}>{allMarked.length}</Typography>
                  <Typography variant="caption" color="text.secondary">Total Marked</Typography>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Marked Students List */}
      {allMarked.length > 0 && (
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Person color="success" /> Students Marked Present ({allMarked.length})
            </Typography>
            <Divider sx={{ mb: 1 }} />
            <List dense>
              {allMarked.map((s, i) => (
                <ListItem key={s.id}>
                  <ListItemIcon><CheckCircle color="success" /></ListItemIcon>
                  <ListItemText primary={`${i + 1}. ${s.name}`} secondary={s.email || ''} />
                  <Chip label="Present" size="small" color="success" variant="outlined" />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </Box>
  )
}
