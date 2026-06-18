import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import UserProfileDialog from '../user/UserProfileDialog';
import useTranslation from '../../hooks/useTranslation';

// Navbar component that displays the app name and user authentication status
const Navbar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [profileOpen, setProfileOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {t('app.name')}
        </Typography>
        
        {isAuthenticated ? (
          <Box>
            <Typography variant="body1" component="span" sx={{ mr: 2 }}>
              {user?.username}
            </Typography>
            <Button color="inherit" onClick={() => setProfileOpen(true)}>
              {t('nav.myProfile')}
            </Button>
            <Button color="inherit" onClick={handleLogout}>
              {t('nav.logout')}
            </Button>
          </Box>
        ) : (
          <Box>
            <Button color="inherit" onClick={() => navigate('/login')}>
              {t('nav.login')}
            </Button>
            <Button color="inherit" onClick={() => navigate('/register')}>
              {t('nav.register')}
            </Button>
          </Box>
        )}
      </Toolbar>
      <UserProfileDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={user}
        editable
      />
    </AppBar>
  );
};

export default Navbar;