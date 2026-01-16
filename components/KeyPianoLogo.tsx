
import React from 'react';

export const KeyPianoLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            {/* Outer Frame */}
            <rect x="2" y="4" width="20" height="16" rx="2" />
            
            {/* Black Keys (Filled) */}
            {/* Left Black Key */}
            <path d="M6 4v8h4V4" fill="currentColor" stroke="none" />
            {/* Right Black Key */}
            <path d="M14 4v8h4V4" fill="currentColor" stroke="none" />
            
            {/* White Key Separators (Bottom half only) */}
            <path d="M8 12v8" />
            <path d="M16 12v8" />
        </svg>
    );
};
