import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

const UserProfileDialog = ({ open, onClose, user }) => {
  if (!user) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>User information</DialogTitle>
      <DialogContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Avatar
            sx={{ width: 56, height: 56, mr: 2 }}
            src={user.profilePicture || undefined}
          >
            {(user.firstName?.[0] ||
              user.username?.[0] ||
              'U'
            ).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="subtitle1">
              {`${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                user.username}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              @{user.username}
            </Typography>
          </Box>
        </Box>
        <Typography variant="body2">
          Online: {user.online ? 'Yes' : 'No'}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserProfileDialog;

