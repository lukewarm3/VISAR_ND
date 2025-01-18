import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import Modal from '@mui/material/Modal'
import 'reactflow/dist/style.css'
import { useDispatch, useSelector } from 'react-redux'
import { setSaveModalClose } from '../slices/EditorSlice'
import {
  Box,
  Typography,
  Stack,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const ndBlue = '#0C2340'
const ndGold = '#C99700'

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '25vw',
  height: '15vh',
  bgcolor: 'background.paper',
  border: `2px solid ${ndBlue}`,
  padding: 10,
  boxShadow: 24,
  pt: 2,
  px: 4,
  pb: 3,
  borderRadius: 1
}

export default function SaveModal ({ message }) {
  const [editor] = useLexicalComposerContext()
  const dispatch = useDispatch()
  const modalOpen = useSelector(state => state.editor.saveModalOpen)

  const handleClose = () => {
    dispatch(setSaveModalClose())
  }

  return (
    <div>
      <Modal
        open={modalOpen}
        onClose={handleClose}
        aria-labelledby='modal-modal-title'
        aria-describedby='modal-modal-description'
      >
        <Box sx={modalStyle}>
          <Stack direction="column" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography 
              variant='h6' 
              sx={{ 
                color: ndBlue,
                fontFamily: 'system-ui',
                mb: 2,
                textAlign: 'center'
              }}
            >
              {message || 'Your draft has been saved successfully!'}
            </Typography>
            <CheckCircleIcon 
              sx={{ 
                color: ndGold,
                fontSize: 40,
                cursor: 'pointer'
              }}
              onClick={handleClose}
            />
          </Stack>
        </Box>
      </Modal>
    </div>
  )
}
