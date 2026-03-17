import React, { useEffect, useRef } from 'react';

const AdBanner: React.FC = () => {
    const adInitialized = useRef(false);

    useEffect(() => {
        // Prevent double injection in React Strict Mode
        if (adInitialized.current) return;

        // The "No slot size for availableWidth=0" error usually happens because the 
        // ad script runs before the element has been fully laid out by the browser.
        // We use a timeout to delay the push call until after the paint.
        const timer = setTimeout(() => {
            try {
                if (typeof window !== 'undefined') {
                    ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
                    adInitialized.current = true;
                }
            } catch (err) {
                console.error('AdSense error:', err);
            }
        }, 500); // 500ms delay to ensure DOM layout is ready

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="w-full bg-[#111] flex justify-center items-center py-2 border-t border-[#333] min-h-[100px] shrink-0 overflow-hidden">
            {/* Replace data-ad-client and data-ad-slot with your actual AdSense values */}
            {/* Recommend using a Responsive Display Ad Unit */}
            <ins className="adsbygoogle"
                 style={{ display: 'block', width: '100%', maxWidth: '728px', height: '90px' }}
                 data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
                 data-ad-slot="1234567890"
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
            
            {/* Visual Placeholder for Development/Preview (Remove in production if desired) */}
            <div className="absolute text-gray-700 text-xs font-mono pointer-events-none">
                Google AdSense Space
            </div>
        </div>
    );
};

export default AdBanner;