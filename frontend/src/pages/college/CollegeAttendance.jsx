import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Grid, TextField, Button, FormControl,
  InputLabel, Select, MenuItem, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Alert
} from '@mui/material'
import { Download, Search } from '@mui/icons-material'
import { motion } from 'framer-motion'
import axios from '../../api'

export default function CollegeAttendance() {
  const [batches, setBatches] = useState([])
  const [allBranches, setAllBranches] = useState([])
  const [allClasses, setAllClasses] = useState([])
  const [sections, setSections] = useState([])
  const [records, setRecords] = useState([])
  const [error, setError] = useState('')

  const [filters, setFilters] = useState({
    date_from: new Date().toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    batch_id: '', branch_id: '', class_id: '', section_id: ''
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    axios.get('/api/college/batches').then(r => setBatches(r.data))
    axios.get('/api/college/branches').then(r => setAllBranches(r.data))
    axios.get('/api/college/classes').then(r => setAllClasses(r.data))
  }, [])

  // Dynamically scoped lists
  const branches = filters.batch_id
    ? allBranches.filter(b => b.batch_id == filters.batch_id)
    : allBranches
  const classes = allClasses.filter(c => {
    if (filters.batch_id && c.batch_id != filters.batch_id) return false
    if (filters.branch_id && c.branch_id != filters.branch_id) return false
    return true
  })

  const handleBatchChange = (val) => {
    setFilters({ ...filters, batch_id: val, branch_id: '', class_id: '', section_id: '' })
    setSections([])
  }
  const handleBranchChange = (val) => {
    setFilters({ ...filters, branch_id: val, class_id: '', section_id: '' })
    setSections([])
  }
  const handleClassChange = async (val) => {
    setFilters({ ...filters, class_id: val, section_id: '' })
    if (val) {
      const r = await axios.get(`/api/college/sections?class_id=${val}`)
      setSections(r.data)
    } else {
      setSections([])
    }
  }

  const handleSearch = async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v) })
      const r = await axios.get(`/api/college/attendance?${params}`)
      setRecords(r.data)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load records')
    }
    setLoading(false)
  }

  const handleDownload = async () => {
    setError('')
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v) })
      const r = await axios.get(`/api/college/attendance/download?${params}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([r.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance_${filters.date_from}_to_${filters.date_to}.xlsx`
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setError('Failed to download. ' + (e.response?.statusText || ''))
    }
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Attendance Records</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
              <TextField fullWidth size="small" type="date" label="From" InputLabelProps={{ shrink: true }}
                value={filters.date_from} onChange={e => setFilters({ ...filters, date_from: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
              <TextField fullWidth size="small" type="date" label="To" InputLabelProps={{ shrink: true }}
                value={filters.date_to} onChange={e => setFilters({ ...filters, date_to: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 1.7 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Batch</InputLabel>
                <Select value={filters.batch_id} label="Batch" onChange={e => handleBatchChange(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  {batches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 1.7 }}>
              <FormControl fullWidth size="small" disabled={!filters.batch_id}>
                <InputLabel>Branch</InputLabel>
                <Select value={filters.branch_id} label="Branch" onChange={e => handleBranchChange(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  {branches.map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 1.7 }}>
              <FormControl fullWidth size="small" disabled={!filters.branch_id}>
                <InputLabel>Class</InputLabel>
                <Select value={filters.class_id} label="Class" onChange={e => handleClassChange(e.target.value)}>
                  <MenuItem value="">All</MenuItem>
                  {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 1.7 }}>
              <FormControl fullWidth size="small" disabled={!filters.class_id}>
                <InputLabel>Section</InputLabel>
                <Select value={filters.section_id} label="Section" onChange={e => setFilters({ ...filters, section_id: e.target.value })}>
                  <MenuItem value="">All</MenuItem>
                  {sections.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 12, md: 2.2 }} sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" startIcon={<Search />} onClick={handleSearch} disabled={loading}>Search</Button>
              <Button variant="outlined" startIcon={<Download />} onClick={handleDownload} color="success">Excel</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Results</Typography>
              <Chip label={`${records.length} records`} size="small" color="primary" variant="outlined" />
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Roll No</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Class</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Section</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Period</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.map((r, i) => (
                    <TableRow key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{r.name}</TableCell>
                      <TableCell>{r.roll_no || '-'}</TableCell>
                      <TableCell>{r.class_name || '-'}</TableCell>
                      <TableCell>{r.section_name || '-'}</TableCell>
                      <TableCell>{r.period || '-'}</TableCell>
                      <TableCell>{r.time || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {records.length === 0 && (
                    <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>
                      Click "Search" to load attendance records.
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  )
}
