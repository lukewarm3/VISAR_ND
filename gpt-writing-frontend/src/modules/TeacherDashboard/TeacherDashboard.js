import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Container, Typography, Paper, Grid, Table, 
  TableBody, TableCell, TableContainer, TableHead, Tooltip,
  TableRow, Card, CardContent, Box, Fade, FormControl, InputLabel, Select, MenuItem, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { createTheme, ThemeProvider } from '@mui/material/styles';
// Add these imports at the top
import { AppBar, Toolbar, IconButton, Menu } from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import EditIcon from '@mui/icons-material/Edit';
import AccountSettingsModal from '../../components/AccountSettingsModal';
import LogoutIcon from '@mui/icons-material/Logout';
import AddIcon from '@mui/icons-material/Add';

// Same Notre Dame colors...could probably just make this part of the global theme
const ndBlue = '#0C2340';
const ndGold = '#C99700';

const theme = createTheme({
  palette: {
    primary: {
      main: ndBlue,
    },
    secondary: {
      main: ndGold,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'white',
          border: `2px solid ${ndGold}`,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: 'white',
        },
      },
    },
  },
});

const COLORS = [ndGold, ndBlue, '#FF8042', '#00C49F'];

export default function TeacherDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const open = Boolean(anchorEl);
  const teacherId = location.state?.teacherId;
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [newClassName, setNewClassName] = useState('');
  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [classNumber, setClassNumber] = useState('');
  const [classNumberError, setClassNumberError] = useState('');
  const [deleteClassOpen, setDeleteClassOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [classToDelete, setClassToDelete] = useState(null);
  const [createClassError, setCreateClassError] = useState('');

  useEffect(() => {
    if (!location.state?.teacherId || location.state?.role !== 'teacher') {
      console.log('Invalid access, redirecting to login. State:', location.state);
      navigate('/');
      return;
    }
    
    const fetchDashboardData = async () => {
      try {
        const url = selectedClass 
          ? `http://127.0.0.1:5000/teacher/${location.state.teacherId}?class_id=${selectedClass}`
          : `http://127.0.0.1:5000/teacher/${location.state.teacherId}`;
          
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.status === 'success') {
          setDashboardData(data);
        } else {
          throw new Error(data.message || 'Failed to fetch dashboard data');
        }
      } catch (error) {
        console.error('Error:', error);
        setError(error.message);
      }
    };

    fetchDashboardData();
    // fetchClasses();
  }, [location.state, selectedClass]);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:5000/teacher/${teacherId}/classes`);
        const data = await response.json();
        if (data.status === 'success') {
          setClasses(data.classes);
          if (data.classes.length > 0) {
            setSelectedClass(data.classes[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching classes:', error);
      }
    };
    
    fetchClasses();
  }, [teacherId]);

  const validateClassNumber = (number) => {
    if (!number) {
      return "Class number is required";
    }
    if (!/^\d+$/.test(number)) {
      return "Class number must contain only digits";
    }
    if (number.length !== 5) {
      return "Class number must be exactly 5 digits";
    }
    return "";
  };

  const handleCreateClass = async () => {
    const error = validateClassNumber(classNumber);
    if (error) {
      setClassNumberError(error);
      return;
    }

    try {
      const response = await fetch('http://127.0.0.1:5000/teacher/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: teacherId,
          class_name: newClassName,
          class_number: classNumber
        })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setClasses([...classes, data.class]);
        setNewClassName('');
        setClassNumber('');
        setClassNumberError('');
        setCreateClassError('');
        setCreateClassOpen(false);
      } else {
        setCreateClassError(data.message || 'Failed to create class');
      }
    } catch (error) {
      console.error('Error creating class:', error);
      setCreateClassError('Failed to create class. Please try again.');
    }
  };

  const handleDeleteClass = (classId) => {
    setClassToDelete(classId);
    setDeleteClassOpen(true);
    setDeleteConfirmation('');
  };

  const confirmDeleteClass = async () => {
    const selectedClassData = classes.find(c => c.id === classToDelete);
    if (deleteConfirmation !== selectedClassData.class_number) {
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:5000/teacher/classes/${classToDelete}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.status === 'success') {
        setClasses(classes.filter(c => c.id !== classToDelete));
        setSelectedClass(null);
        setDeleteClassOpen(false);
        setDeleteConfirmation('');
        setClassToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting class:', error);
    }
  };

  const handleProfileUpdate = async () => {
    try {
      const url = selectedClass 
        ? `http://127.0.0.1:5000/teacher/${teacherId}?class_id=${selectedClass}`
        : `http://127.0.0.1:5000/teacher/${teacherId}`;
        
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'success') {
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Error updating dashboard:', error);
    }
  };

  if (error) {
    return <Typography color="error">Error: {error}</Typography>;
  }

  if (!dashboardData) {
    return <Typography>Loading...</Typography>;
  }

  const {
    teacher,
    students,
    aggregate_metrics
  } = dashboardData;

  const timeSpentData = students.map(student => ({
    name: student.username,
    timeSpent: Math.round(student.total_time / 60000), // Convert to minutes
    activeTime: Math.round(student.active_time / 60000),
    formattedTimeSpent: `${Math.round(student.total_time / 60000)} mins` // Formatted string
  }));

  const essayMetrics = students.map(student => ({
    name: student.username,
    essays: student.draft_count || 0,
    avgWords: Math.round(student.total_words / (student.draft_count || 1))
  }));

  const interactionData = students.map(student => ({
    name: student.username,
    interactions: student.gpt_interactions || 0
  }));

  const loginData = [
    { 
      name: 'Active Users', 
      value: students.filter(s => {
        const lastActive = new Date(s.last_active);
        const now = new Date();
        return (now - lastActive) < 24 * 60 * 60 * 1000; // Within last 24 hours
      }).length 
    },
    { 
      name: 'Inactive Users', 
      value: students.filter(s => {
        const lastActive = new Date(s.last_active);
        const now = new Date();
        return !s.last_active || (now - lastActive) >= 24 * 60 * 60 * 1000;
      }).length 
    }
  ];


  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    navigate('/');
  };

  const handleGoToEditor = () => {
    navigate('/editor', { 
      state: { 
        teacherId: teacherId,
        role: 'teacher'
      } 
    });
  };

  return (
    <ThemeProvider theme={theme}>
      {!dashboardData ? (
        <Fade in={!dashboardData} timeout={400}>
          <Box sx={{ 
            backgroundColor: ndBlue, 
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Typography variant="h4" color="white">
              Loading dashboard...
            </Typography>
          </Box>
        </Fade>
      ) : (
        <Fade in={!!dashboardData} timeout={800}>
          <Box sx={{ 
            backgroundColor: ndBlue, 
            minHeight: '100vh',
            pt: 8,
          }}>
            <AppBar position="fixed" sx={{ backgroundColor: ndBlue }}>
              <Toolbar>
                <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                  Teacher Dashboard
                </Typography>
                <Box sx={{ flexGrow: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Tooltip title="Switch to Editor">
                    <IconButton 
                      color="inherit" 
                      onClick={handleGoToEditor}
                      sx={{ 
                        '&:hover': {
                          backgroundColor: ndGold,
                          color: ndBlue
                        }
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Account Settings">
                    <IconButton
                      color="inherit"
                      onClick={() => setAccountSettingsOpen(true)}
                      sx={{ 
                        '&:hover': {
                          backgroundColor: ndGold,
                          color: ndBlue
                        }
                      }}
                    >
                      <AccountCircleIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Logout">
                    <IconButton
                      color="inherit"
                      onClick={handleLogout}
                      sx={{ 
                        '&:hover': {
                          backgroundColor: ndGold,
                          color: ndBlue
                        }
                      }}
                    >
                      <LogoutIcon />
                    </IconButton>
                  </Tooltip>
                  <AccountSettingsModal 
                    open={accountSettingsOpen}
                    onClose={() => setAccountSettingsOpen(false)}
                    userId={teacherId}
                    role="teacher"
                    username={dashboardData?.teacher?.username}
                    fullName={dashboardData?.teacher?.full_name}
                    onProfileUpdate={handleProfileUpdate}
                  />
                </Box>
              </Toolbar>
            </AppBar>
            <Container maxWidth="lg">
              <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
                <Box sx={{ 
                  mb: 4, 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: 2
                }}>
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center'
                  }}>
                    <Typography variant="h5" sx={{ color: ndBlue }}>
                      Welcome, {dashboardData.teacher.full_name?.split(' ')[0] || dashboardData.teacher.username}!
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {classes.length > 0 ? (
                        <FormControl sx={{ minWidth: 250 }}>
                          <Select
                            value={selectedClass || ''}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            displayEmpty
                            renderValue={(value) => {
                              if (!value) {
                                return <Typography sx={{ color: 'text.secondary' }}>Select Class</Typography>;
                              }
                              const selectedClassData = classes.find(c => c.id === value);
                              return `${selectedClassData.name} - #${selectedClassData.class_number}`;
                            }}
                          >
                            {classes.map((cls) => (
                              <MenuItem key={cls.id} value={cls.id}>
                                {cls.name} - #{cls.class_number}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                          No classes created yet
                        </Typography>
                      )}
                      <Button
                        variant="contained"
                        onClick={() => setCreateClassOpen(true)}
                        startIcon={<AddIcon />}
                        sx={{ bgcolor: ndBlue }}
                      >
                        Create Class
                      </Button>
                      {selectedClass && (
                        <Button
                          variant="outlined"
                          color="error"
                          onClick={() => handleDeleteClass(selectedClass)}
                        >
                          Delete Class
                        </Button>
                      )}
                    </Box>
                  </Box>

                  {selectedClass && (
                    <Typography variant="subtitle1" sx={{ color: ndBlue }}>
                      Showing statistics for class: {classes.find(c => c.id === selectedClass)?.name}
                    </Typography>
                  )}
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={3}>
                    <Card elevation={3}>
                      <CardContent>
                        <Typography color="primary" gutterBottom>
                          Total Students
                        </Typography>
                        <Typography variant="h5" color="primary">
                          {aggregate_metrics.total_students}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Card elevation={3}>
                      <CardContent>
                        <Typography color="primary" gutterBottom>
                          Total Essays
                        </Typography>
                        <Typography variant="h5" color="primary">
                          {aggregate_metrics.total_essays}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Card elevation={3}>
                      <CardContent>
                        <Typography color="primary" gutterBottom>
                          Avg Words/Essay
                        </Typography>
                        <Typography variant="h5" color="primary">
                          {Math.round(aggregate_metrics.avg_words_per_essay)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Card elevation={3}>
                      <CardContent>
                        <Typography color="primary" gutterBottom>
                          Total Interactions
                        </Typography>
                        <Typography variant="h5" color="primary">
                          {aggregate_metrics.total_interactions}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Time Spent Bar Chart */}
                  <Grid item xs={12} md={8}>
                    <Paper elevation={3} sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom sx={{ color: ndBlue }}>
                        Time Spent by Student
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={timeSpentData}>
                          <XAxis dataKey="name" />
                          <YAxis />
                          <RechartsTooltip />
                          <Legend />
                          <Bar dataKey="timeSpent" name="Time Spent" fill={ndGold} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>

                  {/* Essay Metrics Chart */}
                  <Grid item xs={12} md={6}>
                    <Paper elevation={3} sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom sx={{ color: ndBlue }}>
                        Essay Metrics by Student
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={essayMetrics}>
                          <XAxis dataKey="name" />
                          <YAxis yAxisId="left" orientation="left" stroke={ndBlue} />
                          <YAxis yAxisId="right" orientation="right" stroke={ndGold} />
                          <RechartsTooltip />
                          <Legend />
                          <Bar yAxisId="left" dataKey="essays" name="Essays" fill={ndBlue} />
                          <Bar yAxisId="right" dataKey="avgWords" name="Avg Words" fill={ndGold} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>

                  {/* Login Distribution Pie Chart */}
                  <Grid item xs={12} md={4}>
                    <Paper elevation={3} sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom sx={{ color: ndBlue }}>
                        Login Distribution
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={loginData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill={ndBlue}
                            dataKey="value"
                          >
                            {loginData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Grid>

                  {/* Student Table */}
                  <Grid item xs={12}>
                    <TableContainer component={Paper} elevation={3}>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ backgroundColor: ndGold }}>
                            <TableCell sx={{ color: ndBlue }}>Username</TableCell>
                            <TableCell sx={{ color: ndBlue }}>Full Name</TableCell>
                            <TableCell align="right" sx={{ color: ndBlue }}>Drafts</TableCell>
                            <TableCell align="right" sx={{ color: ndBlue }}>Avg Words</TableCell>
                            <TableCell align="right" sx={{ color: ndBlue }}>Time Spent (min)</TableCell>
                            <TableCell align="right" sx={{ color: ndBlue }}>GPT Interactions</TableCell>
                            <TableCell align="right" sx={{ color: ndBlue }}>Last Active</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {students.map((student) => (
                            <TableRow key={student.id}>
                              <TableCell component="th" scope="row">
                                {student.username}
                              </TableCell>
                              <TableCell>
                                {student.full_name || 'N/A'}
                              </TableCell>
                              <TableCell align="right">{student.draft_count || 0}</TableCell>
                              <TableCell align="right">
                                {Math.round(student.total_words / (student.draft_count || 1))}
                              </TableCell>
                              <TableCell align="right">{Math.round(student.total_time / 60000)}</TableCell>
                              <TableCell align="right">{student.gpt_interactions || 0}</TableCell>
                              <TableCell align="right">
                                {student.last_active ? 
                                  new Date(student.last_active).toLocaleString('en-US', {
                                    year: 'numeric',
                                    month: 'numeric',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                                  }) : 'N/A'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>
                </Grid>
              </Paper>
            </Container>
          </Box>
        </Fade>
      )}
      <Dialog open={createClassOpen} onClose={() => {
        setCreateClassOpen(false);
        setCreateClassError('');
        setNewClassName('');
        setClassNumber('');
        setClassNumberError('');
      }}>
        <DialogTitle>Create New Class</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Class Name"
            fullWidth
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Class Number (5 digits)"
            fullWidth
            value={classNumber}
            onChange={(e) => {
              const value = e.target.value;
              setClassNumber(value);
              setClassNumberError(validateClassNumber(value));
            }}
            error={!!classNumberError}
            helperText={classNumberError}
            inputProps={{ maxLength: 5 }}
          />
          {createClassError && (
            <Typography color="error" sx={{ mt: 2 }}>
              {createClassError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateClassOpen(false);
            setCreateClassError('');
            setNewClassName('');
            setClassNumber('');
            setClassNumberError('');
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateClass}
            disabled={!newClassName || !!classNumberError || !classNumber}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={deleteClassOpen} onClose={() => setDeleteClassOpen(false)}>
        <DialogTitle>Delete Class</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            This action cannot be undone. To confirm deletion, please enter the class number:
            <Typography component="span" fontWeight="bold">
              {' '}{classes.find(c => c.id === classToDelete)?.class_number}
            </Typography>
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Enter Class Number"
            fullWidth
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            error={deleteConfirmation !== '' && deleteConfirmation !== classes.find(c => c.id === classToDelete)?.class_number}
            helperText={deleteConfirmation !== '' && deleteConfirmation !== classes.find(c => c.id === classToDelete)?.class_number ? 
              "Class number doesn't match" : ""}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteClassOpen(false);
            setDeleteConfirmation('');
            setClassToDelete(null);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={confirmDeleteClass}
            disabled={deleteConfirmation !== classes.find(c => c.id === classToDelete)?.class_number}
            color="error"
          >
            Delete Class
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}