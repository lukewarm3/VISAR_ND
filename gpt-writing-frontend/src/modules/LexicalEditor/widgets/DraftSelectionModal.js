// DraftSelectionModal.js
import React from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';

export default function DraftSelectionModal({ open, onClose, drafts = [], onSelect, onDelete }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select Draft</DialogTitle>
      <DialogContent>
        {drafts.length === 0 ? (
          <Typography sx={{ p: 2, textAlign: 'center' }}>
            No drafts available
          </Typography>
        ) : (
          <List>
            {drafts.map((draft) => (
              <ListItem 
                button 
                key={draft.id}
                onClick={() => onSelect(draft.id)}
              >
                <ListItemText 
                  primary={draft.title}
                  secondary={`Last modified: ${new Date(draft.updated_at).toLocaleString()}`}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering onSelect
                    onDelete(draft.id);
                  }}>
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}