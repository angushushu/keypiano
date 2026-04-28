import React from 'react';
import { Smartphone } from 'lucide-react';

interface LandscapePromptProps {
  title: string;
  message: string;
}

const LandscapePrompt: React.FC<LandscapePromptProps> = ({ title, message }) => {
  return (
    <div
      className="fixed inset-0 z-[100] bg-[#18181b] flex flex-col items-center justify-center p-8 text-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="landscape-prompt-title"
      aria-describedby="landscape-prompt-message"
    >
      <div className="animate-pulse">
        <Smartphone className="w-16 h-16 text-yellow-500 rotate-90 mb-6 mx-auto" aria-hidden="true" />
      </div>
      <h2 id="landscape-prompt-title" className="text-2xl font-bold text-white mb-2">{title}</h2>
      <p id="landscape-prompt-message" className="text-gray-400">
        {message}
      </p>
    </div>
  );
};

export default LandscapePrompt;
