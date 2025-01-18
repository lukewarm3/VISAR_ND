import * as React from 'react'
import Button from '@mui/material/Button'
import CssBaseline from '@mui/material/CssBaseline'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import Link from '@mui/material/Link'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { useNavigate } from 'react-router-dom'

// Notre Dame colors is what I planned on using
const ndBlue = '#0C2340'
const ndGold = '#C99700'

const theme = createTheme({
  palette: {
    primary: {
      main: ndBlue,
    },
    secondary: {
      main: ndGold,
    },
  },
});

export default function SignIn() {
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [passwordError, setPasswordError] = React.useState('')
  const [role, setRole] = React.useState('student')
  const [isSignUp, setIsSignUp] = React.useState(false)
  const [status, setStatus] = React.useState('idle')
  const [message, setMessage] = React.useState('')
  const [signupCode, setSignupCode] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [usernameError, setUsernameError] = React.useState('');

  const navigate = useNavigate()

  const validatePassword = (password) => {
    if (password.length < 8 || password.length > 20) {
      return "Password must be between 8 and 20 characters long.";
    }
    if (!/\d/.test(password)) {
      return "Password must contain at least one number.";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter.";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter.";
    }
    if (!/[!@#$%^&*]/.test(password)) {
      return "Password must contain at least one special character (!@#$%^&*).";
    }
    return "";
  }

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    if(isSignUp) {
      setPasswordError(validatePassword(newPassword));
    }
  }

  const checkUsername = async (username) => {
    if (!username) return;
    try {
      const response = await fetch(`http://127.0.0.1:5000/check_username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username })
      });
      const data = await response.json();
      if (data.exists) {
        setUsernameError('Username already taken');
      } else {
        setUsernameError('');
      }
    } catch (error) {
      console.error('Error checking username:', error);
    }
  };

  async function authenticate(e) {
  e.preventDefault();  // This line is crucial
  
  if (isSignUp && passwordError) {
    setMessage("Please fix password errors before signing up.");
    return;
  }

  console.log('Testing');
  setStatus('loading');
  setMessage('');

  const endpoint = isSignUp ? 'signup' : 'login';
  
  try {
    const response = await fetch(`http://127.0.0.1:5000/${endpoint}`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        "Accept": 'application/json'
      },
      body: JSON.stringify({
        username,
        password,
        role,
        full_name: fullName,
        ...(isSignUp && role === 'student' && { signup_code: signupCode })
      })
    });

    const data = await response.json();
    setStatus(data.status);
    setMessage(data.message);
    
    if (data.status === 'success') {
      setStatus('success');
      if (data.role === 'teacher') {
        navigate('/teacher', {
          state: { 
            teacherId: data.userId,
            role: data.role,
            username: username,
            condition: 'advanced'
          }
        });
      } else {
        navigate('/editor', {
          state: {
            userId: data.userId,
            username: username,
            sessionId: data.sessionId,
            userType: data.role,
            condition: 'advanced',
            firstTimeLogin: data.firstTimeLogin
          }
        });
      }
    }
  } catch (error) {
    console.error('Error:', error);
    setStatus('error');
    setMessage('An error occurred. Please try again.');
  }
}

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: ndBlue,
          backgroundImage: `linear-gradient(135deg, ${ndBlue} 25%, ${ndGold} 25%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Container component='main' maxWidth='sm'>
          <CssBaseline />
          <Box
            sx={{
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: 'white',
              borderRadius: 2,
              boxShadow: 3,
            }}
          >
            <Typography component='h1' variant='h4' sx={{ color: ndBlue, marginBottom: 3 }}>
              Welcome to VISAR 📝
            </Typography>
            <Box component="form" onSubmit={authenticate} noValidate sx={{ mt: 1, width: '100%' }}>
              <TextField
                margin='normal'
                required
                fullWidth
                id='username'
                label='Username'
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  if (isSignUp) {
                    checkUsername(e.target.value);
                  }
                }}
                error={!!usernameError}
                helperText={usernameError}
                autoFocus
              />
              {isSignUp && (
                <TextField
                  margin='normal'
                  required
                  fullWidth
                  id='fullName'
                  label='Full Name'
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              )}
              <TextField
                margin='normal'
                required
                fullWidth
                value={password}
                onChange={handlePasswordChange}
                label='Password'
                type='password'
                id='password'
                error={!!passwordError}
                helperText={passwordError}
              />
              {isSignUp && (
              <FormControl component="fieldset" sx={{ mt: 2, mb: 2 }}>
                <FormLabel component="legend">Role</FormLabel>
                <RadioGroup
                  aria-label="role"
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <FormControlLabel value="student" control={<Radio />} label="Student" />
                  <FormControlLabel value="teacher" control={<Radio />} label="Teacher" />
                </RadioGroup>
              </FormControl>
              )}
              {isSignUp && role === 'student' && (
                <TextField
                  margin='normal'
                  required
                  fullWidth
                  id='signupCode'
                  label='Class Signup Code'
                  value={signupCode}
                  onChange={e => setSignupCode(e.target.value)}
                />
              )}
              <Button
                type='submit'
                fullWidth
                variant='contained'
                sx={{ mt: 3, mb: 2 }}
                disabled={isSignUp && (!!passwordError || !!usernameError) || status === 'loading'}
              >
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Button>
              <Grid container justifyContent="flex-end">
                <Grid item>
                  <Link href="#" variant="body2" onClick={() => setIsSignUp(!isSignUp)}>
                    {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                  </Link>
                </Grid>
              </Grid>
              {status === 'fail' && (
                <Typography sx={{ color: 'red', mt: 2 }}>{message}</Typography>
              )}
              {status === 'loading' && (
                <Typography sx={{ color: 'blue', mt: 2 }}>Loading...</Typography>
              )}
            </Box>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  )
}