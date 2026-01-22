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

const ImageAnnotator = ({ imageUrl, labelSet = [], questions = [], onAnnotationsChange, initialAnnotations = [], selectedTool = 'bbox', onMouseMove = null }) => {
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState(null);
  const [pendingAnnotation, setPendingAnnotation] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [moveStart, setMoveStart] = useState(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Sync initialAnnotations with state when imageUrl changes (new task loaded)
  const prevImageUrlRef = useRef(imageUrl);
  useEffect(() => {
    if (prevImageUrlRef.current !== imageUrl) {
      prevImageUrlRef.current = imageUrl;
      setAnnotations(initialAnnotations);
      prevAnnotationsRef.current = JSON.stringify(initialAnnotations);
    }
  }, [imageUrl, initialAnnotations]);

  // Use ref to track previous annotations to avoid unnecessary calls
  const prevAnnotationsRef = useRef(JSON.stringify(initialAnnotations));
  
  useEffect(() => {
    // Only call onAnnotationsChange if annotations actually changed
    const currentAnnotationsStr = JSON.stringify(annotations);
    if (prevAnnotationsRef.current !== currentAnnotationsStr) {
      prevAnnotationsRef.current = currentAnnotationsStr;
      onAnnotationsChange(annotations);
    }
  }, [annotations]); // Remove onAnnotationsChange from dependencies to avoid infinite loop

  const getImageCoordinates = (e) => {
    if (!imageRef.current || !containerRef.current) return null;
    
    const imageRect = imageRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Calculate scroll offset
    const scrollLeft = containerRef.current.scrollLeft;
    const scrollTop = containerRef.current.scrollTop;
    
    // Get mouse position relative to container
    const mouseX = e.clientX - containerRect.left + scrollLeft;
    const mouseY = e.clientY - containerRect.top + scrollTop;
    
    // Account for image transform (zoom and position)
    // Reverse the transform to get coordinates in the original image space
    const imageX = (mouseX - position.x) / zoom;
    const imageY = (mouseY - position.y) / zoom;
    
    // Get natural image dimensions
    const naturalWidth = imageRef.current.naturalWidth;
    const naturalHeight = imageRef.current.naturalHeight;
    
    if (naturalWidth === 0 || naturalHeight === 0) return null;
    
    // Calculate the original displayed size (before zoom)
    // imageRect.width/height are the displayed size after zoom
    const originalDisplayWidth = imageRect.width / zoom;
    const originalDisplayHeight = imageRect.height / zoom;
    
    // Convert to percentage based on the original displayed size
    // This ensures coordinates are consistent regardless of zoom level
    const x = (imageX / originalDisplayWidth) * 100;
    const y = (imageY / originalDisplayHeight) * 100;
    
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y))
    };
  };

  const handleMouseDown = (e) => {
    // Prevent default to avoid text selection
    e.preventDefault();
    
    // Only draw on image, not on container
    if (e.target !== imageRef.current && !imageRef.current?.contains(e.target)) {
      // Start panning if clicking on container
      if (e.target === containerRef.current || containerRef.current?.contains(e.target)) {
        setIsDragging(true);
        setDragStart({ 
          x: e.clientX - position.x, 
          y: e.clientY - position.y,
          scrollLeft: containerRef.current?.scrollLeft || 0,
          scrollTop: containerRef.current?.scrollTop || 0
        });
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
    // Call onMouseMove callback if provided
    if (onMouseMove) {
      const coords = getImageCoordinates(e);
      if (coords) {
        onMouseMove({ x: Math.round(coords.x), y: Math.round(coords.y) });
      }
    }
    
    // Cancel previous animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Use requestAnimationFrame for smooth updates
    animationFrameRef.current = requestAnimationFrame(() => {
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
      } else if (isDragging && dragStart && containerRef.current) {
        const deltaX = e.clientX - (dragStart.x + position.x);
        const deltaY = e.clientY - (dragStart.y + position.y);
        
        setPosition({
          x: position.x + deltaX,
          y: position.y + deltaY,
        });
        
        // Update drag start for next frame
        setDragStart({
          ...dragStart,
          x: e.clientX - position.x - deltaX,
          y: e.clientY - position.y - deltaY,
        });
      }
    });
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
        
        // Store pending annotation but don't add yet - show confirm dialog first
        setPendingAnnotation({
          bbox: bbox,
          label: null,
          answer: null,
        });
        
        // Show confirm dialog first
        setShowConfirmDialog(true);
      } else {
        // If box is too small, cancel drawing
        setIsDrawing(false);
        setDrawStart(null);
        setCurrentBox(null);
      }
    }
    
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
    }
  };

  const handleConfirmAnnotation = () => {
    setShowConfirmDialog(false);
    // After confirmation, show label selection dialog
    if (pendingAnnotation) {
      setShowLabelDialog(true);
    }
  };

  const handleCancelAnnotation = () => {
    setShowConfirmDialog(false);
    setPendingAnnotation(null);
    setIsDrawing(false);
    setDrawStart(null);
    setCurrentBox(null);
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
    setZoom(prevZoom => Math.min(prevZoom + 0.2, 5));
  };

  const handleZoomOut = () => {
    setZoom(prevZoom => Math.max(prevZoom - 0.2, 0.1));
  };

  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  };

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const getAnnotationStyle = (annotation) => {
    const [x1, y1, x2, y2] = annotation.bbox;
    const width = Math.max(Math.abs(x2 - x1), 1);
    const height = Math.max(Math.abs(y2 - y1), 1);
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);

    const labelInfo = labelSet.find(l => (l.name || l) === annotation.label);
    const borderColor = labelInfo?.color || '#1976d2';
    const isSelected = selectedAnnotation?.id === annotation.id;

    // Bounding box coordinates are stored as percentage (0-100%) of the original image
    // When rendering, we apply the same transform as the image so it scales correctly
    return {
      position: 'absolute',
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`,
      transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
      transformOrigin: 'top left',
      border: isSelected ? '3px solid' : '2px solid',
      borderColor: borderColor,
      backgroundColor: `${borderColor}${isSelected ? '30' : '20'}`,
      cursor: isMoving ? 'grabbing' : 'grab',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '4px',
      transition: isResizing || isMoving ? 'none' : 'transform 0.1s ease-out',
      zIndex: isSelected ? 10 : 1,
      pointerEvents: 'auto',
      '&:hover': {
        transform: isResizing || isMoving 
          ? `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)` 
          : `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px) scale(1.02)`,
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
    if (!currentBox || !imageRef.current) return null;
    
    return {
      position: 'absolute',
      left: `${currentBox.x}%`,
      top: `${currentBox.y}%`,
      width: `${Math.abs(currentBox.width)}%`,
      height: `${Math.abs(currentBox.height)}%`,
      transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
      transformOrigin: 'top left',
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
            overflow: 'auto',
            border: '2px solid #ccc',
            borderRadius: 1,
            cursor: isDrawing ? 'crosshair' : (isDragging ? 'grabbing' : 'default'),
            maxHeight: '80vh',
            minHeight: '400px',
            backgroundColor: '#f5f5f5',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            width: '100%',
            padding: 0,
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
            onLoad={(e) => {
              // Reset zoom and position when image loads
              if (imageRef.current && containerRef.current) {
                setZoom(1);
                setPosition({ x: 0, y: 0 });
                // Scroll to top-left to ensure full image is visible
                setTimeout(() => {
                  if (containerRef.current) {
                    containerRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                  }
                }, 100);
              }
            }}
            sx={{
              display: 'block',
              width: '100%',
              height: 'auto',
              maxWidth: '100%',
              maxHeight: 'none',
              objectFit: 'contain',
              transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
              transformOrigin: 'top left',
              cursor: isDrawing ? 'crosshair' : 'default',
              userSelect: 'none',
              pointerEvents: 'auto',
              transition: isDrawing || isDragging || isResizing || isMoving ? 'none' : 'transform 0.1s ease-out',
              flexShrink: 0,
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

      {/* Confirm Annotation Dialog */}
      <Dialog open={showConfirmDialog} onClose={handleCancelAnnotation} maxWidth="sm" fullWidth>
        <DialogTitle>Xác nhận khoanh vùng</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Bạn đã khoanh vùng một khu vực trên ảnh.
          </Typography>
          {pendingAnnotation && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Vị trí:</strong> [{Math.round(pendingAnnotation.bbox[0])}%, {Math.round(pendingAnnotation.bbox[1])}%] 
                đến [{Math.round(pendingAnnotation.bbox[2])}%, {Math.round(pendingAnnotation.bbox[3])}%]
              </Typography>
              <Typography variant="body2">
                <strong>Kích thước:</strong> {Math.round(Math.abs(pendingAnnotation.bbox[2] - pendingAnnotation.bbox[0]))}% × {Math.round(Math.abs(pendingAnnotation.bbox[3] - pendingAnnotation.bbox[1]))}%
              </Typography>
            </Box>
          )}
          <Typography variant="body2" sx={{ mt: 2 }}>
            Bạn có muốn tiếp tục chọn label cho vùng này không?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelAnnotation} color="error">
            Hủy
          </Button>
          <Button onClick={handleConfirmAnnotation} variant="contained" color="primary">
            Xác nhận
          </Button>
        </DialogActions>
      </Dialog>

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
