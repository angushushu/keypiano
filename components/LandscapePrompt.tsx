import React from 'react';
import { Smartphone } from 'lucide-react';

interface LandscapePromptProps {
  title: string;
  message: string;
}

const LandscapePrompt: React.FC<LandscapePromptProps> = ({ title, message }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-[#18181b] flex flex-col items-center justify-center p-8 text-center">
      <div className="animate-pulse">
        <Smartphone className="w-16 h-16 text-yellow-500 rotate-90 mb-6 mx-auto" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      <p className="text-gray-400">
        {message}
      </p>
    </div>
  );
};

export default LandscapePrompt;