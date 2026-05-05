import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Grid, TextField, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material'
import { Add, Delete, Edit, FilterList } from '@mui/icons-material'
import { motion } from 'framer-motion'
import axios from '../../api'

const DESIGNATIONS = ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'HOD', 'Dean', 'Visiting Faculty']

export default function CollegeTeachers() {
  const [teachers, setTeachers] = useState([])
  const [filterDesignation, setFilterDesignation] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [dialog, setDialog] = useState(false)
  const [editDialog, setEditDialog] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', designation: '', subjects: '' })
  const [editForm, setEditForm] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = () => {
    const params = new URLSearchParams()
    if (filterDesignation) params.append('designation', filterDesignation)
    if (filterSubject) params.append('subject', filterSubject)
    axios.get(`/api/college/teachers?${params}`)
      .then(r => setTeachers(r.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load teachers'))
  }
  useEffect(() => { load() }, [filterDesignation, filterSubject])

  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 2000); return () => clearTimeout(t) } }, [success])
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 3000); return () => clearTimeout(t) } }, [error])

  const handleAdd = async () => {
    setError('')
    try {
      await axios.post('/api/college/teachers', form)
      setDialog(false); setForm({ name: '', email: '', password: '', designation: '', subjects: '' })
      setSuccess('Teacher registered!'); load()
    } catch (e) { setError(e.response?.data?.error || 'Failed') }
  }

  const handleUpdate = async () => {
    try {
      await axios.put(`/api/college/teachers/${editForm.id}`, editForm)
      setEditDialog(false); setSuccess('Updated!'); load()
    } catch (e) { setError(e.response?.data?.error || 'Failed') }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this teacher?')) return
    try {
      await axios.delete(`/api/college/teachers/${id}`)
      setSuccess('Teacher deleted!'); load()
    } catch (e) { setError(e.response?.data?.error || 'Failed to delete') }
  }

  const designations = [...new Set([...DESIGNATIONS, ...teachers.map(t => t.designation).filter(Boolean)])]

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Teachers & HODs</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialog(true)}>Register Teacher</Button>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField fullWidth size="small" select label="Filter by Designation"
                value={filterDesignation} onChange={e => setFilterDesignation(e.target.value)}
                SelectProps={{ native: true }}>
                <option value="">All Designations</option>
                {designations.map(d => <option key={d} value={d}>{d}</option>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField fullWidth size="small" label="Filter by Subject"
                placeholder="e.g. Mathematics"
                value={filterSubject} onChange={e => setFilterSubject(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 2 }}>
              <Chip icon={<FilterList />} label={`${teachers.length} found`} color="primary" variant="outlined" />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Designation</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Subjects</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {teachers.map((t, i) => (
                <TableRow key={t.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>{t.name}</TableCell>
                  <TableCell>{t.email}</TableCell>
                  <TableCell>{t.designation ? <Chip label={t.designation} size="small" color="primary" variant="outlined" /> : '-'}</TableCell>
                  <TableCell>
                    {t.subjects
                      ? t.subjects.split(',').map((s, idx) => <Chip key={idx} label={s.trim()} size="small" sx={{ mr: 0.5, mb: 0.5 }} />)
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => { setEditForm(t); setEditDialog(true) }}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(t.id)}><Delete fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {teachers.length === 0 && (
                <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>No teachers found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>

      {/* Add Dialog */}
      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Register New Teacher</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Full Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Designation</InputLabel>
                <Select value={form.designation} label="Designation"
                  onChange={e => setForm({ ...form, designation: e.target.value })}>
                  <MenuItem value="">-- Select --</MenuItem>
                  {DESIGNATIONS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Subjects (comma separated)" placeholder="e.g. Math, Physics"
                value={form.subjects} onChange={e => setForm({ ...form, subjects: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd}>Register</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Teacher</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Name" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Email" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="New Password (leave blank to keep)" type="password" value={editForm.password || ''} onChange={e => setEditForm({ ...editForm, password: e.target.value })} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Designation</InputLabel>
                <Select value={editForm.designation || ''} label="Designation"
                  onChange={e => setEditForm({ ...editForm, designation: e.target.value })}>
                  <MenuItem value="">-- Select --</MenuItem>
                  {DESIGNATIONS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Subjects (comma separated)"
                value={editForm.subjects || ''} onChange={e => setEditForm({ ...editForm, subjects: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdate}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
