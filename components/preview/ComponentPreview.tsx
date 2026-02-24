// components/preview/ComponentPreview.tsx
import React from 'react';
import { Component } from '@/lib/types';

interface ComponentPreviewProps {
  component: Component;
}

export const ComponentPreview: React.FC<ComponentPreviewProps> = ({ component }) => {
  return (
    <div className="w-full mb-4 relative group" id={`component-${component.id}`}>
      {/* Component Overlay/Actions (visible on hover) */}
      <div className="absolute top-0 left-0 w-full h-full border-2 border-transparent group-hover:border-blue-400 pointer-events-none z-10 transition-colors" />
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-blue-500 text-white text-xs px-2 py-1 rounded z-20 pointer-events-none">
        {component.name} ({component.id})
      </div>
      
      {/* Rendered Content */}
      <div 
        className="w-full"
        dangerouslySetInnerHTML={{ __html: component.html }} 
      />
    </div>
  );
};
