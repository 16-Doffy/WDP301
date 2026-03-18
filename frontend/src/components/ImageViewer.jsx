import React, { useRef, useEffect, useState } from 'react';

/**
 * Component chung để hiển thị image với bounding boxes
 * Đảm bảo đồng bộ giữa Annotator và Reviewer
 * Sử dụng Tailwind CSS để đảm bảo styling nhất quán
 */
const ImageViewer = ({ 
  imageUrl, 
  annotations = [], 
  labelSet = [],
  reviewNotes = [],
  readOnly = false,
  onAnnotationClick,
  highlightedIndex = null,
  maxHeight = '600px'
}) => {
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateImageSize = () => {
      if (imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        setImageSize({ width: rect.width, height: rect.height });
      }
    };

    updateImageSize();
    window.addEventListener('resize', updateImageSize);
    return () => window.removeEventListener('resize', updateImageSize);
  }, [imageUrl]);

  const renderBoundingBox = (bbox, label, color, index, isNote = false) => {
    if (!bbox || !Array.isArray(bbox) || bbox.length < 4) return null;
    
    const [x1, y1, x2, y2] = bbox;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    const isHighlighted = highlightedIndex === index;
    const borderColor = isNote ? '#ef4444' : (isHighlighted ? '#10b981' : (color || '#3b82f6'));
    const borderStyle = isNote ? 'dashed' : 'solid';
    const bgOpacity = isNote ? '20' : (isHighlighted ? '30' : '15');
    const borderWidth = isHighlighted ? '3px' : '2px';
    const boxShadow = isHighlighted 
      ? '0 0 20px rgba(16, 185, 129, 0.6), 0 0 40px rgba(16, 185, 129, 0.4)' 
      : 'none';

    return (
      <div
        key={`${isNote ? 'note' : 'bbox'}-${index}`}
        onClick={() => onAnnotationClick && onAnnotationClick({ bbox, label, index })}
        onMouseEnter={() => !readOnly && onAnnotationClick && onAnnotationClick({ bbox, label, index })}
        className={`absolute box-border ${readOnly ? 'pointer-events-none cursor-default' : 'pointer-events-auto cursor-pointer'} transition-all duration-300 ${isHighlighted ? 'z-50' : ''}`}
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
          border: `${borderWidth} ${borderStyle} ${borderColor}`,
          backgroundColor: `${borderColor}${bgOpacity}`,
          boxShadow: boxShadow,
          transform: isHighlighted ? 'scale(1.02)' : 'scale(1)',
        }}
      >
        {/* Label Chip - làm nổi bật hơn với border và shadow */}
        <span
          className="absolute -top-6 left-0 px-2 py-0.5 text-xs font-bold text-white rounded z-10"
          style={{
            backgroundColor: borderColor,
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          {label || `Object ${index + 1}`}
        </span>
        
        {/* Index Number (only for non-readonly) */}
        {!readOnly && (
          <div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              color: borderColor,
            }}
          >
            {index + 1}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-block max-w-full"
    >
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Annotation target"
        className="block max-w-full"
        style={{
          maxHeight: maxHeight,
          width: 'auto',
          height: 'auto',
        }}
        onLoad={() => {
          if (imageRef.current) {
            const rect = imageRef.current.getBoundingClientRect();
            setImageSize({ width: rect.width, height: rect.height });
          }
        }}
      />
      
      {/* Render bounding boxes from annotations */}
      {annotations.map((ann, idx) => {
        const labelInfo = labelSet.find(l => (l.name || l) === ann.label);
        const color = labelInfo?.color || '#3b82f6';
        return renderBoundingBox(ann.bbox, ann.label, color, idx, false);
      })}

      {/* Render review notes (if any) */}
      {reviewNotes && reviewNotes.map((note, idx) => {
        return renderBoundingBox(note.bbox, note.comment || 'Note', null, idx, true);
      })}
    </div>
  );
};

export default ImageViewer;
