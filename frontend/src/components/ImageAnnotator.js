import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Alert,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';

const ImageAnnotator = ({ imageUrl, labelSet = [], questions = [], onAnnotationsChange, initialAnnotations = [] }) => {
  const [annotations, setAnnotations] = useState(initialAnnotations);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [currentBox, setCurrentBox] = useState(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [showAnswerDialog, setShowAnswerDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState(null);
  const [pendingAnnotation, setPendingAnnotation] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [moveStart, setMoveStart] = useState(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    onAnnotationsChange(annotations);
  }, [annotations, onAnnotationsChange]);

  const getImageCoordinates = (e) => {
    if (!imageRef.current) return null;
    
    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = rect.width / imageRef.current.naturalWidth;
    const scaleY = rect.height / imageRef.current.naturalHeight;
    
    const x = ((e.clientX - rect.left - position.x) / zoom / scaleX) / imageRef.current.naturalWidth * 100;
    const y = ((e.clientY - rect.top - position.y) / zoom / scaleY) / imageRef.current.naturalHeight * 100;
    
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y))
    };
  };

  const handleMouseDown = (e) => {
    // Only draw on image, not on container
    if (e.target !== imageRef.current) {
      // Start panning if clicking on container
      if (e.target === containerRef.current) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }
      return;
    }
    
    // Start drawing bounding box on image
    e.stopPropagation();
    const coords = getImageCoordinates(e);
    if (coords) {
      setIsDrawing(true);
      setIsDragging(false);
      setDrawStart(coords);
      setCurrentBox({ ...coords, width: 0, height: 0 });
    }
  };

  const handleMouseMove = (e) => {
    if (isResizing || isMoving) {
      handleAnnotationMouseMove(e);
      return;
    }
    
    if (isDrawing && drawStart) {
      const coords = getImageCoordinates(e);
      if (coords) {
        const width = coords.x - drawStart.x;
        const height = coords.y - drawStart.y;
        setCurrentBox({
          x: drawStart.x,
          y: drawStart.y,
          width: width,
          height: height,
        });
      }
    } else if (isDragging && dragStart) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = (e) => {
    if (isResizing || isMoving) {
      handleAnnotationMouseUp();
      return;
    }
    
    if (isDrawing && drawStart && currentBox) {
      const coords = getImageCoordinates(e);
      if (coords && Math.abs(currentBox.width) > 1 && Math.abs(currentBox.height) > 1) {
        // Create bounding box
        const bbox = [
          Math.min(drawStart.x, coords.x),
          Math.min(drawStart.y, coords.y),
          Math.max(drawStart.x, coords.x),
          Math.max(drawStart.y, coords.y)
        ];
        
        setPendingAnnotation({
          bbox: bbox,
          label: null,
          answer: null,
        });
        
        // Show label selection dialog first
        setShowLabelDialog(true);
      }
      
      setIsDrawing(false);
      setDrawStart(null);
      setCurrentBox(null);
    }
    
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
    }
  };

  const handleAddAnnotation = (label) => {
    if (!label || !pendingAnnotation) return;
    
    const newAnnotation = {
      id: Date.now(),
      label: label,
      bbox: pendingAnnotation.bbox,
      confidence: 1.0,
      type: 'bbox',
      answer: null, // Will be set when answer is selected
    };
    
    setPendingAnnotation({ ...newAnnotation });
    
    // If there are questions, show answer dialog
    if (questions && questions.length > 0) {
      setShowLabelDialog(false);
      setShowAnswerDialog(true);
    } else {
      // No questions, just add the annotation with answer = null
      setAnnotations([...annotations, newAnnotation]);
      setShowLabelDialog(false);
      setPendingAnnotation(null);
    }
  };

  const handleSelectAnswer = (answer) => {
    if (!pendingAnnotation) return;
    
    const finalAnnotation = {
      ...pendingAnnotation,
      answer: answer, // Can be null if no questions, or object if has questions
    };
    
    setAnnotations([...annotations, finalAnnotation]);
    setShowAnswerDialog(false);
    setPendingAnnotation(null);
  };

  const handleDeleteAnnotation = (id) => {
    setAnnotations(annotations.filter(ann => ann.id !== id));
    if (selectedAnnotation?.id === id) {
      setSelectedAnnotation(null);
    }
  };

  const handleEditAnnotation = (annotation) => {
    setEditingAnnotation({ ...annotation });
    setShowEditDialog(true);
  };

  const handleUpdateAnnotation = () => {
    if (!editingAnnotation) return;
    
    setAnnotations(annotations.map(ann => 
      ann.id === editingAnnotation.id 
        ? { ...ann, label: editingAnnotation.label, answer: editingAnnotation.answer }
        : ann
    ));
    setShowEditDialog(false);
    setEditingAnnotation(null);
  };

  const handleResizeStart = (e, annotationId, handle) => {
    e.stopPropagation();
    const annotation = annotations.find(a => a.id === annotationId);
    if (annotation) {
      setIsResizing(true);
      setResizeHandle(handle);
      setSelectedAnnotation(annotation);
      const coords = getImageCoordinates(e);
      if (coords) {
        setMoveStart({
          annotationId,
          startX: coords.x,
          startY: coords.y,
          bbox: [...annotation.bbox],
        });
      }
    }
  };

  const handleMoveStart = (e, annotationId) => {
    e.stopPropagation();
    if (e.target.closest('.resize-handle')) return; // Don't move if clicking resize handle
    
    const annotation = annotations.find(a => a.id === annotationId);
    if (annotation) {
      setIsMoving(true);
      setSelectedAnnotation(annotation);
      const coords = getImageCoordinates(e);
      if (coords) {
        setMoveStart({
          annotationId,
          startX: coords.x,
          startY: coords.y,
          bbox: [...annotation.bbox],
        });
      }
    }
  };

  const handleAnnotationMouseMove = (e) => {
    if (isResizing && moveStart && resizeHandle) {
      const coords = getImageCoordinates(e);
      if (coords) {
        const [x1, y1, x2, y2] = moveStart.bbox;
        let newBbox = [...moveStart.bbox];
        
        switch (resizeHandle) {
          case 'nw': // top-left
            newBbox = [coords.x, coords.y, x2, y2];
            break;
          case 'ne': // top-right
            newBbox = [x1, coords.y, coords.x, y2];
            break;
          case 'sw': // bottom-left
            newBbox = [coords.x, y1, x2, coords.y];
            break;
          case 'se': // bottom-right
            newBbox = [x1, y1, coords.x, coords.y];
            break;
        }
        
        // Ensure valid bbox
        newBbox[0] = Math.max(0, Math.min(100, newBbox[0]));
        newBbox[1] = Math.max(0, Math.min(100, newBbox[1]));
        newBbox[2] = Math.max(0, Math.min(100, newBbox[2]));
        newBbox[3] = Math.max(0, Math.min(100, newBbox[3]));
        
        // Swap if needed
        if (newBbox[0] > newBbox[2]) [newBbox[0], newBbox[2]] = [newBbox[2], newBbox[0]];
        if (newBbox[1] > newBbox[3]) [newBbox[1], newBbox[3]] = [newBbox[3], newBbox[1]];
        
        // Ensure minimum size
        if (Math.abs(newBbox[2] - newBbox[0]) < 1) {
          if (resizeHandle === 'nw' || resizeHandle === 'sw') {
            newBbox[0] = newBbox[2] - 1;
          } else {
            newBbox[2] = newBbox[0] + 1;
          }
        }
        if (Math.abs(newBbox[3] - newBbox[1]) < 1) {
          if (resizeHandle === 'nw' || resizeHandle === 'ne') {
            newBbox[1] = newBbox[3] - 1;
          } else {
            newBbox[3] = newBbox[1] + 1;
          }
        }
        
        setAnnotations(annotations.map(ann => 
          ann.id === moveStart.annotationId 
            ? { ...ann, bbox: newBbox }
            : ann
        ));
      }
    } else if (isMoving && moveStart) {
      const coords = getImageCoordinates(e);
      if (coords) {
        const deltaX = coords.x - moveStart.startX;
        const deltaY = coords.y - moveStart.startY;
        const [x1, y1, x2, y2] = moveStart.bbox;
        const width = x2 - x1;
        const height = y2 - y1;
        
        let newX1 = x1 + deltaX;
        let newY1 = y1 + deltaY;
        let newX2 = newX1 + width;
        let newY2 = newY1 + height;
        
        // Keep within bounds
        if (newX1 < 0) {
          newX1 = 0;
          newX2 = width;
        }
        if (newX2 > 100) {
          newX2 = 100;
          newX1 = 100 - width;
        }
        if (newY1 < 0) {
          newY1 = 0;
          newY2 = height;
        }
        if (newY2 > 100) {
          newY2 = 100;
          newY1 = 100 - height;
        }
        
        setAnnotations(annotations.map(ann => 
          ann.id === moveStart.annotationId 
            ? { ...ann, bbox: [newX1, newY1, newX2, newY2] }
            : ann
        ));
      }
    }
  };

  const handleAnnotationMouseUp = () => {
    setIsResizing(false);
    setIsMoving(false);
    setResizeHandle(null);
    setMoveStart(null);
  };


  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 0.2, 0.5));
  };

  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const getAnnotationStyle = (annotation) => {
    const [x1, y1, x2, y2] = annotation.bbox;
    const width = Math.max(Math.abs(x2 - x1), 1);
    const height = Math.max(Math.abs(y2 - y1), 1);
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);

    const labelInfo = labelSet.find(l => (l.name || l) === annotation.label);
    const borderColor = labelInfo?.color || '#1976d2';
    const isSelected = selectedAnnotation?.id === annotation.id;

    return {
      position: 'absolute',
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`,
      border: isSelected ? '3px solid' : '2px solid',
      borderColor: borderColor,
      backgroundColor: `${borderColor}${isSelected ? '30' : '20'}`,
      cursor: isMoving ? 'grabbing' : 'grab',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '4px',
      transition: isResizing || isMoving ? 'none' : 'all 0.2s',
      zIndex: isSelected ? 10 : 1,
      '&:hover': {
        transform: isResizing || isMoving ? 'none' : 'scale(1.02)',
        zIndex: 10,
      },
    };
  };

  const getResizeHandleStyle = (position) => {
    const baseStyle = {
      position: 'absolute',
      width: '12px',
      height: '12px',
      backgroundColor: '#fff',
      border: '2px solid #1976d2',
      borderRadius: '50%',
      cursor: `${position}-resize`,
      zIndex: 20,
    };

    const positions = {
      nw: { top: '-6px', left: '-6px', cursor: 'nw-resize' },
      ne: { top: '-6px', right: '-6px', cursor: 'ne-resize' },
      sw: { bottom: '-6px', left: '-6px', cursor: 'sw-resize' },
      se: { bottom: '-6px', right: '-6px', cursor: 'se-resize' },
    };

    return { ...baseStyle, ...positions[position] };
  };

  const getCurrentBoxStyle = () => {
    if (!currentBox) return null;
    
    return {
      position: 'absolute',
      left: `${currentBox.x}%`,
      top: `${currentBox.y}%`,
      width: `${Math.abs(currentBox.width)}%`,
      height: `${Math.abs(currentBox.height)}%`,
      border: '2px dashed #1976d2',
      backgroundColor: 'rgba(25, 118, 210, 0.1)',
      pointerEvents: 'none',
    };
  };

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Image Annotation Tool</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Typography variant="body2" sx={{ alignSelf: 'center' }}>
              Kéo chuột để khoanh vùng
            </Typography>
            <IconButton onClick={handleZoomOut} size="small">
              <ZoomOutIcon />
            </IconButton>
            <Typography variant="body2" sx={{ alignSelf: 'center', minWidth: '60px', textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </Typography>
            <IconButton onClick={handleZoomIn} size="small">
              <ZoomInIcon />
            </IconButton>
            <Button size="small" onClick={handleReset}>
              Reset
            </Button>
          </Box>
        </Box>

        <Box
          ref={containerRef}
          sx={{
            position: 'relative',
            overflow: 'hidden',
            border: '2px solid #ccc',
            borderRadius: 1,
            cursor: isDrawing ? 'crosshair' : (isDragging ? 'grabbing' : 'default'),
            maxHeight: '600px',
            backgroundColor: '#f5f5f5',
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <Box
            component="img"
            ref={imageRef}
            src={imageUrl}
            alt="Annotate"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              if (isDrawing) {
                setIsDrawing(false);
                setDrawStart(null);
                setCurrentBox(null);
              }
            }}
            sx={{
              width: '100%',
              height: 'auto',
              transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
              transformOrigin: 'top left',
              cursor: isDrawing ? 'crosshair' : 'default',
              userSelect: 'none',
              pointerEvents: 'auto',
            }}
            draggable={false}
          />
          
          {/* Current drawing box */}
          {currentBox && (
            <Box sx={getCurrentBoxStyle()} />
          )}
          
          {/* Existing annotations */}
          {annotations.map((annotation) => {
            const labelInfo = labelSet.find(l => (l.name || l) === annotation.label);
            const borderColor = labelInfo?.color || '#1976d2';
            const isSelected = selectedAnnotation?.id === annotation.id;
            
            return (
              <Box
                key={annotation.id}
                data-annotation-id={annotation.id}
                sx={{
                  ...getAnnotationStyle(annotation),
                  borderColor: borderColor,
                  backgroundColor: `${borderColor}${isSelected ? '30' : '20'}`,
                }}
                onMouseDown={(e) => {
                  if (!e.target.closest('.resize-handle') && !e.target.closest('.chip')) {
                    handleMoveStart(e, annotation.id);
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleEditAnnotation(annotation);
                }}
                onClick={(e) => {
                  if (!e.target.closest('.resize-handle') && !e.target.closest('.chip')) {
                    e.stopPropagation();
                    setSelectedAnnotation(annotation);
                  }
                }}
              >
                <Chip
                  label={`${annotation.label}${annotation.answer ? ` (${typeof annotation.answer === 'object' ? Object.values(annotation.answer).join(', ') : annotation.answer})` : ''}`}
                  size="small"
                  className="chip"
                  sx={{ 
                    pointerEvents: 'auto',
                    bgcolor: borderColor,
                    color: 'white',
                    fontWeight: 'bold',
                    maxWidth: '90%',
                  }}
                  onDelete={() => handleDeleteAnnotation(annotation.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditAnnotation(annotation);
                  }}
                />
                {isSelected && (
                  <>
                    <Box
                      className="resize-handle"
                      sx={getResizeHandleStyle('nw')}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleResizeStart(e, annotation.id, 'nw');
                      }}
                    />
                    <Box
                      className="resize-handle"
                      sx={getResizeHandleStyle('ne')}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleResizeStart(e, annotation.id, 'ne');
                      }}
                    />
                    <Box
                      className="resize-handle"
                      sx={getResizeHandleStyle('sw')}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleResizeStart(e, annotation.id, 'sw');
                      }}
                    />
                    <Box
                      className="resize-handle"
                      sx={getResizeHandleStyle('se')}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleResizeStart(e, annotation.id, 'se');
                      }}
                    />
                  </>
                )}
              </Box>
            );
          })}
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Đã khoanh vùng ({annotations.length}):
          </Typography>
          {annotations.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              Chưa có annotation. Kéo chuột trên ảnh để khoanh vùng.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              {annotations.map((ann) => (
                <Chip
                  key={ann.id}
                  label={`${ann.label}${ann.answer ? ` (${typeof ann.answer === 'object' ? Object.values(ann.answer).join(', ') : ann.answer})` : ''} - [${Math.round(ann.bbox[0])}%, ${Math.round(ann.bbox[1])}%]`}
                  onDelete={() => handleDeleteAnnotation(ann.id)}
                  color="primary"
                  variant="outlined"
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Label Selection Dialog */}
      <Dialog open={showLabelDialog} onClose={() => {
        setShowLabelDialog(false);
        setPendingAnnotation(null);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Chọn Label cho vùng đã khoanh</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Bạn đã khoanh vùng từ ({Math.round(pendingAnnotation?.bbox[0] || 0)}%, {Math.round(pendingAnnotation?.bbox[1] || 0)}%) đến ({Math.round(pendingAnnotation?.bbox[2] || 0)}%, {Math.round(pendingAnnotation?.bbox[3] || 0)}%)
          </Typography>
          <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
            Chọn label phù hợp:
          </Typography>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Label *</InputLabel>
            <Select
              value=""
              onChange={(e) => {
                const label = e.target.value;
                if (label) {
                  handleAddAnnotation(label);
                }
              }}
              label="Label *"
              autoFocus
            >
              {labelSet.length === 0 ? (
                <MenuItem disabled>Không có label nào. Manager cần thêm label vào project.</MenuItem>
              ) : (
                labelSet.map((label, idx) => (
                  <MenuItem key={idx} value={label.name || label}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {label.color && (
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            bgcolor: label.color,
                            borderRadius: '50%',
                            border: '1px solid #ccc',
                          }}
                        />
                      )}
                      <Typography>{label.name || label}</Typography>
                      {label.description && (
                        <Typography variant="caption" color="textSecondary" sx={{ ml: 1 }}>
                          ({label.description})
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
          {labelSet.length === 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Manager chưa thiết lập bộ nhãn cho project này. Vui lòng liên hệ Manager.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowLabelDialog(false);
            setPendingAnnotation(null);
          }}>Hủy</Button>
        </DialogActions>
      </Dialog>

      {/* Answer Selection Dialog */}
      <Dialog open={showAnswerDialog} onClose={() => {
        setShowAnswerDialog(false);
        setPendingAnnotation(null);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Chọn đáp án</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Bạn đã khoanh vùng và chọn label: <strong>{pendingAnnotation?.label}</strong>
          </Typography>
          <Typography variant="body2" sx={{ mt: 2, mb: 2 }}>
            Vui lòng trả lời câu hỏi sau:
          </Typography>
          {questions && questions.length > 0 ? (
            questions.map((question, qIdx) => (
              <FormControl key={qIdx} component="fieldset" fullWidth sx={{ mt: qIdx > 0 ? 3 : 0 }}>
                <FormLabel component="legend" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {question.question || `Câu hỏi ${qIdx + 1}`}
                </FormLabel>
                <RadioGroup
                  value={pendingAnnotation?.answer?.[qIdx] || ''}
                  onChange={(e) => {
                    const newAnswer = { ...(pendingAnnotation?.answer || {}) };
                    newAnswer[qIdx] = e.target.value;
                    setPendingAnnotation({
                      ...pendingAnnotation,
                      answer: newAnswer,
                    });
                  }}
                >
                  {question.options && question.options.map((option, optIdx) => (
                    <FormControlLabel
                      key={optIdx}
                      value={option.key}
                      control={<Radio />}
                      label={`${option.key}. ${option.value || `Đáp án ${option.key}`}`}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            ))
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              Không có câu hỏi nào. Manager cần thêm câu hỏi vào project.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowAnswerDialog(false);
            setPendingAnnotation(null);
          }}>
            Hủy
          </Button>
          <Button
            onClick={() => {
              // If no questions, allow saving with null answer
              // If has questions, must have all answers
              if (!questions || questions.length === 0) {
                handleSelectAnswer(null);
              } else if (pendingAnnotation?.answer && Object.keys(pendingAnnotation.answer).length >= questions.length) {
                handleSelectAnswer(pendingAnnotation.answer);
              }
            }}
            variant="contained"
            disabled={
              questions && questions.length > 0 && 
              (!pendingAnnotation?.answer || Object.keys(pendingAnnotation.answer).length < questions.length)
            }
          >
            Xác nhận
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Annotation Dialog */}
      <Dialog open={showEditDialog} onClose={() => {
        setShowEditDialog(false);
        setEditingAnnotation(null);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Chỉnh sửa Annotation</DialogTitle>
        <DialogContent>
          {editingAnnotation && (
            <>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Vị trí: [{Math.round(editingAnnotation.bbox[0])}%, {Math.round(editingAnnotation.bbox[1])}%] đến [{Math.round(editingAnnotation.bbox[2])}%, {Math.round(editingAnnotation.bbox[3])}%]
              </Typography>
              
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Label *</InputLabel>
                <Select
                  value={editingAnnotation.label || ''}
                  onChange={(e) => {
                    setEditingAnnotation({ ...editingAnnotation, label: e.target.value });
                  }}
                  label="Label *"
                >
                  {labelSet.map((label, idx) => (
                    <MenuItem key={idx} value={label.name || label}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {label.color && (
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              bgcolor: label.color,
                              borderRadius: '50%',
                              border: '1px solid #ccc',
                            }}
                          />
                        )}
                        <Typography>{label.name || label}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {questions && questions.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Câu hỏi và Đáp án:
                  </Typography>
                  {questions.map((question, qIdx) => (
                    <FormControl key={qIdx} component="fieldset" fullWidth sx={{ mt: 2 }}>
                      <FormLabel component="legend" sx={{ fontWeight: 'bold', mb: 1 }}>
                        {question.question || `Câu hỏi ${qIdx + 1}`}
                      </FormLabel>
                      <RadioGroup
                        value={editingAnnotation.answer?.[qIdx] || ''}
                        onChange={(e) => {
                          const newAnswer = { ...(editingAnnotation.answer || {}) };
                          newAnswer[qIdx] = e.target.value;
                          setEditingAnnotation({ ...editingAnnotation, answer: newAnswer });
                        }}
                      >
                        {question.options && question.options.map((option, optIdx) => (
                          <FormControlLabel
                            key={optIdx}
                            value={option.key}
                            control={<Radio />}
                            label={`${option.key}. ${option.value || `Đáp án ${option.key}`}`}
                          />
                        ))}
                      </RadioGroup>
                    </FormControl>
                  ))}
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowEditDialog(false);
            setEditingAnnotation(null);
          }}>
            Hủy
          </Button>
          <Button onClick={handleUpdateAnnotation} variant="contained">
            Lưu thay đổi
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ImageAnnotator;
