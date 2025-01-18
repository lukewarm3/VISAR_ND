import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Box,
  Tab,
  Tabs,
  Alert
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const ndBlue = '#0C2340';
const ndGold = '#C99700';

const theme = createTheme({
  palette: {
    primary: {
      main: ndBlue,
    },
    secondary: {
      main: ndGold,
    }
  },
  typography: {
    h5: {
      color: '#0C2340',
      fontWeight: 500
    },
    body1: {
      fontSize: '1rem'
    }
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          marginBottom: '1rem'
        }
      }
    }
  }
});

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index} style={{ width: '100%' }}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function AccountSettingsModal({ open, onClose, userId, role, username, fullName, onProfileUpdate }) {
  const [activeTab, setActiveTab] = useState(0);
  const [userData, setUserData] = useState({
    username: '',
    full_name: '',
    students: []
  });
  const [newStudent, setNewStudent] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setUserData(prev => ({
      ...prev,
      username: username || '',
      full_name: fullName || ''
    }));
  }, [username, fullName]);

  useEffect(() => {
    if (open && userId) {
      fetchUserData();
    }
  }, [open, userId]);

  const fetchUserData = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/user/${userId}`);
      const data = await response.json();
      if (data.status === 'success') {
        setUserData({
          username: data.user.username || username,
          full_name: data.user.full_name || '',
          students: data.user.students || []
        });
      }
    } catch (err) {
      setError('Failed to fetch user data');
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/user/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: userData.full_name
        })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setSuccess('Profile updated successfully');
        setTimeout(() => setSuccess(''), 3000);
        if (onProfileUpdate) {
          onProfileUpdate();
        }
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to update profile');
    }
  };

  const handleAddStudent = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/teacher/${userId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newStudent })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setUserData(prev => ({
          ...prev,
          students: [...prev.students, data.student]
        }));
        setNewStudent('');
        setSuccess('Student added successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to add student');
    }
  };

  const handleRemoveStudent = async (studentId) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/teacher/${userId}/students/${studentId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.status === 'success') {
        setUserData(prev => ({
          ...prev,
          students: prev.students.filter(s => s.id !== studentId)
        }));
        setSuccess('Student removed successfully');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError('Failed to remove student');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ bgcolor: ndBlue, color: 'white' }}>
          Account Settings
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
          
          {role === 'teacher' && (
            <Tabs 
              value={activeTab} 
              onChange={(e, newValue) => setActiveTab(newValue)}
              sx={{
                '& .MuiTabs-indicator': {
                  backgroundColor: ndGold,
                },
                '& .MuiTab-root': {
                  color: ndBlue,
                  '&.Mui-selected': {
                    color: ndGold,
                  }
                }
              }}
            >
              <Tab label="Profile" />
              <Tab label="Students" />
            </Tabs>
          )}

          <TabPanel value={activeTab} index={0}>
            <TextField
              fullWidth
              label="Full Name"
              value={userData.full_name || ''}
              onChange={(e) => setUserData(prev => ({ ...prev, full_name: e.target.value }))}
              margin="normal"
              sx={{
                '& .MuiOutlinedInput-root': {
                  '&.Mui-focused fieldset': {
                    borderColor: ndGold,
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: ndGold,
                },
              }}
            />
          </TabPanel>

          {role === 'teacher' && (
            <TabPanel value={activeTab} index={1}>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  fullWidth
                  label="Add Student by Username"
                  value={newStudent}
                  onChange={(e) => setNewStudent(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&.Mui-focused fieldset': {
                        borderColor: ndGold,
                      },
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: ndGold,
                    },
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleAddStudent}
                  startIcon={<PersonAddIcon />}
                  sx={{ bgcolor: ndBlue }}
                >
                  Add
                </Button>
              </Box>
              <List>
                {userData.students?.map((student) => (
                  <ListItem key={student.id}>
                    <ListItemText primary={student.username} />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => handleRemoveStudent(student.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </TabPanel>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={onClose} 
            variant="outlined" 
            sx={{ 
              color: ndBlue, 
              borderColor: ndBlue,
              '&:hover': {
                backgroundColor: '#ffebee',  // Light red background
                borderColor: '#c62828',      // Darker red border
                color: '#c62828'            // Darker red text
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpdateProfile} 
            variant="contained" 
            sx={{ 
              bgcolor: ndBlue,
              '&:hover': {
                bgcolor: ndGold
              }
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
} 