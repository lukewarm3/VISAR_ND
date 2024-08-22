import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Container, Typography, Paper, Grid, Table, 
  TableBody, TableCell, TableContainer, TableHead, 
  TableRow, Card, CardContent, Box
} from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { createTheme, ThemeProvider } from '@mui/material/styles';

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
  const location = useLocation();
  const navigate = useNavigate();
  // const { teacherId } = location.state || {};
  const teacherId = 100;

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        if (!teacherId) {
          // Use this for debugging
          // throw new Error('No teacherId provided');
        }
        const response = await fetch(`http://127.0.0.1:5000/teacher/${teacherId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.status === 'success') {
          console.log("This was a success!");
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
  }, [teacherId]);

  useEffect(() => {
    if (!teacherId) {
      console.error('No teacherId in location state, redirecting to login');
      navigate('/');
    }
  }, [teacherId, navigate]);

  if (error) {
    return <Typography color="error">Error: {error}</Typography>;
  }

  if (!dashboardData) {
    return <Typography>Loading...</Typography>;
  }

  // This needs to be included, but for now we'll just put in some static data.
  // const { teacher, students, metrics } = dashboardData;

  // const timeSpentData = students.map(student => ({
  //   name: student.username,
  //   timeSpent: student.time_spent
  // }));
  const timeSpentData = [
    { name: 'Student A', timeSpent: 120 },
    { name: 'Student B', timeSpent: 80 },
    { name: 'Student C', timeSpent: 150 },
  ];
  const metrics = {
    total_students: 100,
    total_time_spent: 6000,
    avg_time_spent: 60,
    total_logins: 250
  };
  const teacher = { username: 'Test Teacher' };
  const students = [
    { id: 1, username: 'Student A', time_spent: 7200, login_count: 10, last_login: new Date() },
    { id: 2, username: 'Student B', time_spent: 4800, login_count: 8, last_login: new Date() },
  ];

  const loginData = [
    { name: 'Logged In', value: metrics.total_logins },
    { name: 'Not Logged In', value: metrics.total_students * 5 - metrics.total_logins }
  ];

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ 
        backgroundColor: ndBlue, 
        minHeight: '100vh', 
        py: 4,
      }}>
        <Container maxWidth="lg">
          <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
            <Typography variant="h4" gutterBottom sx={{ color: ndBlue }}>
              Teacher Dashboard
            </Typography>
            <Typography variant="h6" gutterBottom sx={{ color: ndBlue, mb: 4 }}>
              Welcome, {teacher.username}!
            </Typography>
            
            <Grid container spacing={3}>
              {/* Metrics Cards */}
              <Grid item xs={12} md={3}>
                <Card elevation={3}>
                  <CardContent>
                    <Typography color="primary" gutterBottom>
                      Total Students
                    </Typography>
                    <Typography variant="h5" color="primary">
                      {metrics.total_students}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card elevation={3}>
                  <CardContent>
                    <Typography color="primary" gutterBottom>
                      Total Time Spent
                    </Typography>
                    <Typography variant="h5" color="primary">
                      {Math.round(metrics.total_time_spent / 60)} minutes
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card elevation={3}>
                  <CardContent>
                    <Typography color="primary" gutterBottom>
                      Average Time Spent
                    </Typography>
                    <Typography variant="h5" color="primary">
                      {Math.round(metrics.avg_time_spent / 60)} minutes
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card elevation={3}>
                  <CardContent>
                    <Typography color="primary" gutterBottom>
                      Total Logins
                    </Typography>
                    <Typography variant="h5" color="primary">
                      {metrics.total_logins}
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
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="timeSpent" fill={ndGold} />
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
                      <Tooltip />
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
                        <TableCell align="right" sx={{ color: ndBlue }}>Time Spent (minutes)</TableCell>
                        <TableCell align="right" sx={{ color: ndBlue }}>Login Count</TableCell>
                        <TableCell align="right" sx={{ color: ndBlue }}>Last Login</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {students.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell component="th" scope="row">
                            {student.username}
                          </TableCell>
                          <TableCell align="right">{Math.round(student.time_spent / 60)}</TableCell>
                          <TableCell align="right">{student.login_count}</TableCell>
                          <TableCell align="right">
                            {student.last_login ? new Date(student.last_login).toLocaleString() : 'N/A'}
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
    </ThemeProvider>
  );
}